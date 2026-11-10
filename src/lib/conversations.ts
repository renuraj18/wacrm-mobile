import type { Contact, Conversation, Tag } from "./types";

/** Same embed as wacrm/src/lib/inbox/conversations.ts. */
export const CONVERSATION_SELECT = "*, contact:contacts(*, contact_tags(tags(*)))";

type RawContact = Contact & { contact_tags?: { tags: Tag | null }[] };
type RawConversation = Omit<Conversation, "contact"> & { contact?: RawContact | null };

/** Flatten `contact_tags(tags(*))` onto `contact.tags`. */
export function normalizeConversation(raw: RawConversation): Conversation {
  const rawContact = raw.contact;
  if (!rawContact) return raw as Conversation;
  const { contact_tags, ...contact } = rawContact;
  return {
    ...raw,
    contact: {
      ...contact,
      tags: (contact_tags ?? []).map((ct) => ct.tags).filter((t): t is Tag => t != null),
    },
  };
}

export type InboxFilter = "all" | "mine" | "unread" | "pending" | "closed";

export function applyInboxFilter(
  conversations: Conversation[],
  filter: InboxFilter,
  userId: string | null,
  search: string,
): Conversation[] {
  let result = conversations;
  if (filter === "unread") result = result.filter((c) => c.unread_count > 0);
  if (filter === "mine") result = result.filter((c) => !!userId && c.assigned_agent_id === userId);
  if (filter === "pending") result = result.filter((c) => c.status === "pending");
  if (filter === "closed") result = result.filter((c) => c.status === "closed");
  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter((c) => {
      const name = c.contact?.name?.toLowerCase() ?? "";
      const phone = c.contact?.phone?.toLowerCase() ?? "";
      const last = c.last_message_text?.toLowerCase() ?? "";
      return name.includes(q) || phone.includes(q) || last.includes(q);
    });
  }
  return result;
}

/** Newest activity first, like the web's `order("last_message_at", desc)`. */
export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
}

/** wacrm/src/lib/whatsapp/wa-identity.ts `contactHandle`. */
export function contactHandle(contact: Pick<Contact, "phone" | "wa_username" | "wa_user_id">): string {
  if (contact.phone?.trim()) return contact.phone;
  if (contact.wa_username?.trim()) return `@${contact.wa_username.trim()}`;
  return contact.wa_user_id?.trim() ?? "";
}

export function contactDisplayName(contact: Contact | undefined | null): string {
  if (!contact) return "Unknown";
  return contact.name?.trim() || contactHandle(contact) || "Unknown";
}
