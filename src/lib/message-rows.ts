import { dayLabel } from "./format-time";
import type { Message } from "./types";

export type ChatRow =
  | { type: "msg"; m: Message; /** First bubble of a run from the same side — gets the tail. */ first: boolean }
  | { type: "day"; key: string; label: string };

const side = (m: Message) => (m.sender_type === "customer" ? "in" : "out");

/**
 * Rows for the inverted chat list (newest first). A day pill follows each
 * day's oldest message, so it renders above that day's block.
 */
export function buildRows(messages: Message[], now = new Date()): ChatRow[] {
  const out: ChatRow[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const prev = messages[i - 1];
    const sameDay = !!prev && new Date(prev.created_at).toDateString() === new Date(m.created_at).toDateString();
    out.push({ type: "msg", m, first: !prev || !sameDay || side(prev) !== side(m) });
    if (!prev || !sameDay) {
      out.push({ type: "day", key: `day-${m.created_at.slice(0, 10)}-${i}`, label: dayLabel(m.created_at, now) });
    }
  }
  return out;
}
