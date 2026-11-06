import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth";
import { useNotificationTap } from "@/hooks/use-notification-tap";
import { InboxRoot } from "@/lib/inbox-store";
import { registerForPush } from "@/lib/push";
import { useTheme } from "@/lib/theme";

function RootStack() {
  const { session, loading } = useAuth();
  const theme = useTheme();
  const signedIn = !!session;

  // Register this phone for push on every signed-in launch (server upserts).
  useEffect(() => {
    if (!signedIn) return;
    registerForPush().catch((e) => console.warn("[push] register failed:", e?.message ?? e));
  }, [signedIn]);

  // Tapping a notification opens that chat — including the one that
  // cold-started the app.
  const tappedConversationId = useNotificationTap();
  useEffect(() => {
    if (tappedConversationId && signedIn) router.push({ pathname: "/chat/[id]", params: { id: tappedConversationId } });
  }, [tappedConversationId, signedIn]);

  if (loading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InboxRoot>
          <StatusBar style="auto" />
          <RootStack />
        </InboxRoot>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
