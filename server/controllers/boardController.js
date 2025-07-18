import Board from "../models/Board.js";
import User from "../models/User.js";
import ChatMessage from "../models/ChatMessage.js";

// ✅ Create board with optional collaborators
export const createBoard = async (req, res) => {
  try {
    const { title, collaborators = [] } = req.body;

    console.log("🔧 Creating board with:", title, collaborators);

    const resolvedCollaborators = await Promise.all(
      collaborators.map(async ({ username, permission }) => {
        console.log("🔍 Looking up user by name:", username);
        const user = await User.findOne({ name: username });
        if (!user) throw new Error(`User ${username} not found`);
        return { user: user._id, permission: permission || "editor" };
      })
    );

    const board = await Board.create({
      title,
      owner: req.userId,
      collaborators: resolvedCollaborators,
    });

    console.log("✅ Board created:", board._id);

    res.status(201).json(board);
  } catch (err) {
    console.error("❌ Error in createBoard:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const getBoardById = async (req, res) => {
  try {
    console.log("📥 Fetching board by ID:", req.params.id);

    const board = await Board.findById(req.params.id)
      .populate("owner", "name email")
      .populate("collaborators.user", "name email");

    if (!board) return res.status(404).json({ msg: "Board not found" });

    const isOwner = board.owner._id.toString() === req.userId;
    const isCollaborator = board.collaborators.some(
      (c) => c.user._id.toString() === req.userId
    );

    if (!isOwner && !isCollaborator) {
      console.log("🔐 Access denied");
      return res.status(403).json({ msg: "Access denied" });
    }

    res.status(200).json(board);
  } catch (err) {
    console.error("❌ getBoardById error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const updateBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ msg: "Board not found" });

    const isOwner = board.owner.toString() === req.userId;
    const isEditor = board.collaborators.some(
      (c) => c.user.toString() === req.userId && c.permission === "editor"
    );

    if (!isOwner && !isEditor) {
      console.log("🔐 Update blocked: No permission");
      return res.status(403).json({ msg: "Access denied" });
    }

    board.data = req.body.data;
    await board.save();

    console.log("✅ Board updated:", board._id);

    res.status(200).json({ msg: "Board saved" });
  } catch (err) {
    console.error("❌ updateBoard error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const getBoards = async (req, res) => {
  try {
    console.log("📥 Fetching boards for user:", req.userId);

    const boards = await Board.find({
      $or: [
        { owner: req.userId },
        { "collaborators.user": req.userId }
      ],
    });

    res.status(200).json(boards);
  } catch (err) {
    console.error("❌ getBoards error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const addCollaborator = async (req, res) => {
  try {
    console.log("📩 Incoming addCollaborator request:", req.body);

    const board = await Board.findById(req.params.id);
    if (!board) {
      console.log("❌ Board not found:", req.params.id);
      return res.status(404).json({ msg: "Board not found" });
    }

    if (board.owner.toString() !== req.userId) {
      console.log("🔐 Unauthorized add attempt by:", req.userId);
      return res.status(403).json({ msg: "Only the owner can add collaborators" });
    }

    const { username, permission = "editor" } = req.body;

    const user = await User.findOne({ name: username });
    if (!user) {
      console.log("❌ User not found:", username);
      return res.status(404).json({ msg: "User not found" });
    }

    const alreadyExists = board.collaborators.some(
      (c) => c.user.toString() === user._id.toString()
    );
    if (alreadyExists) {
      console.log("⚠️ User already a collaborator:", username);
      return res.status(409).json({ msg: "User is already a collaborator" });
    }

    board.collaborators.push({ user: user._id, permission });
    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate("collaborators.user", "name email");

    console.log("✅ Collaborator added:", username);

    res.status(200).json({ msg: "Collaborator added", collaborators: updatedBoard.collaborators });
  } catch (err) {
    console.error("❌ addCollaborator error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const updateCollaboratorPermission = async (req, res) => {
  try {
    console.log("🔄 Incoming permission update:", req.body);

    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ msg: "Board not found" });

    if (board.owner.toString() !== req.userId) {
      console.log("🔐 Unauthorized permission change attempt");
      return res.status(403).json({ msg: "Only the owner can update permissions" });
    }

    const { username, permission } = req.body;
    const user = await User.findOne({ name: username });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const collaborator = board.collaborators.find(
      (c) => c.user.toString() === user._id.toString()
    );
    if (!collaborator) {
      console.log("❌ User is not a collaborator");
      return res.status(400).json({ msg: "User is not a collaborator" });
    }

    collaborator.permission = permission;
    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate("collaborators.user", "name email");

    console.log("✅ Permission updated for:", username);

    res.status(200).json({ msg: "Permission updated", collaborators: updatedBoard.collaborators });
  } catch (err) {
    console.error("❌ updateCollaboratorPermission error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};

export const removeCollaborator = async (req, res) => {
  try {
    console.log("❌ Incoming removeCollaborator:", req.body);

    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ msg: "Board not found" });

    if (board.owner.toString() !== req.userId) {
      console.log("🔐 Unauthorized remove attempt");
      return res.status(403).json({ msg: "Only the owner can remove collaborators" });
    }

    const { username } = req.body;
    const user = await User.findOne({ name: username });
    if (!user) {
      console.log("❌ User not found for removal:", username);
      return res.status(404).json({ msg: "User not found" });
    }

    board.collaborators = board.collaborators.filter(
      (c) => c.user.toString() !== user._id.toString()
    );

    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate("collaborators.user", "name email");

    console.log("✅ Collaborator removed:", username);

    res.status(200).json({ msg: "Collaborator removed", collaborators: updatedBoard.collaborators });
  } catch (err) {
    console.error("❌ removeCollaborator error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};
export const deleteBoard = async (req, res) => {
  try {
    console.log("🗑️ Incoming deleteBoard request for ID:", req.params.id);

    const board = await Board.findById(req.params.id);
    if (!board) {
      console.log("❌ Board not found:", req.params.id);
      return res.status(404).json({ msg: "Board not found" });
    }

    if (board.owner.toString() !== req.userId) {
      console.log("🔐 Unauthorized delete attempt by:", req.userId);
      return res.status(403).json({ msg: "Only the owner can delete this board" });
    }

    await Board.findByIdAndDelete(req.params.id);
    console.log("✅ Board deleted:", board.title);

    res.status(200).json({ msg: "Board deleted successfully" });
  } catch (err) {
    console.error("❌ deleteBoard error:", err.message);
    res.status(500).json({ msg: err.message });
  }
};