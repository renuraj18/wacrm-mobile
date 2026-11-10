/** Supabase Storage bucket for agent-sent chat attachments (wacrm migration 023). */
export const CHAT_MEDIA_BUCKET = "chat-media";

/** Meta's per-kind caps — wacrm/src/lib/storage/upload-media.ts. */
export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  // Upload currently buffers files in memory; keep document uploads mobile-safe.
  document: 25 * 1024 * 1024,
} as const;

/**
 * Account-scoped object path, identical to `buildMediaPath` in
 * wacrm/src/lib/storage/upload-media.ts:
 *
 *   account-<account_id>/<timestamp>-<safe basename>.<ext>
 *
 * The first segment is what the bucket's RLS write policy matches, so it
 * must not drift from the web.
 */
export function buildMediaPath(accountId: string, fileName: string, now: number | null = Date.now(), subfolder?: string): string {
  const hasExt = /\.[^.]+$/.test(fileName);
  const ext = hasExt ? fileName.split(".").pop()!.toLowerCase() : "bin";
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 40) || "file";
  const dir = subfolder ? `account-${accountId}/${subfolder}` : `account-${accountId}`;
  const stamp = now === null ? "" : `${now}-`;
  return `${dir}/${stamp}${safeBase}.${ext}`;
}

/** MIME type for a picked/recorded file, from its extension. */
export function mimeForFile(fileName: string, fallback = "application/octet-stream"): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "m4a":
      return "audio/mp4";
    case "mp4":
      return "video/mp4";
    case "aac":
      return "audio/aac";
    case "ogg":
      return "audio/ogg";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return fallback;
  }
}
