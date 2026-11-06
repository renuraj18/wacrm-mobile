import { File } from "expo-file-system";
import { Platform } from "react-native";

import { buildMediaPath, CHAT_MEDIA_BUCKET } from "./media-path";
import { supabase } from "./supabase";

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/**
 * Upload a local file (photo, voice note) to the account-scoped
 * `chat-media` bucket and return its public URL — the mobile twin of
 * `uploadAccountMedia` in wacrm/src/lib/storage/upload-media.ts.
 */
export async function uploadChatMedia(
  accountId: string,
  uri: string,
  fileName: string,
  contentType: string,
): Promise<{ publicUrl: string; path: string }> {
  const path = buildMediaPath(accountId, fileName);
  const bytes = await readBytes(uri);
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, bytes, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  if (error) throw new Error(error.message);
  const {
    data: { publicUrl },
  } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
  return { publicUrl, path };
}

/** Best-effort GC of an uploaded object whose send failed. */
export function deleteChatMedia(path: string): void {
  if (!path) return;
  void supabase.storage.from(CHAT_MEDIA_BUCKET).remove([path]).catch(() => {});
}
