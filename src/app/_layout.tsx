import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/lib/auth";
import { useNotificationTap } from "@/hooks/use-notification-tap";
import { InboxRoot } from "@/lib/inbox-store";
import { registerForPush } from "@/lib/push";
import { ThemeProvider, useThemeState } from "@/lib/theme";

function RootStack() {
  const { session, loading } = useAuth();
  const { theme, isDark } = useThemeState();
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
    <>
      {/* Signed in: the green/charcoal app bar always wants light icons. */}
      <StatusBar style={signedIn || isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.header },
          headerTintColor: theme.headerText,
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
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <AuthProvider>
              <InboxRoot>
                <RootStack />
              </InboxRoot>
            </AuthProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
