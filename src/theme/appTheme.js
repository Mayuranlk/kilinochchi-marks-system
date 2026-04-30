import { alpha, createTheme } from "@mui/material/styles";

const primaryMain = "#1d4ed8";
const secondaryMain = "#0f766e";
const successMain = "#16a34a";
const warningMain = "#d97706";
const errorMain = "#dc2626";
const infoMain = "#0284c7";
const backgroundDefault = "#f6f7f9";
const backgroundPaper = "#ffffff";
const borderColor = "#dfe3ea";
const textPrimary = "#0f172a";
const textSecondary = "#64748b";

const shadows = [
  "none",
  "0px 1px 2px rgba(15, 23, 42, 0.06)",
  "0px 3px 10px rgba(15, 23, 42, 0.05)",
  "0px 8px 20px rgba(15, 23, 42, 0.07)",
  "0px 12px 28px rgba(15, 23, 42, 0.08)",
  ...Array(20).fill("0px 12px 28px rgba(15, 23, 42, 0.08)"),
];

const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: primaryMain },
    secondary: { main: secondaryMain },
    success: { main: successMain },
    warning: { main: warningMain },
    error: { main: errorMain },
    info: { main: infoMain },
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
    borderRadius: 10,
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
      fontSize: "1.8rem",
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 800,
      fontSize: "1.35rem",
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 700,
      fontSize: "1.05rem",
      letterSpacing: 0,
    },
    subtitle1: {
      fontWeight: 600,
    },
    body1: {
      fontSize: "0.95rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.86rem",
      lineHeight: 1.55,
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
      styleOverrides: {
        root: {
          border: `1px solid ${borderColor}`,
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 10,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          boxShadow: "0px 2px 10px rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 42,
          borderRadius: 8,
          paddingInline: 16,
        },
        contained: {
          boxShadow: "0px 6px 14px rgba(29, 78, 216, 0.16)",
        },
        outlined: {
          borderColor: alpha(primaryMain, 0.25),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
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
          backgroundColor: alpha("#fff", 0.9),
          minHeight: 42,
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
          paddingTop: 11,
          paddingBottom: 11,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: borderColor,
          paddingTop: 10,
          paddingBottom: 10,
        },
        head: {
          fontWeight: 800,
          color: textPrimary,
          backgroundColor: "#f8fafc",
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
          minHeight: 42,
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          padding: 10,
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
          borderRadius: 14,
        },
      },
    },
  },
});

export default appTheme;
