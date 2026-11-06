import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;
export type ChangeHandler = (payload: RealtimePostgresChangesPayload<Row>) => void;

interface Subscription {
  table: "messages" | "conversations";
  filter?: string;
  onChange: ChangeHandler;
}

/**
 * One Supabase realtime channel over the given tables. Rows are RLS
 * scoped to the signed-in member's account, like the web inbox.
 * Returns `connected`, which flips back to true after a reconnect so
 * callers can resync anything missed while offline.
 */
export function useRealtime(channelName: string, subs: Subscription[], enabled = true): boolean {
  const [connected, setConnected] = useState(false);
  const subsRef = useRef(subs);
  useEffect(() => {
    subsRef.current = subs;
  });
  const key = subs.map((s) => `${s.table}:${s.filter ?? ""}`).join("|");

  useEffect(() => {
    if (!enabled) return;
    let channel = supabase.channel(`${channelName}-${Date.now()}`);
    subsRef.current.forEach((s, i) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        (payload) => subsRef.current[i]?.onChange(payload as RealtimePostgresChangesPayload<Row>),
      );
    });
    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [channelName, key, enabled]);

  return connected;
}
