import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Paper,
  useTheme,
  Fade,
} from "@mui/material";

const Login = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });
      alert("Login successful");

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.msg || "Login failed");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Fade in timeout={400}>
        <Paper elevation={6} sx={{ p: 4, width: "100%", borderRadius: 3 }}>
          <Typography
            variant="h4"
            align="center"
            gutterBottom
            fontWeight="bold"
            color="primary"
          >
            Login
          </Typography>

          <Typography variant="body2" align="center" color="text.secondary" mb={2}>
            Enter your credentials to access your dashboard
          </Typography>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Email"
              fullWidth
              required
              type="email"
              margin="normal"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Password"
              fullWidth
              required
              type="password"
              margin="normal"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              sx={{ mt: 3, borderRadius: 2 }}
            >
              Login
            </Button>
          </Box>
          <Typography variant="body2" align="center" mt={2}>
            Don't have an account?{" "}
            <Button
              onClick={() => navigate("/signup")}
              variant="text"
              size="small"
              sx={{ textTransform: "none", fontWeight: 500 }}
            >
              Sign up
            </Button>
          </Typography>
        </Paper>
      </Fade>
    </Container>
  );
};

export default Login;
