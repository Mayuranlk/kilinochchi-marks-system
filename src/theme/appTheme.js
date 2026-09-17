import { alpha, createTheme } from "@mui/material/styles";

export const COLOR_MODES = {
  LIGHT: "light",
  DARK: "dark",
  CONTRAST: "contrast",
};

export const DESIGN_TOKENS = {
  breakpoints: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536, "2xl": 1920 },
  radii: { xs: 6, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 },
  motion: {
    fast: "120ms",
    standard: "180ms",
    slow: "260ms",
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
  layout: {
    contentMax: 1600,
    readingMax: 760,
    drawerWidth: 280,
    drawerCollapsedWidth: 84,
    topBarHeight: 68,
  },
  controlHeights: { compact: 34, standard: 40, comfortable: 46, touch: 44 },
};

const palettes = {
  light: {
    mode: "light",
    primary: { main: "#1d4ed8", light: "#dbeafe", lighter: "#eff6ff", dark: "#1e40af", contrastText: "#ffffff" },
    secondary: { main: "#0f766e", light: "#ccfbf1", lighter: "#f0fdfa", dark: "#115e59", contrastText: "#ffffff" },
    success: { main: "#15803d", light: "#dcfce7", lighter: "#f0fdf4", dark: "#166534", contrastText: "#ffffff" },
    warning: { main: "#b45309", light: "#fef3c7", lighter: "#fffbeb", dark: "#92400e", contrastText: "#ffffff" },
    error: { main: "#b91c1c", light: "#fee2e2", lighter: "#fef2f2", dark: "#991b1b", contrastText: "#ffffff" },
    info: { main: "#0369a1", light: "#e0f2fe", lighter: "#f0f9ff", dark: "#075985", contrastText: "#ffffff" },
    background: { default: "#f5f7fb", paper: "#ffffff" },
    text: { primary: "#111827", secondary: "#5b687a", disabled: "#8a96a8" },
    divider: "#dfe5ee",
    action: { hover: "rgba(29,78,216,0.055)", selected: "rgba(29,78,216,0.09)", focus: "rgba(29,78,216,0.14)" },
  },
  dark: {
    mode: "dark",
    primary: { main: "#75a7ff", light: "#1e3a5f", lighter: "#14243b", dark: "#a8c7ff", contrastText: "#071326" },
    secondary: { main: "#5eead4", light: "#164e4a", lighter: "#102f2d", dark: "#99f6e4", contrastText: "#052e2b" },
    success: { main: "#4ade80", light: "#14532d", lighter: "#102b1c", dark: "#86efac", contrastText: "#052e16" },
    warning: { main: "#fbbf24", light: "#713f12", lighter: "#34240d", dark: "#fde68a", contrastText: "#271503" },
    error: { main: "#fb7185", light: "#7f1d1d", lighter: "#361518", dark: "#fda4af", contrastText: "#35060d" },
    info: { main: "#38bdf8", light: "#0c4a6e", lighter: "#102c3b", dark: "#7dd3fc", contrastText: "#05293a" },
    background: { default: "#0b1220", paper: "#111a2b" },
    text: { primary: "#edf2f9", secondary: "#aeb9c9", disabled: "#758196" },
    divider: "#2a374b",
    action: { hover: "rgba(117,167,255,0.09)", selected: "rgba(117,167,255,0.14)", focus: "rgba(117,167,255,0.2)" },
  },
  contrast: {
    mode: "dark",
    primary: { main: "#ffdf00", light: "#3a3300", lighter: "#1f1b00", dark: "#fff176", contrastText: "#000000" },
    secondary: { main: "#67e8f9", light: "#164e63", lighter: "#082f49", dark: "#a5f3fc", contrastText: "#000000" },
    success: { main: "#86efac", light: "#14532d", lighter: "#052e16", dark: "#bbf7d0", contrastText: "#000000" },
    warning: { main: "#fde047", light: "#713f12", lighter: "#422006", dark: "#fef08a", contrastText: "#000000" },
    error: { main: "#fda4af", light: "#881337", lighter: "#4c0519", dark: "#fecdd3", contrastText: "#000000" },
    info: { main: "#7dd3fc", light: "#075985", lighter: "#082f49", dark: "#bae6fd", contrastText: "#000000" },
    background: { default: "#000000", paper: "#050505" },
    text: { primary: "#ffffff", secondary: "#e5e5e5", disabled: "#b8b8b8" },
    divider: "#a3a3a3",
    action: { hover: "rgba(255,223,0,0.16)", selected: "rgba(255,223,0,0.24)", focus: "rgba(255,223,0,0.3)" },
  },
};

