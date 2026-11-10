import * as Clipboard from "expo-clipboard";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { QUICK_EMOJIS } from "@/lib/reactions";
import { useTheme } from "@/lib/theme";
import type { Message } from "@/lib/types";

import { Icon, type IconName } from "./ui/Icon";

interface Props {
  message: Message | null;
  /** The business's current emoji on this message, highlighted in the bar. */
  myEmoji?: string;
  canReact: boolean;
  canReply: boolean;
  canRetry: boolean;
  onClose: () => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
}

/** Long-press sheet: WhatsApp's quick-reaction bar above a short action list. */
export function MessageMenu({ message, myEmoji, canReact, canReply, canRetry, onClose, onReact, onReply, onRetry }: Props) {
  const theme = useTheme();
  if (!message) return null;
  const text = message.content_text?.trim() ?? "";

  const items: { icon: IconName; label: string; onPress: () => void }[] = [];
  if (canReply) items.push({ icon: "arrow-undo-outline", label: "Reply", onPress: () => onReply(message) });
  if (text) {
    items.push({
      icon: "copy-outline",
      label: "Copy",
      onPress: () => {
        void Clipboard.setStringAsync(text).catch((e) => Alert.alert("Couldn't copy", e instanceof Error ? e.message : String(e)));
      },
    });
  }
  if (canRetry) items.push({ icon: "refresh", label: "Retry send", onPress: () => onRetry(message) });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        <View style={styles.col}>
          {canReact && (
            <View style={[styles.bar, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              {QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    onClose();
                    onReact(message, emoji);
                  }}
                  style={[styles.emoji, myEmoji === emoji && { backgroundColor: theme.pillActiveBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={`React ${emoji}`}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {items.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.bg }]}>
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.surface }]}
                  accessibilityRole="button"
                >
                  <Icon name={item.icon} size={22} color={theme.muted} />
                  <Text style={{ color: theme.text, fontSize: 16 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  col: { gap: 12, alignItems: "center" },
  bar: { flexDirection: "row", gap: 2, padding: 6, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth },
  emoji: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 26 },
  card: { minWidth: 220, borderRadius: 14, paddingVertical: 6, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 18, paddingVertical: 14 },
});
