import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { contactDisplayName } from "@/lib/conversations";
import { listTime } from "@/lib/format-time";
import { useTheme } from "@/lib/theme";
import type { Conversation } from "@/lib/types";

import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./ui/Icon";

export type RowAction = "toggle-mine" | "toggle-closed" | "mark-unread";

interface Props {
  conv: Conversation;
  myId: string | null;
  selected: boolean;
  selecting: boolean;
  /** Swipe actions and multi-select need write access (agent and above). */
  canAct: boolean;
  onPress: (conv: Conversation) => void;
  onLongPress: (conv: Conversation) => void;
  onAction: (conv: Conversation, action: RowAction) => void;
}

function ActionButton({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={22} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function ConversationRowInner({ conv, myId, selected, selecting, canAct, onPress, onLongPress, onAction }: Props) {
  const theme = useTheme();
  const name = contactDisplayName(conv.contact);
  const unread = conv.unread_count > 0;
  const mine = !!myId && conv.assigned_agent_id === myId;
  const closed = conv.status === "closed";

  const row = (
    <Pressable
      onPress={() => onPress(conv)}
      onLongPress={() => onLongPress(conv)}
      delayLongPress={300}
      style={[styles.row, { backgroundColor: selected ? theme.selected : theme.bg }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Conversation with ${name}${unread ? `, ${conv.unread_count} unread` : ""}`}
    >
      <View>
        <Avatar name={name} uri={conv.contact?.avatar_url} size={52} />
        {selected && (
          <View style={[styles.check, { backgroundColor: theme.primary, borderColor: theme.bg }]}>
            <Icon name="checkmark" size={14} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={[styles.name, { color: theme.text, fontWeight: unread ? "700" : "500" }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: unread ? theme.primary : theme.muted, fontSize: 12 }}>{listTime(conv.last_message_at)}</Text>
        </View>
        <View style={styles.line}>
          <Text
            style={[styles.preview, { color: unread ? theme.text : theme.muted }]}
            numberOfLines={1}
            accessibilityLabel={conv.last_message_text ?? "No messages yet"}
          >
            {conv.last_message_text || "No messages yet"}
          </Text>
          <View style={styles.badges}>
            {conv.status !== "open" && (
              <Text
                style={[
                  styles.chip,
                  closed
                    ? { color: theme.muted, backgroundColor: theme.surface }
                    : { color: theme.warn, backgroundColor: theme.warnBg },
                ]}
              >
                {closed ? "Closed" : "Pending"}
              </Text>
            )}
            {mine && <Icon name="person-circle" size={16} color={theme.primary} />}
            {unread && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>{conv.unread_count > 99 ? "99+" : conv.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (!canAct || selecting) return row;

  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      renderLeftActions={(_p, _t, methods: SwipeableMethods): ReactNode => (
        <View style={styles.actions}>
          <ActionButton
            color={theme.swipeUnread}
            icon="mail-unread-outline"
            label="Unread"
            onPress={() => {
              methods.close();
              onAction(conv, "mark-unread");
            }}
          />
        </View>
      )}
      renderRightActions={(_p, _t, methods: SwipeableMethods): ReactNode => (
        <View style={styles.actions}>
          <ActionButton
            color={theme.swipeAssign}
            icon={mine ? "person-remove-outline" : "person-add-outline"}
            label={mine ? "Unassign" : "Mine"}
            onPress={() => {
              methods.close();
              onAction(conv, "toggle-mine");
            }}
          />
          <ActionButton
            color={theme.swipeClose}
            icon={closed ? "arrow-undo-outline" : "checkmark-done-outline"}
            label={closed ? "Reopen" : "Close"}
            onPress={() => {
              methods.close();
              onAction(conv, "toggle-closed");
            }}
          />
        </View>
      )}
    >
      {row}
    </Swipeable>
  );
}

export const ConversationRow = memo(ConversationRowInner);

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, paddingLeft: 16, paddingRight: 16, paddingVertical: 10, alignItems: "center" },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  name: { fontSize: 17, flexShrink: 1 },
  preview: { fontSize: 14, flex: 1 },
  badges: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { fontSize: 11, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  check: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row" },
  action: { width: 76, alignItems: "center", justifyContent: "center", gap: 2 },
  actionLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
