import { useLayoutEffect, useState, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, View, type PanResponderGestureState } from "react-native";
import { Icon } from "@/components/ui";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

const swipeDistance = (width: number) => Math.max(110, Math.min(180, width * 0.4));

type SwipeOptions = {
  focused: boolean;
  width: number;
  reduceMotion: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/** Keep one responder through focus changes so a late release cannot finish an old swipe. */
function createSwipeResponder(offset: Animated.Value) {
  let options: SwipeOptions | undefined;
  let dragging = false;

  const horizontal = (_: unknown, g: PanResponderGestureState) =>
    Boolean(options?.focused && options.width > 0 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5);
  const settle = () => {
    if (!options?.focused || !dragging) return false;
    dragging = false;
    if (options.reduceMotion) offset.setValue(0);
    else Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    return true;
  };
  const { panHandlers } = PanResponder.create({
    onMoveShouldSetPanResponderCapture: horizontal,
    onMoveShouldSetPanResponder: horizontal,
    onPanResponderGrant: () => {
      dragging = Boolean(options?.focused);
      if (dragging) offset.stopAnimation();
    },
    onPanResponderMove: (_, g) => {
      if (!options?.focused || !dragging) return;
      const limit = Math.min(options.width / 2, swipeDistance(options.width) + 16);
      offset.setValue(Math.max(-limit, Math.min(limit, g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      if (!options || !settle()) return;
      const distance = swipeDistance(options.width);
      if (g.dx >= distance) options.onEdit();
      else if (g.dx <= -distance) options.onDelete();
    },
    onPanResponderTerminate: settle,
  });

  return {
    panHandlers,
    update(next: SwipeOptions) {
      if (options?.focused && !next.focused) {
        dragging = false;
        offset.stopAnimation();
        offset.setValue(0);
      }
      options = next;
    },
  };
}

export function TransactionSwipeRow({
  children,
  focused,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  focused: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const [responder] = useState(() => createSwipeResponder(offset));
  const [width, setWidth] = useState(0);
  const editOpacity = offset.interpolate({ inputRange: [0, 8], outputRange: [0, 1], extrapolate: "clamp" });
  const deleteOpacity = offset.interpolate({ inputRange: [-8, 0], outputRange: [1, 0], extrapolate: "clamp" });

  useLayoutEffect(() => {
    responder.update({ focused, width, reduceMotion, onEdit, onDelete });
  }, [focused, onDelete, onEdit, reduceMotion, responder, width]);

  return (
    <View
      style={[styles.shell, { backgroundColor: c.card, borderColor: c.outline }]}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      {/* The outgoing tab remains mounted during the transition. Drop the action layers at blur. */}
      {focused && (
        <>
          <Animated.View
            style={[styles.action, styles.edit, { backgroundColor: c.primaryContainer, opacity: editOpacity }]}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Icon name="refresh" size={22} color={c.onPrimaryContainer} />
          </Animated.View>
          <Animated.View
            style={[styles.action, styles.delete, { backgroundColor: c.danger, opacity: deleteOpacity }]}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            <Icon name="trash" size={22} color={c.onDanger} />
          </Animated.View>
        </>
      )}
      <Animated.View style={{ backgroundColor: c.card, transform: [{ translateX: focused ? offset : 0 }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  action: { position: "absolute", top: 0, bottom: 0, width: "50%", justifyContent: "center", paddingHorizontal: space.rowX },
  edit: { left: 0, alignItems: "flex-start" },
  delete: { right: 0, alignItems: "flex-end" },
});
