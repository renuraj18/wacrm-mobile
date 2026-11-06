import type { ContentType } from "./types";

const PREVIEW_MAX = 120;

const MEDIA_LABELS: Partial<Record<ContentType, string>> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Voice note",
  document: "📄 Document",
  location: "📍 Location",
};

/**
 * One-line preview of a message — the inbox row and the realtime
 * conversation patch. Same labels as the server's push `previewText`
 * (wacrm/src/lib/push/notify.ts) so a notification and the inbox row
 * read the same.
 */
export function previewText(contentType: ContentType | string, contentText: string | null | undefined): string {
  const text = (contentText ?? "").replace(/\s+/g, " ").trim();
  const label = MEDIA_LABELS[contentType as ContentType];
  if (label) return text ? `${label}: ${truncate(text)}` : label;
  return text ? truncate(text) : "New message";
}

function truncate(text: string): string {
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;
}
