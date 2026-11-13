import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";

import { Icon } from "./ui/Icon";

const BARS = 32;
const SPEEDS = [1, 1.5, 2] as const;

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Stable pseudo-random bar heights (0.25–1) so a voice note always draws the same waveform. */
export function waveformHeights(seed: string, count = BARS): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out.push(0.25 + ((h >>> 0) % 1000) / 1000 * 0.75);
  }
  return out;
}

export function AudioPlayer({ uri }: { uri: string }) {
  const theme = useTheme();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [width, setWidth] = useState(0);
  const [heights] = useState(() => waveformHeights(uri));
  const progress = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration && status.currentTime >= status.duration)) void player.seekTo(0);
      player.play();
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    player.setPlaybackRate(SPEEDS[next]);
  };

  const seek = (x: number) => {
    if (!width || !status.duration) return;
    void player.seekTo(Math.max(0, Math.min(1, x / width)) * status.duration);
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}>
        <Icon name={status.playing ? "pause" : "play"} size={28} color={theme.muted} />
      </Pressable>
      <View style={styles.mid}>
        <Pressable
          onPress={(e) => seek(e.nativeEvent.locationX)}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={styles.wave}
          accessibilityLabel="Voice note position"
        >
          {heights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: 4 + h * 20, backgroundColor: (i + 0.5) / heights.length <= progress ? theme.primary : theme.border },
              ]}
            />
          ))}
        </Pressable>
        <Text style={{ color: theme.muted, fontSize: 11 }}>
          {mmss(status.playing || progress > 0 ? status.currentTime : status.duration || 0)}
        </Text>
      </View>
      <Pressable
        onPress={cycleSpeed}
        hitSlop={8}
        style={[styles.speed, { backgroundColor: theme.surface }]}
        accessibilityLabel={`Playback speed ${SPEEDS[speedIdx]}x`}
      >
        <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>{SPEEDS[speedIdx]}x</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 230, paddingVertical: 2 },
  mid: { flex: 1, gap: 2 },
  wave: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 28 },
  bar: { width: 3, borderRadius: 2 },
  speed: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
});
