import { FlashList } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { contactDisplayName, contactHandle } from "@/lib/conversations";
import { contactInitial, filterContacts, sortContacts } from "@/lib/contacts";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { Contact } from "@/lib/types";

import { Avatar } from "./Avatar";
import { Icon } from "./ui/Icon";

type Item = { type: "header"; key: string; letter: string } | { type: "contact"; key: string; contact: Contact };

function toItems(contacts: Contact[]): Item[] {
  const items: Item[] = [];
  let last = "";
  for (const contact of contacts) {
    const letter = contactInitial(contact);
    if (letter !== last) {
      items.push({ type: "header", key: `h-${letter}`, letter });
      last = letter;
    }
    items.push({ type: "contact", key: contact.id, contact });
  }
  return items;
}

/** Searchable, alphabetised contact list. Contacts load straight from Supabase (RLS-scoped). */
export function ContactList({ onPick, autoFocusSearch }: { onPick: (contact: Contact) => void; autoFocusSearch?: boolean }) {
  const theme = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("contacts").select("*").order("name", { ascending: true }).limit(2000);
    if (err) setError(err.message);
    else {
      setError(null);
      setContacts(sortContacts((data ?? []) as Contact[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const items = useMemo(() => toItems(filterContacts(contacts, search)), [contacts, search]);

  return (
    <View style={styles.flex}>
      <View style={[styles.searchWrap, { backgroundColor: theme.surface }]}>
        <Icon name="search" size={18} color={theme.muted} />
        <TextInput
          style={[styles.search, { color: theme.text }]}
          placeholder="Search name, phone or company"
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoFocus={autoFocusSearch}
          clearButtonMode="while-editing"
        />
      </View>
      {error && <Text style={[styles.error, { color: theme.danger }]}>Couldn&apos;t load contacts: {error}</Text>}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.type}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No contacts found</Text>}
          renderItem={({ item }) =>
            item.type === "header" ? (
              <Text style={[styles.letter, { color: theme.primary }]}>{item.letter}</Text>
            ) : (
              <Pressable
                onPress={() => onPick(item.contact)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surface }]}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${contactDisplayName(item.contact)}`}
              >
                <Avatar name={contactDisplayName(item.contact)} uri={item.contact.avatar_url} size={44} />
                <View style={styles.flex}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {contactDisplayName(item.contact)}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={1}>
                    {[contactHandle(item.contact), item.contact.company].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Pressable>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    height: 44,
  },
  search: { flex: 1, fontSize: 16, paddingVertical: 0 },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
  loader: { marginTop: 40 },
  letter: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, fontSize: 14, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 40 },
});
