import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useAuth } from "@/lib/auth";
import { APP_VERSION, API_BASE_URL } from "@/lib/config";
import { isPushEnabled, setPushEnabled, unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { useThemeState, type ThemeMode } from "@/lib/theme";

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function Settings() {
  const { theme, mode, setMode } = useThemeState();
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

  const name = profile?.full_name || session?.user.email || "You";

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Settings" />
      <ScrollView>
        <View style={styles.profile}>
          <Avatar name={name} size={64} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: theme.muted }} numberOfLines={1}>
              {session?.user.email}
            </Text>
            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: "600", textTransform: "capitalize" }}>
              {profile?.account_role ?? "member"}
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: theme.primary }]}>Appearance</Text>
        <View style={styles.segment}>
          {MODES.map((m) => {
            const active = m.value === mode;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMode(m.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.segBtn, { backgroundColor: active ? theme.pillActiveBg : theme.pillBg }]}
              >
                <Text style={{ color: active ? theme.pillActiveText : theme.pillText, fontWeight: "600" }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: theme.primary }]}>Notifications</Text>
        <View style={styles.row}>
          <Icon name="notifications-outline" size={24} color={theme.muted} />
          <View style={styles.flex}>
            <Text style={{ color: theme.text, fontSize: 16 }}>New message notifications</Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Alerts for customer messages on this phone</Text>
          </View>
          <Switch value={push} onValueChange={togglePush} trackColor={{ true: theme.primary }} />
        </View>

        <Text style={[styles.section, { color: theme.primary }]}>Account</Text>
        <Pressable
          onPress={signOut}
          disabled={busy}
          style={({ pressed }) => [styles.row, { opacity: busy ? 0.6 : 1 }, pressed && { backgroundColor: theme.surface }]}
          accessibilityRole="button"
        >
          <Icon name="log-out-outline" size={24} color={theme.danger} />
          <Text style={{ color: theme.danger, fontSize: 16 }}>Sign out</Text>
        </Pressable>

        <Text style={[styles.footer, { color: theme.muted }]}>
          v{APP_VERSION} · {API_BASE_URL.replace(/^https?:\/\//, "")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: "row", alignItems: "center", gap: 16, padding: 20 },
  name: { fontSize: 20, fontWeight: "700" },
  section: { fontSize: 13, fontWeight: "700", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  segment: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 14 },
  footer: { textAlign: "center", marginVertical: 28, fontSize: 12 },
});
