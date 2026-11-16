import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type GestureResponderEvent, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, Text, tabIcons } from "@/components/ui";
import { ComposePopup } from "@/components/ledger/ComposePopup";
import { useScopeSelection } from "@/components/ledger/ScopeControls";
import { closeCompose, openCompose, useCompose } from "@/lib/compose";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { opacity, radius, size, space } from "@/theme/tokens";

const TABS = [
  { name: "index", href: "/", label: "보고서", icon: "chart" },
  { name: "transactions", href: "/transactions", label: "거래", icon: "list" },
  { name: "balance", href: "/balance", label: "잔고", icon: "balance" },
  { name: "more", href: "/more", label: "전체", icon: "more" },
] as const;

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      {/* Route declarations; the visible bar is drawn below. */}
      <TabList style={{ display: "none" }}>
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>
      {/* The add / edit popup sits under the tab bar, so the bar stays visible over its scrim. */}
      <ComposePopup />
      <FloatingTabBar />
    </Tabs>
  );
}

/** A 62px pill inset 16px from the sides; content scrolls under it. */
function FloatingTabBar() {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { selected } = useScopeSelection("transactions");
  const reduceMotion = useReducedMotion();
  // The add popup brings its own 취소 / 저장 bar in this spot, so the tab bar steps aside meanwhile.
  const { open: composing } = useCompose();
  const [hidden] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(hidden, {
      toValue: composing ? 1 : 0,
      duration: reduceMotion ? 0 : composing ? 200 : 260,
      delay: composing || reduceMotion ? 0 : 160,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [composing, reduceMotion, hidden]);
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];
  return (
    <Animated.View
      pointerEvents={composing ? "none" : "box-none"}
      style={[
        styles.wrap,
        {
          paddingBottom: insets.bottom + space.xs,
          opacity: hidden.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateY: hidden.interpolate({ inputRange: [0, 1], outputRange: [0, space.xl] }) }],
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: c.card }, shadow("tabbar")]}>
        {left.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
        {/* With exactly one account picked on the transactions tab, new records start on it. */}
        <AddButton account={selected.length === 1 ? selected[0] : undefined} />
        {right.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </View>
    </Animated.View>
  );
}

/** The + button: opens the add popup (it unfolds out of the button) and, while it is open, closes
 * it; the + turns into an × meanwhile. */
function AddButton({ account }: { account?: string }) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const { open } = useCompose();
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? 440 : 300,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [open, reduceMotion, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "135deg"] });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? "거래 기록 닫기" : "거래 기록 추가"}
      accessibilityState={{ expanded: open }}
      onPress={() => (open ? closeCompose() : openCompose({ account, from: "fab" }))}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: c.primaryContainer },
        pressed && { opacity: opacity.pressed, transform: [{ scale: 0.96 }] },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <TabIcon name="plus" color={c.onPrimaryContainer} size={24} />
      </Animated.View>
    </Pressable>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: keyof typeof tabIcons;
};

// The trigger passes its ref and press handlers through props (asChild).
function TabButton({ label, icon, isFocused, onPress, ...props }: TabButtonProps) {
  const { c } = useTheme();
  // The current tab sits on a peach pill (the brand colour, as on the + button).
  const color = isFocused ? c.onPrimaryContainer : c.text2;
  return (
    <Pressable
      {...(props as PressableProps)}
      // Switching tabs closes the add popup.
      onPress={(e: GestureResponderEvent) => {
        closeCompose();
        onPress?.(e as never);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tab, pressed && { opacity: opacity.tabPressed }]}
    >
      <View style={[styles.tabInner, isFocused && { backgroundColor: c.primaryContainer }]}>
        <TabIcon name={icon} color={color} />
        <Text
          variant="tabLabel"
          style={{ color, fontWeight: isFocused ? "700" : "500" }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
  },
  bar: {
    height: size.tabbar,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  fab: {
    width: size.fab,
    height: size.fab,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: space.sm,
  },
});
