import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Breadcrumbs,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import AssignmentIndRoundedIcon from "@mui/icons-material/AssignmentIndRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import BookRoundedIcon from "@mui/icons-material/BookRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContrastRoundedIcon from "@mui/icons-material/ContrastRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import GradingRoundedIcon from "@mui/icons-material/GradingRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import HowToVoteRoundedIcon from "@mui/icons-material/HowToVoteRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import UpgradeRoundedIcon from "@mui/icons-material/UpgradeRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { useAuth } from "../context/AuthContext";
import { useColorMode } from "../theme/ColorModeContext";
import { AppErrorBoundary, BrandMark } from "./ui";

const DRAWER_WIDTH = 280;
const COLLAPSED_DRAWER_WIDTH = 84;

const pathMatches = (pathname, path) => {
  if (path === "/") return pathname === "/";
  if (path === "/teacher") return pathname === "/teacher";
  if (path === "/sectional-head") return pathname === "/sectional-head";
  return pathname === path || pathname.startsWith(`${path}/`);
};

const titleFromPath = (pathname) => {
  const finalSegment = pathname.split("/").filter(Boolean).pop();
  if (!finalSegment) return "Dashboard";
  return finalSegment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function Layout() {
  const {
    profile,
    isAdmin,
    isTeacher,
    isClassTeacher,
    isSectionalHead,
    assignedGrades,
    canAccessAllReports,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { mode: colorMode, cycleMode: cycleColorMode } = useColorMode();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [desktopCollapsed, setDesktopCollapsed] = useState(
    () => window.localStorage.getItem("kcc-sidebar-collapsed") === "true"
  );

  const navCompact = desktopCollapsed && !isMobile;
  const activeDrawerWidth = navCompact ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH;
  const navSurface = theme.palette.background.paper;
  const activeNavBg = theme.palette.action.selected;
  const hoverNavBg = theme.palette.action.hover;
  const colorModeLabel =
    colorMode === "dark" ? "Dark mode" : colorMode === "contrast" ? "High contrast" : "Light mode";
  const colorModeIcon =
    colorMode === "dark" ? (
      <DarkModeRoundedIcon />
    ) : colorMode === "contrast" ? (
      <ContrastRoundedIcon />
    ) : (
      <LightModeRoundedIcon />
    );

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  const adminMenuSections = useMemo(() => [
    {
      section: "Overview",
      items: [{ label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/" }],
    },
    {
      section: "Academic Setup",
      items: [
        { label: "Classrooms", icon: <MeetingRoomRoundedIcon />, path: "/classrooms" },
        { label: "Subjects", icon: <BookRoundedIcon />, path: "/subjects" },
        { label: "Academic Terms", icon: <CalendarMonthRoundedIcon />, path: "/terms" },
        { label: "Practice Exams", icon: <AssessmentRoundedIcon />, path: "/practice-exams" },
        { label: "School Setup", icon: <SettingsSuggestRoundedIcon />, path: "/setup-school-defaults", badge: "SETUP" },
      ],
    },
    {
      section: "Students",
      items: [
        { label: "Students", icon: <PeopleRoundedIcon />, path: "/students" },
        { label: "Students By Subject", icon: <MenuBookRoundedIcon />, path: "/students/by-subject" },
        { label: "Classwise Lists", icon: <FactCheckRoundedIcon />, path: "/students/classwise-list" },
        { label: "Class Shuffle", icon: <ShuffleRoundedIcon />, path: "/class-shuffle", badge: "NEW" },
        { label: "Class Data Management", icon: <DeleteSweepRoundedIcon />, path: "/class-data-management", badge: "DANGER" },
      ],
    },
    {
      section: "Enrollments",
      items: [
        { label: "Subject Enrollments", icon: <AutoFixHighRoundedIcon />, path: "/student-subject-enrollments", badge: "AUTO" },
        { label: "Manual Enrollments", icon: <PlaylistAddRoundedIcon />, path: "/manual-student-subject-enrollments", badge: "MANUAL" },
        { label: "Migrate Student Subjects", icon: <CleaningServicesRoundedIcon />, path: "/migrate-student-subjects" },
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
        { label: "Class Completion", icon: <FactCheckRoundedIcon />, path: "/class-completion-report", badge: "NEW" },
        { label: "Live Marks Status", icon: <FactCheckRoundedIcon />, path: "/marks-status-live", badge: "PUBLIC" },
        { label: "Subject Analysis", icon: <BarChartRoundedIcon />, path: "/subject-analysis", badge: "NEW" },
      ],
    },
    {
      section: "Promotion & Tools",
      items: [
        { label: "Promotion", icon: <UpgradeRoundedIcon />, path: "/promotion" },
        { label: "Data Health", icon: <HealthAndSafetyRoundedIcon />, path: "/academic-data-health", badge: "CHECK" },
        { label: "Backup & Restore", icon: <DownloadRoundedIcon />, path: "/backup-restore" },
      ],
    },
    {
      section: "Special Events",
      items: [{ label: "Election Count", icon: <HowToVoteRoundedIcon />, path: "/election-count", badge: "LIVE" }],
    },
  ], []);

  const teacherMenu = useMemo(() => {
    const items = [
      { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
      { label: "Marks Entry", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
      { label: "SBA", icon: <AssessmentRoundedIcon />, path: "/teacher/sba" },
    ];
    if (canAccessAllReports) {
      items.push(
        { label: "Teacher Mark Sheets", icon: <DescriptionRoundedIcon />, path: "/teacher-mark-sheets", badge: "IT" },
        { label: "Class Marks Reports", icon: <AssessmentRoundedIcon />, path: "/class-marks-reports", badge: "IT" },
        { label: "Class Completion", icon: <FactCheckRoundedIcon />, path: "/class-completion-report", badge: "IT" },
        { label: "Subject Analysis", icon: <BarChartRoundedIcon />, path: "/subject-analysis", badge: "IT" }
      );
    }
    if (isClassTeacher) {
      items.push({ label: "Class Report", icon: <BarChartRoundedIcon />, path: "/teacher/class-report", badge: "NEW" });
    }
    return items;
  }, [canAccessAllReports, isClassTeacher]);

  const sectionalHeadMenu = useMemo(() => {
    const items = [
      { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/sectional-head" },
      { label: "Class Reports", icon: <AssessmentRoundedIcon />, path: "/sectional-head/class-marks-reports" },
      { label: "Class Completion", icon: <FactCheckRoundedIcon />, path: "/sectional-head/class-completion-report" },
      { label: "Subject Analysis", icon: <BarChartRoundedIcon />, path: "/sectional-head/subject-analysis" },
      { label: "Classwise Lists", icon: <FactCheckRoundedIcon />, path: "/sectional-head/classwise-list" },
    ];
    if (isTeacher) {
      items.push(
        { label: "Marks Entry", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
        { label: "SBA", icon: <AssessmentRoundedIcon />, path: "/teacher/sba" }
      );
    }
    if (isClassTeacher) {
      items.push({ label: "Class Report", icon: <BarChartRoundedIcon />, path: "/teacher/class-report", badge: "CT" });
    }
    return items;
  }, [isTeacher, isClassTeacher]);

  const menuItems = useMemo(
    () =>
      isAdmin
        ? adminMenuSections.flatMap((section) => section.items)
        : isSectionalHead
        ? sectionalHeadMenu
        : teacherMenu,
    [adminMenuSections, isAdmin, isSectionalHead, sectionalHeadMenu, teacherMenu]
  );

  const searchableItems = useMemo(
    () =>
      isAdmin
        ? adminMenuSections.flatMap((section) =>
            section.items.map((item) => ({ ...item, section: section.section }))
          )
        : menuItems.map((item) => ({
            ...item,
            section: isSectionalHead ? "Sectional Head" : "Teacher Workspace",
          })),
    [adminMenuSections, isAdmin, isSectionalHead, menuItems]
  );

  const activeItem = useMemo(
    () =>
      [...searchableItems]
        .sort((first, second) => second.path.length - first.path.length)
        .find((item) => pathMatches(location.pathname, item.path)),
    [location.pathname, searchableItems]
  );
  const currentPageTitle = activeItem?.label || titleFromPath(location.pathname);
  const currentPageSection = activeItem?.section || "School Workspace";
  const activePath = activeItem?.path;

  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchableItems.slice(0, 9);
    return searchableItems
      .filter((item) => `${item.label} ${item.section} ${item.path}`.toLowerCase().includes(query))
      .slice(0, 12);
  }, [searchQuery, searchableItems]);

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
    if (isSectionalHead) {
      const items = [
        { label: "Home", icon: <DashboardRoundedIcon />, path: "/sectional-head" },
        { label: "Reports", icon: <AssessmentRoundedIcon />, path: "/sectional-head/class-marks-reports" },
        { label: "Analysis", icon: <BarChartRoundedIcon />, path: "/sectional-head/subject-analysis" },
      ];
      items.push(
        isTeacher
          ? { label: "Marks", icon: <GradingRoundedIcon />, path: "/teacher/marks" }
          : { label: "Lists", icon: <FactCheckRoundedIcon />, path: "/sectional-head/classwise-list" }
      );
      return items;
    }
    if (isClassTeacher) {
      return [
        { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
        { label: "Marks", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
        { label: "Report", icon: <BarChartRoundedIcon />, path: "/teacher/class-report" },
        ...(canAccessAllReports
          ? [{ label: "Reports", icon: <AssessmentRoundedIcon />, path: "/class-marks-reports" }]
          : []),
      ];
    }
    return [
      { label: "Dashboard", icon: <DashboardRoundedIcon />, path: "/teacher" },
      { label: "Marks", icon: <GradingRoundedIcon />, path: "/teacher/marks" },
      ...(canAccessAllReports
        ? [{ label: "Reports", icon: <AssessmentRoundedIcon />, path: "/class-marks-reports" }]
        : []),
    ];
  }, [canAccessAllReports, isAdmin, isClassTeacher, isSectionalHead, isTeacher]);

  const shouldShowBottomNav = isMobile && !mobileOpen;
  const currentBottomNav = useMemo(() => {
    const index = bottomNavItems.findIndex((item) => item.path && pathMatches(location.pathname, item.path));
    return index === -1 ? 0 : index;
  }, [bottomNavItems, location.pathname]);

  const handleLogout = async () => {
    setProfileAnchor(null);
    await logout();
    navigate("/login");
  };

  const handleNavigate = (path) => {
    if (!path) return;
    navigate(path);
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  };

  const toggleDesktopSidebar = () => {
    setDesktopCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("kcc-sidebar-collapsed", String(next));
      return next;
    });
  };

  const getBadgeStyles = (badge) => {
    if (badge === "DANGER") return { bgcolor: "error.lighter", color: "error.dark" };
    if (badge === "NEW") return { bgcolor: "warning.lighter", color: "warning.dark" };
    if (badge === "AUTO") return { bgcolor: "secondary.lighter", color: "secondary.dark" };
    if (badge === "SETUP") return { bgcolor: "success.lighter", color: "success.dark" };
    if (badge === "LIVE" || badge === "PUBLIC") return { bgcolor: "info.lighter", color: "info.dark" };
    return { bgcolor: "action.selected", color: "text.secondary" };
  };

  const renderBadge = (item) =>
    item.badge ? (
      <Chip
        label={item.badge}
        size="small"
        sx={{
          height: 19,
          fontSize: 9.5,
          fontWeight: 850,
          borderRadius: 1,
          ...getBadgeStyles(item.badge),
          "& .MuiChip-label": { px: 0.8 },
        }}
      />
    ) : null;

  const renderMenuItem = (item) => {
    const active = activePath === item.path;
    const button = (
      <ListItemButton
        key={item.label}
        aria-current={active ? "page" : undefined}
        onClick={() => handleNavigate(item.path)}
        sx={{
          mx: navCompact ? 1 : 1.25,
          mb: 0.25,
          minHeight: 42,
          justifyContent: navCompact ? "center" : "flex-start",
          borderRadius: 1.5,
          px: navCompact ? 1 : 1.25,
          bgcolor: active ? activeNavBg : "transparent",
          border: "1px solid",
          borderColor: active ? alpha(theme.palette.primary.main, 0.18) : "transparent",
          "&:hover": { bgcolor: active ? activeNavBg : hoverNavBg },
          "&::before": active
            ? {
                content: '""',
                position: "absolute",
                left: navCompact ? -1 : 0,
                top: 9,
                bottom: 9,
                width: 3,
                borderRadius: 4,
                bgcolor: "primary.main",
              }
            : undefined,
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: navCompact ? 0 : 38,
            justifyContent: "center",
            color: active ? "primary.main" : "text.secondary",
            "& .MuiSvgIcon-root": { fontSize: 21 },
          }}
        >
          {item.icon}
        </ListItemIcon>
        {!navCompact ? (
          <>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 13.5,
                fontWeight: active ? 800 : 650,
                color: active ? "primary.main" : "text.secondary",
                noWrap: true,
              }}
            />
            {renderBadge(item)}
          </>
        ) : null}
      </ListItemButton>
    );

    return navCompact ? (
      <Tooltip key={item.label} title={item.label} placement="right">
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  const SidebarSectionLabel = ({ children }) =>
    navCompact ? (
      <Divider sx={{ mx: 2, my: 1 }} />
    ) : (
      <Typography
        variant="overline"
        sx={{ px: 2.25, pb: 0.55, pt: 1.15, display: "block", color: "text.disabled", fontSize: 10 }}
      >
        {children}
      </Typography>
    );

  const accountChips = !navCompact ? (
    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mt: 0.4 }}>
      <Chip
        label={profile?.role || "user"}
        size="small"
        sx={{ height: 19, fontSize: 9.5, textTransform: "capitalize", bgcolor: "action.selected" }}
      />
      {isClassTeacher ? (
        <Chip
          label={`CT G${profile?.classGrade}-${profile?.classSection}`}
          size="small"
          sx={{ height: 19, fontSize: 9.5, bgcolor: "warning.lighter", color: "warning.dark" }}
        />
      ) : null}
      {isSectionalHead ? (
        <Chip
          label={`SH G${assignedGrades.join(",") || "-"}`}
          size="small"
          sx={{ height: 19, fontSize: 9.5, bgcolor: "info.lighter", color: "info.dark" }}
        />
      ) : null}
    </Stack>
  ) : null;

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: navSurface }}>
      <Box sx={{ px: navCompact ? 1.5 : 1.75, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <BrandMark size={40} compact />
            {!navCompact ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.15 }} noWrap>
                  Kilinochchi
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Education Management
                </Typography>
              </Box>
            ) : null}
          </Stack>
          {isMobile ? (
            <IconButton aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          ) : !navCompact ? (
            <Tooltip title="Collapse navigation">
              <IconButton size="small" aria-label="Collapse navigation" onClick={toggleDesktopSidebar}>
                <ChevronLeftRoundedIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
        {navCompact ? (
          <Tooltip title="Expand navigation" placement="right">
            <IconButton
              aria-label="Expand navigation"
              onClick={toggleDesktopSidebar}
              sx={{ mt: 1.25, width: "100%", border: 1, borderColor: "divider" }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <Box sx={{ px: navCompact ? 1.25 : 1.75, py: 1.35, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" spacing={1.15} alignItems="center" justifyContent={navCompact ? "center" : "flex-start"}>
          <Tooltip title={navCompact ? profile?.name || "User" : ""} placement="right">
            <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 14 }}>
              {profile?.name?.charAt(0)?.toUpperCase() || "U"}
            </Avatar>
          </Tooltip>
          {!navCompact ? (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                {profile?.name || "User"}
              </Typography>
              {accountChips}
            </Box>
          ) : null}
        </Stack>
      </Box>

      {!navCompact ? (
        <Box sx={{ px: 1.25, pt: 1.25 }}>
          <ButtonBase
            onClick={() => setSearchOpen(true)}
            aria-label="Search navigation"
            sx={{
              width: "100%",
              minHeight: 40,
              px: 1.25,
              justifyContent: "flex-start",
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
              color: "text.secondary",
              bgcolor: "background.default",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <SearchRoundedIcon sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="body2" sx={{ flex: 1, textAlign: "left" }}>
              Find a page
            </Typography>
            <Typography variant="caption" sx={{ px: 0.7, py: 0.2, border: 1, borderColor: "divider", borderRadius: 0.75 }}>
              Ctrl K
            </Typography>
          </ButtonBase>
        </Box>
      ) : null}

      <Box component="nav" aria-label="Primary navigation" sx={{ flex: 1, overflowY: "auto", py: 0.75 }}>
        {isAdmin ? (
          adminMenuSections.map((section, index) => (
            <React.Fragment key={section.section}>
              {index > 0 || !navCompact ? <SidebarSectionLabel>{section.section}</SidebarSectionLabel> : null}
              <List disablePadding>{section.items.map(renderMenuItem)}</List>
            </React.Fragment>
          ))
        ) : (
          <>
            <SidebarSectionLabel>{isSectionalHead ? "Sectional Head" : "Teacher Workspace"}</SidebarSectionLabel>
            <List disablePadding>{menuItems.map(renderMenuItem)}</List>
          </>
        )}
      </Box>

      <Box sx={{ p: 1, borderTop: 1, borderColor: "divider" }}>
        <List disablePadding>
          <Tooltip title={navCompact ? colorModeLabel : ""} placement="right">
            <ListItemButton
              onClick={cycleColorMode}
              aria-label={`Change appearance. Current: ${colorModeLabel}`}
              sx={{ borderRadius: 1.5, mb: 0.35, justifyContent: navCompact ? "center" : "flex-start" }}
            >
              <ListItemIcon sx={{ minWidth: navCompact ? 0 : 38, justifyContent: "center", color: "primary.main" }}>
                {colorModeIcon}
              </ListItemIcon>
              {!navCompact ? (
                <ListItemText
                  primary={colorModeLabel}
                  secondary="Change appearance"
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }}
                  secondaryTypographyProps={{ fontSize: 10.5 }}
                />
              ) : null}
            </ListItemButton>
          </Tooltip>
          <Tooltip title={navCompact ? "Sign out" : ""} placement="right">
            <ListItemButton
              onClick={handleLogout}
              sx={{ borderRadius: 1.5, justifyContent: navCompact ? "center" : "flex-start", "&:hover": { bgcolor: "error.lighter" } }}
            >
              <ListItemIcon sx={{ minWidth: navCompact ? 0 : 38, justifyContent: "center", color: "error.main" }}>
                <LogoutRoundedIcon />
              </ListItemIcon>
              {!navCompact ? (
                <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }} />
              ) : null}
            </ListItemButton>
          </Tooltip>
        </List>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", width: "100%", maxWidth: "100vw", overflowX: "hidden", bgcolor: "background.default" }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 2000,
          px: 2,
          py: 1,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontWeight: 800,
          textDecoration: "none",
          transform: "translateY(-140%)",
          "&:focus": { transform: "translateY(0)" },
        }}
      >
        Skip to main content
      </Box>

      {isMobile ? (
        <AppBar
          position="fixed"
          color="inherit"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: alpha(theme.palette.background.paper, 0.94),
            backdropFilter: "blur(16px) saturate(140%)",
            zIndex: theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ minHeight: 62, px: { xs: 1.25, sm: 2 } }}>
            <IconButton edge="start" aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ mr: 0.75 }}>
              <MenuRoundedIcon />
            </IconButton>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
              <BrandMark size={34} compact />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, lineHeight: 1.15 }} noWrap>
                  {currentPageTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Kilinochchi EMS
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Search pages">
              <IconButton aria-label="Search pages" onClick={() => setSearchOpen(true)}>
                <SearchRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={`Appearance: ${colorModeLabel}`}>
              <IconButton onClick={cycleColorMode} aria-label={`Change appearance. Current: ${colorModeLabel}`}>
                {colorModeIcon}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
      ) : null}

      <Box component="nav" sx={{ width: { md: activeDrawerWidth }, flexShrink: { md: 0 }, transition: theme.transitions.create("width", { duration: theme.transitions.duration.shorter }) }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", borderRight: 1, borderColor: "divider" } }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            open
            sx={{
              "& .MuiDrawer-paper": {
                width: activeDrawerWidth,
                boxSizing: "border-box",
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                overflowX: "hidden",
                transition: theme.transitions.create("width", { duration: theme.transitions.duration.shorter }),
              },
            }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          width: { xs: "100%", md: `calc(100% - ${activeDrawerWidth}px)` },
          minWidth: 0,
          maxWidth: { xs: "100vw", md: `calc(100vw - ${activeDrawerWidth}px)` },
          minHeight: "100vh",
          pt: { xs: "62px", md: 0 },
          pb: { xs: shouldShowBottomNav ? "92px" : 0, md: 0 },
          overflowX: "hidden",
          bgcolor: "background.default",
          transition: theme.transitions.create(["width", "max-width"], { duration: theme.transitions.duration.shorter }),
        }}
      >
        {!isMobile ? (
          <AppBar
            position="sticky"
            color="inherit"
            sx={{
              top: 0,
              zIndex: theme.zIndex.appBar - 1,
              border: 0,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              backdropFilter: "blur(18px) saturate(140%)",
            }}
          >
            <Toolbar sx={{ px: { md: 3, xl: 4 }, gap: 2 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Breadcrumbs separator="/" aria-label="Page location" sx={{ mb: 0.15 }}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Kilinochchi EMS
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {currentPageSection}
                  </Typography>
                </Breadcrumbs>
                <Typography variant="subtitle1" sx={{ fontWeight: 850, lineHeight: 1.2 }} noWrap>
                  {currentPageTitle}
                </Typography>
              </Box>

              <ButtonBase
                onClick={() => setSearchOpen(true)}
                aria-label="Search navigation. Keyboard shortcut Control K"
                sx={{
                  width: { md: 260, xl: 340 },
                  minHeight: 40,
                  px: 1.25,
                  justifyContent: "flex-start",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1.5,
                  bgcolor: "background.default",
                  color: "text.secondary",
                  "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                }}
              >
                <SearchRoundedIcon sx={{ mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ flex: 1, textAlign: "left" }}>
                  Search pages and tools
                </Typography>
                <Typography variant="caption" sx={{ px: 0.7, py: 0.2, border: 1, borderColor: "divider", borderRadius: 0.75 }}>
                  Ctrl K
                </Typography>
              </ButtonBase>

              <Tooltip title={`Appearance: ${colorModeLabel}`}>
                <IconButton onClick={cycleColorMode} aria-label={`Change appearance. Current: ${colorModeLabel}`} sx={{ border: 1, borderColor: "divider" }}>
                  {colorModeIcon}
                </IconButton>
              </Tooltip>
              <Tooltip title="Account menu">
                <ButtonBase
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  onClick={(event) => setProfileAnchor(event.currentTarget)}
                  sx={{ borderRadius: 999 }}
                >
                  <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 14 }}>
                    {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                  </Avatar>
                </ButtonBase>
              </Tooltip>
            </Toolbar>
          </AppBar>
        ) : null}

        {!isOnline ? (
          <Alert
            severity="warning"
            icon={<WifiOffRoundedIcon />}
            sx={{ borderRadius: 0, borderInline: 0, borderTop: 0 }}
          >
            You are offline. Previously loaded information may remain visible, but new changes may not save until the connection returns.
          </Alert>
        ) : null}

        <AppErrorBoundary key={location.pathname}>
          <Outlet />
        </AppErrorBoundary>
      </Box>

      {shouldShowBottomNav ? (
        <Paper
          component="nav"
          aria-label="Quick navigation"
          sx={{
            position: "fixed",
            left: 10,
            right: 10,
            bottom: "max(10px, env(safe-area-inset-bottom))",
            zIndex: 1300,
            overflow: "hidden",
            borderRadius: 2.25,
            boxShadow: theme.custom.highContrast ? "none" : theme.custom.shadows.floating,
          }}
        >
          <BottomNavigation
            value={currentBottomNav}
            onChange={(event, value) => {
              const item = bottomNavItems[value];
              if (item?.path) handleNavigate(item.path);
              else setMobileOpen(true);
            }}
            showLabels
            sx={{
              height: 64,
              bgcolor: "background.paper",
              "& .MuiBottomNavigationAction-root": { minWidth: 0, color: "text.secondary" },
              "& .Mui-selected": { color: "primary.main" },
              "& .MuiBottomNavigationAction-label": { fontSize: 10.5, fontWeight: 700 },
            }}
          >
            {bottomNavItems.map((item) => (
              <BottomNavigationAction key={item.label} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="navigation-search-title"
        PaperProps={{ sx: { m: { xs: 1.5, sm: 3 }, alignSelf: { xs: "flex-start", sm: "center" }, mt: { xs: 8, sm: 3 } } }}
      >
        <DialogContent sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Box sx={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 1.5, bgcolor: "action.selected", color: "primary.main" }}>
              <SearchRoundedIcon />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography id="navigation-search-title" variant="subtitle1" sx={{ fontWeight: 850 }}>
                Find a page or tool
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Search within the pages available to your role.
              </Typography>
            </Box>
            <IconButton aria-label="Close search" onClick={() => setSearchOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <TextField
            autoFocus
            placeholder="Try Students, Marks Entry, or Reports"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            inputProps={{ "aria-label": "Search available pages" }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> }}
          />

          <List aria-label="Search results" sx={{ mt: 1, maxHeight: "min(52vh, 460px)", overflowY: "auto" }}>
            {filteredSearchItems.length ? (
              filteredSearchItems.map((item) => (
                <ListItemButton key={`${item.section}-${item.path}`} onClick={() => handleNavigate(item.path)} sx={{ px: 1.25 }}>
                  <ListItemIcon sx={{ minWidth: 40, color: "primary.main" }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    secondary={item.section}
                    primaryTypographyProps={{ fontWeight: 750 }}
                  />
                  <ArrowForwardRoundedIcon color="action" fontSize="small" />
                </ListItemButton>
              ))
            ) : (
              <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
                <Typography variant="subtitle2">No matching pages</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Try a broader search term.
                </Typography>
              </Box>
            )}
          </List>
        </DialogContent>
      </Dialog>

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1.25, minWidth: 230 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
            {profile?.name || "User"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
            {profile?.role || "School account"}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={cycleColorMode}>
          <ListItemIcon>{colorModeIcon}</ListItemIcon>
          <ListItemText primary="Appearance" secondary={colorModeLabel} />
        </MenuItem>
        <MenuItem onClick={() => setSearchOpen(true)}>
          <ListItemIcon><TuneRoundedIcon /></ListItemIcon>
          <ListItemText primary="Find a tool" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
          <ListItemIcon sx={{ color: "error.main" }}><LogoutRoundedIcon /></ListItemIcon>
          <ListItemText primary="Sign out" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
