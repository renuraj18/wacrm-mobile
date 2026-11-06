import * as Notifications from "expo-notifications";

import { conversationIdFrom } from "@/lib/push";

/** Conversation id of the last tapped push (including a cold start). */
export function useNotificationTap(): string | null {
  return conversationIdFrom(Notifications.useLastNotificationResponse());
}
