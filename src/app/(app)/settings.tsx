import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { APP_VERSION, API_BASE_URL } from "@/lib/config";
import { isPushEnabled, setPushEnabled, unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

export default function Settings() {
  const theme = useTheme();
  const { session, profile } = useAuth();
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isPushEnabled().then(setPush);
  }, []);

  const togglePush = async (on: boolean) => {
    setPush(on);
    try {
      await setPushEnabled(on);
    } catch (e) {
      Alert.alert("Notifications", e instanceof Error ? e.message : String(e));
    }
  };

  const signOut = async () => {
    setBusy(true);
    await unregisterPush();
    await supabase.auth.signOut();
    setBusy(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Text style={[styles.label, { color: theme.muted }]}>Signed in as</Text>
        <Text style={{ color: theme.text, fontSize: 16 }}>{profile?.full_name || session?.user.email}</Text>
        <Text style={{ color: theme.muted }}>
          {session?.user.email} · {profile?.account_role ?? "member"}
        </Text>
      </View>
      <View style={[styles.card, styles.row, { backgroundColor: theme.surface }]}>
        <View style={styles.flex}>
          <Text style={{ color: theme.text, fontSize: 16 }}>New message notifications</Text>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Alerts for customer messages on this phone</Text>
        </View>
        <Switch value={push} onValueChange={togglePush} trackColor={{ true: theme.primary }} />
      </View>
      <Pressable
        onPress={signOut}
        disabled={busy}
        style={[styles.card, { backgroundColor: theme.surface, opacity: busy ? 0.6 : 1 }]}
        accessibilityRole="button"
      >
        <Text style={{ color: theme.danger, fontSize: 16, textAlign: "center" }}>Sign out</Text>
      </Pressable>
      <Text style={[styles.footer, { color: theme.muted }]}>
        v{APP_VERSION} · {API_BASE_URL.replace(/^https?:\/\//, "")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  footer: { textAlign: "center", marginTop: 24, fontSize: 12 },
});
