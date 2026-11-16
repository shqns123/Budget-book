import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";

const OPEN_MS = 280;
const CLOSE_MS = 220;
const EASE = Easing.bezier(0.2, 0, 0, 1);

/**
 * A card whose body folds open and shut under its header: the body's height eases between 0 and
 * its full height while the content fades, and the chevron turns. Tapping the header toggles it.
 * The header can carry a `right` control (e.g. a delete button) beside the chevron.
 *
 * Height animates on the JS driver (it can't on the native one).
 */
export function FoldSection({
  title,
  meta,
  defaultOpen = false,
  right,
  padded,
  inset,
  smallTitle,
  children,
}: {
  title: string;
  /** A short line beside the title, e.g. "3개". */
  meta?: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  /** Pad the body (for forms); leave off for rows that bring their own padding. */
  padded?: boolean;
  /** A card nested inside another (canvas grey instead of white). */
  inset?: boolean;
  /** Title at 15px instead of 17px (dense lists). */
  smallTitle?: boolean;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [progress] = useState(() => new Animated.Value(defaultOpen ? 1 : 0));
  // The body's full height, followed while it changes (rows added or removed).
  const [bodyH, setBodyH] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? OPEN_MS : CLOSE_MS,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [open, reduceMotion, progress]);

  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, bodyH] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.4, 1] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] });

  return (
    <View style={[styles.card, { backgroundColor: inset ? c.bg : c.card }, inset && styles.insetCard]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${title}${meta ? `, ${meta}` : ""}, ${open ? "접기" : "펼치기"}`}
          style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Icon name="chevronDown" size={20} color={c.text2} />
          </Animated.View>
          <Text
            variant="headline"
            numberOfLines={1}
            style={[{ flexShrink: 1 }, smallTitle && { fontSize: 15, lineHeight: 20 }]}
          >
            {title}
          </Text>
          {meta ? (
            <Text variant="footnote" weight="400" color="text2">
              {meta}
            </Text>
          ) : null}
        </Pressable>
        {right}
      </View>
      <Animated.View style={[styles.clip, { height, opacity }]} pointerEvents={open ? "auto" : "none"}>
        <View
          onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}
          style={[styles.body, { borderTopColor: c.outline }, padded && (inset ? styles.insetPadded : styles.padded)]}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: "hidden" },
  head: {
    minHeight: size.row,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: space.md,
    gap: space.xs,
  },
  toggle: {
    flex: 1,
    minHeight: size.row,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.lg,
  },
  clip: { overflow: "hidden" },
  // Absolute, so it keeps its own height while the clip around it animates.
  body: { position: "absolute", top: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  padded: { paddingHorizontal: space.rowX, paddingVertical: space.lg },
  insetCard: { borderRadius: radius.control },
  insetPadded: { padding: space.md },
});
