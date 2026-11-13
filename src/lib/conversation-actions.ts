import { supabase } from "./supabase";
import type { Conversation, ConversationStatus } from "./types";

export type ConversationChanges = {
  assigned_agent_id?: string | null;
  status?: ConversationStatus;
  unread_count?: number;
};

/**
 * Update one conversation under the member's RLS and return the values the
 * database actually stored (an assignee who left the account is nulled).
 */
export async function updateConversation(
  id: string,
  changes: ConversationChanges,
): Promise<Pick<Conversation, "assigned_agent_id" | "status" | "unread_count">> {
  const { data, error } = await supabase
    .from("conversations")
    .update(changes)
    .eq("id", id)
    .select("assigned_agent_id, status, unread_count")
    .single();
  if (error) throw new Error(error.message);
  return data as Pick<Conversation, "assigned_agent_id" | "status" | "unread_count">;
}

export type BulkAction = "toggle-mine" | "toggle-closed" | "mark-unread";

/**
 * The change one swipe/bulk action applies to a set of conversations.
 * Toggles flip only when *every* target is already in the "on" state, so a
 * mixed selection always moves to "on" first (assigned to me / closed).
 */
export function changesFor(
  targets: Pick<Conversation, "assigned_agent_id" | "status">[],
  action: BulkAction,
  myId: string | null,
): ConversationChanges | null {
  if (targets.length === 0) return null;
  switch (action) {
    case "mark-unread":
      return { unread_count: 1 };
    case "toggle-mine":
      if (!myId) return null;
      return targets.every((c) => c.assigned_agent_id === myId) ? { assigned_agent_id: null } : { assigned_agent_id: myId };
    case "toggle-closed":
      return targets.every((c) => c.status === "closed") ? { status: "open" } : { status: "closed" };
  }
}
