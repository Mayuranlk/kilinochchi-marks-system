import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemIcon, ListItemText, IconButton, Avatar,
  Divider, useMediaQuery, useTheme, BottomNavigation,
  BottomNavigationAction, Paper
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import GradeIcon from "@mui/icons-material/Grade";
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import SchoolIcon from "@mui/icons-material/School";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import BookIcon from "@mui/icons-material/Book";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

const DRAWER_WIDTH = 240;

export default function Layout() {
  const { profile, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminMenu = [
    { label: "Dashboard",      icon: <DashboardIcon />,     path: "/" },
    { label: "Classrooms",     icon: <MeetingRoomIcon />,   path: "/classrooms" },
    { label: "Subjects",       icon: <BookIcon />,          path: "/subjects" },
    { label: "Students",       icon: <PeopleIcon />,        path: "/students" },
    { label: "Marks Entry",    icon: <GradeIcon />,         path: "/marks" },
    { label: "Teachers",       icon: <PersonIcon />,        path: "/teachers" },
    { label: "Promotion",      icon: <UpgradeIcon />,       path: "/promotion" },
    { label: "Academic Terms", icon: <CalendarMonthIcon />, path: "/terms" },
  ];

  const teacherMenu = [
    { label: "Dashboard",   icon: <DashboardIcon />, path: "/teacher" },
    { label: "Marks Entry", icon: <GradeIcon />,     path: "/teacher/marks" },
  ];

  const menuItems = isAdmin ? adminMenu : teacherMenu;

  const bottomNavItems = isAdmin
    ? [
        { label: "Home",     icon: <DashboardIcon />,   path: "/" },
        { label: "Students", icon: <PeopleIcon />,      path: "/students" },
        { label: "Marks",    icon: <GradeIcon />,       path: "/marks" },
        { label: "Classes",  icon: <MeetingRoomIcon />, path: "/classrooms" },
        { label: "More",     icon: <MenuIcon />,        path: null },
      ]
    : [
        { label: "Dashboard", icon: <DashboardIcon />, path: "/teacher" },
        { label: "Marks",     icon: <GradeIcon />,     path: "/teacher/marks" },
      ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const currentBottomNav = bottomNavItems.findIndex(
    (item) => item.path === location.pathname
  );

  const drawer = (
    <Box sx={{
      height: "100%",
      bgcolor: "#1a237e",
      color: "white",
      display: "flex",
      flexDirection: "column",
      overflowX: "hidden",
      overflowY: "hidden",
      width: DRAWER_WIDTH,
    }}>
      {/* Logo */}
      <Box sx={{
        p: 2.5, display: "flex", alignItems: "center",
        gap: 1.5, flexShrink: 0
      }}>
        <SchoolIcon sx={{ fontSize: 32, color: "#ffd54f" }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Kilinochchi
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Marks System
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

      {/* Profile */}
      <Box sx={{
        p: 2, display: "flex", alignItems: "center",
        gap: 1.5, flexShrink: 0
      }}>
        <Avatar sx={{
          bgcolor: "#ffd54f", color: "#1a237e",
          width: 36, height: 36, fontSize: 14, fontWeight: 700
        }}>
          {profile?.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {profile?.name}
          </Typography>
          <Typography variant="caption"
            sx={{ opacity: 0.7, textTransform: "capitalize" }}>
            {profile?.role}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

      {/* Menu Items */}
      <List sx={{ flex: 1, pt: 1, overflowY: "hidden", overflowX: "hidden" }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem button key={item.label}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              sx={{
                mx: 1, mb: 0.3, borderRadius: 2, cursor: "pointer",
                py: 0.8,
                width: `calc(100% - 16px)`,
                bgcolor: active ? "rgba(255,255,255,0.2)" : "transparent",
                "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
              }}>
              <ListItemIcon sx={{
                color: active ? "#ffd54f" : "rgba(255,255,255,0.8)",
                minWidth: 36
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label}
                primaryTypographyProps={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  color: "white",
                  noWrap: true
                }} />
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

      {/* Logout */}
      <List sx={{ flexShrink: 0 }}>
        <ListItem button onClick={handleLogout}
          sx={{
            mx: 1, mb: 1, borderRadius: 2, cursor: "pointer",
            width: `calc(100% - 16px)`,
            "&:hover": { bgcolor: "rgba(255,0,0,0.2)" }
          }}>
          <ListItemIcon sx={{ color: "#ef9a9a", minWidth: 36 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout"
            primaryTypographyProps={{ fontSize: 13, color: "white" }} />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Top AppBar — Mobile Only */}
      {isMobile && (
        <AppBar position="fixed"
          sx={{ bgcolor: "#1a237e", zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton color="inherit" edge="start"
              onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <SchoolIcon sx={{ mr: 1, color: "#ffd54f", fontSize: 22 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              Kilinochchi Marks
            </Typography>
            <Avatar sx={{
              bgcolor: "#ffd54f", color: "#1a237e",
              width: 30, height: 30, fontSize: 13, fontWeight: 700
            }}>
              {profile?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar Drawer */}
      <Box component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer variant="temporary" open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                overflowX: "hidden",
                overflowY: "hidden",
              }
            }}>
            {drawer}
          </Drawer>
        ) : (
          <Drawer variant="permanent"
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                border: "none",
                overflowX: "hidden",
                overflowY: "hidden",
              }
            }}>
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{
        flexGrow: 1,
        p: { xs: 1.5, sm: 2, md: 3 },
        width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
        maxWidth: { xs: "100vw", md: `calc(100vw - ${DRAWER_WIDTH}px)` },
        mt: { xs: 7, md: 0 },
        mb: { xs: 8, md: 0 },
        bgcolor: "#f5f5f5",
        minHeight: "100vh",
        overflowX: "hidden",
      }}>
        <Outlet />
      </Box>

      {/* Bottom Navigation — Mobile Only */}
      {isMobile && (
        <Paper
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1200 }}
          elevation={8}>
          <BottomNavigation value={currentBottomNav}
            onChange={(e, val) => {
              const item = bottomNavItems[val];
              if (item?.path) navigate(item.path);
              else setMobileOpen(true);
            }}
            sx={{ bgcolor: "#1a237e" }}>
            {bottomNavItems.map((item) => (
              <BottomNavigationAction key={item.label}
                label={item.label} icon={item.icon}
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-selected": { color: "#ffd54f" },
                  minWidth: 0, fontSize: 10,
                }} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}