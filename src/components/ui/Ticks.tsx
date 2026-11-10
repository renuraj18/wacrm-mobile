import { useTheme } from "@/lib/theme";
import type { MessageStatus } from "@/lib/types";

import { Icon } from "./Icon";

/** WhatsApp delivery ticks: clock, one grey tick, two grey, two blue, or a warning. */
export function Ticks({ status, size = 15 }: { status: MessageStatus; size?: number }) {
  const theme = useTheme();
  switch (status) {
    case "sending":
      return <Icon name="time-outline" size={size - 2} color={theme.muted} />;
    case "sent":
      return <Icon name="checkmark" size={size} color={theme.muted} />;
    case "delivered":
      return <Icon name="checkmark-done" size={size} color={theme.muted} />;
    case "read":
      return <Icon name="checkmark-done" size={size} color={theme.tick} />;
    case "failed":
      return <Icon name="alert-circle" size={size} color={theme.danger} />;
  }
}
