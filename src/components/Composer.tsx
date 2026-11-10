import * as DocumentPicker from "expo-document-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, ApiError } from "@/lib/api";
import { MEDIA_MAX_BYTES_BY_KIND, mimeForFile } from "@/lib/media-path";
import { productCaption } from "@/lib/products";
import { useTheme } from "@/lib/theme";
import type { InteractivePayload, Message, MessageTemplate, ProductListItem } from "@/lib/types";
import { uploadChatMedia } from "@/lib/upload";

import { AttachSheet, type AttachKind } from "./AttachSheet";
import { ProductPicker } from "./ProductPicker";
import { QuickReplyPicker } from "./QuickReplyPicker";
import { ReplyBar } from "./ReplyBar";
import { TemplatePicker, type TemplateValues } from "./TemplatePicker";
import { Icon } from "./ui/Icon";

export interface MediaSend {
  kind: "image" | "audio" | "video" | "document";
  mediaUrl: string;
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
  onSendInteractive: (payload: InteractivePayload) => void;
  /** Message being replied to (shown above the input), if any. */
  replyTo: { message: Message; peerName: string } | null;
  onCancelReply: () => void;
}

const MIN_RECORDING_MS = 800;
const MAX_RECORDING_MS = 5 * 60 * 1000;
/** Drag the mic this far left to cancel a voice note. */
const CANCEL_DRAG_PX = 80;

function alertError(title: string, e: unknown) {
  Alert.alert(title, e instanceof Error ? e.message : String(e));
}

export function Composer(props: Props) {
  const theme = useTheme();
  if (props.readOnly) {
    return (
      <View style={[styles.notice, { backgroundColor: theme.surface }]}>
        <Text style={{ color: theme.muted, textAlign: "center" }}>You have view-only access to this inbox.</Text>
      </View>
    );
  }
  if (props.sessionExpired) {
    return <ExpiredNotice sessionLabel={props.sessionLabel} onSendTemplate={props.onSendTemplate} />;
  }
  return <ActiveComposer {...props} />;
}

function ExpiredNotice({ sessionLabel, onSendTemplate }: Pick<Props, "sessionLabel" | "onSendTemplate">) {
  const theme = useTheme();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  return (
    <View style={[styles.notice, { backgroundColor: theme.warnBg }]}>
      <Text style={{ color: theme.warn, textAlign: "center" }}>
        The 24-hour reply window has closed ({sessionLabel.toLowerCase()}). WhatsApp only allows approved templates now.
      </Text>
      <Pressable style={[styles.templateBtn, { backgroundColor: theme.primary }]} onPress={() => setTemplatesOpen(true)}>
        <Text style={styles.templateBtnText}>Send a template</Text>
      </Pressable>
      {templatesOpen && (
        <TemplatePicker
          visible
          onClose={() => setTemplatesOpen(false)}
          onSend={(t, v) => {
            setTemplatesOpen(false);
            onSendTemplate(t, v);
          }}
        />
      )}
    </View>
  );
}

