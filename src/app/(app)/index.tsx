import { Link, router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { applyInboxFilter, contactDisplayName, type InboxFilter } from "@/lib/conversations";
import { listTime } from "@/lib/format-time";
import { useInbox } from "@/lib/inbox-store";
import { useTheme } from "@/lib/theme";
import type { Conversation } from "@/lib/types";

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "unread", label: "Unread" },
];

export default function Inbox() {
  const theme = useTheme();
  const { session } = useAuth();
  const { conversations, loading, error, refresh, totalUnread } = useInbox();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const shown = useMemo(
    () => applyInboxFilter(conversations, filter, session?.user.id ?? null, search),
    [conversations, filter, session?.user.id, search],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <Stack.Screen
        options={{
          title: totalUnread > 0 ? `Inbox (${totalUnread})` : "Inbox",
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12} accessibilityLabel="Settings">
                <Text style={{ color: theme.primary, fontSize: 16 }}>Settings</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={styles.top}>
        <TextInput
          style={[styles.search, { backgroundColor: theme.surface, color: theme.text }]}
          placeholder="Search name, phone or message"
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.chip, { backgroundColor: active ? theme.primary : theme.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? theme.primaryText : theme.muted, fontWeight: "600" }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error && <Text style={[styles.error, { color: theme.danger }]}>Couldn&apos;t load conversations: {error}</Text>}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <Row conv={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No conversations</Text>}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const STATUS_COLOR = { open: "#00a884", pending: "#d69e2e", closed: "#8696a0" } as const;

function Row({ conv }: { conv: Conversation }) {
  const theme = useTheme();
  const name = contactDisplayName(conv.contact);
  const unread = conv.unread_count > 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: conv.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${name}`}
    >
      <Avatar name={name} uri={conv.contact?.avatar_url} />
      <View style={styles.flex}>
        <View style={styles.line}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: unread ? theme.primary : theme.muted, fontSize: 12 }}>{listTime(conv.last_message_at)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={[styles.preview, { color: theme.muted }]} numberOfLines={1}>
            {conv.last_message_text || "No messages yet"}
          </Text>
          <View style={styles.badges}>
            {unread && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>{conv.unread_count}</Text>
              </View>
            )}
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[conv.status] }]} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { padding: 12, gap: 10 },
  search: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
  loader: { marginTop: 40 },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  preview: { fontSize: 14, flex: 1, marginTop: 2 },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  empty: { textAlign: "center", marginTop: 40 },
});
