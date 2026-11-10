import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

import { Icon, type IconName } from "./Icon";

export interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** WhatsApp-style app bar used by the tab screens (the stack screens use the native header). */
export function ScreenHeader({
  title,
  actions = [],
  left,
  children,
}: {
  title: string;
  actions?: HeaderAction[];
  /** Replaces the title area, e.g. a back arrow while multi-selecting. */
  left?: ReactNode;
  /** Extra rows under the bar (search, pills). */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.header, paddingTop: insets.top }}>
      <View style={styles.bar}>
        {left ?? <Text style={[styles.title, { color: theme.headerText }]}>{title}</Text>}
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={a.label}>
              <Icon name={a.icon} size={24} color={theme.headerText} />
            </Pressable>
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "700", flexShrink: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 22 },
});
