import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

export function SheetModal({
  visible,
  title,
  onClose,
  left,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  left?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.side}>{left}</View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <View style={[styles.side, styles.end]}>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={{ color: theme.primary, fontSize: 16 }}>Close</Text>
            </Pressable>
          </View>
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 70 },
  end: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
});
