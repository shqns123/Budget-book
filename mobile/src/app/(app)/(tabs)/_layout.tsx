import { router } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabIcon, Text, tabIcons } from "@/components/ui";
import { useScopeSelection } from "@/components/ledger/ScopeControls";
import { useTheme } from "@/theme/theme";
import { opacity, radius, size, space } from "@/theme/tokens";

const TABS = [
  { name: "index", href: "/", label: "개요", icon: "overview" },
  { name: "transactions", href: "/transactions", label: "거래", icon: "list" },
  { name: "reports", href: "/reports", label: "보고서", icon: "chart" },
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
      <FloatingTabBar />
    </Tabs>
  );
}

/** A 62px pill inset 16px from the sides; content scrolls under it. */
function FloatingTabBar() {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { selected } = useScopeSelection("transactions");
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + space.xs }]}
    >
      <View style={[styles.bar, { backgroundColor: c.card }, shadow("tabbar")]}>
        {left.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="거래 기록 추가"
          onPress={() =>
            router.push(selected[0] ? { pathname: "/compose", params: { account: selected[0] } } : "/compose")
          }
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: c.primary },
            pressed && { opacity: opacity.pressed, transform: [{ scale: 0.96 }] },
          ]}
        >
          <TabIcon name="plus" color={c.onPrimary} size={24} />
        </Pressable>
        {right.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: keyof typeof tabIcons;
};

// The trigger passes its ref and press handlers through props (asChild).
function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  const { c } = useTheme();
  const color = isFocused ? c.primaryText : c.text2;
  return (
    <Pressable
      {...(props as PressableProps)}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tab, pressed && { opacity: opacity.tabPressed }]}
    >
      <TabIcon name={icon} color={color} />
      <Text
        variant="tabLabel"
        style={{ color, fontWeight: isFocused ? "700" : "500" }}
        numberOfLines={1}
      >
        {label}
      </Text>
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
    gap: 2,
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
