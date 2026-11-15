import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { motion, radius, space } from "@/theme/tokens";
import { useReducedMotion } from "@/lib/motion";
import { IconButton } from "./Button";
import { useKeyboardInset } from "./Keyboard";
import { Text } from "./Text";

/** Bottom sheet over a scrim. Opens on a near-critical spring, closes faster. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Android: the sheet rides up on the keyboard (iOS: KeyboardAvoidingView below).
  const keyboard = useKeyboardInset();
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  // Mount as soon as the sheet is asked to open; unmount after it has slid away.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      Animated.spring(progress, {
        toValue: 1,
        ...motion.spring,
        ...(reduceMotion ? { stiffness: 10000, damping: 1000 } : null),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : motion.close,
      easing: Easing.bezier(0.3, 0, 1, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, reduceMotion, progress]);

  if (!mounted) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        style={[styles.root, { paddingBottom: keyboard }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            shadow("dialog"),
            {
              backgroundColor: c.sheet,
              maxHeight: height - insets.top - space.xl - keyboard,
              paddingBottom: (keyboard ? 0 : insets.bottom) + space.lg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.handle }]} />
          {(title || subtitle) && (
            <View style={styles.header}>
              <View style={{ flex: 1, gap: 2 }}>
                {title ? (
                  <Text variant="title2" accessibilityRole="header">
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text variant="subhead" color="text2">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="close" label="닫기" onPress={onClose} filled />
            </View>
          )}
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
              style={{ flexShrink: 1 }}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    marginBottom: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  body: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md },
});