const makeShadows = (mode) => {
  const shadow = mode === "light" ? "rgba(15,23,42,0.10)" : "rgba(0,0,0,0.45)";
  return [
    "none",
    `0 1px 2px ${shadow}`,
    `0 2px 8px ${shadow}`,
    `0 8px 24px ${shadow}`,
    `0 16px 40px ${shadow}`,
    ...Array(20).fill(`0 16px 40px ${shadow}`),
  ];
};

export function createAppTheme(colorMode = COLOR_MODES.LIGHT) {
  const mode = palettes[colorMode] ? colorMode : COLOR_MODES.LIGHT;
  const palette = palettes[mode];
  const highContrast = mode === COLOR_MODES.CONTRAST;
  const border = palette.divider;
  const focusColor = highContrast ? "#ffdf00" : palette.primary.main;
  const surfaceRaised = mode === COLOR_MODES.LIGHT ? "#ffffff" : palette.background.paper;

  return createTheme({
    breakpoints: { values: DESIGN_TOKENS.breakpoints },
    palette: {
      ...palette,
      accent: { main: mode === COLOR_MODES.LIGHT ? "#7c3aed" : "#c4b5fd" },
    },
    custom: {
      colorMode: mode,
      highContrast,
      radii: DESIGN_TOKENS.radii,
      shadows: { subtle: makeShadows(mode)[1], card: makeShadows(mode)[2], floating: makeShadows(mode)[3] },
      motion: DESIGN_TOKENS.motion,
      layout: DESIGN_TOKENS.layout,
      controlHeights: DESIGN_TOKENS.controlHeights,
      surfaces: {
        canvas: palette.background.default,
        base: palette.background.paper,
        subtle: mode === "light" ? "#f8fafc" : mode === "contrast" ? "#000000" : "#151f31",
        raised: surfaceRaised,
      },
    },
    shape: { borderRadius: 10 },
    spacing: 8,
    shadows: makeShadows(mode),
    typography: {
      fontFamily: 'Inter, "Segoe UI Variable", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
      h1: { fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.035em" },
      h2: { fontSize: "clamp(1.7rem, 3vw, 2.35rem)", fontWeight: 800, lineHeight: 1.14, letterSpacing: "-0.03em" },
      h3: { fontSize: "clamp(1.45rem, 2.4vw, 1.9rem)", fontWeight: 800, lineHeight: 1.18, letterSpacing: "-0.025em" },
      h4: { fontSize: "clamp(1.3rem, 2vw, 1.65rem)", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" },
      h5: { fontSize: "clamp(1.15rem, 1.6vw, 1.35rem)", fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.012em" },
      h6: { fontSize: "1rem", fontWeight: 750, lineHeight: 1.3 },
      subtitle1: { fontSize: "0.95rem", fontWeight: 700, lineHeight: 1.4 },
      subtitle2: { fontSize: "0.84rem", fontWeight: 700, lineHeight: 1.4 },
      body1: { fontSize: "0.94rem", lineHeight: 1.6 },
      body2: { fontSize: "0.84rem", lineHeight: 1.55 },
      caption: { fontSize: "0.74rem", lineHeight: 1.45, letterSpacing: "0.01em" },
      overline: { fontSize: "0.68rem", fontWeight: 800, lineHeight: 1.5, letterSpacing: "0.09em" },
      button: { fontSize: "0.84rem", fontWeight: 750, lineHeight: 1.2, textTransform: "none", letterSpacing: "0.005em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { backgroundColor: palette.background.default, maxWidth: "100vw", overflowX: "hidden", colorScheme: palette.mode },
          body: { backgroundColor: palette.background.default, color: palette.text.primary, maxWidth: "100vw", overflowX: "hidden", fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"', textRendering: "optimizeLegibility" },
          "*, *::before, *::after": { boxSizing: "border-box" },
          "*:focus-visible": { outline: `3px solid ${focusColor}`, outlineOffset: 2 },
          "::selection": { backgroundColor: alpha(palette.primary.main, 0.28) },
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": { animationDuration: "0.01ms !important", animationIterationCount: "1 !important", transitionDuration: "0.01ms !important", scrollBehavior: "auto !important" },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: "none", maxWidth: "100%", border: `1px solid ${border}` }, rounded: { borderRadius: 12 } },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: { minHeight: `${DESIGN_TOKENS.layout.topBarHeight}px` },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 14, border: `1px solid ${border}`, boxShadow: highContrast ? "none" : makeShadows(mode)[1], backgroundImage: "none", maxWidth: "100%", transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease" },
        },
      },
      MuiCardActionArea: {
        styleOverrides: { root: { borderRadius: "inherit", "&:focus-visible": { outline: `3px solid ${focusColor}`, outlineOffset: -3 } } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { minHeight: DESIGN_TOKENS.controlHeights.standard, borderRadius: 9, paddingInline: 16, gap: 4, transition: "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease", "&:active:not(.Mui-disabled)": { transform: "translateY(1px)" }, "&.Mui-focusVisible": { boxShadow: `0 0 0 3px ${alpha(focusColor, 0.24)}` }, "@media (max-width:599.95px)": { minHeight: DESIGN_TOKENS.controlHeights.touch } },
          contained: { boxShadow: highContrast ? "none" : `0 1px 2px ${alpha(palette.primary.main, 0.22)}`, "&:hover": { boxShadow: highContrast ? "none" : `0 5px 14px ${alpha(palette.primary.main, 0.2)}` } },
          outlined: { borderColor: highContrast ? border : alpha(palette.primary.main, 0.38), borderWidth: highContrast ? 2 : 1 },
          sizeSmall: { minHeight: 34, paddingInline: 12 },
          sizeLarge: { minHeight: 46, paddingInline: 22 },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 9, minWidth: 40, minHeight: 40, transition: "background-color 150ms ease, transform 150ms ease", "&:active:not(.Mui-disabled)": { transform: "scale(0.96)" }, "&.Mui-focusVisible": { boxShadow: `0 0 0 3px ${alpha(focusColor, 0.24)}` }, "@media (max-width:599.95px)": { minWidth: DESIGN_TOKENS.controlHeights.touch, minHeight: DESIGN_TOKENS.controlHeights.touch } } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 750, height: 28 }, sizeSmall: { height: 24, fontSize: "0.7rem" } },
      },
      MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
      MuiFormControl: { defaultProps: { size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 9, backgroundColor: surfaceRaised, minHeight: 40, transition: "box-shadow 150ms ease, background-color 150ms ease", "& fieldset": { borderColor: border, borderWidth: highContrast ? 2 : 1 }, "&:hover fieldset": { borderColor: palette.primary.main }, "&.Mui-focused fieldset": { borderWidth: 2, borderColor: palette.primary.main }, "&.Mui-focused": { boxShadow: `0 0 0 3px ${alpha(focusColor, 0.2)}` }, "&.Mui-disabled": { backgroundColor: alpha(palette.text.disabled, 0.08) } },
          input: { paddingTop: 10, paddingBottom: 10 },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiFormLabel: { styleOverrides: { root: { fontWeight: 700, color: palette.text.primary } } },
      MuiFormHelperText: { styleOverrides: { root: { marginTop: 5, lineHeight: 1.35 } } },
      MuiCheckbox: { styleOverrides: { root: { padding: 8 } } },
      MuiRadio: { styleOverrides: { root: { padding: 8 } } },
      MuiSwitch: { styleOverrides: { root: { padding: 8 }, thumb: { boxShadow: highContrast ? `0 0 0 1px ${border}` : makeShadows(mode)[1] } } },
      MuiTableContainer: { styleOverrides: { root: { maxWidth: "100%", overflowX: "auto", borderRadius: 12, border: `1px solid ${border}`, scrollbarGutter: "stable" } } },
      MuiTableHead: { styleOverrides: { root: { position: "sticky", top: 0, zIndex: 2 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: border, padding: "10px 14px" },
          head: { fontWeight: 800, color: palette.text.secondary, backgroundColor: mode === "light" ? "#f3f6fa" : "#172235", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.055em", whiteSpace: "nowrap" },
          body: { fontSize: "0.82rem" },
        },
      },
      MuiTableRow: { styleOverrides: { root: { transition: "background-color 120ms ease", "&:hover": { backgroundColor: palette.action.hover }, "&:last-child td": { borderBottom: 0 } } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: { height: 3, borderRadius: 3 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 44, textTransform: "none", fontWeight: 750, borderRadius: "8px 8px 0 0" } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 10, border: `1px solid ${border}`, alignItems: "center" }, message: { minWidth: 0 } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${border}`,
            boxShadow: highContrast ? "none" : makeShadows(mode)[4],
            maxHeight: "calc(100dvh - 32px)",
            "@media (max-width:599.95px)": {
              width: "calc(100% - 24px)",
              margin: 12,
              borderRadius: 14,
            },
          },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { padding: "20px 24px 14px", fontSize: "1.05rem", fontWeight: 800 } } },
      MuiDialogContent: { styleOverrides: { root: { padding: "16px 24px" } } },
      MuiDialogActions: { styleOverrides: { root: { padding: "14px 24px 20px", gap: 8 } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
      MuiListItemButton: { styleOverrides: { root: { minHeight: 42, borderRadius: 9, transition: "background-color 140ms ease, color 140ms ease" } } },
      MuiMenu: { styleOverrides: { paper: { marginTop: 6, borderRadius: 12, border: `1px solid ${border}`, boxShadow: highContrast ? "none" : makeShadows(mode)[3] } } },
      MuiMenuItem: { styleOverrides: { root: { minHeight: 40, borderRadius: 7, marginInline: 5 } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 12, border: `1px solid ${border}`, boxShadow: highContrast ? "none" : makeShadows(mode)[3] } } },
      MuiBreadcrumbs: { styleOverrides: { root: { color: palette.text.secondary }, li: { minWidth: 0 } } },
      MuiAvatar: { styleOverrides: { root: { fontWeight: 800 } } },
      MuiLink: { defaultProps: { underline: "hover" }, styleOverrides: { root: { textUnderlineOffset: 3 } } },
      MuiFab: { defaultProps: { disableRipple: false }, styleOverrides: { root: { boxShadow: highContrast ? "none" : makeShadows(mode)[3], textTransform: "none", fontWeight: 750 } } },
      MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 10, boxShadow: highContrast ? "none" : makeShadows(mode)[3] } } },
      MuiTooltip: { defaultProps: { arrow: true, enterDelay: 450 }, styleOverrides: { tooltip: { borderRadius: 7, fontWeight: 650, fontSize: "0.72rem" } } },
      MuiLinearProgress: { styleOverrides: { root: { height: 7, borderRadius: 999 }, bar: { borderRadius: 999 } } },
      MuiSkeleton: { defaultProps: { animation: "wave" }, styleOverrides: { root: { borderRadius: 7 } } },
      MuiAccordion: { styleOverrides: { root: { border: `1px solid ${border}`, borderRadius: "12px !important", boxShadow: "none", "&::before": { display: "none" } } } },
      MuiBottomNavigation: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiBottomNavigationAction: { styleOverrides: { root: { minWidth: 52, "&.Mui-selected": { fontWeight: 800 } }, label: { fontWeight: 700 } } },
      MuiPaginationItem: { styleOverrides: { root: { borderRadius: 8, fontWeight: 700 } } },
    },
  });
}

const appTheme = createAppTheme(COLOR_MODES.LIGHT);
export default appTheme;
