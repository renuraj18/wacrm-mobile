import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatHeaderTitle } from "@/components/ChatHeaderTitle";
import { Composer, type MediaSend } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageMenu } from "@/components/MessageMenu";
import { Icon } from "@/components/ui/Icon";
import type { TemplateValues } from "@/components/TemplatePicker";
import { useRealtime } from "@/hooks/use-realtime";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { contactDisplayName } from "@/lib/conversations";
import { useInbox } from "@/lib/inbox-store";
import { buildRows } from "@/lib/message-rows";
import {
  applyMessageUpdate,
  applyRealtimeInsert,
  confirmedSendUpdate,
  isTempMessage,
  mergeFetchedPage,
  newTempMessageId,
  prependOlder,
} from "@/lib/optimistic";
import {
  applyReactionChange,
  businessReactionOn,
  nextBusinessEmoji,
  withBusinessReaction,
} from "@/lib/reactions";
import { sessionWindow } from "@/lib/session-window";
import { supabase } from "@/lib/supabase";
import { renderTemplateBody, templateHeaderMediaUrl } from "@/lib/templates";
import { useTheme } from "@/lib/theme";
import type { Conversation, Message, MessageReaction, MessageTemplate } from "@/lib/types";

const PAGE = 50;

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, canSend, session: auth } = useAuth();
  const myUserId = auth?.user.id;
  const { conversations, setActiveId, ensure } = useInbox();
  const conversation = conversations.find((c) => c.id === id);
  const [fallbackConv, setFallbackConv] = useState<Conversation | null>(null);
  const conv = conversation ?? fallbackConv;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [away, setAway] = useState(false); // scrolled up from the newest message
  const [newAway, setNewAway] = useState(0); // customer messages that arrived while scrolled up
  const listRef = useRef<FlatList>(null);

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
            if (m.sender_type === "customer") {
              setMarkedFor((n) => n + 1);
              if (away) setNewAway((n) => n + 1);
            }
          } else if (p.eventType === "UPDATE") {
            const m = p.new as unknown as Message;
            setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
          }
        },
      },
      {
        table: "message_reactions",
        filter: `conversation_id=eq.${id}`,
        onChange: (p) => {
          const row = (p.eventType === "DELETE" ? p.old : p.new) as Partial<MessageReaction>;
          setReactions((prev) => applyReactionChange(prev, p.eventType, row));
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

  // Reactions load once per chat; realtime keeps them current after that.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void supabase
      .from("message_reactions")
      .select("*")
      .eq("conversation_id", id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("reactions load failed", error.message);
        else setReactions((prev) => [...((data ?? []) as MessageReaction[]), ...prev.filter((r) => r.id.startsWith("temp-"))]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    for (const r of reactions) {
      const list = map.get(r.message_id);
      if (list) list.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  const session = useMemo(() => sessionWindow(messages, now), [messages, now]);

  // ---- Sending — same bodies as wacrm message-thread.tsx -------------
  const sendWith = useCallback(
    async (optimistic: Message, body: Record<string, unknown>) => {
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await api("/api/whatsapp/send", { method: "POST", body: { conversation_id: id, ...body } });
        setMessages((prev) => applyMessageUpdate(prev, optimistic.id, confirmedSendUpdate(res)));
      } catch (e) {
        setMessages((prev) => applyMessageUpdate(prev, optimistic.id, { status: "failed" }));
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

  // A pending reply rides along with the next text/media send, then clears.
  const takeReply = () => {
    const id = replyTo?.id;
    setReplyTo(null);
    return id ? { reply_to_message_id: id } : {};
  };

  const onSendText = (text: string) =>
    sendWith(temp({ content_text: text, ...takeReply() }), {
      message_type: "text",
      content_text: text,
      ...(replyTo ? { reply_to_message_id: replyTo.id } : {}),
    });

  const onSendMedia = (m: MediaSend) =>
    sendWith(temp({ content_type: m.kind, content_text: m.caption, media_url: m.mediaUrl, ...takeReply() }), {
      message_type: m.kind,
      media_url: m.mediaUrl,
      content_text: m.caption,
      ...(replyTo ? { reply_to_message_id: replyTo.id } : {}),
    });

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

  const retryFailed = useCallback(
    async (message: Message) => {
      if (message.status !== "failed") return;
      let body: Record<string, unknown>;
      if (message.content_type === "text" && message.content_text) {
        body = {
          message_type: "text",
          content_text: message.content_text,
          ...(message.reply_to_message_id ? { reply_to_message_id: message.reply_to_message_id } : {}),
        };
      } else if (
        (message.content_type === "image" ||
          message.content_type === "audio" ||
          message.content_type === "video" ||
          message.content_type === "document") &&
        message.media_url
      ) {
        body = {
          message_type: message.content_type,
          media_url: message.media_url,
          content_text: message.content_text,
          ...(message.reply_to_message_id ? { reply_to_message_id: message.reply_to_message_id } : {}),
        };
      } else {
        return;
      }

      setMessages((prev) => applyMessageUpdate(prev, message.id, { status: "sending" }));
      try {
        const res = await api("/api/whatsapp/send", { method: "POST", body: { conversation_id: id, ...body } });
        setMessages((prev) => applyMessageUpdate(prev, message.id, confirmedSendUpdate(res)));
      } catch (e) {
        setMessages((prev) => applyMessageUpdate(prev, message.id, { status: "failed" }));
        Alert.alert("Message not sent", e instanceof Error ? e.message : String(e));
      }
    },
    [id],
  );

  // Set / swap / remove the business reaction (optimistic, rolled back on failure).
  const react = useCallback(
    async (message: Message, tapped: string) => {
      if (!myUserId || !id) return;
      if (isTempMessage(message)) {
        Alert.alert("Please wait", "This message is still sending.");
        return;
      }
      const emoji = nextBusinessEmoji(businessReactionOn(reactions, message.id), tapped);
      const snapshot = reactions;
      setReactions(
        withBusinessReaction(reactions, { messageId: message.id, conversationId: id, userId: myUserId, emoji, now: new Date() }),
      );
      try {
        await api("/api/whatsapp/react", { method: "POST", body: { message_id: message.id, emoji } });
      } catch (e) {
        setReactions(snapshot);
        Alert.alert("Reaction failed", e instanceof Error ? e.message : String(e));
      }
    },
    [id, myUserId, reactions],
  );

  const rows = useMemo(() => buildRows(messages), [messages]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isAway = e.nativeEvent.contentOffset.y > 300;
    setAway(isAway);
    if (!isAway) setNewAway(0);
  }, []);

  const jumpToLatest = () => listRef.current?.scrollToOffset({ offset: 0, animated: true });

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const name = contactDisplayName(conv?.contact);
  const phoneDigits = conv?.contact?.phone?.replace(/\D/g, "") ?? "";
  const openInfo = () => router.push({ pathname: "/contact/[id]", params: { id: id! } });
  // Replies/reactions need a write role, and replies need an open 24h window.
  const canReply = canSend && !session.expired;
  const menuMine = menuMessage ? businessReactionOn(reactions, menuMessage.id)?.emoji : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: theme.chatBg }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <ChatHeaderTitle
              name={name}
              uri={conv?.contact?.avatar_url}
              subtitle={session.expired ? session.label : session.label ? `Reply window: ${session.label}` : ""}
              onPress={openInfo}
            />
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              {!!phoneDigits && (
                <Pressable
                  hitSlop={10}
                  onPress={() => void Linking.openURL(`tel:+${phoneDigits}`).catch(() => Alert.alert("Couldn't start a call"))}
                  accessibilityLabel={`Call ${name}`}
                >
                  <Icon name="call-outline" size={24} color={theme.headerText} />
                </Pressable>
              )}
              <Pressable hitSlop={10} onPress={openInfo} accessibilityLabel="Contact details">
                <Icon name="information-circle-outline" size={26} color={theme.headerText} />
              </Pressable>
            </View>
          ),
        }}
      />
      {/* react-native-keyboard-controller works on both platforms even with
          Android edge-to-edge (the default in SDK 58), where the RN
          KeyboardAvoidingView and softwareKeyboardLayoutMode "resize" don't. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.primary} />
        ) : (
          <FlatList
            ref={listRef}
            inverted
            // Shorter glide after a fling, closer to WhatsApp's chat scroll.
            decelerationRate={0.985}
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
                  peerName={name}
                  reactions={reactionsByMessage.get(item.m.id)}
                  first={item.first}
                  onRetry={retryFailed}
                  onLongPress={setMenuMessage}
                  onReply={canReply && !isTempMessage(item.m) && item.m.status !== "failed" ? setReplyTo : undefined}
                  onToggleReaction={canSend ? react : undefined}
                />
              )
            }
            onScroll={onScroll}
            scrollEventThrottle={64}
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
        {away && (
          <Pressable
            onPress={jumpToLatest}
            style={[styles.jump, { backgroundColor: theme.bg, borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest message"
          >
            {newAway > 0 && (
              <View style={[styles.jumpBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.jumpBadgeText}>{newAway}</Text>
              </View>
            )}
            <Icon name="chevron-down" size={24} color={theme.muted} />
          </Pressable>
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
              replyTo={replyTo ? { message: replyTo, peerName: name } : null}
              onCancelReply={() => setReplyTo(null)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
      <MessageMenu
        message={menuMessage}
        myEmoji={menuMine}
        canReact={canSend && !!menuMessage && !isTempMessage(menuMessage) && menuMessage.status !== "failed"}
        canReply={canReply && !!menuMessage && !isTempMessage(menuMessage) && menuMessage.status !== "failed"}
        canRetry={canSend && menuMessage?.status === "failed"}
        onClose={() => setMenuMessage(null)}
        onReact={react}
        onReply={setReplyTo}
        onRetry={retryFailed}
      />
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 20 },
  jump: {
    position: "absolute",
    right: 14,
    bottom: 76,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  jumpBadge: {
    position: "absolute",
    top: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  jumpBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 40 },
});
