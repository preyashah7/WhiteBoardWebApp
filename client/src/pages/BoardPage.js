import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Stage, Layer, Rect, Line, Transformer, Text, Circle , Ellipse , Arrow} from "react-konva";
import { Box, Button, Container, FormControlLabel, Switch } from "@mui/material";
import axios from "axios";
import io from "socket.io-client";
import { ChromePicker } from "react-color";
import { Typography , TextField , Select , MenuItem  } from "@mui/material";



const socket = io("http://localhost:5000");
const GRID_SIZE = 20;

const BoardPage = () => {
  const { id } = useParams();
  const [tool, setTool] = useState("select");
  const [shapes, setShapes] = useState([]);
  const [lines, setLines] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [editLockEnabled, setEditLockEnabled] = useState(true);
  const [shapeLocks, setShapeLocks] = useState({});
  const [cursors, setCursors] = useState({});
  const [role, setRole] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [currentColorTarget, setCurrentColorTarget] = useState(null); // index or line
  const [colorType, setColorType] = useState("fill"); // "fill" or "stroke"
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [drawingArrow, setDrawingArrow] = useState(null); // { from: {x, y}, to: {x, y} }
  const [collaborators, setCollaborators] = useState([]);
  const [newCollaborator, setNewCollaborator] = useState("");
  const [newPermission, setNewPermission] = useState("viewer");
  const [isOwner, setIsOwner] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedShapeIds, setSelectedShapeIds] = useState([]);
  const [copiedShapes, setCopiedShapes] = useState([]);


  const isDrawing = useRef(false);
  const stageRef = useRef();
  const transformerRef = useRef();
  const shapeRefs = useRef({});
  const fetchBoardData = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/boards/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const board = res.data;
      if (board?.data) {
        setShapes(board.data.shapes || []);
        setLines(board.data.lines || []);
      }

      const currentUser = JSON.parse(localStorage.getItem("user"));
      const currentUserId = currentUser?._id;

      const currentCollaborator = Array.isArray(board.collaborators)
        ? board.collaborators.find(
            (c) =>
              c.user &&
              (c.user._id?.toString?.() === currentUserId ||
              c.user === currentUserId) // fallback for unpopulated
          )
        : null;

        const userRole =
          board.owner === currentUserId ||
          board.owner?._id === currentUserId
            ? "editor"
            : currentCollaborator?.permission || "viewer";


      setRole(userRole);

      if (userRole !== "editor") {
        setSelectedId(null);
        setSelectedLineId(null);
      }
    } catch (err) {
      console.error("Failed to load board:", err);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    const lastState = undoStack[undoStack.length - 1];

    // Filter only the user's shapes and lines
    const userShapes = shapes.filter((s) => s.createdBy === userId);
    const userLines = lines.filter((l) => l.createdBy === userId);

    const prevUserShapes = lastState.shapes.filter((s) => s.createdBy === userId);
    const prevUserLines = lastState.lines.filter((l) => l.createdBy === userId);

    // Replace only the user's shapes/lines
    const newShapes = [
      ...shapes.filter((s) => s.createdBy !== userId),
      ...prevUserShapes,
    ];
    const newLines = [
      ...lines.filter((l) => l.createdBy !== userId),
      ...prevUserLines,
    ];

    setRedoStack((prev) => [
      ...prev,
      { shapes: userShapes, lines: userLines },
    ]);
    setShapes(newShapes);
    setLines(newLines);
    setUndoStack((prev) => prev.slice(0, -1));

    socket.emit("shape-update", { boardId: id, shapes: newShapes });
    socket.emit("line-update", { boardId: id, lines: newLines });
  };

