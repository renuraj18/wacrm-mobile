import { Tabs } from "expo-router";

import { Icon } from "@/components/ui/Icon";
import { useInbox } from "@/lib/inbox-store";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const theme = useTheme();
  const { totalUnread } = useInbox();
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // each tab draws its own app bar (ScreenHeader)
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarBadgeStyle: { backgroundColor: theme.primary, color: theme.primaryText },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? "99+" : totalUnread) : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "people" : "people-outline"} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "settings" : "settings-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
