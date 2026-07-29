import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { AuthShell } from "../components/ui";

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

      if (role === "sectional_head" || profile.isSectionalHead === true) {
        navigate("/sectional-head", { replace: true });
        return;
      }

      if (role === "prefect" || profile.isPrefect === true) {
        navigate("/prefect", { replace: true });
        return;
      }

      if (role === "teacher" || profile.isSubjectTeacher === true) {
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
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to the school management workspace."
      badge="Admin & Teacher Access"
      icon={<SchoolIcon />}
      footer="Contact your administrator if you forgot your password."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleLogin}>
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
          required
          autoFocus
          autoComplete="email"
        />
        <TextField
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
        <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
        </Button>
      </Box>
    </AuthShell>
  );
}