const handleAiPrompt = async () => {
  try {
    const res = await axios.post("/api/ai", { prompt: aiPrompt });
    const { action, shapes: aiShapes = [] } = res.data;

    if (action === "add_shapes" && Array.isArray(aiShapes)) {
      const newShapes = [];

      aiShapes.forEach((s) => {
        const baseShape = {
          id: `ai-${Date.now()}-${Math.random()}`,
          type: s.shape || "rect",
          x: s.x || 100,
          y: s.y || 100,
          width: s.width,
          height: s.height,
          radius: s.radius,
          radiusX: s.radiusX,
          radiusY: s.radiusY,
          text: s.text,
          fontSize: s.fontSize,
          fill: s.fill || s.color || "#ccc",
          lockedBy: null,
        };

        newShapes.push(baseShape);

        // ✅ If label is present, add a separate text shape
        if (s.label) {
          newShapes.push({
            id: `ai-label-${Date.now()}-${Math.random()}`,
            type: "text",
            x: (s.x || 100) + 10,
            y: (s.y || 100) + 10,
            text: s.label,
            fontSize: 16,
            fill: "#000",
            lockedBy: null,
          });
        }
      });

      setShapes((prev) => {
        const updated = [...prev, ...newShapes];
        socket.emit("shape-update", { boardId: id, shapes: updated });
        return updated;
      });
    } else {
      alert("⚠️ AI response format was incorrect or empty.");
    }

    setAiPrompt("");
  } catch (err) {
    console.error("AI prompt failed:", err);
    alert("AI assistant failed or returned invalid data.");
  }
};


  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    const nextState = redoStack[redoStack.length - 1];

    const userShapes = shapes.filter((s) => s.createdBy === userId);
    const userLines = lines.filter((l) => l.createdBy === userId);

    const nextUserShapes = nextState.shapes;
    const nextUserLines = nextState.lines;

    const newShapes = [
      ...shapes.filter((s) => s.createdBy !== userId),
      ...nextUserShapes,
    ];
    const newLines = [
      ...lines.filter((l) => l.createdBy !== userId),
      ...nextUserLines,
    ];

    setUndoStack((prev) => [...prev, { shapes: userShapes, lines: userLines }]);
    setShapes(newShapes);
    setLines(newLines);
    setRedoStack((prev) => prev.slice(0, -1));

    socket.emit("shape-update", { boardId: id, shapes: newShapes });
    socket.emit("line-update", { boardId: id, lines: newLines });
  };

  useEffect(() => {
    fetchBoardData();
    socket.emit("join-board", id);

    socket.on("remote-shape-update", (updatedShapes) => {
      setShapes(() => [...updatedShapes]);
    });

    socket.on("remote-line-update", (updatedLines) => {
      setLines(() => [...updatedLines]);
    });

    socket.on("cursors-update", (cursorMap) => {
      const updatedCursors = { ...cursorMap };
      delete updatedCursors[socket.id]; // Optional: hide your own cursor
      setCursors(updatedCursors);
    });

    socket.on("chat-message", (data) => {
      setChatMessages((prev) => [...prev, data]);
    });


    socket.on("remote-lock-update", ({ shapeIndex, lockedBy }) => {
      setShapeLocks((prev) => ({
        ...prev,
        [shapeIndex]: lockedBy,
      }));
    });

    return () => {
      socket.off("remote-shape-update");
      socket.off("remote-line-update");
      socket.off("cursors-update");
      socket.off("remote-lock-update");
      socket.off("chat-message");
    };
  }, []);

  useEffect(() => {
    if (role !== "editor") {
      setSelectedId(null);
      setSelectedLineId(null);
    }
  }, [role]);

    useEffect(() => {
      if (
        transformerRef.current &&
        selectedId !== null &&
        shapeRefs.current[selectedId] &&
        (!shapeLocks[selectedId] || shapeLocks[selectedId] === socket.id)
      ) {
        transformerRef.current.nodes([shapeRefs.current[selectedId]]);
        transformerRef.current.getLayer().batchDraw();
      } else if (transformerRef.current) {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer().batchDraw();
      }
    }, [selectedId, shapes, shapeLocks]);

    useEffect(() => {
    const handleKeyDown = (e) => {
      if (role !== "editor") return;

      if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedId !== null) {
        const updatedShapes = [...shapes];
        updatedShapes.splice(selectedId, 1);
        setShapes(updatedShapes);
        saveHistory();
        socket.emit("shape-update", { boardId: id, shapes: updatedShapes });

        setSelectedId(null);

        // 🔧 Reset related state
        setToolbarVisible(false);
        setCurrentColorTarget(null);
        setColorPickerVisible(false);
      }

      if (selectedLineId !== null) {
        const updatedLines = [...lines];
        updatedLines.splice(selectedLineId, 1);
        setLines(updatedLines);
        saveHistory();
        socket.emit("line-update", { boardId: id, lines: updatedLines });

        setSelectedLineId(null);

        // 🔧 Also hide tools when line is deleted
        setToolbarVisible(false);
        setCurrentColorTarget(null);
        setColorPickerVisible(false);
      }
    }

    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, selectedLineId, shapes, lines, role]);


  const token = localStorage.getItem("token");
  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const res = await axios.get(`/api/boards/${id}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setChatMessages(res.data);
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };

    fetchChatHistory();

    // existing socket.on("chat-message") or other listeners here
  }, [id]);

  useEffect(() => {
    const fetchCollaborators = async () => {
      try {
        const res = await axios.get(`/api/boards/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCollaborators(res.data.collaborators || []);
      } catch (err) {
        console.error("Failed to fetch collaborators", err);
      }
    };
    fetchCollaborators();
  }, [id]);



  const handlePermissionChange = async (username, newPermission) => {
    try {
      const res = await axios.put(
        `/api/boards/${id}/collaborators`,
        { username, permission: newPermission },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCollaborators(res.data.collaborators || res.data.board?.collaborators || []);
    } catch (err) {
      console.error("Permission update failed", err);
    }
  };

  const handleRemoveCollaborator = async (username) => {
    try {
      const res = await axios.delete(
        `http://localhost:5000/api/boards/${id}/collaborators`,
        {
          data: { username }, // ✅ username matches backend
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // ✅ update UI with backend's confirmed result
      setCollaborators(res.data.collaborators || []);
    } catch (err) {
      console.error("Failed to remove collaborator", err);
      alert(err.response?.data?.msg || "Remove failed");
    }
  };

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const res = await axios.get(`/api/boards/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const currentUserId = JSON.parse(localStorage.getItem("user"))._id;

        setIsOwner(res.data.owner._id === currentUserId);
        setCollaborators(res.data.collaborators || []);
      } catch (err) {
        console.error("Failed to fetch board", err);
      }
    };

    fetchBoard();
  }, [id]);

  const handleAddCollaborator = async () => {
    try {
      const res = await axios.post(
        `/api/boards/${id}/collaborators`,
        {
          username: newCollaborator,
          permission: newPermission,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCollaborators(res.data.collaborators || res.data.board?.collaborators || []);
      setNewCollaborator("");
    } catch (err) {
      console.error("Add collaborator failed", err);
    }
  };


  
  const handleMouseDown = (e) => {
  if (e.evt.button === 1) return; // ignore middle click
  if (role !== "editor") return;

  const stage = stageRef.current;
  const clickedOnEmpty = e.target === stage;

  if (clickedOnEmpty) {
    if (editLockEnabled && selectedId !== null) {
      socket.emit("unlock-object", { boardId: id, shapeIndex: selectedId });
    }
    setSelectedId(null);
    setSelectedLineId(null);
    setToolbarVisible(false); 
  }

  const pointer = stage.getPointerPosition();
  const transformed = {
    x: (pointer.x - stage.x()) / stage.scaleX(),
    y: (pointer.y - stage.y()) / stage.scaleY(),
  };

  // 🧹 ERASER TOOL LOGIC
  if (tool === "erase") {
    const clickedShapeIndex = shapes.findIndex((_, i) => {
      const shapeNode = shapeRefs.current[i];
      if (!shapeNode || typeof shapeNode.getClientRect !== "function") return false;

      const shapeRect = shapeNode.getClientRect();
      return (
        transformed.x >= shapeRect.x &&
        transformed.x <= shapeRect.x + shapeRect.width &&
        transformed.y >= shapeRect.y &&
        transformed.y <= shapeRect.y + shapeRect.height
      );
    });


    if (clickedShapeIndex !== -1) {
      const updatedShapes = shapes.filter((_, idx) => idx !== clickedShapeIndex);
      saveHistory();
      setShapes(updatedShapes);
      setToolbarVisible(false);
      setSelectedId(null);
      socket.emit("shape-update", { boardId: id, shapes: updatedShapes });
      return;
    }

    const clickedLineIndex = lines.findIndex((line) =>
      line.points.some((_, i) =>
        Math.abs(line.points[i] - transformed.x) < 10 &&
        Math.abs(line.points[i + 1] - transformed.y) < 10
      )
    );

    if (clickedLineIndex !== -1) {
      const updatedLines = lines.filter((_, idx) => idx !== clickedLineIndex);
      saveHistory();
      setLines(updatedLines);
      setSelectedLineId(null);
      socket.emit("line-update", { boardId: id, lines: updatedLines });
      return;
    }
  }

  // 🏹 ARROW TOOL START
    if (tool === "arrow") {
      setDrawingArrow({ from: pointer, to: pointer });
      return;
    }

    // ✏️ DRAW TOOL START
    if (tool === "draw") {
      const isInsideLockedShape = shapes.some((shape, i) => {
        const lockedBy = shapeLocks[i];
        if (!lockedBy || lockedBy === socket.id) return false;

        // Same logic for rect, circle, etc...
        if (shape.type === "rect") {
          return (
            transformed.x >= shape.x &&
            transformed.x <= shape.x + shape.width &&
            transformed.y >= shape.y &&
            transformed.y <= shape.y + shape.height
          );
        }

        if (shape.type === "circle") {
          const dx = transformed.x - shape.x;
          const dy = transformed.y - shape.y;
          return dx * dx + dy * dy <= shape.radius * shape.radius;
        }

        if (shape.type === "text") {
          return (
            transformed.x >= shape.x &&
            transformed.x <= shape.x + (shape.width || 200) &&
            transformed.y >= shape.y &&
            transformed.y <= shape.y + (shape.height || 30)
          );
        }

        if (shape.type === "ellipse") {
          const dx = transformed.x - shape.x;
          const dy = transformed.y - shape.y;
          const rx = shape.radiusX || shape.width / 2;
          const ry = shape.radiusY || shape.height / 2;
          return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
        }

        return false;
      });

      if (isInsideLockedShape) {
        console.log("❌ Drawing blocked: inside locked shape");
        return;
      }

      isDrawing.current = true;
      saveHistory();
      const userId = JSON.parse(localStorage.getItem("user"))?._id;
      const newLine = { points: [transformed.x, transformed.y], createdBy: userId };
      setLines((prevLines) => [...prevLines, newLine]);
    }
  };

  const handleMouseMove = (e) => {
    if (!stageRef.current || role !== "editor") return;

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const transformed = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };

    socket.emit("cursor-move", {
      boardId: id,
      x: transformed.x,
      y: transformed.y,
      name: JSON.parse(localStorage.getItem("user"))?.name || "Anonymous",
    });

    if (!isDrawing.current || tool !== "draw") return;

    const isInsideLockedShape = shapes.some((shape, i) => {
      const lockedBy = shapeLocks[i];
      if (!lockedBy || lockedBy === socket.id) return false;

      if (shape.type === "rect") {
        return (
          transformed.x >= shape.x &&
          transformed.x <= shape.x + shape.width &&
          transformed.y >= shape.y &&
          transformed.y <= shape.y + shape.height
        );
      }


      if (drawingArrow) {
        const pos = stageRef.current.getPointerPosition();
        setDrawingArrow((prev) => ({ ...prev, to: pos }));
      }

      if (shape.type === "circle") {
        const dx = transformed.x - shape.x;
        const dy = transformed.y - shape.y;
        return dx * dx + dy * dy <= shape.radius * shape.radius;
      }

      if (shape.type === "text") {
        return (
          transformed.x >= shape.x &&
          transformed.x <= shape.x + (shape.width || 200) &&
          transformed.y >= shape.y &&
          transformed.y <= shape.y + (shape.height || 30)
        );
      }

      if (shape.type === "ellipse") {
        const dx = transformed.x - shape.x;
        const dy = transformed.y - shape.y;
        const rx = shape.radiusX || shape.width / 2;
        const ry = shape.radiusY || shape.height / 2;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      }
      if (tool === "arrow" && drawingArrow) {
        const pos = stage.getPointerPosition();
        setDrawingArrow((prev) => ({ ...prev, to: pos }));
      }
      return false;
    });

    if (isInsideLockedShape) {
      console.log("Skipping draw point: moved into locked shape");
      return;
    }

    setLines((prev) => {
      const updated = [...prev];
      const lastLine = updated[updated.length - 1];
      if (!lastLine) return updated;

      const newPoints = [...lastLine.points, transformed.x, transformed.y];
      updated[updated.length - 1] = { ...lastLine, points: newPoints };
      return updated;
    });
  };

  useEffect(() => {
    const handleLeave = () => {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user?._id) {
        socket.emit("cursor-left", {
          boardId: id,
          userId: user._id,
        });
      }
    };

    window.addEventListener("beforeunload", handleLeave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleLeave();
    });

    return () => {
      window.removeEventListener("beforeunload", handleLeave);
      document.removeEventListener("visibilitychange", handleLeave);
    };
  }, []);


  const handleMouseUp = () => {
    if (role !== "editor") return;

    // 👉 Finalize free drawing
    if (isDrawing.current) {
      isDrawing.current = false;
      socket.emit("line-update", { boardId: id, lines });
    }

    // 👉 Finalize arrow
    if (drawingArrow) {
      saveHistory();
      const userId = JSON.parse(localStorage.getItem("user"))?._id;

      const newArrow = {
        type: "arrow",
        from: drawingArrow.from,
        to: drawingArrow.to,
        stroke: "#000",
        strokeWidth: 2,
        pointerLength: 10,
        pointerWidth: 10,
        fill: "#000",
        createdBy: userId,
      };

      const newShapes = [...shapes, newArrow];
      setShapes(newShapes);
      socket.emit("shape-update", { boardId: id, shapes: newShapes });

      setDrawingArrow(null); // clear draft arrow
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleDragMove = (e) => {
    if (e.evt.buttons === 4) {
      const newPos = e.target.position();
      setStagePos(newPos);
    }
  };

  // useEffect(() => {
  //   const handleClickOutside = (e) => {
  //     if (!e.target.closest(".color-picker-popup")) {
  //       setColorPickerVisible(false);
  //     }
  //   };
  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => document.removeEventListener("mousedown", handleClickOutside);
  // }, []);

  useEffect(() => {
  if (
    selectedId !== null &&
    shapeRefs.current[selectedId] &&
    stageRef.current &&
    toolbarVisible
  ) {
    const shapeNode = shapeRefs.current[selectedId];
    const absPos = shapeNode.getAbsolutePosition();
    const stageBox = stageRef.current.container().getBoundingClientRect();

    setToolbarPosition({
      x: absPos.x + stageBox.left,
      y: absPos.y + stageBox.top,
    });
  }
}, [shapes, selectedId, toolbarVisible]);

  const sendMessage = () => {
    const user = JSON.parse(localStorage.getItem("user"))?.name;
    if (!newMessage.trim() || !user) return;

    socket.emit("chat-message", {
      boardId: id,
      user,
      message: newMessage.trim(),
    });

    setNewMessage("");
  };

  const addRectangle = () => {
    if (role !== "editor") return;
    saveHistory();
    const snappedX = Math.round(100 / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(100 / GRID_SIZE) * GRID_SIZE;
    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    setShapes((prev) => [
      ...prev,
      {
        type: "rect",
        x: snappedX,
        y: snappedY,
        width: 120,
        height: 60,
        fill: "transparent", // ✅ transparent fill
        stroke: "#000",       // ✅ visible border
        strokeWidth: 2,       // ✅ border thickness
        createdBy: userId,
      },
    ]);
  };

 const addCircle = () => {
    if (role !== "editor") return;
    saveHistory();
    const snappedX = Math.round(150 / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(150 / GRID_SIZE) * GRID_SIZE;
    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    setShapes((prev) => [
      ...prev,
      {
        type: "circle",
        x: snappedX,
        y: snappedY,
        radius: 40,
        fill: "transparent", 
        stroke: "#000",      
        strokeWidth: 2,       
        createdBy: userId,
      },
    ]);
  };


  const addEllipse = () => {
    if (role !== "editor") return;
    saveHistory();
    const snappedX = Math.round(300 / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(300 / GRID_SIZE) * GRID_SIZE;
    const userId = JSON.parse(localStorage.getItem("user"))?._id;

    setShapes((prev) => [
      ...prev,
      {
        type: "ellipse",
        x: snappedX,
        y: snappedY,
        radiusX: 60,
        radiusY: 40,
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 2,
        createdBy: userId,
      },
    ]);
  };

 const addArrow = () => {
    if (role !== "editor") return;
    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    const from = { x: 300, y: 300 };
    const to = { x: 400, y: 400 };

    const newArrow = {
      type: "arrow",
      from,
      to,
      stroke: "#000",
      strokeWidth: 2,
      pointerLength: 10,
      pointerWidth: 10,
      createdBy: userId,
    };

    const updatedShapes = [...shapes, newArrow];
    setShapes(updatedShapes);
    saveHistory(); // ✅ Add after updating shapes
    socket.emit("shape-update", { boardId: id, shapes: updatedShapes });
  };


  const addText = () => {
    if (role !== "editor") return;
    saveHistory();
    const snappedX = Math.round(200 / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(200 / GRID_SIZE) * GRID_SIZE;
    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    setShapes((prev) => [
      ...prev,
      {
        type: "text",
        x: snappedX,
        y: snappedY,
        text: "Double-click to edit",
        fontSize: 18,
        width: 200,
        height: 30,
        fill: "black",
        createdBy: userId,
      },
    ]);
  };

  const addStickyNote = () => {
    if (role !== "editor") return;
    saveHistory();
    const userId = JSON.parse(localStorage.getItem("user"))?._id;
    const snappedX = Math.round(250 / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(250 / GRID_SIZE) * GRID_SIZE;

    setShapes((prev) => [
      ...prev,
      {
        type: "sticky",
        x: snappedX,
        y: snappedY,
        width: 200,
        height: 150,
        text: "New Sticky Note",
        fontSize: 16,
        fill: "#FFF176", // light yellow
        createdBy: userId,
      },
    ]);
  };

  const saveBoard = async () => {
    if (role !== "editor") return;
    try {
      await axios.put(
        `http://localhost:5000/api/boards/${id}`,
        { data: { shapes, lines } },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert("Board saved!");
    } catch (err) {
      alert("Failed to save");
      console.error(err);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      stageRef.current?.batchDraw();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

const drawGrid = (stageWidth, stageHeight, gridSize) => {
  const lines = [];

  const visibleWidth = stageWidth / stageScale;
  const visibleHeight = stageHeight / stageScale;
  const startX = -stagePos.x / stageScale;
  const startY = -stagePos.y / stageScale;

  const endX = startX + visibleWidth;
  const endY = startY + visibleHeight;

  for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, startY, x, endY]}
        stroke="#eee"
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
    );
  }

  for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[startX, y, endX, y]}
        stroke="#eee"
        strokeWidth={1}
        perfectDrawEnabled={false}
      />
    );
  }

  return lines;
};


  const saveHistory = () => {
    setUndoStack((prev) => [...prev, { shapes: [...shapes], lines: [...lines] }]);
    setRedoStack([]); // Clear redo stack on new change
  };
  return (
    <Container>
      <Box my={2}>
        <FormControlLabel
          control={
            <Switch
              checked={editLockEnabled}
              onChange={() => setEditLockEnabled((prev) => !prev)}
              color="primary"
              disabled={role !== "editor"}
            />
          }
          label="Enable Edit Lock"
        />

        <Button
          onClick={() => setTool("select")}
          variant={tool === "select" ? "contained" : "outlined"}
        >
          Select
        </Button>

        <Button
          onClick={() => setTool("draw")}
          variant={tool === "draw" ? "contained" : "outlined"}
          sx={{ ml: 1 }}
          disabled={role !== "editor"}
        >
          Free Draw
        </Button>
        <Button
          onClick={() => setTool("erase")}
          variant={tool === "erase" ? "contained" : "outlined"}
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Eraser
        </Button>
        <Button
          onClick={addRectangle}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Add Rectangle
        </Button>

        <Button
          onClick={addCircle}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Add Circle
        </Button>

        <Button
          onClick={addEllipse}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Add Ellipse         
        </Button>

        <Button onClick={addArrow} variant="outlined" disabled={role !== "editor"} sx={{ ml: 2 }}>
          Add Arrow
        </Button>


        <Button
          onClick={addText}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Add Text
        </Button>

          <Button
            onClick={addStickyNote}
            variant="outlined"
            sx={{ ml: 2 }}
            disabled={role !== "editor"}
          >
            Add Sticky Note
          </Button>

        <Button
          onClick={handleUndo}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={undoStack.length === 0 || role !== "editor"}
        >
          Undo
        </Button>

        <Button
          onClick={handleRedo}
          variant="outlined"
          sx={{ ml: 2 }}
          disabled={redoStack.length === 0 || role !== "editor"}
        >
          Redo
        </Button>

        <Button
          variant="contained"
          color="success"
          onClick={saveBoard}
          sx={{ ml: 2 }}
          disabled={role !== "editor"}
        >
          Save Board
        </Button>


        <Box mt={4} display="flex" alignItems="center" gap={2}>
          <TextField
            size="small"
            label="Ask AI to draw something"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAiPrompt}
            disabled={!aiPrompt}
          >
            Run AI
          </Button>
        </Box>

      </Box>
        {isOwner && (
          <Box
            mb={2}
            p={2}
            border="1px solid #ccc"
            borderRadius="8px"
            bgcolor="#f9f9f9"
          >
            <Typography variant="h6" gutterBottom>
              👥 Collaborators
            </Typography>

            {Array.isArray(collaborators) && collaborators.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                No collaborators yet.
              </Typography>
            )}

            {collaborators.map((c, index) => (
              <Box
                key={c.user?._id || `${c.user.name}-${index}`}
                display="flex"
                alignItems="center"
                gap={2}
                mb={1}
              >
                <Typography>{c.user.name}</Typography>
                <Select
                  size="small"
                  value={c.permission}
                  onChange={(e) =>
                    handlePermissionChange(c.user.name, e.target.value)
                  }
                >
                  <MenuItem value="editor">Editor</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </Select>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleRemoveCollaborator(c.user.name)}
                >
                  Remove
                </Button>
              </Box>
            ))}

            <Box mt={2} display="flex" gap={2} alignItems="center">
              <TextField
                size="small"
                label="Username"
                value={newCollaborator}
                onChange={(e) => setNewCollaborator(e.target.value)}
              />
              <Select
                size="small"
                value={newPermission}
                onChange={(e) => setNewPermission(e.target.value)}
              >
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
              <Button
                size="small"
                variant="contained"
                onClick={handleAddCollaborator}
                disabled={!newCollaborator}
              >
                Add
              </Button>
            </Box>
          </Box>
        )}

      <Stage
        width={window.innerWidth * 0.95}
        height={window.innerHeight * 0.8}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        draggable={role === "editor" && tool === "select" && !isDrawing.current}
        onDragMove={handleDragMove}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
        style={{
          border: "1px solid #ccc",
          background: "#fff",
          cursor: tool === "draw" ? "crosshair" : "default",
          overflow: "hidden", // optional
        }}
      >
        <Layer>
        {drawGrid(
          stageRef.current?.width() || window.innerWidth * 0.95,
          stageRef.current?.height() || window.innerHeight * 0.8,
          GRID_SIZE
        )}  
      </Layer>

        <Layer>
          {shapes.map((shape, i) => (
            <React.Fragment key={i}>
              {shape.type === "rect" && (
                <>
                  <Rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill || "transparent"} // ✅ dynamic fill
                    stroke={selectedId === i ? "blue" : shape.stroke || "#000"} // ✅ dynamic stroke
                    strokeWidth={shape.strokeWidth || 2} // ✅ dynamic strokeWidth
                    draggable={
                      tool === "select" &&
                      role === "editor" &&
                      (!shapeLocks[i] || shapeLocks[i] === socket.id)
                    }
                    ref={(node) => (shapeRefs.current[i] = node)}
                    onClick={(e) => {
                      if (role === "editor") {
                        if (editLockEnabled) {
                          socket.emit("lock-object", { boardId: id, shapeIndex: i });
                        }
                        setSelectedId(i);

                        const absPos = e.target.getAbsolutePosition();
                        const stageBox = stageRef.current.container().getBoundingClientRect();
                        setToolbarVisible(true);
                        setToolbarPosition({
                          x: absPos.x + stageBox.left,
                          y: absPos.y + stageBox.top,
                        });
                        setCurrentColorTarget({ type: shape.type, index: i });

                      }
                    }}

                    onDragEnd={(e) => {
                      if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                      saveHistory(); 
                      const snappedX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                      const snappedY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                      const newShapes = [...shapes];
                      newShapes[i] = {
                        ...shapes[i],
                        x: snappedX,
                        y: snappedY,
                        createdBy: shapes[i].createdBy,
                      };
                      setShapes(newShapes);
                      socket.emit("shape-update", { boardId: id, shapes: newShapes });
                    }}
                    onTransformEnd={(e) => {
                      if (role !== "editor") return;
                      if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                      saveHistory();
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      const newShapes = [...shapes];
                      newShapes[i] = {
                        ...shapes[i],
                        x: node.x(),
                        y: node.y(),
                        width: node.width() * scaleX,
                        height: node.height() * scaleY,
                        createdBy: shapes[i].createdBy,
                      };
                      node.scaleX(1);
                      node.scaleY(1);
                      setShapes(newShapes);
                      socket.emit("shape-update", { boardId: id, shapes: newShapes });
                    }}
                  />
                </>
              )}

              {shape.type === "circle" && (
                <>
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    fill={shape.fill || "transparent"}
                    stroke={selectedId === i ? "blue" : shape.stroke || "#000"}
                    strokeWidth={shape.strokeWidth || 2}
                    draggable={
                      tool === "select" &&
                      role === "editor" &&
                      (!shapeLocks[i] || shapeLocks[i] === socket.id)
                    }
                    ref={(node) => (shapeRefs.current[i] = node)}
                    onClick={(e) => {
                      if (role === "editor") {
                        if (editLockEnabled) {
                          socket.emit("lock-object", { boardId: id, shapeIndex: i });
                        }
                        setSelectedId(i);

                        const absPos = e.target.getAbsolutePosition();
                        const stageBox = stageRef.current.container().getBoundingClientRect();
                        setToolbarVisible(true);
                        setToolbarPosition({
                          x: absPos.x + stageBox.left,
                          y: absPos.y + stageBox.top,
                        });
                        setCurrentColorTarget({ type: shape.type, index: i });
                      }
                    }}

                    onDragEnd={(e) => {
                      if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                      saveHistory(); 
                      const snappedX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                      const snappedY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                      const newShapes = [...shapes];
                      newShapes[i] = {
                        ...shapes[i],
                        x: snappedX,
                        y: snappedY,
                        createdBy: shapes[i].createdBy,
                      };
                      setShapes(newShapes);
                      socket.emit("shape-update", { boardId: id, shapes: newShapes });
                    }}
                    onTransformEnd={(e) => {
                      if (role !== "editor") return;
                      if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                      saveHistory();
                      const node = e.target;
                      const scale = node.scaleX();
                      const newShapes = [...shapes];
                      newShapes[i] = {
                        ...shapes[i],
                        x: node.x(),
                        y: node.y(),
                        radius: shape.radius * scale,
                        createdBy: shapes[i].createdBy,
                      };
                      node.scaleX(1);
                      node.scaleY(1);
                      setShapes(newShapes);
                      socket.emit("shape-update", { boardId: id, shapes: newShapes });
                    }}
                  />

                </>
              )}
              {shape.type === "text" && (
                <Text
                  {...shape}
                  draggable={
                    tool === "select" &&
                    role === "editor" &&
                    (!shapeLocks[i] || shapeLocks[i] === socket.id)
                  }
                  ref={(node) => (shapeRefs.current[i] = node)}
                  onClick={(e) => {
                    if (role === "editor") {
                      if (editLockEnabled) {
                        socket.emit("lock-object", { boardId: id, shapeIndex: i });
                      }
                      setSelectedId(i);

                      const absPos = e.target.getAbsolutePosition();
                      const stageBox = stageRef.current.container().getBoundingClientRect();
                      setToolbarVisible(true);
                      setToolbarPosition({
                        x: absPos.x + stageBox.left,
                        y: absPos.y + stageBox.top,
                      });
                      setCurrentColorTarget({ type: shape.type, index: i });

                    }
                  }}

                  onDblClick={(e) => {
                    const absPos = e.target.getAbsolutePosition();
                    const stageBox = stageRef.current.container().getBoundingClientRect();
                    const textarea = document.createElement("textarea");
                    document.body.appendChild(textarea);

                    textarea.value = shape.text;
                    textarea.style.position = "absolute";
                    textarea.style.top = `${absPos.y + stageBox.top}px`;
                    textarea.style.left = `${absPos.x + stageBox.left}px`;
                    textarea.style.width = `${shape.width || 200}px`;
                    textarea.style.fontSize = `${shape.fontSize || 18}px`;
                    textarea.style.border = "1px solid gray";
                    textarea.style.padding = "2px";
                    textarea.style.resize = "none";
                    textarea.focus();

                    textarea.addEventListener("keydown", (ev) => {
                      if (ev.key === "Enter") {
                        const updated = [...shapes];
                        updated[i] = {
                          ...updated[i],
                          text: textarea.value,
                          createdBy: updated[i].createdBy, // ✅
                        };
                        setShapes(updated);
                        socket.emit("shape-update", { boardId: id, shapes: updated });
                        document.body.removeChild(textarea);
                      }
                    });
                  }}
                  onDragEnd={(e) => {
                    if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                    saveHistory();
                    const snappedX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                    const snappedY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                    const newShapes = [...shapes];
                    newShapes[i] = {
                      ...shapes[i],
                      x: snappedX,
                      y : snappedY,
                      createdBy: shapes[i].createdBy, // ✅ preserve author
                    };

                    setShapes(newShapes);
                    socket.emit("shape-update", { boardId: id, shapes: newShapes });
                  }}
                  stroke={selectedId === i ? "blue" : null}
                />
              )}

              {shape.type === "ellipse" && (
                <Ellipse
                  x={shape.x}
                  y={shape.y}
                  radiusX={shape.radiusX}
                  radiusY={shape.radiusY}
                  fill={shape.fill || "transparent"}
                  stroke={selectedId === i ? "blue" : shape.stroke || "#000"}
                  strokeWidth={shape.strokeWidth || 2}
                  draggable={
                    tool === "select" &&
                    role === "editor" &&
                    (!shapeLocks[i] || shapeLocks[i] === socket.id)
                  }
                  ref={(node) => (shapeRefs.current[i] = node)}
                  onClick={(e) => {
                    if (role === "editor") {
                      if (editLockEnabled) {
                        socket.emit("lock-object", { boardId: id, shapeIndex: i });
                      }
                      setSelectedId(i);

                      const absPos = e.target.getAbsolutePosition();
                      const stageBox = stageRef.current.container().getBoundingClientRect();
                      setToolbarVisible(true);
                      setToolbarPosition({
                        x: absPos.x + stageBox.left,
                        y: absPos.y + stageBox.top,
                      });
                      setCurrentColorTarget({ type: shape.type, index: i });
                    }
                  }}
                  onDragEnd={(e) => {
                    if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                    saveHistory();
                    const snappedX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                    const snappedY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                    const newShapes = [...shapes];
                    newShapes[i] = {
                      ...shapes[i],
                      x: snappedX,
                      y: snappedY,
                    };
                    setShapes(newShapes);
                    socket.emit("shape-update", { boardId: id, shapes: newShapes });
                  }}
                  onTransformEnd={(e) => {
                    if (role !== "editor") return;
                    if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                    saveHistory();

                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    const newShapes = [...shapes];
                    newShapes[i] = {
                      ...shapes[i],
                      x: node.x(),
                      y: node.y(),
                      radiusX: shape.radiusX * scaleX,
                      radiusY: shape.radiusY * scaleY,
                      createdBy: shapes[i].createdBy,
                    };

                    node.scaleX(1);
                    node.scaleY(1);
                    setShapes(newShapes);
                    socket.emit("shape-update", { boardId: id, shapes: newShapes });
                  }}
                />
              )}

              {shape.type === "arrow" && (
                <>
              <Arrow
                points={[
                  shape.from.x,
                  shape.from.y,
                  shape.to.x,
                  shape.to.y,
                ]}
                stroke={selectedId === i ? "blue" : shape.stroke || "#000"}
                fill={shape.fill || shape.stroke || "#000"}
                strokeWidth={shape.strokeWidth || 2}
                pointerLength={shape.pointerLength || 10}
                pointerWidth={shape.pointerWidth || 10}
                draggable={
                  tool === "select" &&
                  role === "editor" &&
                  (!shapeLocks[i] || shapeLocks[i] === socket.id)
                }
                onClick={(e) => {
                  if (role !== "editor") return;
                  if (editLockEnabled) {
                    socket.emit("lock-object", { boardId: id, shapeIndex: i });
                  }
                  setSelectedId(i);

                  const absPos = {
                    x: (shape.from.x + shape.to.x) / 2,
                    y: (shape.from.y + shape.to.y) / 2,
                  };
                  const stageBox = stageRef.current.container().getBoundingClientRect();
                  setToolbarVisible(true);
                  setToolbarPosition({
                    x: absPos.x + stageBox.left,
                    y: absPos.y + stageBox.top,
                  });
                  setCurrentColorTarget({ type: shape.type, index: i });
                }}
                onDragEnd={(e) => {
                  if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                  saveHistory();

                  const dx = e.target.x();
                  const dy = e.target.y();

                  const updated = [...shapes];
                  updated[i] = {
                    ...updated[i],
                    from: {
                      x: shape.from.x + dx,
                      y: shape.from.y + dy,
                    },
                    to: {
                      x: shape.to.x + dx,
                      y: shape.to.y + dy,
                    },
                  };

                  setShapes(updated);
                  socket.emit("shape-update", { boardId: id, shapes: updated });

                  // reset arrow position
                  e.target.position({ x: 0, y: 0 });
                }}
              />


                  {/* 🟢 Draggable Endpoints */}
              {selectedId === i &&
                (!editLockEnabled || shapeLocks[i] === socket.id) && (
                  <>
                    <Circle
                      x={shape.from.x}
                      y={shape.from.y}
                      radius={5}
                      fill="blue"
                      draggable
                      onDragMove={(e) => {
                        const updated = [...shapes];
                        updated[i] = {
                          ...updated[i],
                          from: { x: e.target.x(), y: e.target.y() },
                        };
                        saveHistory(); 
                        setShapes(updated);
                        socket.emit("shape-update", { boardId: id, shapes: updated });
                      }}
                    />
                    <Circle
                      x={shape.to.x}
                      y={shape.to.y}
                      radius={5}
                      fill="green"
                      draggable
                      onDragMove={(e) => {
                        const updated = [...shapes];
                        updated[i] = {
                          ...updated[i],
                          to: { x: e.target.x(), y: e.target.y() },
                        };
                        saveHistory(); 
                        setShapes(updated);
                        socket.emit("shape-update", { boardId: id, shapes: updated });
                      }}
                    />
                  </>
                )}

                </>
              )}


              {shape.type === "sticky" && (
              <>
                <Rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  fill={shape.fill || "lightyellow"}
                  stroke={selectedId === i ? "blue" : "#ccc"}
                  strokeWidth={1}
                  cornerRadius={6}
                  draggable={
                    tool === "select" &&
                    role === "editor" &&
                    (!editLockEnabled || shapeLocks[i] === socket.id)
                  }
                  ref={(node) => (shapeRefs.current[i] = node)}
                  onClick={(e) => {
                    if (role === "editor") {
                      if (editLockEnabled) {
                        socket.emit("lock-object", { boardId: id, shapeIndex: i });
                      }
                      setSelectedId(i);

                      const absPos = e.target.getAbsolutePosition();
                      const stageBox = stageRef.current.container().getBoundingClientRect();
                      setToolbarVisible(true);
                      setToolbarPosition({
                        x: absPos.x + stageBox.left,
                        y: absPos.y + stageBox.top,
                      });
                      setCurrentColorTarget({ type: shape.type, index: i });

                    }
                  }}

                  onDragEnd={(e) => {
                    if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                    saveHistory();
                    const snappedX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                    const snappedY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                    const newShapes = [...shapes];
                    newShapes[i] = {
                      ...shapes[i],
                      x: snappedX,
                      y: snappedY,
                    };
                    setShapes(newShapes);
                    socket.emit("shape-update", { boardId: id, shapes: newShapes });
                  }}
                  onTransformEnd={(e) => {
                    if (role !== "editor") return;
                    if (shapeLocks[i] && shapeLocks[i] !== socket.id) return;
                    saveHistory();

                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    const newShapes = [...shapes];
                    newShapes[i] = {
                      ...shapes[i],
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(100, shape.width * scaleX),
                      height: Math.max(60, shape.height * scaleY),
                      createdBy: shapes[i].createdBy,
                    };

                    node.scaleX(1);
                    node.scaleY(1);

                    setShapes(newShapes);
                    socket.emit("shape-update", { boardId: id, shapes: newShapes });
                  }}
                />

                <Text
                  text={shape.text}
                  x={shape.x + 10}
                  y={shape.y + 10}
                  width={shape.width - 20}
                  height={shape.height - 20}
                  fontSize={shape.fontSize || 16}
                  fill="black"
                  onClick={(e) => {
                    if (role === "editor") {
                      if (editLockEnabled) {
                        socket.emit("lock-object", { boardId: id, shapeIndex: i });
                      }
                      setSelectedId(i);

                      const absPos = e.target.getAbsolutePosition();
                      const stageBox = stageRef.current.container().getBoundingClientRect();
                      setToolbarVisible(true);
                      setToolbarPosition({
                        x: absPos.x + stageBox.left,
                        y: absPos.y + stageBox.top,
                      });
                      setCurrentColorTarget({ type: shape.type, index: i });

                    }
                  }}

                  onDblClick={(e) => {
                    if (
                      role !== "editor" ||
                      (editLockEnabled && shapeLocks[i] !== socket.id)
                    )
                      return;

                    const absPos = e.target.getAbsolutePosition();
                    const stageBox = stageRef.current.container().getBoundingClientRect();
                    const textarea = document.createElement("textarea");
                    document.body.appendChild(textarea);

                    textarea.value = shape.text;
                    textarea.style.position = "absolute";
                    textarea.style.top = `${absPos.y + stageBox.top - window.scrollY}px`;
                    textarea.style.left = `${absPos.x + stageBox.left - window.scrollX}px`;
                    textarea.style.width = `${shape.width - 20}px`;
                    textarea.style.height = `${shape.height - 20}px`;
                    textarea.style.fontSize = `${shape.fontSize || 16}px`;
                    textarea.style.lineHeight = "1.5";
                    textarea.style.padding = "4px";
                    textarea.style.border = "1px solid gray";
                    textarea.style.resize = "none";
                    textarea.style.background = "lightyellow";
                    textarea.style.fontFamily = "inherit";
                    textarea.style.zIndex = 1000;
                    textarea.focus();

                    textarea.addEventListener("keydown", (ev) => {
                      if (ev.key === "Enter" && !ev.shiftKey) {
                        ev.preventDefault();
                        textarea.blur();
                      }
                    });

                    textarea.addEventListener("blur", () => {
                      const updated = [...shapes];
                      updated[i] = {
                        ...updated[i],
                        text: textarea.value,
                      };
                      saveHistory(); 
                      setShapes(updated);
                      socket.emit("shape-update", { boardId: id, shapes: updated });
                      document.body.removeChild(textarea);
                    });
                  }}
                />

                {editLockEnabled &&
                  shapeLocks[i] &&
                  shapeLocks[i] !== socket.id && (
                    <Text
                      text="🔒"
                      fontSize={16}
                      x={shape.x + shape.width - 20}
                      y={shape.y + 4}
                    />
                  )}
              </>
            )}

              {/* 🔐 Lock Icon for shapes locked by others */}
              {editLockEnabled &&
                shapeLocks[i] &&
                shapeLocks[i] !== socket.id &&
                (shape.type === "rect" || shape.type === "circle" || shape.type === "ellipse") && (
                  <Text
                    text="🔒"
                    fontSize={16}
                    x={
                      shape.type === "rect"
                        ? shape.x + shape.width - 16
                        : shape.type === "circle"
                        ? shape.x + shape.radius - 16
                        : shape.x + shape.radiusX - 16 // for ellipse
                    }
                    y={shape.y + 4}
                  />
              )}
            </React.Fragment>
          ))}

          {/* 🛠 Transformer for selected shape */}
          {role === "editor" &&
            selectedId !== null &&
            shapeRefs.current[selectedId] &&
            (!editLockEnabled ||
              !shapeLocks[selectedId] ||
              shapeLocks[selectedId] === socket.id) && (
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            )}

          {/* 🖊️ Render all drawn lines */}
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={selectedLineId === i ? "blue" : "black"}
              strokeWidth={2}
              tension={0.5}
              lineCap="round"
              globalCompositeOperation="source-over"
              draggable={tool === "select" && role === "editor"}
              onClick={() => {
                if (role !== "editor") return;
                setSelectedLineId(i);
                setSelectedId(null);
              }}
              onDragEnd={(e) => {
                if (role !== "editor") return;
                const node = e.target;
                const dx = node.x();
                const dy = node.y();
                const updatedLines = [...lines];
                updatedLines[i] = {
                  ...updatedLines[i],
                  points: updatedLines[i].points.map((p, idx) =>
                    idx % 2 === 0 ? p + dx : p + dy
                  ),
                  createdBy: updatedLines[i].createdBy,
                };

                node.position({ x: 0, y: 0 });
                setLines(updatedLines);
                socket.emit("line-update", { boardId: id, lines: updatedLines });
              }}
            />
          ))}

          {/* 👤 Show all live user cursors */}
          {Object.entries(cursors).map(([userId, cursor]) => (
            <React.Fragment key={userId}>
              <Line
                points={[cursor.x - 5, cursor.y, cursor.x + 5, cursor.y]}
                stroke="red"
                strokeWidth={2}
              />
              <Line
                points={[cursor.x, cursor.y - 5, cursor.x, cursor.y + 5]}
                stroke="red"
                strokeWidth={2}
              />
              <Text
                text={cursor.name}
                x={cursor.x + 8}
                y={cursor.y + 8}
                fontSize={12}
                fill="red"
              />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>
      {toolbarVisible &&
      currentColorTarget &&
      (!editLockEnabled || !shapeLocks[currentColorTarget.index] || shapeLocks[currentColorTarget.index] === socket.id) && (

        <div
          style={{
            position: "absolute",
            top: toolbarPosition.y - 40,
            left: toolbarPosition.x + 20,
            zIndex: 1000,
            background: "white",
            padding: "6px 10px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button
            onClick={() => {
              setColorPickerVisible(true);
              setToolbarVisible(false);
              setColorPickerPosition(toolbarPosition); // reuse same position
              setColorType("fill");
            }}
            title="Change color"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
            }}
          >
            🎨
          </button>
          <button
            onClick={() => {
              setToolbarVisible(false);
              setSelectedId(null);
            }}
            title="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            ❌
          </button>
        </div>
        )}

      {colorPickerVisible && currentColorTarget && (
        <div
          style={{
            position: "absolute",
            top: colorPickerPosition.y + 50,
            left: colorPickerPosition.x + 30,
            zIndex: 1000,
            background: "white",
            padding: "8px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          <ChromePicker
            color={
              colorType === "fill"
                ? shapes[currentColorTarget.index]?.fill || "#000"
                : shapes[currentColorTarget.index]?.stroke || "#000"
            }
            onChangeComplete={(color) => {
              const newShapes = [...shapes];
              newShapes[currentColorTarget.index] = {
                ...newShapes[currentColorTarget.index],
                [colorType]: color.hex,
              };
              saveHistory(); 
              setShapes(newShapes);
              socket.emit("shape-update", { boardId: id, shapes: newShapes });
            }}
          />

          <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
            <Button
              size="small"
              variant={colorType === "fill" ? "contained" : "outlined"}
              onClick={() => setColorType("fill")}
            >
              Fill
            </Button>
            <Button
              size="small"
              variant={colorType === "stroke" ? "contained" : "outlined"}
              onClick={() => setColorType("stroke")}
            >
              Stroke
            </Button>
          </div>

          <Button
            size="small"
            onClick={() => setColorPickerVisible(false)}
            style={{ marginTop: "8px" }}
          >
            Close
          </Button>
        </div>
      )}
<Box
  sx={{
    mt: 4,
    border: "1px solid #ccc",
    borderRadius: "8px",
    p: 2,
    maxHeight: "250px",
    overflowY: "auto",
    backgroundColor: "#fafafa",
  }}
>
  <Typography variant="h6">💬 Chat</Typography>

  <Box sx={{ maxHeight: "150px", overflowY: "auto", mb: 2 }}>
    {chatMessages.map((msg, idx) => (
      <Box key={idx} sx={{ mb: 1 }}>
        <Typography variant="body2">
          <strong>{msg.user}</strong> [{new Date(msg.timestamp).toLocaleTimeString()}]: {msg.message}
        </Typography>
      </Box>
    ))}
  </Box>

  <Box display="flex" gap={1}>
    <TextField
      size="small"
      fullWidth
      placeholder="Type a message..."
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          sendMessage();
        }
      }}
    />
    <Button
      variant="contained"
      onClick={sendMessage}
      disabled={!newMessage.trim()}
    >
      Send
    </Button>
  </Box>
</Box>

      </Container>
        );
      };

export default BoardPage;
