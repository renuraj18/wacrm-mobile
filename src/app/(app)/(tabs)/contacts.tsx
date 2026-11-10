import { View } from "react-native";

import { ContactList } from "@/components/ContactList";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useOpenChat } from "@/hooks/use-open-chat";
import { useTheme } from "@/lib/theme";

export default function Contacts() {
  const theme = useTheme();
  const openChat = useOpenChat();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader title="Contacts" />
      <ContactList onPick={(c) => void openChat(c)} />
    </View>
  );
}
