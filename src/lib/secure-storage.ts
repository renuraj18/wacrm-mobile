import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Supabase sessions (access + refresh token + user JSON) regularly exceed
// the ~2 KB value size SecureStore guarantees, so values are split into
// chunks under `<key>.<n>` with a `<key>.count` index. On web (used only
// for local previews) there is no keychain, so fall back to localStorage.

const CHUNK = 1800;

function safeKey(key: string): string {
  // SecureStore keys allow only [A-Za-z0-9._-].
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function removeChunks(k: string): Promise<void> {
  const count = Number((await SecureStore.getItemAsync(`${k}.count`)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
  await SecureStore.deleteItemAsync(`${k}.count`);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    const k = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(`${k}.count`)) ?? 0);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const k = safeKey(key);
    await removeChunks(k);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}.count`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await removeChunks(safeKey(key));
  },
};
