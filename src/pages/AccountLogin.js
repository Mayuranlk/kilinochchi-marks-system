import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function AccountLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { profile, loading, isAdmin, isAccount } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;

    const status = String(profile.status || "active").trim().toLowerCase();
    if (["inactive", "disabled", "transferred"].includes(status)) {
      setError("This account login is not active. Contact an administrator.");
      signOut(auth).catch(() => {});
      return;
    }

    if (isAdmin || isAccount) {
      navigate("/accounts", { replace: true });
      return;
    }

    setError("This login does not have access to the accounts system.");
    signOut(auth).catch(() => {});
  }, [profile, loading, isAdmin, isAccount, navigate]);

  const login = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (err) {
      setError(
        ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(err.code)
          ? "Invalid email or password."
          : err.message || "Could not sign in."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 430, borderRadius: 2, boxShadow: "0px 14px 34px rgba(15,23,42,.08)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack alignItems="center" spacing={1} mb={3} textAlign="center">
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "success.dark",
                color: "white",
              }}
            >
              <AccountBalanceWalletRoundedIcon sx={{ fontSize: 36 }} />
            </Box>
            <Typography variant="h4" fontWeight={900}>
              Accounts Portal
            </Typography>
            <Typography color="text.secondary">Student facilities and development fee desk</Typography>
          </Stack>

          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Box component="form" onSubmit={login}>
            <TextField
              fullWidth
              label="Account email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2.5 }}
            />
            <Button fullWidth size="large" variant="contained" color="success" type="submit" disabled={submitting} sx={{ py: 1.35, fontWeight: 800 }}>
              {submitting ? <CircularProgress size={24} color="inherit" /> : "Sign in to accounts"}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2.5}>
            Uses student records from the marks database with separate finance access.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
