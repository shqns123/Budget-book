import { useEffect, useState, type ReactNode } from "react";
import { Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/lib/motion";
import { useLedger } from "@/store/ledger-store";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";
import { IconButton, PrimaryButton, SecondaryButton, TextButton } from "./Button";
import { Banner } from "./Controls";
import { useKeyboardInset } from "./Keyboard";
import { Text } from "./Text";

const CLOSE_MS = 260;
/** The same slightly bouncy spring the chip menus (FoldMenu) open with. */
const OPEN_SPRING = { stiffness: 320, damping: 24, mass: 1 };

type Rect = { x: number; y: number; width: number; height: number };

/**
 * A popup card above the floating tab bar, over a scrim. Render it inside the tab layout, before
 * the tab bar, so the bar stays on top.
 *
 * `from="fab"` grows it out of the tab bar's + button the way a chip grows into its menu: the card
 * (and the footer's action bar) start as the button itself (its place, size, round shape and
 * peach) and spring open to full size, the content appearing once there is room; closing shrinks
 * both back into the button. Otherwise it rises and fades in place.
 *
 * Controlled: `visible` false plays the closing animation, then `onClosed` (unmount it there).
 * The close button (or the footer's 취소), the scrim and Android back call `onRequestClose`.
 *
 * Size, place and corners animate on the JS driver (they can't on the native one).
 */
export function Popup({
  visible,
  onRequestClose,
  onClosed,
  title,
  from = "center",
  footer,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  title: string;
  from?: "fab" | "center";
  /** Actions in a floating bar where the tab bar sits (e.g. PopupActions). Replaces the × button;
   * hide the tab bar while the popup is open. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const keyboard = useKeyboardInset();
  const { saveError, clearSaveError } = useLedger();
  const [progress] = useState(() => new Animated.Value(0));
  // The content's height at full width; it follows the content (and the keyboard) while open.
  const [contentH, setContentH] = useState(0);
  const measured = contentH > 0;

  useEffect(() => {
    if (!measured) return;
    progress.stopAnimation();
    if (visible) {
      if (reduceMotion) progress.setValue(1);
      else Animated.spring(progress, { toValue: 1, ...OPEN_SPRING, useNativeDriver: false }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : CLOSE_MS,
      easing: Easing.bezier(0.4, 0, 0.6, 1),
      useNativeDriver: false,
    }).start();
    // Unmount on a timer rather than the animation callback, so an interrupted animation can
    // never leave an invisible popup blocking touches.
    const t = setTimeout(onClosed, reduceMotion ? 0 : CLOSE_MS);
    return () => clearTimeout(t);
  }, [measured, visible, reduceMotion, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onRequestClose]);

  // --- Geometry. The action bar takes the tab bar's place (above the keyboard while it is up);
  // the card sits above that bar.
  const tabBarBottom = insets.bottom + space.xs;
  const barBottom = keyboard ? keyboard + space.sm : tabBarBottom;
  const cardBottom = barBottom + size.tabbar + space.sm;
  const cardTop = insets.top + space.lg;
  const width = screenW - space.lg * 2;
  const maxHeight = screenH - cardTop - cardBottom;
  const cardH = Math.min(contentH, maxHeight);
  const card: Rect = { x: space.lg, y: screenH - cardBottom - cardH, width, height: cardH };
  const bar: Rect = { x: space.lg, y: screenH - barBottom - size.tabbar, width, height: size.tabbar };
  const fab: Rect = {
    x: (screenW - size.fab) / 2,
    y: screenH - tabBarBottom - size.tabbar / 2 - size.fab / 2,
    width: size.fab,
    height: size.fab,
  };
  const fold = from === "fab";
  // Where each starts: the + button, or (in place) slightly lower.
  const cardStart = fold ? fab : { ...card, y: card.y + space.xl };
  const barStart = fold ? fab : { ...bar, y: bar.y + space.lg };

  const grow = (start: Rect, end: Rect, endRadius: number, endColor: string) => ({
    left: progress.interpolate({ inputRange: [0, 1], outputRange: [start.x, end.x], extrapolateLeft: "clamp" }),
    top: progress.interpolate({ inputRange: [0, 1], outputRange: [start.y, end.y], extrapolateLeft: "clamp" }),
    width: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [start.width, end.width],
      extrapolateLeft: "clamp",
    }),
    height: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [start.height, end.height],
      extrapolateLeft: "clamp",
    }),
    borderRadius: fold
      ? progress.interpolate({ inputRange: [0, 0.6], outputRange: [size.fab / 2, endRadius], extrapolate: "clamp" })
      : endRadius,
    backgroundColor: fold
      ? progress.interpolate({ inputRange: [0, 0.35], outputRange: [c.primaryContainer, endColor], extrapolate: "clamp" })
      : endColor,
    opacity: fold
      ? 1
      : progress.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }),
  });
  const contentOpacity = progress.interpolate({
    inputRange: fold ? [0.35, 0.8] : [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const scrimOpacity = progress.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: "clamp" });

  return (
    <View pointerEvents={visible ? "box-none" : "none"} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: scrimOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="닫기" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.panel, shadow("dialog"), grow(cardStart, card, radius.sheet, c.sheet), !measured && { opacity: 0 }]}
      >
        {/* Laid out at full size from the start and revealed as the card grows around it. */}
        <Animated.View
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
          style={[styles.content, { width, maxHeight, opacity: contentOpacity }]}
        >
          <View style={styles.header}>
            <Text variant="title2" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Text>
            {footer ? null : <IconButton icon="close" label="닫기" filled onPress={onRequestClose} />}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} style={{ flexShrink: 1 }}>
            {saveError ? (
              <Banner
                message={saveError}
                action={<TextButton label="닫기" tone="danger" onPress={clearSaveError} />}
              />
            ) : null}
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
      {footer ? (
        <Animated.View
          style={[styles.panel, shadow("tabbar"), grow(barStart, bar, radius.pill, c.card), !measured && { opacity: 0 }]}
        >
          <Animated.View style={[styles.barContent, { width, opacity: contentOpacity }]}>{footer}</Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** 취소 + the main action, for Popup's floating action bar. */
export function PopupActions({
  onCancel,
  label,
  onPress,
  loading,
  disabled,
}: {
  onCancel: () => void;
  /** The main action; leave out for a bar with 취소 only. */
  label?: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      <SecondaryButton label="취소" onPress={onCancel} style={styles.barButton} />
      {label ? (
        <PrimaryButton
          label={label}
          onPress={onPress}
          loading={loading}
          disabled={disabled}
          style={{ ...styles.barButton, flex: 2 }}
        />
      ) : null}
    </>
  );
}

const BAR_PAD = 6;

const styles = StyleSheet.create({
  panel: { position: "absolute", overflow: "hidden" },
  content: { position: "absolute", top: 0, left: 0, paddingTop: space.md },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.rowX,
    paddingRight: space.md,
    gap: space.sm,
  },
  body: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.lg, gap: space.xl },
  barContent: {
    position: "absolute",
    top: 0,
    left: 0,
    height: size.tabbar,
    padding: BAR_PAD,
    flexDirection: "row",
    gap: BAR_PAD,
  },
  barButton: { flex: 1, minHeight: size.tabbar - BAR_PAD * 2, borderRadius: radius.pill },
});
