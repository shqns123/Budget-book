import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

/** Where the control that opened a fold menu sits, in window coordinates. */
export type Anchor = { x: number; y: number; width: number; height: number };

const CLOSE_MS = 220;
/** Opens on a slightly bouncy spring, so the chip "pops" into the panel. */
const OPEN_SPRING = { stiffness: 320, damping: 24, mass: 1 };

/**
 * State for a control that opens a FoldMenu: put `ref` on a View around the control (with
 * collapsable={false}) and call `show()` on press.
 */
export function useFoldAnchor() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  return {
    ref,
    anchor,
    open,
    show: () =>
      ref.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      }),
    hide: () => setOpen(false),
    /** For FoldMenu's onClosed: unmounts the menu. */
    clear: () => setAnchor(null),
  };
}

/**
 * A panel that grows out of the control that opened it. It starts as the control itself (same
 * place, size, pill shape and colour) and springs open to full size, the corners easing from the
 * pill to the panel's and the content fading in once there is room. Closing (tapping outside,
 * Android back, or the owner setting visible false) shrinks it back into the control, then calls
 * onClosed (unmount it there). By default it opens over the control, toward the side of the
 * screen with room (upward for a control in the lower half), and is never taller than the room it
 * has (content scrolls inside if needed); `placement="center"` moves it to the middle of the
 * screen as it grows.
 *
 * Size and corners animate on the JS driver (they can't on the native one); it's one small view.
 */
export function FoldMenu({
  anchor,
  visible,
  onClose,
  onClosed,
  maxWidth = 320,
  placement = "anchor",
  anchorRadius,
  anchorColor,
  accessibilityLabel,
  children,
}: {
  anchor: Anchor;
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
  maxWidth?: number;
  /** "anchor": over the control. "center": grows from the control to the middle of the screen. */
  placement?: "anchor" | "center";
  /** The control's corner radius, where the panel's corners start (default: a pill). */
  anchorRadius?: number;
  /** The control's fill, where the panel's colour starts (default: the card white of a chip). */
  anchorColor?: string;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  // The content's height at full width, measured before the panel opens.
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
    // Unmount on a timer, so an interrupted animation never leaves the menu blocking touches.
    const t = setTimeout(onClosed, reduceMotion ? 0 : CLOSE_MS);
    return () => clearTimeout(t);
  }, [measured, visible, reduceMotion, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final frame: over the control, growing toward the side of the screen with room; or centered.
  const centered = placement === "center";
  const width = Math.min(maxWidth, screenW - space.lg * 2);
  const fromRight = !centered && anchor.x + anchor.width / 2 > screenW / 2;
  const left = centered
    ? (screenW - width) / 2
    : fromRight
      ? Math.max(space.lg, Math.min(anchor.x + anchor.width, screenW - space.lg) - width)
      : Math.min(Math.max(space.lg, anchor.x), screenW - space.lg - width);
  // A control in the lower half of the screen (a floating button) opens upward.
  const upward = !centered && anchor.y + anchor.height / 2 > screenH / 2;
  const anchorBottom = anchor.y + anchor.height;
  const maxHeight = centered
    ? screenH - insets.top - insets.bottom - space.lg * 2
    : upward
      ? anchorBottom - insets.top - space.lg
      : screenH - anchor.y - insets.bottom - space.lg;
  const height = Math.min(contentH, maxHeight);
  const top = centered
    ? Math.max(insets.top + space.lg, (screenH - height) / 2)
    : upward
      ? anchorBottom - height
      : anchor.y;

  const clamp = { extrapolateLeft: "clamp" as const };
  const frame = {
    left: progress.interpolate({ inputRange: [0, 1], outputRange: [anchor.x, left], ...clamp }),
    top: progress.interpolate({ inputRange: [0, 1], outputRange: [anchor.y, top], ...clamp }),
    width: progress.interpolate({ inputRange: [0, 1], outputRange: [anchor.width, width], ...clamp }),
    height: progress.interpolate({ inputRange: [0, 1], outputRange: [anchor.height, height], ...clamp }),
    borderRadius: progress.interpolate({
      inputRange: [0, 0.6],
      outputRange: [anchorRadius ?? anchor.height / 2, radius.popover],
      extrapolate: "clamp",
    }),
    backgroundColor: progress.interpolate({
      inputRange: [0, 0.35],
      outputRange: [anchorColor ?? c.card, c.sheet],
      extrapolate: "clamp",
    }),
  };
  const contentOpacity = progress.interpolate({ inputRange: [0.35, 0.8], outputRange: [0, 1], extrapolate: "clamp" });
  const scrimOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6], extrapolate: "clamp" });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }} pointerEvents={visible ? "auto" : "none"}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: scrimOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[styles.panel, shadow("float"), frame, !measured && { opacity: 0 }]}
        >
          {/* Laid out at full size from the start (pinned to the side the panel grows from), and
              revealed as the panel grows around it. */}
          <Animated.View
            onLayout={(e) => {
              setContentH(e.nativeEvent.layout.height);
            }}
            style={[
              styles.content,
              fromRight ? { right: 0 } : { left: 0 },
              upward ? { bottom: 0 } : { top: 0 },
              { width, maxHeight, opacity: contentOpacity },
            ]}
          >
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", overflow: "hidden" },
  content: { position: "absolute", padding: space.md },
});
