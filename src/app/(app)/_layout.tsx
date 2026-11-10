import { Stack } from "expo-router";

import { useTheme } from "@/lib/theme";

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.header },
        headerTintColor: theme.headerText,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ title: "" }} />
      <Stack.Screen name="contact/[id]" options={{ title: "Contact", presentation: "modal" }} />
      <Stack.Screen name="new-chat" options={{ title: "New chat" }} />
    </Stack>
  );
}
