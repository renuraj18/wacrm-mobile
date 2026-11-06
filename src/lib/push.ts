import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";
import { APP_VERSION, EAS_PROJECT_ID } from "./config";
import { secureStorage } from "./secure-storage";

const TOKEN_KEY = "wacrm.push-token";
const ENABLED_KEY = "wacrm.push-enabled";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function isPushEnabled(): Promise<boolean> {
  return (await secureStorage.getItem(ENABLED_KEY)) !== "false";
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await secureStorage.setItem(ENABLED_KEY, String(enabled));
  if (enabled) await registerForPush();
  else await unregisterPush();
}

export type PushResult = { ok: true; token: string } | { ok: false; reason: string };

/**
 * Ask permission, get the Expo push token and register it with the CRM
 * (`POST /api/push/devices`). Safe to call on every launch — the server
 * upserts on the token.
 */
export async function registerForPush(): Promise<PushResult> {
  if (Platform.OS === "web") return { ok: false, reason: "Push isn't available on web." };
  if (!Device.isDevice) return { ok: false, reason: "Push notifications need a real phone (not a simulator)." };
  if (!(await isPushEnabled())) return { ok: false, reason: "Notifications are turned off in Settings." };

  if (Platform.OS === "android") {
    // Must match `channelId` the server sends (wacrm/src/lib/push/notify.ts).
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Customer messages",
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, reason: "Notification permission was not granted." };

  if (!EAS_PROJECT_ID) return { ok: false, reason: "No EAS project id — run `npx eas-cli init` and rebuild." };

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
  await api("/api/push/devices", {
    method: "POST",
    body: { expo_push_token: token, platform: Platform.OS, app_version: APP_VERSION },
  });
  await secureStorage.setItem(TOKEN_KEY, token);
  return { ok: true, token };
}

/** Remove this phone's token from the CRM (sign-out / toggle off). */
export async function unregisterPush(): Promise<void> {
  const token = await secureStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api("/api/push/devices", { method: "DELETE", body: { expo_push_token: token } });
  } catch {
    // Best effort — the server also prunes tokens Expo reports as dead.
  }
  await secureStorage.removeItem(TOKEN_KEY);
}

/** `conversation_id` from a tapped notification's data payload. */
export function conversationIdFrom(response: Notifications.NotificationResponse | null | undefined): string | null {
  const id = response?.notification.request.content.data?.conversation_id;
  return typeof id === "string" && id ? id : null;
}
