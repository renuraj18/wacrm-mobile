import { View } from "react-native";

import { ContactList } from "@/components/ContactList";
import { useOpenChat } from "@/hooks/use-open-chat";
import { useTheme } from "@/lib/theme";

/** "New chat": pick a contact, then jump into (or create) their conversation. */
export default function NewChat() {
  const theme = useTheme();
  const openChat = useOpenChat();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ContactList autoFocusSearch onPick={(c) => void openChat(c)} />
    </View>
  );
}
