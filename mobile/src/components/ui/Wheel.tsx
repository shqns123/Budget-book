import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { Text } from "./Text";

export type WheelItem<T extends string | number> = { value: T; label: string };

const ITEM_H = 40;
/** Rows on show: the picked one in the middle, two above and two below. */
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/**
 * An iOS-style wheel: a column that scrolls and snaps one row at a time, the picked row in the
 * middle band, the rows above and below turning away (smaller, fainter, tilted). Tapping a row
 * moves the selection. `onChange` reports the nearest row while scrolling.
 *
 * Uncontrolled after mount: `value` sets where it starts (remount it, with a key, to jump).
 */
export function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  flex = 1,
  bare,
  accessibilityLabel,
}: {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  flex?: number;
  /** Leave out the middle band (WheelRow draws one band across its wheels). */
  bare?: boolean;
  accessibilityLabel: string;
}) {
  const { c } = useTheme();
  const [start] = useState(() => Math.max(
    0,
    items.findIndex((item) => item.value === value),
  ));
  const [index, setIndex] = useState(start);
  const [scrollY] = useState(() => new Animated.Value(start * ITEM_H));
  const listRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const pickedIndex = useRef(start);

  const pickIndex = useCallback((next: number) => {
    const item = items[next];
    if (!item || next === pickedIndex.current) return;
    pickedIndex.current = next;
    setIndex(next);
    onChange(item.value);
  }, [items, onChange]);
  useEffect(() => {
    const listener = scrollY.addListener(({ value: y }) => {
      const next = Math.round(y / ITEM_H);
      pickIndex(Math.min(items.length - 1, Math.max(0, next)));
    });
    return () => scrollY.removeListener(listener);
  }, [items.length, pickIndex, scrollY]);
  const rollTo = (next: number) => {
    const target = Math.min(items.length - 1, Math.max(0, next));
    listRef.current?.scrollTo({ y: target * ITEM_H, animated: false });
    pickIndex(target);
  };

  return (
    <View
      style={{ flex, height: ITEM_H * VISIBLE }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: items[index]?.label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => rollTo(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
    >
      {/* The middle band the picked row rests in. */}
      {bare ? null : <View pointerEvents="none" style={[styles.band, { backgroundColor: c.card }]} />}
      <Animated.ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: start * ITEM_H }}
        contentContainerStyle={{ paddingVertical: PAD }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {items.map((item, i) => {
          const at = i * ITEM_H;
          const range = [at - PAD, at - ITEM_H, at, at + ITEM_H, at + PAD];
          return (
            <Pressable key={String(item.value)} onPress={() => rollTo(i)} importantForAccessibility="no">
              <Animated.View
                style={[
                  styles.item,
                  {
                    opacity: scrollY.interpolate({
                      inputRange: range,
                      outputRange: [0.25, 0.5, 1, 0.5, 0.25],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      { perspective: 600 },
                      {
                        rotateX: scrollY.interpolate({
                          inputRange: range,
                          outputRange: ["-50deg", "-25deg", "0deg", "25deg", "50deg"],
                          extrapolate: "clamp",
                        }),
                      },
                      {
                        scale: scrollY.interpolate({
                          inputRange: range,
                          outputRange: [0.86, 0.94, 1, 0.94, 0.86],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text variant="headline" weight={i === index ? "700" : "500"} tabular numberOfLines={1}>
                  {item.label}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

/** Wheels side by side (year · month) over one shared middle band. Give the wheels `bare`. */
export function WheelRow({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: c.card }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_H,
    borderRadius: radius.control,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});
