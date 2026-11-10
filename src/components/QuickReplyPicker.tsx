import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text } from "react-native";

import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { InteractivePayload } from "@/lib/types";

import { SheetModal } from "./SheetModal";

/** Row shape of the CRM's `quick_replies` table (wacrm migration 035). */
export interface QuickReply {
  id: string;
  title: string;
  kind: "text" | "interactive";
  content_text: string | null;
  interactive_payload: InteractivePayload | null;
}

/**
 * Quick replies managed in the CRM (Settings) and shared by the whole
 * account. Read-only here: text replies are inserted into the composer,
 * interactive replies are sent as they are.
 */
export function QuickReplyPicker({
  visible,
  onClose,
  onSelectText,
  onSelectInteractive,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectText: (body: string) => void;
  onSelectInteractive: (payload: InteractivePayload) => void;
}) {
  const theme = useTheme();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    supabase
      .from("quick_replies")
      .select("id, title, kind, content_text, interactive_payload")
      .order("title", { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setReplies((data as QuickReply[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const choose = (r: QuickReply) => {
    if (r.kind === "interactive" && r.interactive_payload) onSelectInteractive(r.interactive_payload);
    else if (r.content_text) onSelectText(r.content_text);
    onClose();
  };

  return (
    <SheetModal visible={visible} title="Quick replies" onClose={onClose}>
      {loading ? (
        <ActivityIndicator style={styles.msg} color={theme.primary} />
      ) : (
        <FlatList
          data={replies}
          keyExtractor={(r) => r.id}
          ListEmptyComponent={
            <Text style={[styles.msg, { color: theme.muted }]}>
              {error ?? "No quick replies yet. Add them in the CRM under Settings."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { backgroundColor: theme.surface }]}
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={`Use quick reply ${item.title}`}
            >
              <Text style={{ color: theme.text, fontWeight: "600" }}>
                {item.kind === "interactive" ? "🔘 " : "⚡ "}
                {item.title}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={2}>
                {item.kind === "interactive" ? item.interactive_payload?.body : item.content_text}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  msg: { textAlign: "center", margin: 20 },
  row: { padding: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
});
