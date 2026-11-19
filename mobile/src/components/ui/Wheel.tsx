import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type WheelItem<T extends string | number> = { value: T; label: string };

/** The value sets the initial selection each time the surrounding menu mounts. */
export function Wheel<T extends string | number>({ items, value, onChange, flex = 1, accessibilityLabel }: {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  flex?: number;
  bare?: boolean;
  accessibilityLabel: string;
}) {
  const { c } = useTheme();
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(false);
  const current = items.find((item) => item.value === selected);
  return (
    <View style={{ flex, minWidth: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${current?.label ?? "선택"}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[styles.control, { backgroundColor: c.card, borderColor: c.outline }]}
      >
        <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{current?.label ?? "선택"}</Text>
        <Icon name={open ? "moveUp" : "chevronDown"} size={20} color={c.text2} />
      </Pressable>
      {open && (
        <ScrollView nestedScrollEnabled style={[styles.list, { backgroundColor: c.card, borderColor: c.outline }]}>
          {items.map((item) => (
            <Pressable
              key={String(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.value === selected }}
              onPress={() => { setSelected(item.value); setOpen(false); onChange(item.value); }}
              style={[styles.option, item.value === selected && { backgroundColor: c.primaryContainer }]}
            >
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.label}</Text>
              {item.value === selected && <Icon name="check" size={18} color={c.onPrimaryContainer} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function WheelRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  control: { minHeight: size.hit, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm },
  list: { maxHeight: 192, marginTop: space.xs, borderWidth: 1, borderRadius: radius.control },
  option: { minHeight: size.hit, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm },
});
