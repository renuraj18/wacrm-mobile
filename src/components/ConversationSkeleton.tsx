import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useTheme } from "@/lib/theme";

/** Placeholder rows shown while the first page of conversations loads. */
export function ConversationSkeleton({ rows = 8 }: { rows?: number }) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }} accessibilityLabel="Loading conversations">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: theme.surface }]} />
          <View style={styles.lines}>
            <View style={[styles.line, { width: `${45 + ((i * 13) % 30)}%`, backgroundColor: theme.surface }]} />
            <View style={[styles.line, { width: `${60 + ((i * 7) % 30)}%`, backgroundColor: theme.surface, height: 12 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  lines: { flex: 1, gap: 8 },
  line: { height: 14, borderRadius: 7 },
});
