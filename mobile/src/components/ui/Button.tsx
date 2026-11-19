import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { opacity, radius, size, space } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Overrides for the label (e.g. a smaller size in a compact bar). */
  labelStyle?: TextStyle;
  accessibilityLabel?: string;
};

/** The One Strong Button: ink fill, at most one per screen. */
export function PrimaryButton({ label, onPress, icon, disabled, loading, style, accessibilityLabel }: ButtonProps) {
  const { c } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, 저장 중` : (accessibilityLabel ?? label)}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: size.primary, backgroundColor: c.primary },
        pressed && { opacity: opacity.pressed, transform: [{ scale: 0.98 }] },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.onPrimary} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={c.onPrimary} />}
          <Text variant="headline" style={{ color: c.onPrimary }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  disabled,
  style,
  labelStyle,
  tone = "neutral",
  accessibilityLabel,
}: ButtonProps & { tone?: "neutral" | "danger" | "accent" }) {
  const { c } = useTheme();
  const fg = tone === "danger" ? c.danger : tone === "accent" ? c.onPrimaryContainer : c.text;
  const bg = tone === "danger" ? c.dangerContainer : tone === "accent" ? c.primaryContainer : c.subtle;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { minHeight: size.control, backgroundColor: pressed ? c.fill : bg },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={20} color={fg} />}
      <Text variant="headline" style={[{ color: fg }, labelStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Quiet text action such as 「다시 시도」, 「초기화」. */
export function TextButton({
  label,
  onPress,
  tone = "primary",
  icon,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  tone?: "primary" | "danger" | "muted";
  icon?: IconName;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const color = tone === "danger" ? c.danger : tone === "muted" ? c.text2 : c.primaryText;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.text,
        pressed && { opacity: opacity.tabPressed },
        disabled && { opacity: opacity.disabled },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={color} />}
      <Text variant="subhead" weight="600" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Round, icon only. Always carries a spoken name. */
export function IconButton({
  icon,
  label,
  onPress,
  filled,
  tone = "neutral",
  badge,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  filled?: boolean;
  /** "accent": sienna on the peach accent card. */
  tone?: "neutral" | "danger" | "accent";
  badge?: ReactNode;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const color = tone === "danger" ? c.danger : tone === "accent" ? c.onPrimaryContainer : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.icon,
        tone === "accent"
          ? { opacity: pressed ? 0.6 : 1 }
          : { backgroundColor: pressed ? c.fill : filled ? c.subtle : "transparent" },
        disabled && { opacity: opacity.disabled },
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      {badge ? <View style={styles.badge}>{badge}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  text: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 32,
    justifyContent: "center",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { position: "absolute", top: 4, right: 4 },
});
