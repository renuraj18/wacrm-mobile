import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const theme = useTheme();
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={style} contentFit="cover" />;
  return (
    <View style={[style, styles.fallback, { backgroundColor: theme.border }]}>
      <Text style={{ color: theme.muted, fontSize: size * 0.42, fontWeight: "600" }}>
        {(name.trim().charAt(0) || "?").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ fallback: { alignItems: "center", justifyContent: "center" } });
