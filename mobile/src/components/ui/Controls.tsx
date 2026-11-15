import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Switch, View, type ViewStyle } from "react-native";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { motion, opacity, radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** Segmented control: subtle track, peach selected slot that slides to the tapped option. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
  accessibilityLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const placed = useRef(false);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const slotWidth = trackWidth
    ? (trackWidth - SEGMENT_PAD * 2 - SEGMENT_GAP * (options.length - 1)) / options.length
    : 0;
  const target = index * (slotWidth + SEGMENT_GAP);

  useEffect(() => {
    if (!slotWidth) return;
    // Jump into place the first time; slide after that.
    if (!placed.current || reduceMotion) {
      placed.current = true;
      x.setValue(target);
      return;
    }
    Animated.spring(x, { toValue: target, ...motion.spring, useNativeDriver: true }).start();
  }, [target, slotWidth, reduceMotion, x]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: c.segmentTrack }, style]}
    >
      {slotWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: slotWidth, backgroundColor: c.primaryContainer, transform: [{ translateX: x }] },
          ]}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.slot, selected && !slotWidth && { backgroundColor: c.primaryContainer }]}
          >
            <Text
              variant="subhead"
              weight={selected ? "700" : "500"}
              color={selected ? "onPrimaryContainer" : "text2"}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pill chip. Selected = peach container, no check icon. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  trailingIcon,
  count,
  accessibilityLabel,
}: {
  /** Leave out for an icon-only chip (then give accessibilityLabel). */
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  trailingIcon?: IconName;
  count?: number;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const fg = selected ? c.onPrimaryContainer : c.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (count ? `${label}, ${count}개 적용` : label)}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        !label && styles.chipIconOnly,
        {
          backgroundColor: selected ? c.primaryContainer : pressed ? c.fill : c.card,
        },
      ]}
    >
      {icon && <Icon name={icon} size={label ? 16 : 18} color={fg} />}
      {label ? (
        <Text variant="subhead" weight="600" style={{ color: fg }} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {count ? (
        <View style={[styles.count, { backgroundColor: c.primary }]}>
          <Text variant="caption" style={{ color: c.onPrimary, fontSize: 11, lineHeight: 14 }}>
            {count}
          </Text>
        </View>
      ) : null}
      {trailingIcon && <Icon name={trailingIcon} size={16} color={fg} />}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** A toggle row with the platform switch. */
export function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text variant="subhead" weight="500" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: c.fill, true: c.primary }}
        thumbColor={c.card}
        ios_backgroundColor={c.switchOff}
      />
    </View>
  );
}

/** A check control used inside lists (e.g. 완료, account pickers). */
export function CheckRow({
  label,
  meta,
  checked,
  onToggle,
  icon,
}: {
  label: string;
  meta?: string;
  checked: boolean;
  onToggle: () => void;
  icon?: IconName;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      style={({ pressed }) => [
        styles.checkRow,
        { backgroundColor: checked ? c.primaryContainer : pressed ? c.fill : c.card },
      ]}
    >
      {icon && <Icon name={icon} size={20} color={checked ? c.onPrimaryContainer : c.text2} />}
      <View style={{ flex: 1 }}>
        <Text variant="body" weight="500" color={checked ? "onPrimaryContainer" : "text"}>
          {label}
        </Text>
        {meta ? (
          <Text variant="footnote" weight="400" color={checked ? "onPrimaryContainer" : "text2"}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Icon
        name={checked ? "checkbox" : "checkboxEmpty"}
        size={22}
        color={checked ? c.onPrimaryContainer : c.tertiary}
      />
    </Pressable>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "expense" }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[styles.progress, { backgroundColor: c.subtle }]}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: radius.pill,
          backgroundColor: tone === "expense" ? c.chartExpense : c.primary,
        }}
      />
    </View>
  );
}

export function Banner({
  message,
  tone = "danger",
  action,
}: {
  message: string;
  tone?: "danger" | "warn" | "info";
  action?: ReactNode;
}) {
  const { c } = useTheme();
  const [bg, fg] =
    tone === "danger"
      ? [c.dangerContainer, c.danger]
      : tone === "warn"
        ? [c.warnContainer, c.onWarn]
        : [c.primaryContainer, c.onPrimaryContainer];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: bg }]}>
      <Icon name={tone === "info" ? "sparkles" : "alert"} size={20} color={fg} />
      <Text variant="subhead" style={{ color: fg, flex: 1 }}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "warn" }) {
  const { c } = useTheme();
  const [bg, fg] =
    tone === "accent"
      ? [c.primaryContainer, c.onPrimaryContainer]
      : tone === "warn"
        ? [c.warnContainer, c.onWarn]
        : [c.subtle, c.text2];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export const pressedOpacity = opacity.pressed;

const SEGMENT_PAD = 4;
const SEGMENT_GAP = 4;

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: radius.control,
    padding: SEGMENT_PAD,
    gap: SEGMENT_GAP,
  },
  thumb: {
    position: "absolute",
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: SEGMENT_PAD,
    borderRadius: radius.control - SEGMENT_PAD,
  },
  slot: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control - 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  chip: {
    minHeight: 36,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipIconOnly: { minWidth: 36, paddingHorizontal: 9, justifyContent: "center" },
  chipRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap", alignItems: "center" },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  switchRow: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: space.md },
  checkRow: {
    minHeight: 56,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  progress: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  banner: {
    borderRadius: radius.control,
    padding: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
});
