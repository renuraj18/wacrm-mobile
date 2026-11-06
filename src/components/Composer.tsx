import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, ApiError } from "@/lib/api";
import { MEDIA_MAX_BYTES_BY_KIND, mimeForFile } from "@/lib/media-path";
import { productCaption } from "@/lib/products";
import { useTheme } from "@/lib/theme";
import type { MessageTemplate, ProductListItem } from "@/lib/types";
import { uploadChatMedia } from "@/lib/upload";

import { ProductPicker } from "./ProductPicker";
import { TemplatePicker, type TemplateValues } from "./TemplatePicker";

export interface MediaSend {
  kind: "image" | "audio";
  mediaUrl: string;
  /** Storage path, "" for external URLs (Shopify CDN). */
  path: string;
  caption?: string;
}

interface Props {
  conversationId: string;
  accountId: string | undefined;
  readOnly: boolean;
  sessionExpired: boolean;
  sessionLabel: string;
  onSendText: (text: string) => void;
  onSendMedia: (m: MediaSend) => void;
  onSendTemplate: (t: MessageTemplate, v: TemplateValues) => void;
}

const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 5 * 60 * 1000;

function alertError(title: string, e: unknown) {
  Alert.alert(title, e instanceof Error ? e.message : String(e));
}

export function Composer({
  conversationId,
  accountId,
  readOnly,
  sessionExpired,
  sessionLabel,
  onSendText,
  onSendMedia,
  onSendTemplate,
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [staged, setStaged] = useState<{ uri: string; name: string; mime: string } | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 200);
  const recordingRef = useRef(false);
  const releasedRef = useRef(false);

  if (readOnly) {
    return (
      <View style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.muted, textAlign: "center" }}>You have view-only access to this inbox.</Text>
      </View>
    );
  }

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText("");
  };

  const draftWithAi = async () => {
    setBusy("ai");
    try {
      const data = await api<{ draft?: string }>("/api/ai/draft", { method: "POST", body: { conversation_id: conversationId } });
      const draft = typeof data.draft === "string" ? data.draft.trim() : "";
      if (!draft) Alert.alert("AI draft", "The assistant returned an empty draft.");
      else setText(draft);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ai_not_configured") {
        Alert.alert("AI draft", "AI isn't set up for this account yet (Settings → AI in the CRM).");
      } else alertError("AI draft failed", e);
    } finally {
      setBusy(null);
    }
  };

  const pickImage = async (source: "camera" | "library") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", `Allow ${source === "camera" ? "camera" : "photo"} access in Settings to send photos.`);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, exif: false };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize && a.fileSize > MEDIA_MAX_BYTES_BY_KIND.image) {
      Alert.alert("Photo too large", "WhatsApp allows photos up to 5 MB.");
      return;
    }
    // HEIC isn't accepted by WhatsApp or the bucket; the picker's
    // compression (quality < 1) re-encodes to JPEG on iOS.
    const name = a.fileName?.replace(/\.(heic|heif)$/i, ".jpg") || `photo-${Date.now()}.jpg`;
    const mime = a.mimeType && a.mimeType !== "image/heic" ? a.mimeType : mimeForFile(name, "image/jpeg");
    setStaged({ uri: a.uri, name, mime });
  };

  const sendStaged = async () => {
    if (!staged || !accountId) return;
    setBusy("upload");
    try {
      const { publicUrl, path } = await uploadChatMedia(accountId, staged.uri, staged.name, staged.mime);
      onSendMedia({ kind: "image", mediaUrl: publicUrl, path, caption: text.trim() || undefined });
      setStaged(null);
      setText("");
    } catch (e) {
      alertError("Upload failed", e);
    } finally {
      setBusy(null);
    }
  };

  const openAttach = () => {
    const options = ["Camera", "Photo library", "Shopify product", "Template", "Cancel"];
    const run = (i: number) => {
      if (i === 0) void pickImage("camera");
      if (i === 1) void pickImage("library");
      if (i === 2) setProductsOpen(true);
      if (i === 3) setTemplatesOpen(true);
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4 }, run);
    } else {
      Alert.alert("Attach", undefined, [
        ...options.slice(0, 4).map((o, i) => ({ text: o, onPress: () => run(i) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  const pickProduct = (p: ProductListItem) => {
    setProductsOpen(false);
    const caption = productCaption(p);
    if (p.image_url) onSendMedia({ kind: "image", mediaUrl: p.image_url, path: "", caption });
    else onSendText(caption);
  };

  // ---- Voice notes: press and hold the mic, release to send ----------
  const startRecording = async () => {
    releasedRef.current = false;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Microphone needed", "Allow microphone access in Settings to record voice notes.");
      return;
    }
    // The user may have let go while the permission prompt was up.
    if (releasedRef.current) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_RECORDING_MS / 1000 });
      recordingRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (releasedRef.current) void stopRecording();
    } catch (e) {
      alertError("Couldn't start recording", e);
    }
  };

  const stopRecording = async (cancel = false) => {
    releasedRef.current = true;
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const duration = recorder.getStatus().durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (cancel || !uri || duration < MIN_RECORDING_MS || !accountId) return;
    setBusy("upload");
    try {
      const { publicUrl, path } = await uploadChatMedia(accountId, uri, `voice-${Date.now()}.m4a`, "audio/mp4");
      onSendMedia({ kind: "audio", mediaUrl: publicUrl, path });
    } catch (e) {
      alertError("Voice note upload failed", e);
    } finally {
      setBusy(null);
    }
  };

  if (sessionExpired) {
    return (
      <View style={[styles.notice, { backgroundColor: theme.warnBg }]}>
        <Text style={{ color: theme.warn, textAlign: "center" }}>
          The 24-hour reply window has closed ({sessionLabel.toLowerCase()}). WhatsApp only allows approved templates now.
        </Text>
        <Pressable style={[styles.templateBtn, { backgroundColor: theme.primary }]} onPress={() => setTemplatesOpen(true)}>
          <Text style={styles.templateBtnText}>Send a template</Text>
        </Pressable>
        {templatesOpen && <TemplatePicker
          visible
          onClose={() => setTemplatesOpen(false)}
          onSend={(t, v) => {
            setTemplatesOpen(false);
            onSendTemplate(t, v);
          }}
        />}
      </View>
    );
  }

  const recording = recState.isRecording;
  const seconds = Math.floor((recState.durationMillis ?? 0) / 1000);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {sessionLabel ? <Text style={[styles.window, { color: theme.muted }]}>Reply window: {sessionLabel}</Text> : null}
      {staged && (
        <View style={[styles.staged, { backgroundColor: theme.bg }]}>
          <Text style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
            📷 {staged.name}
          </Text>
          <Pressable onPress={() => setStaged(null)} hitSlop={8}>
            <Text style={{ color: theme.danger }}>Remove</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <Pressable onPress={openAttach} style={styles.icon} hitSlop={6} accessibilityLabel="Attach" disabled={recording}>
          <Text style={[styles.iconText, { color: theme.muted }]}>＋</Text>
        </Pressable>
        <Pressable onPress={draftWithAi} style={styles.icon} hitSlop={6} accessibilityLabel="Draft reply with AI" disabled={!!busy}>
          {busy === "ai" ? <ActivityIndicator color={theme.primary} /> : <Text style={[styles.ai, { color: theme.primary }]}>AI</Text>}
        </Pressable>
        {recording ? (
          <View style={[styles.input, styles.recBox, { backgroundColor: theme.bg }]}>
            <Text style={{ color: theme.danger }}>● Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>Release to send</Text>
          </View>
        ) : (
          <TextInput
            style={[styles.input, { backgroundColor: theme.bg, color: theme.text }]}
            placeholder={staged ? "Add a caption" : "Message"}
            placeholderTextColor={theme.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={staged ? 1024 : 4096}
            accessibilityLabel="Message"
          />
        )}
        {busy === "upload" ? (
          <ActivityIndicator style={styles.send} color={theme.primary} />
        ) : text.trim() || staged ? (
          <Pressable
            onPress={staged ? sendStaged : sendText}
            style={[styles.send, { backgroundColor: theme.primary }]}
            accessibilityLabel="Send"
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        ) : (
          <Pressable
            onPressIn={startRecording}
            onPressOut={() => void stopRecording()}
            style={[styles.send, { backgroundColor: recording ? theme.danger : theme.primary }]}
            accessibilityLabel="Hold to record a voice note"
          >
            <Text style={styles.sendIcon}>🎤</Text>
          </Pressable>
        )}
      </View>
      <ProductPicker visible={productsOpen} onClose={() => setProductsOpen(false)} onPick={pickProduct} />
      <TemplatePicker
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSend={(t, v) => {
          setTemplatesOpen(false);
          onSendTemplate(t, v);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  window: { fontSize: 11, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  icon: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 26 },
  ai: { fontSize: 15, fontWeight: "800" },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16, maxHeight: 140, minHeight: 40 },
  recBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendIcon: { color: "#fff", fontSize: 18 },
  staged: { flexDirection: "row", gap: 8, padding: 8, borderRadius: 8, alignItems: "center" },
  notice: { padding: 14, gap: 10 },
  templateBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  templateBtnText: { color: "#fff", fontWeight: "600" },
});
