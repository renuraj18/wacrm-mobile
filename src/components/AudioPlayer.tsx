import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AudioPlayer({ uri }: { uri: string }) {
  const theme = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const progress = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration && status.currentTime >= status.duration)) void player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}>
        <Text style={[styles.icon, { color: theme.primary }]}>{status.playing ? "❚❚" : "▶"}</Text>
      </Pressable>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{mmss(status.playing ? status.currentTime : status.duration || 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 200, paddingVertical: 4 },
  icon: { fontSize: 20, width: 24, textAlign: "center" },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4 },
});
