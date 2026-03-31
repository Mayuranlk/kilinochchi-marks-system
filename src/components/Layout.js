import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Chip,
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
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import BarChartIcon from "@mui/icons-material/BarChart";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";

const DRAWER_WIDTH = 240;

export default function Layout() {
  const { profile, isAdmin, isClassTeacher, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminMenu = [
    { label: "Dashboard", icon: <DashboardIcon />, path: "/" },
    { label: "Classrooms", icon: <MeetingRoomIcon />, path: "/classrooms" },
    { label: "Subjects", icon: <BookIcon />, path: "/subjects" },
    { label: "Students", icon: <PeopleIcon />, path: "/students" },
    { label: "Marks Entry", icon: <GradeIcon />, path: "/marks" },
    { label: "Teachers", icon: <PersonIcon />, path: "/teachers" },
{ label: "School Setup", icon: <SettingsSuggestIcon />, path: "/setup-school-defaults",badge: "SETUP",
},
    { label: "Assignments", icon: <AssignmentIndIcon />, path: "/assignments" },
    { label: "Class Teachers", icon: <HomeWorkIcon />, path: "/class-teachers" },

    { label: "Promotion", icon: <UpgradeIcon />, path: "/promotion" },
    { label: "Academic Terms", icon: <CalendarMonthIcon />, path: "/terms" },

    {
      label: "Subject Enrollments",
      icon: <AutoFixHighIcon />,
      path: "/student-subject-enrollments",
      badge: "AUTO",
    },
    {
      label: "Manual Enrollments",
      icon: <PlaylistAddIcon />,
      path: "/manual-student-subject-enrollments",
      badge: "MANUAL",
    },
    {
      label: "Migrate Student Subjects",
      icon: <CleaningServicesIcon />,
      path: "/migrate-student-subjects",
    },
  ];
  

  const teacherMenu = [
    { label: "Dashboard", icon: <DashboardIcon />, path: "/teacher" },
    { label: "Marks Entry", icon: <GradeIcon />, path: "/teacher/marks" },
  ];

  if (isClassTeacher) {
    teacherMenu.push({
      label: "Class Report",
      icon: <BarChartIcon />,
      path: "/teacher/class-report",
      badge: "NEW",
    });
  }

  const menuItems = isAdmin ? adminMenu : teacherMenu;

  const bottomNavItems = isAdmin
    ? [
        { label: "Home", icon: <DashboardIcon />, path: "/" },
        { label: "Students", icon: <PeopleIcon />, path: "/students" },
        { label: "Marks", icon: <GradeIcon />, path: "/marks" },
        { label: "Enroll", icon: <MenuBookIcon />, path: "/student-subject-enrollments" },
        { label: "More", icon: <MenuIcon />, path: null },
      ]
    : isClassTeacher
    ? [
        { label: "Dashboard", icon: <DashboardIcon />, path: "/teacher" },
        { label: "Marks", icon: <GradeIcon />, path: "/teacher/marks" },
        { label: "Report", icon: <BarChartIcon />, path: "/teacher/class-report" },
      ]
    : [
        { label: "Dashboard", icon: <DashboardIcon />, path: "/teacher" },
        { label: "Marks", icon: <GradeIcon />, path: "/teacher/marks" },
      ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const currentBottomNav = bottomNavItems.findIndex(
    (item) => item.path === location.pathname
  );

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/teacher") return location.pathname === "/teacher";
    return location.pathname.startsWith(path);
  };

  function renderBadge(item) {
    if (!item.badge) return null;

    let bg = "#ffd54f";
    let color = "#1a237e";

    if (item.badge === "MANUAL") {
      bg = "#e0e0e0";
      color = "#1a237e";
    }

    if (item.badge === "NEW") {
      bg = "#ffd54f";
      color = "#1a237e";
    }

    return (
      <Chip
        label={item.badge}
        size="small"
        sx={{
          bgcolor: bg,
          color,
          fontWeight: 700,
          fontSize: 9,
          height: 16,
          "& .MuiChip-label": { px: 0.8 },
        }}
      />
    );
  }

  function renderMenuItem(item) {
    const active = isActive(item.path);

    return (
      <ListItem
        button
        key={item.label}
        onClick={() => {
          navigate(item.path);
          setMobileOpen(false);
        }}
        sx={{
          mx: 1,
          mb: 0.3,
          borderRadius: 2,
          cursor: "pointer",
          py: 0.8,
          width: "calc(100% - 16px)",
          bgcolor: active ? "rgba(255,255,255,0.2)" : "transparent",
          "&:hover": { bgcolor: "rgba(255,255,255,0.15)" },
        }}
      >
        <ListItemIcon
          sx={{
            color: active ? "#ffd54f" : "rgba(255,255,255,0.8)",
            minWidth: 36,
          }}
        >
          {item.icon}
        </ListItemIcon>

        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: 13,
            fontWeight: active ? 700 : 400,
            color: "white",
            noWrap: true,
          }}
        />

        {renderBadge(item)}
      </ListItem>
    );
  }

  const drawer = (
    <Box
      sx={{
        height: "100%",
        bgcolor: "#1a237e",
        color: "white",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        overflowY: "hidden",
        width: DRAWER_WIDTH,
      }}
    >
      <Box
        sx={{
          p: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexShrink: 0,
        }}
      >
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

      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Avatar
          sx={{
            bgcolor: "#ffd54f",
            color: "#1a237e",
            width: 36,
            height: 36,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {profile?.name?.charAt(0)?.toUpperCase() || "U"}
        </Avatar>

        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {profile?.name || "User"}
          </Typography>

          <Box display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
            <Typography
              variant="caption"
              sx={{ opacity: 0.7, textTransform: "capitalize" }}
            >
              {profile?.role}
            </Typography>

            {isClassTeacher && (
              <Chip
                label={`CT G${profile?.classGrade}-${profile?.classSection}`}
                size="small"
                sx={{
                  bgcolor: "#ffd54f",
                  color: "#1a237e",
                  fontWeight: 700,
                  fontSize: 9,
                  height: 16,
                  "& .MuiChip-label": { px: 0.8 },
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

      <List sx={{ flex: 1, pt: 1, overflowY: "auto", overflowX: "hidden" }}>
        {isAdmin && (
          <>
            <Typography
              variant="caption"
              sx={{
                px: 2,
                opacity: 0.5,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Management
            </Typography>
            {adminMenu.slice(0, 6).map((item) => renderMenuItem(item))}

            <Typography
              variant="caption"
              sx={{
                px: 2,
                mt: 1,
                display: "block",
                opacity: 0.5,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Staff
            </Typography>
            {adminMenu.slice(6, 8).map((item) => renderMenuItem(item))}

            <Typography
              variant="caption"
              sx={{
                px: 2,
                mt: 1,
                display: "block",
                opacity: 0.5,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              System
            </Typography>
            {adminMenu.slice(8).map((item) => renderMenuItem(item))}
          </>
        )}

        {!isAdmin && menuItems.map((item) => renderMenuItem(item))}
      </List>

      <Divider sx={{ bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

      <List sx={{ flexShrink: 0 }}>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            mx: 1,
            mb: 1,
            borderRadius: 2,
            cursor: "pointer",
            width: "calc(100% - 16px)",
            "&:hover": { bgcolor: "rgba(255,0,0,0.2)" },
          }}
        >
          <ListItemIcon sx={{ color: "#ef9a9a", minWidth: 36 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ fontSize: 13, color: "white" }}
          />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", overflowX: "hidden" }}>
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{ bgcolor: "#1a237e", zIndex: theme.zIndex.drawer + 1 }}
        >
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>

            <SchoolIcon sx={{ mr: 1, color: "#ffd54f", fontSize: 22 }} />

            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              Kilinochchi Marks
            </Typography>

            <Avatar
              sx={{
                bgcolor: "#ffd54f",
                color: "#1a237e",
                width: 30,
                height: 30,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </Avatar>
          </Toolbar>
        </AppBar>
      )}

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                overflowX: "hidden",
                overflowY: "hidden",
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                border: "none",
                overflowX: "hidden",
                overflowY: "hidden",
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: { xs: "100vw", md: `calc(100vw - ${DRAWER_WIDTH}px)` },
          mt: { xs: 7, md: 0 },
          mb: { xs: 8, md: 0 },
          bgcolor: "#f5f5f5",
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        <Outlet />
      </Box>

      {isMobile && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
          }}
          elevation={8}
        >
          <BottomNavigation
            value={currentBottomNav}
            onChange={(e, val) => {
              const item = bottomNavItems[val];
              if (item?.path) navigate(item.path);
              else setMobileOpen(true);
            }}
            sx={{ bgcolor: "#1a237e" }}
          >
            {bottomNavItems.map((item) => (
              <BottomNavigationAction
                key={item.label}
                label={item.label}
                icon={item.icon}
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-selected": { color: "#ffd54f" },
                  minWidth: 0,
                  fontSize: 10,
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}