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
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
