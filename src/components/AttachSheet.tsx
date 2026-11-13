import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

import { Icon, type IconName } from "./ui/Icon";

export type AttachKind = "document" | "camera" | "gallery" | "video" | "product" | "template" | "ai";

const ITEMS: { kind: AttachKind; label: string; icon: IconName; color: string }[] = [
  { kind: "document", label: "Document", icon: "document-text", color: "#5f66cd" },
  { kind: "camera", label: "Camera", icon: "camera", color: "#d3396d" },
  { kind: "gallery", label: "Gallery", icon: "image", color: "#ac44cf" },
  { kind: "video", label: "Video", icon: "videocam", color: "#e55c3d" },
  { kind: "product", label: "Product", icon: "pricetag", color: "#e8941a" },
  { kind: "template", label: "Template", icon: "reader", color: "#0f9d8a" },
  { kind: "ai", label: "AI draft", icon: "sparkles", color: "#1fa855" },
];

/** WhatsApp-style attachment grid, shown as a bottom sheet. */
export function AttachSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: AttachKind) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close attachments">
        <Pressable style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: 20 + insets.bottom }]}>
          <View style={styles.grid}>
            {ITEMS.map((item) => (
              <Pressable
                key={item.kind}
                style={styles.cell}
                onPress={() => {
                  onClose();
                  onSelect(item.kind);
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={[styles.circle, { backgroundColor: item.color }]}>
                  <Icon name={item.icon} size={26} color="#fff" />
                </View>
                <Text style={{ color: theme.muted, fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 22, paddingHorizontal: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "25%", alignItems: "center", gap: 8, paddingVertical: 12 },
  circle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
});
