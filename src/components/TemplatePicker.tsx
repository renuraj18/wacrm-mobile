import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
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
  const { session } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [headerText, setHeaderText] = useState("");
  const favoriteKey = `wacrm.favorite-templates.${session?.user.id ?? "signed-out"}`;

  // Mounted only while open (see Composer), so state starts fresh each time.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    supabase
      .from("message_templates")
      .select("*")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          Alert.alert("Couldn't load templates", error.message);
          setLoading(false);
          return;
        }
        setTemplates((data as MessageTemplate[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void AsyncStorage.getItem(favoriteKey)
      .then((saved) => {
        if (!saved) {
          if (!cancelled) setFavorites([]);
          return;
        }
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
          throw new Error("Saved template favorites have an invalid format.");
        }
        if (!cancelled) setFavorites(parsed);
      })
      .catch((error: unknown) => {
        if (!cancelled) Alert.alert("Template favorites", error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setFavoritesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [favoriteKey, visible]);

  const visibleTemplates = templates
    .filter((template) => {
      const q = query.trim().toLowerCase();
      return !q || template.name.toLowerCase().includes(q) || template.body_text.toLowerCase().includes(q);
    })
    .sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));

  const toggleFavorite = (template: MessageTemplate) => {
    const next = favorites.includes(template.id)
      ? favorites.filter((id) => id !== template.id)
      : [...favorites, template.id];
    void AsyncStorage.setItem(favoriteKey, JSON.stringify(next))
      .then(() => setFavorites(next))
      .catch((error: unknown) =>
        Alert.alert("Couldn't save favorite", error instanceof Error ? error.message : String(error)),
      );
  };

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
          <>
            <TextInput
              style={[styles.search, { backgroundColor: theme.surface, color: theme.text }]}
              placeholder="Search templates"
              placeholderTextColor={theme.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <FlatList
              data={visibleTemplates}
              keyExtractor={(t) => t.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[styles.msg, { color: theme.muted }]}>No matching approved templates</Text>}
              renderItem={({ item }) => (
                <View style={[styles.row, { borderBottomColor: theme.border }]}>
                  <Pressable style={styles.templateBody} onPress={() => choose(item)}>
                    <Text style={{ color: theme.text, fontWeight: "600" }}>{item.name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={2}>
                      {item.body_text}
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 11 }}>
                      {item.category} · {item.language}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleFavorite(item)}
                    disabled={!favoritesLoaded}
                    hitSlop={8}
                    accessibilityLabel={`${favorites.includes(item.id) ? "Remove" : "Add"} ${item.name} ${favorites.includes(item.id) ? "from" : "to"} favorites`}
                  >
                    <Text style={[styles.star, { color: favorites.includes(item.id) ? theme.primary : theme.muted }]}>
                      {favorites.includes(item.id) ? "★" : "☆"}
                    </Text>
                  </Pressable>
                </View>
              )}
            />
          </>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  templateBody: { flex: 1, gap: 4 },
  star: { fontSize: 24 },
  search: { margin: 12, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  form: { padding: 16, gap: 8 },
  field: { gap: 4 },
  input: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  preview: { borderRadius: 10, padding: 10, gap: 4 },
  send: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
