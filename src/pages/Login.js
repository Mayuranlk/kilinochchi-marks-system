import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function redirectByProfile() {
      if (!profile) return;

      const role = normalizeLower(profile.role);
      const status = normalizeLower(profile.status || "active");

      if (status === "transferred" || status === "inactive" || status === "disabled") {
        setError("Your account is not active. Please contact the administrator.");
        try {
          await signOut(auth);
        } catch {
          // ignore sign out failure
        }
        return;
      }

      if (role === "admin") {
        navigate("/", { replace: true });
        return;
      }

      if (role === "teacher") {
        navigate("/teacher", { replace: true });
        return;
      }

      setError("Your account role is not configured correctly. Please contact the administrator.");
      try {
        await signOut(auth);
      } catch {
        // ignore sign out failure
      }
    }

    redirectByProfile();
  }, [profile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanedEmail = normalizeLower(email);
    const cleanedPassword = password;

    if (!cleanedEmail || !cleanedPassword) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, cleanedEmail, cleanedPassword);
      // Redirect is handled in the profile effect above
    } catch (err) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)",
        px: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: 10,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Box
              sx={{
                display: "inline-flex",
                p: 2,
                borderRadius: "50%",
                bgcolor: "#e8eaf6",
                mb: 2,
              }}
            >
              <SchoolIcon sx={{ fontSize: 48, color: "#1a237e" }} />
            </Box>

            <Typography variant="h5" fontWeight={700} color="#1a237e">
              Kilinochchi Marks System
            </Typography>

            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Sign in to your account
            </Typography>

            <Stack direction="row" justifyContent="center" mt={1.5}>
              <Chip label="Admin & Teacher Access" size="small" color="primary" />
            </Stack>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              required
              autoFocus
              autoComplete="email"
            />

            <TextField
              fullWidth
              label="Password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              required
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPass((prev) => !prev)}
                      edge="end"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                bgcolor: "#1a237e",
                py: 1.5,
                fontSize: 16,
                fontWeight: 600,
                "&:hover": { bgcolor: "#283593" },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </form>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="center"
            mt={3}
          >
            Contact your administrator if you forgot your password.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}