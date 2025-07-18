import express from "express";
import {
  createBoard,
  getBoards,
  getBoardById, 
  updateBoard,
  addCollaborator,
  deleteBoard,
  updateCollaboratorPermission,
  removeCollaborator
  
} from "../controllers/boardController.js";
import auth from "../middleware/auth.js";
import ChatMessage from "../models/ChatMessage.js";

const router = express.Router();

router.post("/", auth, createBoard);      // create new board
router.get("/", auth, getBoards);         // get all boards for user
router.get("/:id", auth, getBoardById);   // get one board
router.put("/:id", auth, updateBoard);    // update board content
router.put("/:id/add-collaborator", auth, addCollaborator);
router.delete("/:id", auth, deleteBoard);
router.put('/:id/collaborators', auth, updateCollaboratorPermission);
router.post('/:id/collaborators', auth, addCollaborator);
router.delete("/:id/collaborators", auth, removeCollaborator); // ✅ THIS LINE
router.post('/:id/collaborators', auth, addCollaborator); // ✅ for POST
router.put('/:id/collaborators', auth, updateCollaboratorPermission); // ✅ for PUT
router.delete('/:id/collaborators', auth, removeCollaborator); // ✅ for DELETE
router.get("/:id/chat", auth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ boardId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});



export default router;
