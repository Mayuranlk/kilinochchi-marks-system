import { alpha, createTheme } from "@mui/material/styles";

const primaryMain = "#2563eb";
const secondaryMain = "#0d9488";
const successMain = "#16a34a";
const warningMain = "#f59e0b";
const errorMain = "#dc2626";
const infoMain = "#0284c7";
const backgroundDefault = "#f8fafc";
const backgroundPaper = "#ffffff";
const borderColor = "#e2e8f0";
const textPrimary = "#0f172a";
const textSecondary = "#64748b";

const shadows = [
  "none",
  "0px 1px 2px rgba(15, 23, 42, 0.05)",
  "0px 2px 8px rgba(15, 23, 42, 0.05)",
  "0px 8px 18px rgba(15, 23, 42, 0.06)",
  "0px 12px 26px rgba(15, 23, 42, 0.07)",
  ...Array(20).fill("0px 12px 26px rgba(15, 23, 42, 0.07)"),
];

const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: primaryMain, light: "#dbeafe", dark: "#1d4ed8" },
    secondary: { main: secondaryMain, light: "#ccfbf1", dark: "#0f766e" },
    success: { main: successMain, light: "#dcfce7", dark: "#15803d" },
    warning: { main: warningMain, light: "#fef3c7", dark: "#b45309" },
    error: { main: errorMain, light: "#fee2e2", dark: "#b91c1c" },
    info: { main: infoMain, light: "#e0f2fe", dark: "#0369a1" },
    background: {
      default: backgroundDefault,
      paper: backgroundPaper,
    },
    divider: borderColor,
    text: {
      primary: textPrimary,
      secondary: textSecondary,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  shadows,
  typography: {
    fontFamily: [
      "Inter",
      "Roboto",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "sans-serif",
    ].join(","),
    h4: {
      fontWeight: 800,
      fontSize: "1.72rem",
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 800,
      fontSize: "1.28rem",
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 700,
      fontSize: "1rem",
      letterSpacing: 0,
    },
    subtitle1: {
      fontWeight: 600,
    },
    body1: {
      fontSize: "0.94rem",
      lineHeight: 1.58,
    },
    body2: {
      fontSize: "0.84rem",
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
      letterSpacing: 0,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: backgroundDefault,
          color: textPrimary,
          maxWidth: "100vw",
          overflowX: "hidden",
        },
        html: {
          backgroundColor: backgroundDefault,
          maxWidth: "100vw",
          overflowX: "hidden",
        },
        "*": {
          boxSizing: "border-box",
        },
        "::selection": {
          backgroundColor: alpha(primaryMain, 0.16),
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: `1px solid ${borderColor}`,
          backgroundImage: "none",
          maxWidth: "100%",
        },
        rounded: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          boxShadow: "0px 1px 3px rgba(15, 23, 42, 0.04)",
          backgroundImage: "none",
          maxWidth: "100%",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 8,
          paddingInline: 16,
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: alpha(primaryMain, 0.25),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          height: 28,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#fff",
          minHeight: 40,
          "& fieldset": {
            borderColor: borderColor,
          },
          "&:hover fieldset": {
            borderColor: alpha(primaryMain, 0.4),
          },
          "&.Mui-focused fieldset": {
            borderWidth: 1.5,
            boxShadow: `0 0 0 3px ${alpha(primaryMain, 0.1)}`,
          },
        },
        input: {
          paddingTop: 10,
          paddingBottom: 10,
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: "small",
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: borderColor,
          paddingTop: 9,
          paddingBottom: 9,
        },
        head: {
          fontWeight: 800,
          color: "#334155",
          backgroundColor: "#f8fafc",
          fontSize: "0.76rem",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: alpha(primaryMain, 0.035),
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 8,
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          padding: 8,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 42,
        },
        indicator: {
          height: 3,
          borderRadius: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          textTransform: "none",
          fontWeight: 700,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid transparent",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 800,
        },
      },
    },
  },
});

export default appTheme;
