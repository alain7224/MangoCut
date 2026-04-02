import React, { createContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import light from "../themes/light";
import dark from "../themes/dark";

const STORAGE_KEY = "mangocut.theme";

export const ThemeContext = createContext({
  theme: dark,
  mode: "dark",
  toggleTheme: async () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === "light" || saved === "dark") setMode(saved);
      } catch {}
    })();
  }, []);

  const theme = mode === "dark" ? dark : light;

  const toggleTheme = async () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const value = useMemo(() => ({ theme, mode, toggleTheme }), [theme, mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
