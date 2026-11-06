import type { Message } from "./types";

// Trimmed port of wacrm/src/lib/inbox/optimistic-messages.ts.

const TEMP_PREFIX = "temp-";
let counter = 0;

export function newTempMessageId(now: number = Date.now()): string {
  counter += 1;
  return `${TEMP_PREFIX}${now}-${counter}`;
}

export function isTempMessage(m: Pick<Message, "id">): boolean {
  return m.id.startsWith(TEMP_PREFIX);
}

function sameOutgoing(temp: Message, row: Message): boolean {
  return (
    row.sender_type === "agent" &&
    temp.sender_type === row.sender_type &&
    temp.conversation_id === row.conversation_id &&
    temp.content_type === row.content_type &&
    (temp.content_text ?? "") === (row.content_text ?? "")
  );
}

/** Realtime INSERT: append, replacing the matching pending temp bubble. */
export function applyRealtimeInsert(prev: Message[], row: Message): Message[] {
  if (prev.some((m) => m.id === row.id)) return prev;
  const i = prev.findIndex((m) => isTempMessage(m) && m.status !== "failed" && sameOutgoing(m, row));
  return [...(i >= 0 ? prev.filter((_, j) => j !== i) : prev), row];
}

export function confirmedSendUpdate(response: unknown): Partial<Message> {
  const id = (response as { message_id?: unknown } | null)?.message_id;
  return typeof id === "string" && id ? { status: "sent", id } : { status: "sent" };
}

export function applyMessageUpdate(prev: Message[], id: string, updates: Partial<Message>): Message[] {
  const nextId = updates.id;
  if (nextId && nextId !== id && prev.some((m) => m.id === nextId)) return prev.filter((m) => m.id !== id);
  return prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
}

/** Merge a fresh newest page with local state, keeping unsent temps. */
export function mergeFetchedPage(prev: Message[], fetched: Message[]): Message[] {
  const fetchedIds = new Set(fetched.map((m) => m.id));
  const temps = prev.filter((m) => isTempMessage(m) && !fetched.some((r) => sameOutgoing(m, r)));
  const newest = fetched.length ? fetched[fetched.length - 1].created_at : "";
  const olderKept = fetched.length
    ? prev.filter((m) => !isTempMessage(m) && !fetchedIds.has(m.id) && m.created_at < fetched[0].created_at)
    : prev.filter((m) => !isTempMessage(m));
  const newerKept = prev.filter((m) => !isTempMessage(m) && !fetchedIds.has(m.id) && m.created_at > newest && fetched.length > 0);
  return [...olderKept, ...fetched, ...newerKept, ...temps];
}

export function prependOlder(prev: Message[], older: Message[]): Message[] {
  const known = new Set(prev.map((m) => m.id));
  const fresh = older.filter((m) => !known.has(m.id));
  return fresh.length ? [...fresh, ...prev] : prev;
}
