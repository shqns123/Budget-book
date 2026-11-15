import { useEffect, useState, useSyncExternalStore } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from "react-native";
import { closeDialog, currentDialog, subscribeDialog, type DialogRequest } from "@/lib/confirm";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";
import { PrimaryButton, SecondaryButton } from "./Button";
import { Text } from "./Text";

const OPEN = { duration: 220, easing: Easing.bezier(0.2, 0, 0, 1) };
const CLOSE = { duration: 180, easing: Easing.bezier(0.3, 0, 1, 1) };

/**
 * The app's confirm / notice popup (replaces the OS alert): a centered card over the scrim that
 * fades in while scaling 0.95 → 1 and leaves faster. Driven by confirm() / notice() in lib/confirm.
 * Mount once, at the root.
 */
export function DialogHost() {
  const { c, shadow } = useTheme();
  const reduceMotion = useReducedMotion();
  const request = useSyncExternalStore(subscribeDialog, currentDialog, currentDialog);
  // Keep the last request on screen while it animates out.
  const [shown, setShown] = useState<DialogRequest | null>(null);
  if (request && request !== shown) setShown(request);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!request) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      ...OPEN,
      duration: reduceMotion ? 0 : OPEN.duration,
      useNativeDriver: true,
    }).start();
  }, [request, progress, reduceMotion]);

  const answer = (ok: boolean) => {
    const r = shown;
    if (!r || !request) return;
    Animated.timing(progress, {
      toValue: 0,
      ...CLOSE,
      duration: reduceMotion ? 0 : CLOSE.duration,
      useNativeDriver: true,
    }).start();
    // Unmount on a timer rather than the animation callback, so an interrupted animation can
    // never leave an invisible popup blocking touches.
    setTimeout(() => setShown((s) => (s === r ? null : s)), (reduceMotion ? 0 : CLOSE.duration) + 40);
    closeDialog(r, ok);
  };

  if (!shown) return null;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });
  const isConfirm = shown.kind === "confirm";

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => answer(false)}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => answer(false)} accessibilityLabel="닫기" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            shadow("dialog"),
            { backgroundColor: c.sheet, opacity: progress, transform: [{ scale }] },
          ]}
        >
          <View style={{ gap: space.sm }}>
            <Text variant="headline" accessibilityRole="header">
              {shown.title}
            </Text>
            {shown.message ? (
              <Text variant="subhead" weight="400" color="text2">
                {shown.message}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            {isConfirm ? (
              <SecondaryButton label="취소" onPress={() => answer(false)} style={styles.action} />
            ) : null}
            {shown.destructive ? (
              <SecondaryButton
                label={shown.confirmLabel}
                tone="danger"
                onPress={() => answer(true)}
                style={styles.action}
              />
            ) : (
              <PrimaryButton label={shown.confirmLabel} onPress={() => answer(true)} style={styles.action} />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.popover,
    padding: space.xl,
    gap: space.xl,
  },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1, minHeight: size.control },
});
