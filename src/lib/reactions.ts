import type { MessageReaction } from "./types";

// Port of the pure parts of wacrm/src/lib/inbox/business-reaction.ts.

export interface ReactionGroup {
  emoji: string;
  count: number;
  byBusiness: boolean;
}

/** WhatsApp's quick-reaction bar. */
export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export function businessReactionOn(
  reactions: readonly MessageReaction[] | undefined,
  messageId: string,
): MessageReaction | undefined {
  return reactions?.find((r) => r.message_id === messageId && r.actor_type === "agent");
}

export function groupReactions(reactions: readonly MessageReaction[]): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    const byBusiness = r.actor_type === "agent";
    const existing = groups.get(r.emoji);
    if (existing) {
      existing.count += 1;
      existing.byBusiness = existing.byBusiness || byBusiness;
    } else {
      groups.set(r.emoji, { emoji: r.emoji, count: 1, byBusiness });
    }
  }
  return [...groups.values()];
}

/** Tapping the emoji you already used removes it (""), otherwise it sets/swaps. */
export function nextBusinessEmoji(current: MessageReaction | undefined, tapped: string): string {
  return current?.emoji === tapped ? "" : tapped;
}

/** Optimistic local change: set, swap or (emoji === "") remove the business reaction. */
export function withBusinessReaction(
  reactions: readonly MessageReaction[],
  change: { messageId: string; conversationId: string; userId: string; emoji: string; now: Date },
): MessageReaction[] {
  const current = businessReactionOn(reactions, change.messageId);
  const others = reactions.filter((r) => !(r.message_id === change.messageId && r.actor_type === "agent"));
  if (change.emoji === "") return others;
  const replacement: MessageReaction = current
    ? { ...current, emoji: change.emoji }
    : {
        id: `temp-${change.now.getTime()}`,
        message_id: change.messageId,
        conversation_id: change.conversationId,
        actor_type: "agent",
        actor_id: change.userId,
        emoji: change.emoji,
        created_at: change.now.toISOString(),
      };
  return [...others, replacement];
}

/**
 * Apply a realtime change. A server INSERT for the business reaction
 * replaces our optimistic temp row so it never shows twice.
 */
export function applyReactionChange(
  prev: MessageReaction[],
  event: "INSERT" | "UPDATE" | "DELETE",
  row: Partial<MessageReaction>,
): MessageReaction[] {
  if (event === "DELETE") return row.id ? prev.filter((r) => r.id !== row.id) : prev;
  const next = row as MessageReaction;
  if (event === "UPDATE") return prev.map((r) => (r.id === next.id ? next : r));
  if (prev.some((r) => r.id === next.id)) return prev;
  const withoutTemp = prev.filter(
    (r) =>
      !(
        r.id.startsWith("temp-") &&
        r.message_id === next.message_id &&
        r.actor_type === next.actor_type &&
        (r.actor_id ?? null) === (next.actor_id ?? null)
      ),
  );
  return [...withoutTemp, next];
}
