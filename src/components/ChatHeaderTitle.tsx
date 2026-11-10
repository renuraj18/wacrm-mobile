import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

import { Avatar } from "./Avatar";

/** App-bar title for a chat: avatar, name and the 24h reply-window status. */
export function ChatHeaderTitle({
  name,
  uri,
  subtitle,
  onPress,
}: {
  name: string;
  uri?: string | null;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${name}, contact details`}>
      <Avatar name={name} uri={uri} size={36} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.headerText }]} numberOfLines={1}>
          {name}
        </Text>
        {!!subtitle && (
          <Text style={{ color: theme.headerMuted, fontSize: 12 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 230 },
  text: { flexShrink: 1 },
  name: { fontSize: 17, fontWeight: "600" },
});
