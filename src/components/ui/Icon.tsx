import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: ColorValue }) {
  // Tab bars hand us an opaque platform colour; the icon font only needs it passed through.
  return <Ionicons name={name} size={size} color={color as string} />;
}
