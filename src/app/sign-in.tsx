import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

export default function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(err.message);
  };

  const input = [styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView style={[styles.flex, styles.center]} behavior="padding">
        <View style={styles.card}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Shanthi Inbox</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Sign in with your CRM account</Text>
          <TextInput
            style={input}
            placeholder="Email"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email"
          />
          <TextInput
            style={input}
            placeholder="Password"
            placeholderTextColor={theme.muted}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            accessibilityLabel="Password"
          />
          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary, opacity: busy ? 0.7 : 1 }]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", maxWidth: 400, gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 32, alignSelf: "center", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 30, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginTop: 8 },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 13 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
