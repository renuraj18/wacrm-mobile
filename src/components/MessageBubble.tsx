import { Image } from "expo-image";
import { memo, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { clock } from "@/lib/format-time";
import { useTheme } from "@/lib/theme";
import type { Message } from "@/lib/types";

import { AudioPlayer } from "./AudioPlayer";

function Ticks({ status }: { status: Message["status"] }) {
  const theme = useTheme();
  switch (status) {
    case "sending":
      return <Text style={{ color: theme.muted, fontSize: 11 }}>🕓</Text>;
    case "sent":
      return <Text style={{ color: theme.muted, fontSize: 12 }}>✓</Text>;
    case "delivered":
      return <Text style={{ color: theme.muted, fontSize: 12 }}>✓✓</Text>;
    case "read":
      return <Text style={{ color: theme.tick, fontSize: 12 }}>✓✓</Text>;
    case "failed":
      return <Text style={{ color: theme.danger, fontSize: 12 }}>⚠︎</Text>;
  }
}

function MessageBubbleInner({ message, quoted }: { message: Message; quoted?: Message | null }) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(false);
  const outgoing = message.sender_type !== "customer";
  const text = message.content_text?.trim() ?? "";
  const media = message.media_url;
  const payload = message.interactive_payload;

  const body = (() => {
    switch (message.content_type) {
      case "image":
        return (
          <>
            {media ? (
              <Pressable onPress={() => setZoom(true)} accessibilityLabel="Open photo">
                <Image source={{ uri: media }} style={styles.image} contentFit="cover" transition={150} />
              </Pressable>
            ) : (
              <Text style={{ color: theme.muted }}>📷 Photo unavailable</Text>
            )}
            {!!text && <Text style={[styles.text, { color: theme.text }]}>{text}</Text>}
          </>
        );
      case "audio":
        return media ? <AudioPlayer uri={media} /> : <Text style={{ color: theme.muted }}>🎤 Voice note</Text>;
      case "video":
      case "document":
        return (
          <Pressable onPress={() => media && Linking.openURL(media)} disabled={!media}>
            <Text style={[styles.text, { color: theme.text }]}>
              {message.content_type === "video" ? "🎥 " : "📄 "}
              {text || (message.content_type === "video" ? "Video" : "Document")}
            </Text>
            {media && <Text style={{ color: theme.primary, fontSize: 13 }}>Open</Text>}
          </Pressable>
        );
      case "location":
        return <Text style={[styles.text, { color: theme.text }]}>📍 {text || "Location"}</Text>;
      case "template":
        return (
          <>
            {media && <Image source={{ uri: media }} style={styles.image} contentFit="cover" />}
            <Text style={[styles.label, { color: theme.muted }]}>Template · {message.template_name}</Text>
            <Text style={[styles.text, { color: theme.text }]}>{text || "(template)"}</Text>
          </>
        );
      case "interactive":
        return (
          <>
            {!outgoing && message.interactive_reply_id && (
              <Text style={[styles.label, { color: theme.muted }]}>↩ Button reply</Text>
            )}
            {payload?.header && <Text style={[styles.text, styles.bold, { color: theme.text }]}>{payload.header}</Text>}
            <Text style={[styles.text, { color: theme.text }]}>{payload?.body ?? text}</Text>
            {payload?.footer && <Text style={{ color: theme.muted, fontSize: 12 }}>{payload.footer}</Text>}
            {payload?.kind === "buttons" &&
              payload.buttons.map((b) => (
                <View key={b.id} style={[styles.ibutton, { borderTopColor: theme.border }]}>
                  <Text style={{ color: theme.tick, textAlign: "center" }}>{b.title}</Text>
                </View>
              ))}
            {payload?.kind === "list" && (
              <View style={[styles.ibutton, { borderTopColor: theme.border }]}>
                <Text style={{ color: theme.tick, textAlign: "center" }}>☰ {payload.button_label || "Options"}</Text>
                {payload.sections.flatMap((s) => s.rows).map((r) => (
                  <Text key={r.id} style={{ color: theme.muted, fontSize: 13 }}>
                    • {r.title}
                  </Text>
                ))}
              </View>
            )}
          </>
        );
      default:
        return <Text style={[styles.text, { color: theme.text }]}>{text}</Text>;
    }
  })();

  return (
    <View style={[styles.wrap, outgoing ? styles.right : styles.left]}>
      <View style={[styles.bubble, { backgroundColor: outgoing ? theme.bubbleOut : theme.bubbleIn }]}>
        {message.sender_type === "bot" && (
          <Text style={[styles.label, { color: theme.primary }]}>{message.ai_generated ? "AI" : "Bot"}</Text>
        )}
        {quoted && (
          <View style={[styles.quote, { borderLeftColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={2}>
              {quoted.content_text || quoted.content_type}
            </Text>
          </View>
        )}
        {body}
        <View style={styles.meta}>
          <Text style={{ color: theme.muted, fontSize: 11 }}>{clock(new Date(message.created_at))}</Text>
          {outgoing && <Ticks status={message.status} />}
        </View>
        {message.status === "failed" && (message.error_title || message.error_details) && (
          <Text style={{ color: theme.danger, fontSize: 12 }}>{message.error_details || message.error_title}</Text>
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
}

export const MessageBubble = memo(MessageBubbleInner);

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 2, maxWidth: "100%" },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubble: { maxWidth: "82%", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, gap: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  bold: { fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600" },
  image: { width: 240, height: 240, borderRadius: 8 },
  meta: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4 },
  quote: { borderLeftWidth: 3, borderRadius: 4, padding: 6 },
  ibutton: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, marginTop: 2, gap: 2 },
  zoomBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center" },
  zoomImg: { width: "100%", height: "80%" },
});
