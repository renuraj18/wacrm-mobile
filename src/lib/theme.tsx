import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

// WhatsApp-like palette in light and dark.
const light = {
  bg: "#ffffff",
  surface: "#f0f2f5",
  chatBg: "#efeae2",
  text: "#111b21",
  muted: "#667781",
  border: "#e9edef",
  primary: "#00a884",
  primaryText: "#ffffff",
  bubbleIn: "#ffffff",
  bubbleOut: "#d9fdd3",
  danger: "#ea0038",
  warn: "#b7791f",
  warnBg: "#fff4e5",
  tick: "#53bdeb",
  // App bar (green in light mode, charcoal in dark mode, like WhatsApp).
  header: "#008069",
  headerText: "#ffffff",
  headerMuted: "#c8e6df",
  // Filter pills, floating button, link colour, swipe actions.
  pillBg: "#f0f2f5",
  pillText: "#54656f",
  pillActiveBg: "#d9fdd3",
  pillActiveText: "#008069",
  fab: "#00a884",
  fabText: "#ffffff",
  link: "#027eb5",
  swipeAssign: "#00a884",
  swipeClose: "#667781",
  swipeUnread: "#53bdeb",
  selected: "#e7f5f1",
};

const dark: typeof light = {
  bg: "#111b21",
  surface: "#202c33",
  chatBg: "#0b141a",
  text: "#e9edef",
  muted: "#8696a0",
  border: "#222d34",
  primary: "#00a884",
  primaryText: "#ffffff",
  bubbleIn: "#202c33",
  bubbleOut: "#005c4b",
  danger: "#f15c6d",
  warn: "#f6ad55",
  warnBg: "#3a2a12",
  tick: "#53bdeb",
  header: "#1f2c34",
  headerText: "#e9edef",
  headerMuted: "#8696a0",
  pillBg: "#202c33",
  pillText: "#8696a0",
  pillActiveBg: "#103629",
  pillActiveText: "#21c063",
  fab: "#00a884",
  fabText: "#0b141a",
  link: "#53bdeb",
  swipeAssign: "#00a884",
  swipeClose: "#53656f",
  swipeUnread: "#2f7fa3",
  selected: "#182b2a",
};

export type Theme = typeof light;
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeState>(() => {
    const isDark = mode === "system" ? system === "dark" : mode === "dark";
    return { theme: isDark ? dark : light, isDark, mode, setMode };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Fallback when rendered outside the provider (tests, early splash). */
function useFallback(): ThemeState {
  const system = useColorScheme();
  const isDark = system === "dark";
  return { theme: isDark ? dark : light, isDark, mode: "system", setMode: () => undefined };
}

export function useThemeState(): ThemeState {
  const ctx = useContext(ThemeContext);
  const fallback = useFallback();
  return ctx ?? fallback;
}

export function useTheme(): Theme {
  return useThemeState().theme;
}
