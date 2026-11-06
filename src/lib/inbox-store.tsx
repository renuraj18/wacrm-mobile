import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { useRealtime } from "@/hooks/use-realtime";

import { useAuth } from "./auth";
import { CONVERSATION_SELECT, normalizeConversation, sortConversations } from "./conversations";
import { previewText } from "./preview";
import { supabase } from "./supabase";
import type { Conversation, Message } from "./types";

interface InboxState {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Conversation currently open on screen — its unread count stays 0. */
  setActiveId: (id: string | null) => void;
  patch: (id: string, changes: Partial<Conversation>) => void;
  ensure: (id: string) => Promise<Conversation | null>;
  totalUnread: number;
}

const InboxContext = createContext<InboxState | null>(null);

export function InboxProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const knownIds = useRef(new Set<string>());
  const hydrating = useRef(new Set<string>());

  useEffect(() => {
    knownIds.current = new Set(conversations.map((c) => c.id));
  }, [conversations]);

  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .order("last_message_at", { ascending: false });
    if (err) setError(err.message);
    else {
      setError(null);
      setConversations(
        (data ?? []).map(normalizeConversation).map((c) => (c.id === activeIdRef.current ? { ...c, unread_count: 0 } : c)),
      );
    }
    setLoading(false);
  }, []);

  /** Fetch one conversation with its contact (realtime rows carry no joins). */
  const ensure = useCallback(async (id: string) => {
    if (hydrating.current.has(id)) return null;
    hydrating.current.add(id);
    try {
      const { data } = await supabase.from("conversations").select(CONVERSATION_SELECT).eq("id", id).maybeSingle();
      if (!data) return null;
      const fetched = normalizeConversation(data);
      setConversations((prev) =>
        prev.some((c) => c.id === id)
          ? prev.map((c) => (c.id === id ? { ...c, contact: c.contact ?? fetched.contact } : c))
          : sortConversations([fetched, ...prev]),
      );
      return fetched;
    } finally {
      hydrating.current.delete(id);
    }
  }, []);

  const userId = session?.user.id;
  // The provider is keyed by user id (see InboxRoot), so a sign-out /
  // sign-in starts from empty state; just load for the current user.
  useEffect(() => {
    if (userId) void Promise.resolve().then(refresh);
  }, [userId, refresh]);

  // Catch up after the app returns to the foreground — realtime events
  // sent while suspended are lost.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && userId) void refresh();
    });
    return () => sub.remove();
  }, [userId, refresh]);

  const connected = useRealtime(
    "inbox",
    [
      {
        table: "conversations",
        onChange: (p) => {
          if (p.eventType === "DELETE") return;
          const row = p.new as unknown as Conversation;
          if (!knownIds.current.has(row.id)) {
            void ensure(row.id);
            return;
          }
          setConversations((prev) =>
            sortConversations(
              prev.map((c) =>
                c.id === row.id
                  ? { ...c, ...row, contact: c.contact, unread_count: activeIdRef.current === row.id ? 0 : row.unread_count }
                  : c,
              ),
            ),
          );
        },
      },
      {
        table: "messages",
        onChange: (p) => {
          if (p.eventType !== "INSERT") return;
          const m = p.new as unknown as Message;
          if (!knownIds.current.has(m.conversation_id)) {
            void ensure(m.conversation_id);
            return;
          }
          setConversations((prev) =>
            sortConversations(
              prev.map((c) =>
                c.id === m.conversation_id
                  ? {
                      ...c,
                      last_message_text: m.content_text || previewText(m.content_type, null),
                      last_message_at: m.created_at,
                      unread_count:
                        activeIdRef.current === c.id || m.sender_type !== "customer" ? c.unread_count : c.unread_count + 1,
                    }
                  : c,
              ),
            ),
          );
        },
      },
    ],
    !!userId,
  );

  // Resync on reconnect (not the first connect, which the mount fetch covers).
  const wasConnected = useRef(false);
  const firstConnect = useRef(true);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      if (!firstConnect.current) void refresh();
      firstConnect.current = false;
    }
    wasConnected.current = connected;
  }, [connected, refresh]);

  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    if (id) setConversations((prev) => prev.map((c) => (c.id === id && c.unread_count > 0 ? { ...c, unread_count: 0 } : c)));
  }, []);

  const patch = useCallback((id: string, changes: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }, []);

  const totalUnread = useMemo(() => conversations.reduce((n, c) => n + (c.unread_count > 0 ? 1 : 0), 0), [conversations]);

  return (
    <InboxContext.Provider value={{ conversations, loading, error, refresh, setActiveId, patch, ensure, totalUnread }}>
      {children}
    </InboxContext.Provider>
  );
}

/** Remounts the inbox per signed-in user so nothing leaks across accounts. */
export function InboxRoot({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return <InboxProvider key={session?.user.id ?? "signed-out"}>{children}</InboxProvider>;
}

export function useInbox(): InboxState {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used inside InboxProvider");
  return ctx;
}
