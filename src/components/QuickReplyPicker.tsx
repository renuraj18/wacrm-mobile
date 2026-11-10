import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

import { SheetModal } from "./SheetModal";

interface QuickReply {
  id: string;
  title: string;
  body: string;
}

export function QuickReplyPicker({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}) {
  const theme = useTheme();
  const { session } = useAuth();
  const storageKey = `wacrm.quick-replies.${session?.user.id ?? "signed-out"}`;
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void AsyncStorage.getItem(storageKey)
      .then((saved) => {
        if (!saved) {
          if (!cancelled) setReplies([]);
          return;
        }
        const parsed: unknown = JSON.parse(saved);
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.title === "string" &&
              typeof item.body === "string",
          )
        ) {
          throw new Error("Saved quick replies have an invalid format.");
        }
        if (!cancelled) setReplies(parsed as QuickReply[]);
      })
      .catch((error: unknown) => {
        if (!cancelled) Alert.alert("Quick replies", error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey, visible]);

  const addReply = async () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;
    const next = [...replies, { id: `${Date.now()}`, title: cleanTitle, body: cleanBody }];
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setReplies(next);
      setTitle("");
      setBody("");
    } catch (error) {
      Alert.alert("Couldn't save quick reply", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const removeReply = (reply: QuickReply) => {
    Alert.alert("Delete quick reply?", reply.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const next = replies.filter((item) => item.id !== reply.id);
          void AsyncStorage.setItem(storageKey, JSON.stringify(next))
            .then(() => setReplies(next))
            .catch((error: unknown) =>
              Alert.alert("Couldn't delete quick reply", error instanceof Error ? error.message : String(error)),
            );
        },
      },
    ]);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.surface, color: theme.text }];

  return (
    <SheetModal visible={visible} title="Quick replies" onClose={onClose}>
      {loading ? (
        <ActivityIndicator style={styles.center} color={theme.primary} />
      ) : (
        <FlatList
          data={replies}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.center, { color: theme.muted }]}>No quick replies saved on this device.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.replyRow, { borderBottomColor: theme.border }]}>
              <Pressable style={styles.replyBody} onPress={() => onSelect(item.body)}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>{item.title}</Text>
                <Text style={{ color: theme.muted }} numberOfLines={2}>{item.body}</Text>
              </Pressable>
              <Pressable onPress={() => removeReply(item)} hitSlop={8} accessibilityLabel={`Delete ${item.title}`}>
                <Text style={{ color: theme.danger }}>Delete</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.form}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Add a quick reply</Text>
              <TextInput
                style={inputStyle}
                value={title}
                onChangeText={setTitle}
                placeholder="Shortcut name"
                placeholderTextColor={theme.muted}
                maxLength={60}
              />
              <TextInput
                style={[inputStyle, styles.bodyInput]}
                value={body}
                onChangeText={setBody}
                placeholder="Reply text"
                placeholderTextColor={theme.muted}
                multiline
                maxLength={4096}
              />
              <Pressable
                onPress={() => void addReply()}
                disabled={saving || !title.trim() || !body.trim()}
                style={[styles.addButton, { backgroundColor: theme.primary, opacity: saving || !title.trim() || !body.trim() ? 0.5 : 1 }]}
              >
                <Text style={styles.addButtonText}>{saving ? "Saving…" : "Save quick reply"}</Text>
              </Pressable>
              <Text style={{ color: theme.muted, fontSize: 12, textAlign: "center" }}>
                Quick replies are stored only on this device.
              </Text>
            </View>
          }
        />
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center", margin: 20 },
  replyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  replyBody: { flex: 1, gap: 4 },
  form: { padding: 16, gap: 10 },
  formTitle: { fontSize: 16, fontWeight: "700" },
  input: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  bodyInput: { minHeight: 88, textAlignVertical: "top" },
  addButton: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  addButtonText: { color: "#fff", fontWeight: "600" },
});
