import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Height the on-screen keyboard covers at the bottom of the screen (Android; 0 on iOS, which
 * uses KeyboardAvoidingView). Android draws edge-to-edge, so the window no longer shrinks when the
 * keyboard opens and inputs near the bottom end up under it.
 */
export function useKeyboardInset() {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const ease = () => {
      if (!prefersReducedMotion()) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(220, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity),
        );
      }
    };
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      ease();
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      ease();
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // RN reports the keyboard height above the navigation bar; the screen reaches under that bar too.
  return height > 0 ? height + insets.bottom : 0;
}

/**
 * Keeps inputs above the keyboard: the content gets bottom padding as tall as the keyboard, so
 * scroll views shrink to the space that is left and keep the focused field in view.
 */
export function KeyboardAware({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <AndroidKeyboardPad style={style}>{children}</AndroidKeyboardPad>;
}

function AndroidKeyboardPad({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const inset = useKeyboardInset();
  return <View style={[{ flex: 1 }, style, { paddingBottom: inset }]}>{children}</View>;
}
