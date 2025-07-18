import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Box,
  Chip,
  Divider,
  Paper,
  Grid,
  Tooltip,
  IconButton,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DashboardIcon from "@mui/icons-material/Dashboard";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

const Dashboard = () => {
  const [ownedBoards, setOwnedBoards] = useState([]);
  const [sharedBoards, setSharedBoards] = useState([]);
  const [title, setTitle] = useState("");
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const fetchBoards = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/boards", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userId = JSON.parse(localStorage.getItem("user"))._id;

      const owned = res.data.filter((b) => b.owner === userId);
      const shared = res.data.filter((b) =>
        b.collaborators.some((c) => c.user === userId)
      );

      setOwnedBoards(owned);
      setSharedBoards(shared);
    } catch (err) {
      console.error("Fetch boards error:", err);
    }
  };

  const handleAddCollaborator = () => {
    const trimmed = collaboratorInput.trim();
    if (trimmed && !collaborators.some((c) => c.username === trimmed)) {
      setCollaborators([
        ...collaborators,
        { username: trimmed, permission: "editor" },
      ]);
      setCollaboratorInput("");
    }
  };

  const createBoard = async () => {
    if (!title.trim()) return;
    try {
      await axios.post(
        "http://localhost:5000/api/boards",
        { title, collaborators },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTitle("");
      setCollaborators([]);
      fetchBoards();
    } catch (err) {
      console.error("Create board error:", err);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ py: 4, minHeight: "100vh" }}>
      <Typography variant="h4" gutterBottom textAlign="center">
        <DashboardIcon sx={{ verticalAlign: "middle", mr: 1 }} />
        Whiteboard Dashboard
      </Typography>

      <Grid container spacing={4} justifyContent="center" alignItems="flex-start">
        {/* Create Board Section */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              🧾 Create New Board
            </Typography>

            <TextField
              label="Board Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="e.g. Design Sprint, Team Plan"
            />

            <TextField
              label="Collaborator Username"
              value={collaboratorInput}
              onChange={(e) => setCollaboratorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCollaborator();
                }
              }}
              fullWidth
              margin="normal"
              placeholder="Add by username"
              InputProps={{
                endAdornment: (
                  <Tooltip title="Add Collaborator">
                    <IconButton onClick={handleAddCollaborator}>
                      <PersonAddIcon />
                    </IconButton>
                  </Tooltip>
                ),
              }}
            />

            {/* Collaborators */}
            <Box mt={2} display="flex" flexDirection="column" gap={1}>
              {collaborators.map((c, index) => (
                <Box
                  key={c.username}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Chip label={c.username} variant="outlined" />
                  <TextField
                    select
                    size="small"
                    value={c.permission}
                    onChange={(e) => {
                      const updated = [...collaborators];
                      updated[index].permission = e.target.value;
                      setCollaborators(updated);
                    }}
                    SelectProps={{ native: true }}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </TextField>
                  <Button
                    color="error"
                    size="small"
                    onClick={() =>
                      setCollaborators(
                        collaborators.filter((u) => u.username !== c.username)
                      )
                    }
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>

            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              onClick={createBoard}
              startIcon={<AddIcon />}
            >
              Create Board
            </Button>
          </Paper>
        </Grid>

        {/* Boards List Section */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              📌 Your Boards
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {ownedBoards.map((board) => (
                <ListItem
                  key={board._id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    "&:hover": { backgroundColor: "#f5f5f5" },
                  }}
                >
                  <Box
                    onClick={() => navigate(`/board/${board._id}`)}
                    sx={{ cursor: "pointer", flexGrow: 1 }}
                  >
                    <ListItemText
                      primary={board.title}
                      secondary={`Created: ${new Date(
                        board.createdAt
                      ).toLocaleDateString()}`}
                    />
                  </Box>
                  <IconButton
                    color="error"
                    onClick={async () => {
                      try {
                        await axios.delete(
                          `http://localhost:5000/api/boards/${board._id}`,
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                        fetchBoards();
                      } catch (err) {
                        console.error("Delete board error:", err);
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Shared Boards */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              🤝 Shared With You
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              {sharedBoards.map((board) => (
                <ListItem
                  key={board._id}
                  button
                  onClick={() => navigate(`/board/${board._id}`)}
                >
                  <ListItemText
                    primary={board.title}
                    secondary={`Shared on ${new Date(
                      board.createdAt
                    ).toLocaleDateString()}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
    </>
    
  );
};

export default Dashboard;
