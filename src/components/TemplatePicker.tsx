import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { extractTemplateVariables, renderTemplateBody } from "@/lib/templates";
import { useTheme } from "@/lib/theme";
import type { MessageTemplate } from "@/lib/types";

import { SheetModal } from "./SheetModal";

export interface TemplateValues {
  body: string[];
  headerText?: string;
}

/**
 * Approved templates (account-scoped by RLS, like the web picker). Body
 * and text-header variables are collected before sending. Templates with
 * URL-button variables aren't fillable here yet — use the web for those.
 */
export function TemplatePicker({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (t: MessageTemplate, values: TemplateValues) => void;
}) {
  const theme = useTheme();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [headerText, setHeaderText] = useState("");

  // Mounted only while open (see Composer), so state starts fresh each time.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    supabase
      .from("message_templates")
      .select("*")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setTemplates((data as MessageTemplate[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const vars = selected ? extractTemplateVariables(selected.body_text) : [];
  const headerVar =
    selected?.header_type === "text" && selected.header_content
      ? (extractTemplateVariables(selected.header_content)[0] ?? null)
      : null;
  const ready = vars.every((_, i) => params[i]?.trim()) && (!headerVar || headerText.trim());

  const choose = (t: MessageTemplate) => {
    setSelected(t);
    setParams(extractTemplateVariables(t.body_text).map(() => ""));
    setHeaderText("");
  };

  const input = [styles.input, { backgroundColor: theme.surface, color: theme.text }];

  return (
    <SheetModal
      visible={visible}
      title={selected ? selected.name : "Templates"}
      onClose={onClose}
      left={
        selected ? (
          <Pressable onPress={() => setSelected(null)} hitSlop={12}>
            <Text style={{ color: theme.primary, fontSize: 16 }}>Back</Text>
          </Pressable>
        ) : null
      }
    >
      {!selected ? (
        loading ? (
          <ActivityIndicator style={styles.msg} color={theme.primary} />
        ) : (
          <FlatList
            data={templates}
            keyExtractor={(t) => t.id}
            ListEmptyComponent={<Text style={[styles.msg, { color: theme.muted }]}>No approved templates</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { backgroundColor: theme.surface }]}
                onPress={() => choose(item)}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>{item.name}</Text>
                <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={2}>
                  {item.body_text}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 11 }}>
                  {item.category} · {item.language}
                </Text>
              </Pressable>
            )}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {headerVar && (
            <>
              <Text style={{ color: theme.muted }}>Header {`{{${headerVar}}}`}</Text>
              <TextInput style={input} value={headerText} onChangeText={setHeaderText} />
            </>
          )}
          {vars.map((v, i) => (
            <View key={v} style={styles.field}>
              <Text style={{ color: theme.muted }}>{`{{${v}}}`}</Text>
              <TextInput
                style={input}
                value={params[i]}
                onChangeText={(s) => setParams((prev) => prev.map((p, j) => (j === i ? s : p)))}
              />
            </View>
          ))}
          <Text style={{ color: theme.muted, marginTop: 8 }}>Preview</Text>
          <View style={[styles.preview, { backgroundColor: theme.bubbleOut }]}>
            <Text style={{ color: theme.text }}>{renderTemplateBody(selected.body_text, params)}</Text>
            {selected.footer_text && <Text style={{ color: theme.muted, fontSize: 12 }}>{selected.footer_text}</Text>}
          </View>
          <Pressable
            style={[styles.send, { backgroundColor: theme.primary, opacity: ready ? 1 : 0.5 }]}
            disabled={!ready}
            onPress={() => onSend(selected, { body: params, headerText: headerVar ? headerText : undefined })}
          >
            <Text style={styles.sendText}>Send template</Text>
          </Pressable>
        </ScrollView>
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  msg: { textAlign: "center", margin: 20 },
  row: { padding: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  form: { padding: 16, gap: 8 },
  field: { gap: 4 },
  input: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  preview: { borderRadius: 10, padding: 10, gap: 4 },
  send: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
