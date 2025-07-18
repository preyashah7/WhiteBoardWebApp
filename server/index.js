import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/board.js";
import http from "http";
import { Server } from "socket.io";
import ChatMessage from "./models/ChatMessage.js";
import aiRoutes from "./routes/ai.js";


const boardLocks = {}; // ✅ fix for ReferenceError
const activeCursors = {}; 

dotenv.config();
const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
  cors: {
    origin: "*", // You can restrict this to your frontend URL
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/ai", aiRoutes);



io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("lock-object", ({ boardId, shapeIndex }) => {
    if (!boardLocks[boardId]) boardLocks[boardId] = {};

    // Prevent overwrite
    if (boardLocks[boardId][shapeIndex]) return;

    boardLocks[boardId][shapeIndex] = socket.id;

    io.to(boardId).emit("remote-lock-update", {
      shapeIndex,
      lockedBy: socket.id,
    });
  });

  socket.on("unlock-object", ({ boardId, shapeIndex }) => {
    if (boardLocks[boardId] && boardLocks[boardId][shapeIndex] === socket.id) {
      delete boardLocks[boardId][shapeIndex];
      io.to(boardId).emit("remote-lock-update", {
        shapeIndex,
        lockedBy: null,
      });
    }
  });

  socket.on("join-board", (boardId) => {
    socket.join(boardId);
    console.log(`User ${socket.id} joined board ${boardId}`);

    // Send existing cursors to the new user
    if (activeCursors[boardId]) {
      socket.emit("cursors-update", activeCursors[boardId]);
    }
  });


  socket.on("shape-update", ({ boardId, shapes }) => {
    console.log("Received shape update from client:", shapes);
    socket.to(boardId).emit("remote-shape-update", shapes);
  });

  socket.on("line-update", ({ boardId, lines }) => {
    console.log("Received line update from client:", lines);
    socket.to(boardId).emit("remote-line-update", lines);
  });

  // ✅ Live cursor broadcasting
  socket.on("cursor-move", ({ boardId, x, y, name }) => {
    if (!activeCursors[boardId]) {
      activeCursors[boardId] = {};
    }

    activeCursors[boardId][socket.id] = {
      x,
      y,
      name,
    };

    io.to(boardId).emit("cursors-update", activeCursors[boardId]);
  });


  socket.on("cursor-left", ({ boardId, userId }) => {
    socket.to(boardId).emit("remove-cursor", userId);
  });

  socket.on("chat-message", async ({ boardId, user, message }) => {
    try {
      const saved = await ChatMessage.create({
        boardId,
        user,
        message,
      });

      io.to(boardId).emit("chat-message", {
        user: saved.user,
        message: saved.message,
        timestamp: saved.timestamp,
      });
    } catch (err) {
      console.error("Failed to save chat message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove locks held by user
    for (const boardId in boardLocks) {
      for (const shapeIndex in boardLocks[boardId]) {
        if (boardLocks[boardId][shapeIndex] === socket.id) {
          delete boardLocks[boardId][shapeIndex];
          io.to(boardId).emit("remote-lock-update", {
            shapeIndex: parseInt(shapeIndex),
            lockedBy: null,
          });
        }
      }
    }

    // Remove user's cursor
    for (const boardId in activeCursors) {
      if (activeCursors[boardId][socket.id]) {
        delete activeCursors[boardId][socket.id];
        io.to(boardId).emit("cursors-update", activeCursors[boardId]);
      }
    }
  });


});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    server.listen(5000, () => console.log("Server running on port 5000")); // Use `server.listen`
  })
  .catch((err) => console.error(err));
