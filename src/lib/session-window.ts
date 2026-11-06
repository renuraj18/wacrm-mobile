import type { Message } from "./types";

const HOUR_MS = 60 * 60 * 1000;
export const SESSION_WINDOW_HOURS = 24;

export interface SessionInfo {
  /** True when free-form messages can no longer be sent — templates only. */
  expired: boolean;
  /** Short human label, e.g. "5h left", "40m left", "Window closed". */
  label: string;
}

/**
 * WhatsApp 24h customer-service window, same rule as the web thread
 * (`sessionInfo` in wacrm/src/components/inbox/message-thread.tsx):
 * no messages loaded → open; no customer message → closed; otherwise
 * closed once 24 whole hours have passed since the last customer message.
 */
export function sessionWindow(messages: Pick<Message, "sender_type" | "created_at">[], now: number = Date.now()): SessionInfo {
  if (messages.length === 0) return { expired: false, label: "" };
  let last: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === "customer") {
      last = messages[i].created_at;
      break;
    }
  }
  if (!last) return { expired: true, label: "No customer messages" };
  // date-fns differenceInHours truncates toward zero.
  const hoursSince = Math.trunc((now - new Date(last).getTime()) / HOUR_MS);
  if (hoursSince >= SESSION_WINDOW_HOURS) return { expired: true, label: "Window closed" };
  const hoursLeft = SESSION_WINDOW_HOURS - hoursSince;
  return {
    expired: false,
    label: hoursLeft >= 1 ? `${Math.floor(hoursLeft)}h left` : `${Math.floor(hoursLeft * 60)}m left`,
  };
}
