import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ConversationRow, type RowAction } from "@/components/ConversationRow";
import { ConversationSkeleton } from "@/components/ConversationSkeleton";
import { Fab } from "@/components/ui/Fab";
import { Icon } from "@/components/ui/Icon";
import { ScreenHeader, type HeaderAction } from "@/components/ui/ScreenHeader";
import { useAuth } from "@/lib/auth";
import { changesFor, updateConversation } from "@/lib/conversation-actions";
import { applyInboxFilter, type InboxFilter } from "@/lib/conversations";
import { useInbox } from "@/lib/inbox-store";
import { useTheme } from "@/lib/theme";
import type { Conversation } from "@/lib/types";

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mine", label: "Mine" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" },
];

export default function Chats() {
  const theme = useTheme();
  const { session, canSend } = useAuth();
  const { conversations, loading, error, refresh, patch } = useInbox();
  const myId = session?.user.id ?? null;

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const selecting = selected.size > 0;

  const shown = useMemo(() => applyInboxFilter(conversations, filter, myId, search), [conversations, filter, myId, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const run = useCallback(
    async (targets: Conversation[], action: RowAction) => {
      const changes = changesFor(targets, action, myId);
      if (!changes) return;
      const results = await Promise.allSettled(targets.map((c) => updateConversation(c.id, changes)));
      let failed = 0;
      results.forEach((r, i) => {
        if (r.status === "fulfilled") patch(targets[i].id, r.value);
        else failed += 1;
      });
      if (failed) Alert.alert("Update failed", `${failed} of ${targets.length} conversations couldn't be updated.`);
    },
    [myId, patch],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPress = useCallback(
    (conv: Conversation) => {
      if (selecting) toggle(conv.id);
      else router.push({ pathname: "/chat/[id]", params: { id: conv.id } });
    },
    [selecting, toggle],
  );

  const onLongPress = useCallback(
    (conv: Conversation) => {
      if (canSend) toggle(conv.id);
    },
    [canSend, toggle],
  );

  const onAction = useCallback((conv: Conversation, action: RowAction) => void run([conv], action), [run]);

  const selectedConversations = useMemo(() => conversations.filter((c) => selected.has(c.id)), [conversations, selected]);
  const bulk = async (action: RowAction) => {
    const targets = selectedConversations;
    setSelected(new Set());
    await run(targets, action);
  };

  // ---- Header: normal / searching / selecting -----------------------
  let header: React.ReactNode;
  if (selecting) {
    const actions: HeaderAction[] = [
      { icon: "mail-unread-outline", label: "Mark unread", onPress: () => void bulk("mark-unread") },
      { icon: "person-add-outline", label: "Assign to me", onPress: () => void bulk("toggle-mine") },
      { icon: "checkmark-done-outline", label: "Close or reopen", onPress: () => void bulk("toggle-closed") },
    ];
    header = (
      <ScreenHeader
        title=""
        actions={actions}
        left={
          <View style={styles.selectLeft}>
            <Pressable onPress={() => setSelected(new Set())} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear selection">
              <Icon name="arrow-back" size={24} color={theme.headerText} />
            </Pressable>
            <Text style={[styles.selectCount, { color: theme.headerText }]}>{selected.size}</Text>
          </View>
        }
      />
    );
  } else if (searching) {
    header = (
      <ScreenHeader
        title=""
        left={
          <View style={styles.selectLeft}>
            <Pressable
              onPress={() => {
                setSearching(false);
                setSearch("");
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close search"
            >
              <Icon name="arrow-back" size={24} color={theme.headerText} />
            </Pressable>
            <TextInput
              style={[styles.headerSearch, { color: theme.headerText }]}
              placeholder="Search name, phone or message"
              placeholderTextColor={theme.headerMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        }
      />
    );
  } else {
    header = (
      <ScreenHeader title="Shanthi Inbox" actions={[{ icon: "search", label: "Search", onPress: () => setSearching(true) }]} />
    );
  }

  const pills = (
    <View style={styles.pills}>
      {FILTERS.map((f) => {
        const active = f.value === filter;
        return (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.pill, { backgroundColor: active ? theme.pillActiveBg : theme.pillBg }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? theme.pillActiveText : theme.pillText, fontWeight: "600" }}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      {header}
      {error && <Text style={[styles.error, { color: theme.danger }]}>Couldn&apos;t load conversations: {error}</Text>}
      {loading ? (
        <>
          {pills}
          <ConversationSkeleton />
        </>
      ) : (
        <FlashList
          data={shown}
          extraData={selected}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={pills}
          renderItem={({ item }) => (
            <ConversationRow
              conv={item}
              myId={myId}
              selected={selected.has(item.id)}
              selecting={selecting}
              canAct={canSend}
              onPress={onPress}
              onLongPress={onLongPress}
              onAction={onAction}
            />
          )}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.muted }]}>
              {search || filter !== "all" ? "No conversations match" : "No conversations yet"}
            </Text>
          }
        />
      )}
      {canSend && !selecting && !searching && <Fab icon="chatbubble-ellipses" label="New chat" onPress={() => router.push("/new-chat")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  error: { paddingHorizontal: 16, paddingTop: 8 },
  empty: { textAlign: "center", marginTop: 40 },
  selectLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  selectCount: { fontSize: 20, fontWeight: "600" },
  headerSearch: { flex: 1, fontSize: 17, paddingVertical: 0 },
});
