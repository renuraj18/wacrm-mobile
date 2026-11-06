import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { contactDisplayName, contactHandle } from "@/lib/conversations";
import { useInbox } from "@/lib/inbox-store";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import type { ConversationStatus } from "@/lib/types";

const STATUS_LABEL: Record<ConversationStatus, string> = { open: "Open", pending: "Pending", closed: "Closed" };

/** Contact + conversation panel for a chat (`id` is the conversation id). */
export default function ContactPanel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { session, canSend } = useAuth();
  const { conversations, patch } = useInbox();
  const conv = conversations.find((c) => c.id === id);
  const contact = conv?.contact;
  const [members, setMembers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const me = session?.user.id;

  // Assignee display names. Profiles are account-member readable (RLS).
  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const p of (data ?? []) as { user_id: string; full_name: string | null }[]) map[p.user_id] = p.full_name || "Teammate";
        setMembers(map);
      });
  }, []);

  if (!conv) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.muted }}>Conversation not found.</Text>
      </View>
    );
  }

  const update = async (changes: { assigned_agent_id?: string | null; status?: ConversationStatus }) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("conversations")
      .update(changes)
      .eq("id", conv.id)
      .select("assigned_agent_id, status")
      .single();
    setBusy(false);
    if (error) return Alert.alert("Update failed", error.message);
    if ("assigned_agent_id" in changes && data?.assigned_agent_id !== changes.assigned_agent_id) {
      Alert.alert("Not assigned", "That teammate is no longer a member of this account.");
    }
    patch(conv.id, { assigned_agent_id: data?.assigned_agent_id ?? null, status: data?.status ?? conv.status });
  };

  const name = contactDisplayName(contact);
  const phone = contact ? contactHandle(contact) : "";
  const assignee = conv.assigned_agent_id
    ? conv.assigned_agent_id === me
      ? "You"
      : (members[conv.assigned_agent_id] ?? "Teammate")
    : "Unassigned";
  const closed = conv.status === "closed";

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.body}>
      <View style={styles.head}>
        <Avatar name={name} uri={contact?.avatar_url} size={84} />
        <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
        {!!phone && (
          <Pressable onPress={() => /^\d+$/.test(phone) && Linking.openURL(`tel:+${phone}`)}>
            <Text style={{ color: theme.primary, fontSize: 16 }}>{/^\d+$/.test(phone) ? `+${phone}` : phone}</Text>
          </Pressable>
        )}
      </View>

      <Section title="Details">
        <Field label="Email" value={contact?.email} />
        <Field label="Company" value={contact?.company} />
        <Field label="Status" value={STATUS_LABEL[conv.status]} />
        <Field label="Assigned to" value={assignee} />
      </Section>

      <Section title="Tags">
        {contact?.tags?.length ? (
          <View style={styles.tags}>
            {contact.tags.map((t) => (
              <View key={t.id} style={[styles.tag, { borderColor: t.color }]}>
                <View style={[styles.tagDot, { backgroundColor: t.color }]} />
                <Text style={{ color: theme.text, fontSize: 13 }}>{t.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.muted }}>No tags</Text>
        )}
      </Section>

      {canSend && (
        <View style={styles.actions}>
          {conv.assigned_agent_id !== me ? (
            <Button label="Assign to me" onPress={() => update({ assigned_agent_id: me ?? null })} disabled={busy} />
          ) : (
            <Button label="Unassign" onPress={() => update({ assigned_agent_id: null })} disabled={busy} subtle />
          )}
          <Button
            label={closed ? "Reopen conversation" : "Close conversation"}
            onPress={() => update({ status: closed ? "open" : "closed" })}
            disabled={busy}
            subtle
          />
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.muted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={{ color: theme.muted }}>{label}</Text>
      <Text style={{ color: theme.text, flexShrink: 1, textAlign: "right" }}>{value || "—"}</Text>
    </View>
  );
}

function Button({ label, onPress, disabled, subtle }: { label: string; onPress: () => void; disabled?: boolean; subtle?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: subtle ? theme.surface : theme.primary, opacity: disabled ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={{ color: subtle ? theme.primary : "#fff", fontWeight: "600", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 16 },
  head: { alignItems: "center", gap: 6, marginVertical: 8 },
  name: { fontSize: 22, fontWeight: "700" },
  section: { borderRadius: 12, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  field: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  actions: { gap: 10 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: "center" },
});
