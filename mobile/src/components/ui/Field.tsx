import { useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { spokenDate } from "@/lib/dates";
import { formatNumber, parseNumberInput } from "@/lib/ledger";
import { useTheme } from "@/theme/theme";
import { radius, size, space, type } from "@/theme/tokens";
import { Calendar } from "./Calendar";
import { FoldMenu, useFoldAnchor } from "./FoldMenu";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";

function Labelled({ label, children, style }: { label?: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ gap: space.sm, flex: 1 }, style]}>
      {label ? (
        <Text variant="footnote" color="text2">
          {label}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function TextField({
  label,
  style,
  suffix,
  compact,
  ...props
}: TextInputProps & { label?: string; style?: ViewStyle; suffix?: string; compact?: boolean }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Labelled label={label} style={style}>
      <View
        style={[
          styles.control,
          compact && styles.compact,
          { backgroundColor: c.subtle, borderColor: focused ? c.primary : "transparent" },
        ]}
      >
        <TextInput
          placeholderTextColor={c.muted}
          accessibilityLabel={label ?? props.accessibilityLabel}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[type.body, styles.input, { color: c.text }]}
        />
        {suffix ? (
          <Text variant="body" color="text2">
            {suffix}
          </Text>
        ) : null}
      </View>
    </Labelled>
  );
}

/** Amount input: digits only, shown with thousands separators. */
export function MoneyField({
  value,
  onChange,
  label,
  placeholder = "0",
  style,
  compact,
  accessibilityLabel,
}: {
  value: string | number;
  onChange: (digits: string) => void;
  label?: string;
  placeholder?: string;
  style?: ViewStyle;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TextField
      label={label}
      style={style}
      compact={compact}
      accessibilityLabel={accessibilityLabel}
      keyboardType="number-pad"
      value={value === "" ? "" : formatNumber(value)}
      onChangeText={(text) => onChange(parseNumberInput(text))}
      placeholder={placeholder}
      suffix="원"
    />
  );
}

export type Option<T extends string = string> = { value: T; label: string; meta?: string };

/** A field that opens a sheet of options. Selection uses the peach container. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "선택",
  style,
  compact,
  sheetTitle,
  accessibilityLabel,
}: {
  label?: string;
  value: T | "";
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  style?: ViewStyle;
  compact?: boolean;
  sheetTitle?: string;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Labelled label={label} style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel ?? label ?? "선택"}, ${current?.label ?? placeholder}`}
        style={({ pressed }) => [
          styles.control,
          compact && styles.compact,
          { backgroundColor: pressed ? c.fill : c.subtle },
        ]}
      >
        <Text variant="body" color={current ? "text" : "muted"} numberOfLines={1} style={{ flex: 1 }}>
          {current?.label ?? placeholder}
        </Text>
        <Icon name="chevronDown" size={18} color={c.text2} />
      </Pressable>
      <OptionSheet
        visible={open}
        title={sheetTitle ?? label ?? accessibilityLabel ?? "선택"}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </Labelled>
  );
}

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  value: T | "";
  onClose: () => void;
  onSelect: (value: T) => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: space.xs }}>
        {options.length === 0 && (
          <Text variant="subhead" color="text2" style={{ padding: space.lg }}>
            선택할 수 있는 항목이 없어요.
          </Text>
        )}
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? c.primaryContainer : pressed ? c.fill : c.card,
                },
              ]}
            >
              <Text variant="body" weight={selected ? "600" : "500"} color={selected ? "onPrimaryContainer" : "text"}>
                {option.label}
              </Text>
              {option.meta ? (
                <Text variant="footnote" weight="400" color={selected ? "onPrimaryContainer" : "text2"}>
                  {option.meta}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/**
 * Date input. Tapping it grows the app's calendar out of the field to the middle of the screen
 * (FoldMenu); picking a day folds it back into the field.
 */
export function DateField({
  label,
  value,
  onChange,
  style,
  compact,
  accessibilityLabel,
}: {
  label?: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  style?: ViewStyle;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const menuWidth = Math.min(CALENDAR_WIDTH, screenW - space.lg * 2);
  return (
    <Labelled label={label} style={style}>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={show}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel ?? label ?? "날짜"}, ${valid ? spokenDate(value) : "선택 안 됨"}`}
          style={({ pressed }) => [
            styles.control,
            compact && styles.compact,
            { backgroundColor: pressed || open ? c.fill : c.subtle },
          ]}
        >
          <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {valid ? (compact ? value.slice(5).replace("-", ".") : spokenDate(value)) : "날짜 선택"}
          </Text>
          {!compact && <Icon name="calendar" size={18} color={c.text2} />}
        </Pressable>
      </View>
      {anchor ? (
        <FoldMenu
          anchor={anchor}
          visible={open}
          onClose={hide}
          onClosed={clear}
          maxWidth={CALENDAR_WIDTH}
          placement="center"
          anchorRadius={radius.control}
          accessibilityLabel={label ?? "날짜 선택"}
        >
          <Calendar
            value={valid ? value : ""}
            width={menuWidth - space.md * 2}
            onPick={(iso) => {
              onChange(iso);
              hide();
            }}
          />
        </FoldMenu>
      ) : null}
    </Labelled>
  );
}

const CALENDAR_WIDTH = 340;

export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: space.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  control: {
    minHeight: size.control,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  compact: { minHeight: 44, paddingHorizontal: space.md },
  input: { flex: 1, paddingVertical: space.md, minWidth: 0 },
  option: {
    minHeight: 52,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    justifyContent: "center",
    gap: 2,
  },
});
