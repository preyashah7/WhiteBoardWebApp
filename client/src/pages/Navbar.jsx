// src/components/Navbar.jsx
import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button,
  Tooltip,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useNavigate, useLocation } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <AppBar position="static" color="default" elevation={2}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Left - Logo + App Name */}
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6" fontWeight="bold" sx={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            🧠 Whiteboard
          </Typography>
        </Box>

        {/* Middle (optional) */}
        {location.pathname.startsWith("/board/") && (
          <Typography variant="body1" sx={{ fontStyle: "italic" }}>
            {location.pathname.includes("/board/") && "Collaborative Board"}
          </Typography>
        )}

        {/* Right - Actions */}
        <Box display="flex" alignItems="center" gap={2}>
          {user && (
            <>
              <Typography variant="body1">👤 {user.name}</Typography>

              <Tooltip title="Dashboard">
                <IconButton color="primary" onClick={() => navigate("/dashboard")}>
                  <DashboardIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Logout">
                <IconButton color="error" onClick={handleLogout}>
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
