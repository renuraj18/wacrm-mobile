import { Pressable, StyleSheet, Text, View } from "react-native";

import { previewText } from "@/lib/preview";
import { useTheme } from "@/lib/theme";
import type { Message } from "@/lib/types";

import { Icon } from "./ui/Icon";

/** "Replying to …" strip shown above the composer input. */
export function ReplyBar({ message, peerName, onCancel }: { message: Message; peerName: string; onCancel: () => void }) {
  const theme = useTheme();
  const mine = message.sender_type !== "customer";
  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg }]}>
      <View style={[styles.accent, { backgroundColor: mine ? theme.primary : theme.tick }]} />
      <View style={styles.flex}>
        <Text style={{ color: mine ? theme.primary : theme.tick, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
          {mine ? "You" : peerName}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14 }} numberOfLines={1}>
          {previewText(message.content_type, message.content_text)}
        </Text>
      </View>
      <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel reply">
        <Icon name="close" size={22} color={theme.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 8, paddingLeft: 0, overflow: "hidden" },
  accent: { width: 4, alignSelf: "stretch", borderRadius: 2 },
});
