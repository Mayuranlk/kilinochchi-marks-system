import React, { useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  useMediaQuery,
  useTheme,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Chip,
  Stack,
  Tooltip,
} from "@mui/material";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import GradingRoundedIcon from "@mui/icons-material/GradingRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import UpgradeRoundedIcon from "@mui/icons-material/UpgradeRounded";
import BookRoundedIcon from "@mui/icons-material/BookRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";

const DRAWER_WIDTH = 280;

export default function Layout() {
  const { profile, isAdmin, isClassTeacher, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const adminMenuSections = [
    {
      section: "Dashboard",
      items: [{ label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/" }],
    },
    {
      section: "Academic Setup",
      items: [
        { label: "Classrooms", icon: <MeetingRoomRoundedIcon />, path: "/classrooms" },
        { label: "Subjects", icon: <BookRoundedIcon />, path: "/subjects" },
        { label: "Academic Terms", icon: <CalendarMonthRoundedIcon />, path: "/terms" },
        {
          label: "School Setup",
          icon: <SettingsSuggestRoundedIcon />,
          path: "/setup-school-defaults",
          badge: "SETUP",
        },
      ],
    },
    {
      section: "Students",
      items: [
        { label: "Students", icon: <PeopleRoundedIcon />, path: "/students" },
        { label: "Students By Subject", icon: <MenuBookRoundedIcon />, path: "/students/by-subject" },
        {
          label: "Class Data Management",
          icon: <DeleteSweepRoundedIcon />,
          path: "/class-data-management",
          badge: "DANGER",
        },
      ],
    },
    {
      section: "Enrollments",
      items: [
        {
          label: "Subject Enrollments",
          icon: <AutoFixHighRoundedIcon />,
          path: "/student-subject-enrollments",
          badge: "AUTO",
        },
        {
          label: "Manual Enrollments",
          icon: <PlaylistAddRoundedIcon />,
          path: "/manual-student-subject-enrollments",
          badge: "MANUAL",
        },
        {
          label: "Migrate Student Subjects",
          icon: <CleaningServicesRoundedIcon />,
          path: "/migrate-student-subjects",
        },
      ],
    },
    {
      section: "Staff",
      items: [
        { label: "Teachers", icon: <PersonRoundedIcon />, path: "/teachers" },
        { label: "Teacher Assignments", icon: <AssignmentIndRoundedIcon />, path: "/assignments" },
        { label: "Class Teachers", icon: <HomeWorkRoundedIcon />, path: "/class-teachers" },
      ],
    },
    {
      section: "Marks & Reports",
      items: [
        { label: "Marks Entry", icon: <GradingRoundedIcon />, path: "/marks" },
        { label: "SBA", icon: <AssessmentRoundedIcon />, path: "/sba" },
        { label: "Bulk Marks Upload", icon: <UploadFileRoundedIcon />, path: "/marks-upload", badge: "NEW" },
        { label: "Teacher Mark Sheets", icon: <DescriptionRoundedIcon />, path: "/teacher-mark-sheets", badge: "NEW" },
        { label: "Class Marks Reports", icon: <AssessmentRoundedIcon />, path: "/class-marks-reports", badge: "NEW" },
      ],
    },
    {
      section: "Promotion & Tools",
      items: [
        { label: "Promotion", icon: <UpgradeRoundedIcon />, path: "/promotion" },
        { label: "Export Samples", icon: <DownloadRoundedIcon />, path: "/export-firestore-samples", badge: "DEV" },
      ],
    },
  ];

  const teacherMenu = useMemo(() => {
    const items = [
      { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
      { label: "Marks Entry", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
      { label: "SBA", icon: <AssessmentRoundedIcon />, path: "/teacher/sba" },
    ];

    if (isClassTeacher) {
      items.push({
        label: "Class Report",
        icon: <BarChartRoundedIcon />,
        path: "/teacher/class-report",
        badge: "NEW",
      });
    }

    return items;
  }, [isClassTeacher]);

  const menuItems = isAdmin
    ? adminMenuSections.flatMap((section) => section.items)
    : teacherMenu;

  const bottomNavItems = useMemo(() => {
    if (isAdmin) {
      return [
        { label: "Home", icon: <DashboardRoundedIcon />, path: "/" },
        { label: "Students", icon: <PeopleRoundedIcon />, path: "/students" },
        { label: "Marks", icon: <GradingRoundedIcon />, path: "/marks" },
        { label: "Reports", icon: <AssessmentRoundedIcon />, path: "/class-marks-reports" },
        { label: "More", icon: <MoreHorizRoundedIcon />, path: null },
      ];
    }

    if (isClassTeacher) {
      return [
        { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
        { label: "Marks", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
        { label: "Report", icon: <BarChartRoundedIcon />, path: "/teacher/class-report" },
      ];
    }

    return [
      { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
      { label: "Marks", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
    ];
  }, [isAdmin, isClassTeacher]);

  const shouldShowBottomNav = isMobile && !mobileOpen;

  const currentBottomNav = useMemo(() => {
    const index = bottomNavItems.findIndex((item) => {
      if (!item.path) return false;
      if (item.path === "/") return location.pathname === "/";
      if (item.path === "/teacher") return location.pathname === "/teacher";
      return location.pathname.startsWith(item.path);
    });

    return index === -1 ? 0 : index;
  }, [bottomNavItems, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/teacher") return location.pathname === "/teacher";
    return location.pathname.startsWith(path);
  };

  const getBadgeStyles = (badge) => {
    switch (badge) {
      case "MANUAL":
        return {
          bgcolor: "grey.200",
          color: "text.primary",
        };
      case "NEW":
        return {
          bgcolor: "warning.light",
          color: "warning.dark",
        };
      case "DEV":
        return {
          bgcolor: "info.light",
          color: "info.dark",
        };
      case "SETUP":
        return {
          bgcolor: "success.light",
          color: "success.dark",
        };
      case "AUTO":
        return {
          bgcolor: "secondary.light",
          color: "secondary.dark",
        };
      case "DANGER":
        return {
          bgcolor: "error.light",
          color: "error.dark",
        };
      default:
        return {
          bgcolor: "grey.200",
          color: "text.primary",
        };
    }
  };

  const renderBadge = (item) => {
    if (!item.badge) return null;

    return (
      <Chip
        label={item.badge}
        size="small"
        sx={{
          height: 20,
          fontSize: 10,
          fontWeight: 800,
          borderRadius: 999,
          ...getBadgeStyles(item.badge),
          "& .MuiChip-label": {
            px: 1,
          },
        }}
      />
    );
  };

  const handleNavigate = (path) => {
    if (!path) return;
    navigate(path);
    setMobileOpen(false);
  };

  const renderMenuItem = (item) => {
    const active = isActive(item.path);

    return (
      <ListItemButton
        key={item.label}
        onClick={() => handleNavigate(item.path)}
        sx={{
          mx: 1.25,
          mb: 0.5,
          minHeight: 46,
          borderRadius: 3,
          px: 1.25,
          py: 0.75,
          alignItems: "center",
          bgcolor: active ? "rgba(37, 99, 235, 0.12)" : "transparent",
          border: active ? "1px solid rgba(37, 99, 235, 0.18)" : "1px solid transparent",
          "&:hover": {
            bgcolor: active ? "rgba(37, 99, 235, 0.16)" : "rgba(148, 163, 184, 0.08)",
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 38,
            color: active ? "primary.main" : "text.secondary",
          }}
        >
          {item.icon}
        </ListItemIcon>

        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: 14,
            fontWeight: active ? 800 : 600,
            color: active ? "text.primary" : "text.secondary",
            noWrap: true,
          }}
        />

        {renderBadge(item)}
      </ListItemButton>
    );
  };

  const SidebarSectionLabel = ({ children }) => (
    <Typography
      variant="caption"
      sx={{
        px: 2.25,
        pb: 0.75,
        pt: 1.25,
        display: "block",
        color: "text.secondary",
        fontWeight: 800,
        fontSize: 11,
        letterSpacing: 0.8,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Typography>
  );

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.08) 100%)",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.main",
              color: "white",
              boxShadow: "0px 10px 24px rgba(37, 99, 235, 0.22)",
            }}
          >
            <SchoolRoundedIcon />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Kilinochchi
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Marks Management System
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            sx={{
              width: 42,
              height: 42,
              bgcolor: "primary.main",
              color: "white",
              fontWeight: 800,
            }}
          >
            {profile?.name?.charAt(0)?.toUpperCase() || "U"}
          </Avatar>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
              {profile?.name || "User"}
            </Typography>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
              <Chip
                label={profile?.role || "user"}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "capitalize",
                  bgcolor: "grey.100",
                }}
              />

              {isClassTeacher && (
                <Chip
                  label={`CT G${profile?.classGrade}-${profile?.classSection}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    bgcolor: "warning.light",
                    color: "warning.dark",
                  }}
                />
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {isAdmin ? (
          <>
            {adminMenuSections.map((section) => (
              <React.Fragment key={section.section}>
                <SidebarSectionLabel>{section.section}</SidebarSectionLabel>
                <List disablePadding>{section.items.map(renderMenuItem)}</List>
              </React.Fragment>
            ))}
          </>
        ) : (
          <>
            <SidebarSectionLabel>Teacher Menu</SidebarSectionLabel>
            <List disablePadding>{menuItems.map(renderMenuItem)}</List>
          </>
        )}

        {isMobile ? (
          <>
            <SidebarSectionLabel>Account</SidebarSectionLabel>
            <List disablePadding sx={{ pb: 1.5 }}>
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  mx: 1.25,
                  mb: 0.5,
                  borderRadius: 3,
                  "&:hover": {
                    bgcolor: "rgba(220, 38, 38, 0.08)",
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: "error.main" }}>
                  <LogoutRoundedIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Logout"
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "text.primary",
                  }}
                />
              </ListItemButton>
            </List>
          </>
        ) : null}
      </Box>

      {!isMobile ? (
        <Box
          sx={{
            p: 1.25,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <List disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 3,
                "&:hover": {
                  bgcolor: "rgba(220, 38, 38, 0.08)",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: "error.main" }}>
                <LogoutRoundedIcon />
              </ListItemIcon>
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "text.primary",
                }}
              />
            </ListItemButton>
          </List>
        </Box>
      ) : null}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {isMobile && (
        <AppBar
          position="fixed"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(10px)",
            zIndex: theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar
            sx={{
              minHeight: 64,
              px: { xs: 1.25, sm: 2 },
            }}
          >
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{
                mr: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2.5,
              }}
            >
              <MenuRoundedIcon />
            </IconButton>

            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "white",
                  flexShrink: 0,
                }}
              >
                <SchoolRoundedIcon sx={{ fontSize: 20 }} />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
                  Kilinochchi Marks
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {profile?.role ? String(profile.role).toUpperCase() : "USER"}
                </Typography>
              </Box>
            </Stack>

            <Tooltip title={profile?.name || "User"}>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: "primary.main",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {profile?.name?.charAt(0)?.toUpperCase() || "U"}
              </Avatar>
            </Tooltip>
          </Toolbar>
        </AppBar>
      )}

      <Box
        component="nav"
        sx={{
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 },
        }}
      >
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
                borderRight: "1px solid",
                borderColor: "divider",
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box",
                borderRight: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
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
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
          pt: { xs: "72px", md: 0 },
          pb: { xs: shouldShowBottomNav ? "104px" : 0, md: 0 },
          px: { xs: 0, md: 0 },
          overflowX: "hidden",
          bgcolor: "background.default",
        }}
      >
        <Outlet />
      </Box>

      {shouldShowBottomNav && (
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 1300,
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0px 16px 40px rgba(15, 23, 42, 0.14)",
          }}
        >
          <BottomNavigation
            value={currentBottomNav}
            onChange={(event, value) => {
              const item = bottomNavItems[value];
              if (item?.path) {
                navigate(item.path);
              } else {
                setMobileOpen(true);
              }
            }}
            showLabels
            sx={{
              height: 68,
              bgcolor: "background.paper",
              "& .MuiBottomNavigationAction-root": {
                minWidth: 0,
                color: "text.secondary",
              },
              "& .Mui-selected": {
                color: "primary.main",
              },
              "& .MuiBottomNavigationAction-label": {
                fontSize: 11,
                fontWeight: 700,
              },
            }}
          >
            {bottomNavItems.map((item) => (
              <BottomNavigationAction
                key={item.label}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
