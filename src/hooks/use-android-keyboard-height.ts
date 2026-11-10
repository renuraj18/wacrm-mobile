import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// Keyboard height from React Native's own events. Android edge-to-edge never
// resizes the window, and this doesn't depend on a native module being in
// the build. iOS handles the keyboard through react-native-keyboard-controller.
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
