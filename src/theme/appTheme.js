import { alpha, createTheme } from "@mui/material/styles";

const primaryMain = "#2563eb";
const secondaryMain = "#7c3aed";
const successMain = "#16a34a";
const warningMain = "#d97706";
const errorMain = "#dc2626";
const infoMain = "#0284c7";
const backgroundDefault = "#f5f7fb";
const backgroundPaper = "#ffffff";
const borderColor = "#e5e7eb";
const textPrimary = "#111827";
const textSecondary = "#6b7280";

const shadows = [
  "none",
  "0px 1px 2px rgba(15, 23, 42, 0.06)",
  "0px 4px 12px rgba(15, 23, 42, 0.06)",
  "0px 8px 24px rgba(15, 23, 42, 0.08)",
  "0px 12px 32px rgba(15, 23, 42, 0.1)",
  ...Array(20).fill("0px 12px 32px rgba(15, 23, 42, 0.1)"),
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
    borderRadius: 16,
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
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 800,
      fontSize: "1.35rem",
      letterSpacing: "-0.02em",
    },
    h6: {
      fontWeight: 700,
      fontSize: "1.05rem",
      letterSpacing: "-0.01em",
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
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${borderColor}`,
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 18,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${borderColor}`,
          boxShadow: "0px 8px 24px rgba(15, 23, 42, 0.06)",
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
          borderRadius: 12,
          paddingInline: 16,
        },
        contained: {
          boxShadow: "0px 8px 20px rgba(37, 99, 235, 0.18)",
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
          borderRadius: 12,
          backgroundColor: alpha("#fff", 0.9),
          "& fieldset": {
            borderColor: borderColor,
          },
          "&:hover fieldset": {
            borderColor: alpha(primaryMain, 0.4),
          },
          "&.Mui-focused fieldset": {
            borderWidth: 1.5,
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
        head: {
          fontWeight: 800,
          color: textPrimary,
          backgroundColor: alpha(primaryMain, 0.03),
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