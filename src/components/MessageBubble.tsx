import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { memo, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable, { SwipeDirection, type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { clock } from "@/lib/format-time";
import { previewText } from "@/lib/preview";
import { groupReactions } from "@/lib/reactions";
import { useTheme } from "@/lib/theme";
import type { Message, MessageReaction } from "@/lib/types";

import { AudioPlayer } from "./AudioPlayer";
import { Icon } from "./ui/Icon";
import { Ticks } from "./ui/Ticks";

const TAIL = 9;
// Invisible filler so the last line of text never runs under the time/ticks.
const SPACER_OUT = " ".repeat(15);
const SPACER_IN = " ".repeat(9);

export interface BubbleProps {
  message: Message;
  /** The message this one replies to, if loaded. */
  quoted?: Message | null;
  /** Display name of the customer, for quote headers. */
  peerName: string;
  reactions?: MessageReaction[];
  /** First bubble of a run from the same side: gets the tail and extra top spacing. */
  first: boolean;
  onRetry?: (message: Message) => void;
  onLongPress?: (message: Message) => void;
  /** Swipe-to-reply; omit to disable (view-only role, unsent messages). */
  onReply?: (message: Message) => void;
  onToggleReaction?: (message: Message, emoji: string) => void;
}

function MessageBubbleInner({
  message,
  quoted,
  peerName,
  reactions,
  first,
  onRetry,
  onLongPress,
  onReply,
  onToggleReaction,
}: BubbleProps) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(false);
  const swipeRef = useRef<SwipeableMethods>(null);
  const outgoing = message.sender_type !== "customer";
  const text = message.content_text?.trim() ?? "";
  const media = message.media_url;
  const payload = message.interactive_payload;
  const bubbleColor = outgoing ? theme.bubbleOut : theme.bubbleIn;
  const groups = useMemo(() => groupReactions(reactions ?? []), [reactions]);
  const retryable =
    (message.content_type === "text" && !!text) ||
    ((message.content_type === "image" ||
      message.content_type === "audio" ||
      message.content_type === "video" ||
      message.content_type === "document") &&
      !!media);

  const longPress = () => {
    if (!onLongPress) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(message);
  };

  const meta = (
    <View style={styles.metaRow}>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{clock(new Date(message.created_at))}</Text>
      {outgoing && <Ticks status={message.status} size={16} />}
    </View>
  );

  /** Text with the time/ticks pinned to the bottom-right of the last line. */
  const textWithMeta = (value: string, extra?: ReactNode) => (
    <View>
      <Text style={[styles.text, { color: theme.text }]}>
        {value}
        <Text style={styles.spacer}>{outgoing ? SPACER_OUT : SPACER_IN}</Text>
      </Text>
      {extra}
      <View style={styles.metaAbs}>{meta}</View>
    </View>
  );

  let body: ReactNode;
  switch (message.content_type) {
    case "image":
      body = (
        <>
          {media ? (
            <View>
              <Pressable onPress={() => setZoom(true)} onLongPress={longPress} accessibilityLabel="Open photo">
                <Image source={{ uri: media }} style={styles.image} contentFit="cover" transition={150} />
              </Pressable>
              {!text && (
                <View style={styles.imageMeta}>
                  <Text style={styles.imageMetaText}>{clock(new Date(message.created_at))}</Text>
                  {outgoing && <Ticks status={message.status} size={16} />}
                </View>
              )}
            </View>
          ) : (
            <Text style={{ color: theme.muted }}>📷 Photo unavailable</Text>
          )}
          {!!text && textWithMeta(text)}
        </>
      );
      break;
    case "audio":
      body = (
        <>
          {media ? <AudioPlayer uri={media} /> : <Text style={{ color: theme.muted }}>🎤 Voice note</Text>}
          {meta}
        </>
      );
      break;
    case "video":
    case "document": {
      const video = message.content_type === "video";
      body = (
        <>
          <Pressable
            onPress={() => media && Linking.openURL(media)}
            onLongPress={longPress}
            disabled={!media}
            style={[styles.file, { backgroundColor: theme.surface }]}
            accessibilityRole="button"
            accessibilityLabel={video ? "Open video" : "Open document"}
          >
            <Icon name={video ? "videocam" : "document-text"} size={30} color={video ? theme.danger : theme.primary} />
            <View style={styles.flex}>
              <Text style={[styles.text, { color: theme.text }]} numberOfLines={2}>
                {text || (video ? "Video" : "Document")}
              </Text>
              {media && <Text style={{ color: theme.link, fontSize: 12 }}>Tap to open</Text>}
            </View>
          </Pressable>
          {meta}
        </>
      );
      break;
    }
    case "location":
      body = textWithMeta(`📍 ${text || "Location"}`);
      break;
    case "template":
      body = (
        <>
          {media && <Image source={{ uri: media }} style={styles.image} contentFit="cover" />}
          <Text style={[styles.label, { color: theme.muted }]}>Template · {message.template_name}</Text>
          {textWithMeta(text || "(template)")}
        </>
      );
      break;
    case "interactive":
      body = (
        <>
          {!outgoing && message.interactive_reply_id && <Text style={[styles.label, { color: theme.muted }]}>↩ Button reply</Text>}
          {payload?.header && <Text style={[styles.text, styles.bold, { color: theme.text }]}>{payload.header}</Text>}
          {textWithMeta(
            payload?.body ?? text,
            <>
              {payload?.footer && <Text style={{ color: theme.muted, fontSize: 12 }}>{payload.footer}</Text>}
              {payload?.kind === "buttons" &&
                payload.buttons.map((b) => (
                  <View key={b.id} style={[styles.ibutton, { borderTopColor: theme.border }]}>
                    <Text style={{ color: theme.link, textAlign: "center" }}>{b.title}</Text>
                  </View>
                ))}
              {payload?.kind === "list" && (
                <View style={[styles.ibutton, { borderTopColor: theme.border }]}>
                  <Text style={{ color: theme.link, textAlign: "center" }}>☰ {payload.button_label || "Options"}</Text>
                  {payload.sections
                    .flatMap((s) => s.rows)
                    .map((r) => (
                      <Text key={r.id} style={{ color: theme.muted, fontSize: 13 }}>
                        • {r.title}
                      </Text>
                    ))}
                </View>
              )}
            </>,
          )}
        </>
      );
      break;
    default:
      body = textWithMeta(text);
  }

  const bubble = (
    <View style={[styles.wrap, outgoing ? styles.right : styles.left, { marginTop: first ? 8 : 2 }]}>
      <View style={styles.bubbleCol}>
        <Pressable
          onLongPress={longPress}
          delayLongPress={250}
          style={[
            styles.bubble,
            { backgroundColor: bubbleColor },
            first && (outgoing ? styles.noTopRight : styles.noTopLeft),
          ]}
        >
          {first && (
            <View
              style={[
                styles.tail,
                outgoing
                  ? { right: -TAIL, borderTopColor: bubbleColor, borderLeftColor: "transparent", borderLeftWidth: TAIL }
                  : { left: -TAIL, borderTopColor: bubbleColor, borderRightColor: "transparent", borderRightWidth: TAIL },
              ]}
            />
          )}
          {message.sender_type === "bot" && (
            <Text style={[styles.label, { color: theme.primary }]}>{message.ai_generated ? "AI" : "Bot"}</Text>
          )}
          {quoted && (
            <View style={[styles.quote, { borderLeftColor: outgoing ? theme.primary : theme.tick, backgroundColor: theme.surface }]}>
              <Text style={{ color: outgoing ? theme.primary : theme.tick, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                {quoted.sender_type === "customer" ? peerName : "You"}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={2}>
                {previewText(quoted.content_type, quoted.content_text)}
              </Text>
            </View>
          )}
          {body}
          {message.status === "failed" && (message.error_title || message.error_details) && (
            <Text style={{ color: theme.danger, fontSize: 12 }}>{message.error_details || message.error_title}</Text>
          )}
          {message.status === "failed" && retryable && onRetry && (
            <Pressable onPress={() => onRetry(message)} accessibilityRole="button">
              <Text style={{ color: theme.danger, fontSize: 13, fontWeight: "600" }}>Retry send</Text>
            </Pressable>
          )}
        </Pressable>
        {groups.length > 0 && (
          <View style={[styles.reactions, outgoing ? styles.reactionsRight : styles.reactionsLeft]}>
            {groups.map((g) => (
              <Pressable
                key={g.emoji}
                onPress={() => onToggleReaction?.(message, g.emoji)}
                disabled={!onToggleReaction}
                accessibilityRole="button"
                accessibilityState={{ selected: g.byBusiness }}
                style={[
                  styles.reaction,
                  { backgroundColor: theme.bg, borderColor: g.byBusiness ? theme.primary : theme.border },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                {g.count > 1 && <Text style={{ color: theme.muted, fontSize: 11 }}>{g.count}</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {media && message.content_type === "image" && (
        <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
          <Pressable style={styles.zoomBg} onPress={() => setZoom(false)} accessibilityLabel="Close photo">
            <Image source={{ uri: media }} style={styles.zoomImg} contentFit="contain" />
          </Pressable>
        </Modal>
      )}
    </View>
  );

  if (!onReply) return bubble;

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      friction={1.5}
      leftThreshold={48}
      renderLeftActions={() => (
        <View style={styles.replyAction}>
          <View style={[styles.replyIcon, { backgroundColor: theme.surface }]}>
            <Icon name="arrow-undo" size={18} color={theme.muted} />
          </View>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction !== SwipeDirection.RIGHT) return;
        void Haptics.selectionAsync();
        onReply(message);
        swipeRef.current?.close();
      }}
    >
      {bubble}
    </Swipeable>
  );
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { paddingHorizontal: 14, maxWidth: "100%" },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubbleCol: { maxWidth: "82%" },
  bubble: { borderRadius: 10, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 6, gap: 4 },
  noTopLeft: { borderTopLeftRadius: 0 },
  noTopRight: { borderTopRightRadius: 0 },
  tail: { position: "absolute", top: 0, width: 0, height: 0, borderTopWidth: TAIL + 1 },
  text: { fontSize: 15.5, lineHeight: 21 },
  spacer: { color: "transparent" },
  bold: { fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600" },
  image: { width: 240, height: 240, borderRadius: 8 },
  imageMeta: {
    position: "absolute",
    right: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  imageMetaText: { color: "#fff", fontSize: 11 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  metaAbs: { position: "absolute", right: 0, bottom: 0 },
  file: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, minWidth: 200 },
  quote: { borderLeftWidth: 4, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  ibutton: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, marginTop: 2, gap: 2 },
  reactions: { flexDirection: "row", gap: 4, marginTop: -6 },
  reactionsLeft: { justifyContent: "flex-start", paddingLeft: 6 },
  reactionsRight: { justifyContent: "flex-end", paddingRight: 6 },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  replyAction: { width: 56, justifyContent: "center", alignItems: "center" },
  replyIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  zoomBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" },
  zoomImg: { width: "100%", height: "80%" },
});
