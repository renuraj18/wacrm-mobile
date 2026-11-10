import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Composer, type MediaSend } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import type { TemplateValues } from "@/components/TemplatePicker";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { contactDisplayName } from "@/lib/conversations";
import { dayLabel } from "@/lib/format-time";
import { useInbox } from "@/lib/inbox-store";
import {
  applyMessageUpdate,
  applyRealtimeInsert,
  confirmedSendUpdate,
  isTempMessage,
  mergeFetchedPage,
  newTempMessageId,
  prependOlder,
} from "@/lib/optimistic";
import { sessionWindow } from "@/lib/session-window";
import { supabase } from "@/lib/supabase";
import { renderTemplateBody, templateHeaderMediaUrl } from "@/lib/templates";
import { useTheme } from "@/lib/theme";
import type { Conversation, Message, MessageTemplate } from "@/lib/types";
import { deleteChatMedia } from "@/lib/upload";

const PAGE = 50;

type Row = { type: "msg"; m: Message } | { type: "day"; key: string; label: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, canSend } = useAuth();
  const { conversations, setActiveId, ensure } = useInbox();
  const conversation = conversations.find((c) => c.id === id);
  const [fallbackConv, setFallbackConv] = useState<Conversation | null>(null);
  const conv = conversation ?? fallbackConv;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Opened from a notification before the inbox knew this conversation.
  useEffect(() => {
    if (!conversation && id) void ensure(id).then((c) => c && setFallbackConv(c));
  }, [conversation, id, ensure]);

  useEffect(() => {
    setActiveId(id ?? null);
    return () => setActiveId(null);
  }, [id, setActiveId]);

  const fetchNewest = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE);
    if (error) Alert.alert("Couldn't load messages", error.message);
    else {
      const page = ((data ?? []) as Message[]).reverse();
      setHasOlder(page.length === PAGE);
      setMessages((prev) => mergeFetchedPage(prev, page));
    }
    setLoading(false);
  }, [id]);

  // Each chat is its own screen instance (keyed by route), so state starts
  // empty — just load the newest page.
  useEffect(() => {
    void Promise.resolve().then(fetchNewest);
  }, [fetchNewest]);

  const loadOlder = useCallback(async () => {
    const oldest = messages.find((m) => !isTempMessage(m));
    if (!id || !oldest || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .lte("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE);
    setLoadingOlder(false);
    if (error) return Alert.alert("Couldn't load earlier messages", error.message);
    const page = ((data ?? []) as Message[]).reverse();
    setHasOlder(page.length === PAGE);
    setMessages((prev) => prependOlder(prev, page));
  }, [id, messages, loadingOlder, hasOlder]);

  // Mark read on open, and again whenever new inbound messages bump the
  // server count while the chat is on screen (same as the web thread).
  const serverUnread = conversation?.unread_count ?? fallbackConv?.unread_count ?? 0;
  const [markedFor, setMarkedFor] = useState(0);
  useEffect(() => {
    if (!id) return;
    void supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", id)
      .gt("unread_count", 0)
      .then(({ error }) => error && console.warn("unread reset failed", error.message));
  }, [id, serverUnread, markedFor]);

  const connected = useRealtime(
    `chat-${id}`,
    [
      {
        table: "messages",
        filter: `conversation_id=eq.${id}`,
        onChange: (p) => {
          if (p.eventType === "INSERT") {
            const m = p.new as unknown as Message;
            setMessages((prev) => applyRealtimeInsert(prev, m));
            if (m.sender_type === "customer") setMarkedFor((n) => n + 1);
          } else if (p.eventType === "UPDATE") {
            const m = p.new as unknown as Message;
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
          }
        },
      },
    ],
    !!id,
  );
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && wasConnected.current === false && !loading) void fetchNewest();
    wasConnected.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const session = useMemo(() => sessionWindow(messages, now), [messages, now]);

  // ---- Sending — same bodies as wacrm message-thread.tsx -------------
  const sendWith = useCallback(
    async (optimistic: Message, body: Record<string, unknown>, cleanupPath?: string) => {
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await api("/api/whatsapp/send", { method: "POST", body: { conversation_id: id, ...body } });
        setMessages((prev) => applyMessageUpdate(prev, optimistic.id, confirmedSendUpdate(res)));
      } catch (e) {
        setMessages((prev) => applyMessageUpdate(prev, optimistic.id, { status: "failed" }));
        if (cleanupPath) deleteChatMedia(cleanupPath);
        Alert.alert("Message not sent", e instanceof Error ? e.message : String(e));
      }
    },
    [id],
  );

  const temp = (fields: Partial<Message>): Message => ({
    id: newTempMessageId(),
    conversation_id: id!,
    sender_type: "agent",
    content_type: "text",
    status: "sending",
    created_at: new Date().toISOString(),
    ...fields,
  });

  const onSendText = (text: string) =>
    sendWith(temp({ content_text: text }), { message_type: "text", content_text: text });

  const onSendMedia = (m: MediaSend) =>
    sendWith(
      temp({ content_type: m.kind, content_text: m.caption, media_url: m.mediaUrl }),
      { message_type: m.kind, media_url: m.mediaUrl, content_text: m.caption },
      m.path,
    );

  const onSendTemplate = (t: MessageTemplate, v: TemplateValues) => {
    const rendered = renderTemplateBody(t.body_text, v.body);
    return sendWith(
      temp({
        content_type: "template",
        content_text: rendered,
        template_name: t.name,
        media_url: templateHeaderMediaUrl(t),
      }),
      {
        message_type: "template",
        template_name: t.name,
        template_language: t.language,
        template_message_params: { body: v.body, headerText: v.headerText },
        template_params: v.body,
        content_text: rendered,
      },
    );
  };

  // Inverted list: newest first, with a day separator after each day's block.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      out.push({ type: "msg", m });
      const prev = messages[i - 1];
      if (!prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()) {
        out.push({ type: "day", key: `day-${m.created_at.slice(0, 10)}-${i}`, label: dayLabel(m.created_at) });
      }
    }
    return out;
  }, [messages]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const name = contactDisplayName(conv?.contact);

  return (
    <View style={[styles.flex, { backgroundColor: theme.chatBg }]}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={() => router.push({ pathname: "/contact/[id]", params: { id: id! } })}
              accessibilityLabel="Contact details"
            >
              <Text style={{ color: theme.primary, fontSize: 16 }}>Info</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.primary} />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(r) => (r.type === "msg" ? r.m.id : r.key)}
            renderItem={({ item }) =>
              item.type === "day" ? (
                <View style={styles.dayWrap}>
                  <Text style={[styles.day, { backgroundColor: theme.surface, color: theme.muted }]}>{item.label}</Text>
                </View>
              ) : (
                <MessageBubble
                  message={item.m}
                  quoted={item.m.reply_to_message_id ? byId.get(item.m.reply_to_message_id) : null}
                />
              )
            }
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              hasOlder ? (
                <Pressable onPress={loadOlder} style={styles.older}>
                  {loadingOlder ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Text style={{ color: theme.primary }}>Load earlier messages</Text>
                  )}
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.muted, transform: [{ scaleY: -1 }] }]}>No messages yet</Text>
            }
            contentContainerStyle={styles.list}
          />
        )}
        <View style={{ paddingBottom: insets.bottom }}>
          {id && (
            <Composer
              conversationId={id}
              accountId={profile?.account_id}
              readOnly={!canSend}
              sessionExpired={session.expired}
              sessionLabel={session.label}
              onSendText={onSendText}
              onSendMedia={onSendMedia}
              onSendTemplate={onSendTemplate}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { flex: 1 },
  list: { paddingVertical: 8 },
  dayWrap: { alignItems: "center", marginVertical: 8 },
  day: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
  older: { alignItems: "center", padding: 12 },
  empty: { textAlign: "center", marginTop: 40 },
});