function ActiveComposer({
  conversationId,
  accountId,
  sessionLabel,
  onSendText,
  onSendMedia,
  onSendTemplate,
  onSendInteractive,
  replyTo,
  onCancelReply,
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [willCancel, setWillCancel] = useState(false);
  const [staged, setStaged] = useState<{
    uri: string;
    name: string;
    mime: string;
    kind: "image" | "video" | "document";
  } | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 200);
  const recordingRef = useRef(false);
  const releasedRef = useRef(false);
  const cancelRef = useRef(false);

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

  const stageMedia = (file: {
    uri: string;
    name: string;
    mime: string;
    kind: "image" | "video" | "document";
    size?: number | null;
  }) => {
    const maxBytes = MEDIA_MAX_BYTES_BY_KIND[file.kind];
    if (file.size && file.size > maxBytes) {
      Alert.alert("File too large", `This ${file.kind} must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller.`);
      return;
    }
    setStaged({ uri: file.uri, name: file.name, mime: file.mime, kind: file.kind });
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
    // HEIC isn't accepted by WhatsApp or the bucket; the picker's
    // compression (quality < 1) re-encodes to JPEG on iOS.
    const name = a.fileName?.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg";
    const mime = a.mimeType && a.mimeType !== "image/heic" ? a.mimeType : mimeForFile(name, "image/jpeg");
    stageMedia({ uri: a.uri, name, mime, kind: "image", size: a.fileSize });
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo and video access in Settings to send videos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const name = asset.fileName || `video-${Date.now()}.mp4`;
    stageMedia({
      uri: asset.uri,
      name,
      mime: asset.mimeType || mimeForFile(name, "video/mp4"),
      kind: "video",
      size: asset.fileSize,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    stageMedia({
      uri: asset.uri,
      name: asset.name,
      mime: asset.mimeType || mimeForFile(asset.name),
      kind: "document",
      size: asset.size,
    });
  };

  const sendStaged = async () => {
    if (!staged || !accountId) return;
    setBusy("upload");
    try {
      const { publicUrl } = await uploadChatMedia(accountId, staged.uri, staged.name, staged.mime);
      onSendMedia({ kind: staged.kind, mediaUrl: publicUrl, caption: text.trim() || undefined });
      setStaged(null);
      setText("");
    } catch (e) {
      alertError("Upload failed", e);
    } finally {
      setBusy(null);
    }
  };

  const onAttach = (kind: AttachKind) => {
    if (kind === "camera") void pickImage("camera");
    else if (kind === "gallery") void pickImage("library");
    else if (kind === "video") void pickVideo();
    else if (kind === "document") void pickDocument();
    else if (kind === "product") setProductsOpen(true);
    else if (kind === "template") setTemplatesOpen(true);
    else void draftWithAi();
  };

  const pickProduct = (p: ProductListItem) => {
    setProductsOpen(false);
    const caption = productCaption(p);
    if (p.image_url) onSendMedia({ kind: "image", mediaUrl: p.image_url, caption });
    else onSendText(caption);
  };

  // ---- Voice notes: hold the mic, release to send, drag left to cancel ----
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
      if (releasedRef.current) void stopRecording(cancelRef.current);
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
      const { publicUrl } = await uploadChatMedia(accountId, uri, `voice-${Date.now()}.m4a`, "audio/mp4");
      onSendMedia({ kind: "audio", mediaUrl: publicUrl });
    } catch (e) {
      alertError("Voice note upload failed", e);
    } finally {
      setBusy(null);
    }
  };

  // The PanResponder is created once; it calls the latest recording handlers through this ref.
  const recordingActions = useRef({ start: startRecording, stop: stopRecording });
  useEffect(() => {
    recordingActions.current = { start: startRecording, stop: stopRecording };
  });
  // The callbacks below only touch the ref when a touch event fires, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        cancelRef.current = false;
        setWillCancel(false);
        void recordingActions.current.start();
      },
      onPanResponderMove: (_e, g) => {
        const cancel = g.dx < -CANCEL_DRAG_PX;
        if (cancel !== cancelRef.current) {
          cancelRef.current = cancel;
          setWillCancel(cancel);
          if (cancel) void Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: () => {
        void recordingActions.current.stop(cancelRef.current);
        setWillCancel(false);
      },
      // If the system steals the touch, drop the note rather than send it by accident.
      onPanResponderTerminate: () => {
        cancelRef.current = true;
        void recordingActions.current.stop(true);
        setWillCancel(false);
      },
    }),
  );

  const recording = recState.isRecording;
  const seconds = Math.floor((recState.durationMillis ?? 0) / 1000);
  const hasContent = !!text.trim() || !!staged;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.chatBg }]}>
      {sessionLabel ? <Text style={[styles.window, { color: theme.muted }]}>Reply window: {sessionLabel}</Text> : null}
      {replyTo && <ReplyBar message={replyTo.message} peerName={replyTo.peerName} onCancel={onCancelReply} />}
      {staged && (
        <View style={[styles.staged, { backgroundColor: theme.bg }]}>
          <Icon
            name={staged.kind === "image" ? "image" : staged.kind === "video" ? "videocam" : "document-text"}
            size={20}
            color={theme.muted}
          />
          <Text style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
            {staged.name}
          </Text>
          <Pressable onPress={() => setStaged(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove attachment">
            <Icon name="close-circle" size={22} color={theme.muted} />
          </Pressable>
        </View>
      )}
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: theme.bg }]}>
          {recording ? (
            <View style={styles.recording}>
              <Icon name="mic" size={20} color={theme.danger} />
              <Text style={{ color: theme.text, fontVariant: ["tabular-nums"] }}>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </Text>
              <Text style={{ color: willCancel ? theme.danger : theme.muted, flex: 1, textAlign: "center" }}>
                {willCancel ? "Release to cancel" : "‹  Slide to cancel"}
              </Text>
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => setAttachOpen(true)}
                style={styles.pillIcon}
                hitSlop={6}
                accessibilityLabel="Attach"
                disabled={!!busy}
              >
                {busy === "ai" ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <Icon name="attach" size={26} color={theme.muted} />
                )}
              </Pressable>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={staged ? "Add a caption" : "Message"}
                placeholderTextColor={theme.muted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={staged ? 1024 : 4096}
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={() => setQuickRepliesOpen(true)}
                style={styles.pillIcon}
                hitSlop={6}
                accessibilityLabel="Quick replies"
              >
                <Icon name="flash" size={22} color={theme.primary} />
              </Pressable>
              {!hasContent && (
                <Pressable
                  onPress={() => void pickImage("camera")}
                  style={styles.pillIcon}
                  hitSlop={6}
                  accessibilityLabel="Take a photo"
                >
                  <Icon name="camera" size={24} color={theme.muted} />
                </Pressable>
              )}
            </>
          )}
        </View>
        {busy === "upload" ? (
          <ActivityIndicator style={styles.send} color={theme.primary} />
        ) : hasContent ? (
          <Pressable
            onPress={staged ? sendStaged : sendText}
            style={[styles.send, { backgroundColor: theme.primary }]}
            accessibilityLabel="Send"
          >
            <Icon name="send" size={22} color="#fff" />
          </Pressable>
        ) : (
          <View
            {...pan.panHandlers}
            style={[
              styles.send,
              recording && styles.sendRecording,
              { backgroundColor: recording ? (willCancel ? theme.muted : theme.danger) : theme.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Hold to record a voice note"
          >
            <Icon name="mic" size={24} color="#fff" />
          </View>
        )}
      </View>
      <AttachSheet visible={attachOpen} onClose={() => setAttachOpen(false)} onSelect={onAttach} />
      {quickRepliesOpen && (
        <QuickReplyPicker
          visible
          onClose={() => setQuickRepliesOpen(false)}
          onSelectText={(reply) => setText((current) => (current ? `${current}\n${reply}` : reply))}
          onSelectInteractive={onSendInteractive}
        />
      )}
      <ProductPicker visible={productsOpen} onClose={() => setProductsOpen(false)} onPick={pickProduct} />
      {templatesOpen && (
        <TemplatePicker
          visible
          onClose={() => setTemplatesOpen(false)}
          onSend={(t, v) => {
            setTemplatesOpen(false);
            onSendTemplate(t, v);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, gap: 6 },
  window: { fontSize: 11, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  pill: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 24, paddingHorizontal: 6, minHeight: 48 },
  pillIcon: { width: 38, height: 48, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontSize: 16, maxHeight: 140, paddingTop: 13, paddingBottom: 13, paddingHorizontal: 2 },
  recording: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 48, paddingHorizontal: 8 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  sendRecording: { transform: [{ scale: 1.25 }] },
  staged: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 12, alignItems: "center" },
  notice: { padding: 14, gap: 10 },
  templateBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  templateBtnText: { color: "#fff", fontWeight: "600" },
});
