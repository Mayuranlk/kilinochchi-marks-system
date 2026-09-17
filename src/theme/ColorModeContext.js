import { createContext, useContext } from "react";

export const ColorModeContext = createContext({
  mode: "light",
  setMode: () => undefined,
  cycleMode: () => undefined,
});

export const useColorMode = () => useContext(ColorModeContext);
