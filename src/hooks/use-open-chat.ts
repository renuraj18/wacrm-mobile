import { router } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";

import { useAuth } from "@/lib/auth";
import { useInbox } from "@/lib/inbox-store";
import { supabase } from "@/lib/supabase";
import type { Contact } from "@/lib/types";

/**
 * Open the chat for a contact, creating the conversation first when the
 * contact has none (same find-or-create the CRM's send route does).
 */
export function useOpenChat() {
  const { session, profile, canSend } = useAuth();
  const { conversations, ensure } = useInbox();
  const accountId = profile?.account_id;
  const userId = session?.user.id;

  return useCallback(
    async (contact: Contact) => {
      const open = (id: string) => router.push({ pathname: "/chat/[id]", params: { id } });

      const existing = conversations.find((c) => c.contact_id === contact.id);
      if (existing) return open(existing.id);

      if (!canSend || !accountId || !userId) {
        Alert.alert("View-only access", "You can't start new conversations with this role.");
        return;
      }

      const find = async () => {
        const { data } = await supabase
          .from("conversations")
          .select("id")
          .eq("account_id", accountId)
          .eq("contact_id", contact.id)
          .maybeSingle();
        return (data as { id: string } | null)?.id ?? null;
      };

      let id = await find();
      if (!id) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ account_id: accountId, user_id: userId, contact_id: contact.id })
          .select("id")
          .single();
        // A concurrent create (unique contact per account) is fine — reuse it.
        id = error ? await find() : (data as { id: string }).id;
        if (!id) {
          Alert.alert("Couldn't start chat", error?.message ?? "Try again.");
          return;
        }
      }
      await ensure(id);
      open(id);
    },
    [conversations, ensure, canSend, accountId, userId],
  );
}
