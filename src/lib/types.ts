// Row shapes mirrored from wacrm/src/types/index.ts — only the columns
// the mobile app reads. Keep field names identical to the database.

export type AccountRole = "owner" | "admin" | "agent" | "viewer";
export type ConversationStatus = "open" | "pending" | "closed";
export type SenderType = "customer" | "agent" | "bot";
export type ContentType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "location"
  | "template"
  | "interactive";
export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Contact {
  id: string;
  account_id: string;
  phone: string;
  wa_username?: string | null;
  wa_user_id?: string | null;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  avatar_url?: string | null;
  tags?: Tag[];
}

export interface Conversation {
  id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  last_inbound_at?: string | null;
  last_reply_at?: string | null;
  created_at: string;
  contact?: Contact;
}

export interface InteractiveButton {
  id: string;
  title: string;
}
export interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
}
/** wacrm/src/lib/whatsapp/interactive.ts InteractiveMessagePayload. */
export type InteractivePayload =
  | { kind: "buttons"; body: string; header?: string; footer?: string; buttons: InteractiveButton[] }
  | {
      kind: "list";
      body: string;
      header?: string;
      footer?: string;
      button_label: string;
      sections: { title?: string; rows: InteractiveListRow[] }[];
    };

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id?: string | null;
  content_type: ContentType;
  content_text?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  template_name?: string | null;
  status: MessageStatus;
  created_at: string;
  reply_to_message_id?: string | null;
  interactive_reply_id?: string | null;
  interactive_payload?: InteractivePayload | null;
  ai_generated?: boolean | null;
  error_title?: string | null;
  error_details?: string | null;
}

export interface Profile {
  user_id: string;
  full_name: string | null;
  account_id: string;
  account_role: AccountRole;
}

export interface MessageTemplate {
  id: string;
  name: string;
  language?: string | null;
  category?: string | null;
  header_type?: "text" | "image" | "video" | "document" | null;
  header_content?: string | null;
  header_media_url?: string | null;
  body_text: string;
  footer_text?: string | null;
  status?: string | null;
}

export interface ProductListItem {
  id: string;
  title: string;
  image_url: string | null;
  price_min: number;
  price_max: number;
  currency: string;
  total_inventory: number | null;
  tracks_inventory: boolean;
  online_url: string | null;
}
