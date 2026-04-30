import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  alpha,
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
        display: "grid",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #eef4ff 0%, #f8fafc 45%, #ecfdf5 100%)",
        px: { xs: 1.5, sm: 2 },
        py: 4,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 3,
          borderColor: "rgba(148, 163, 184, 0.32)",
          boxShadow: "0px 24px 70px rgba(15, 23, 42, 0.14)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box textAlign="center" mb={3}>
            <Box
              sx={{
                display: "inline-flex",
                width: 64,
                height: 64,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                border: "1px solid",
                borderColor: "divider",
                mb: 2,
              }}
            >
              <SchoolIcon sx={{ fontSize: 34, color: "primary.main" }} />
            </Box>

            <Typography variant="h5" fontWeight={800}>
              Kilinochchi Marks System
            </Typography>

            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Professional assessment and marks management
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
                py: 1.25,
                fontSize: 16,
                fontWeight: 800,
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
