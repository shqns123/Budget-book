import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";
import type { ColorTokens } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/**
 * The Quiet Surface Rule: a white card on the gray canvas, no border,
 * no shadow. The title sits outside, above it, in footnote / text2.
 */
export function Section({
  title,
  action,
  children,
  style,
  padded,
  tone = "card",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  /** "accent" is the rare peach card: one per screen at most. */
  tone?: "card" | "accent";
}) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: space.sm }, style]}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          {title ? (
            <Text variant="footnote" color="text2" accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      <View
        style={[
          styles.card,
          { backgroundColor: tone === "accent" ? c.primaryContainer : c.card },
          padded && styles.padded,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** A list row: optional 36px icon tile, label + meta, trailing value. */
export function Row({
  title,
  meta,
  icon,
  iconTone = "neutral",
  trailing,
  trailingMeta,
  trailingColor,
  onPress,
  chevron,
  first,
  accessibilityLabel,
  destructive,
  dimmed,
  badge,
  dense,
  metaLines = 1,
}: {
  title: string;
  meta?: string;
  /** A small mark under the meta line (e.g. a Tag). */
  badge?: ReactNode;
  /** Long lists (the transaction list): title 14px and meta line 11px. */
  dense?: boolean;
  /** Lines the meta may take (break them with "
"). */
  metaLines?: number;
  icon?: IconName;
  iconTone?: "neutral" | "income" | "expense" | "accent" | "danger";
  trailing?: ReactNode | string;
  trailingMeta?: string;
  trailingColor?: keyof ColorTokens;
  onPress?: () => void;
  chevron?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
  destructive?: boolean;
  dimmed?: boolean;
}) {
  const { c } = useTheme();
  const tile = {
    neutral: [c.subtle, c.text2],
    income: [c.incomeContainer, c.income],
    expense: [c.expenseContainer, c.expense],
    accent: [c.primaryContainer, c.onPrimaryContainer],
    danger: [c.dangerContainer, c.danger],
  }[iconTone];
  const content = (
    <View style={[styles.row, dimmed && { opacity: 0.55 }]}>
      {icon && (
        <View style={[styles.tile, { backgroundColor: tile[0] }]}>
          <Icon name={icon} size={20} color={tile[1]} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text
          variant="body"
          weight="500"
          color={destructive ? "danger" : "text"}
          numberOfLines={1}
          style={dense ? styles.denseTitle : undefined}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            variant="footnote"
            color="text2"
            weight="400"
            numberOfLines={metaLines}
            style={dense ? styles.denseMeta : undefined}
          >
            {meta}
          </Text>
        ) : null}
        {badge ? <View style={{ flexDirection: "row", marginTop: 4 }}>{badge}</View> : null}
      </View>
      {trailing !== undefined && (
        <View style={styles.trailing}>
          {typeof trailing === "string" ? (
            <Text variant="subhead" weight="600" color={trailingColor ?? "text"} tabular>
              {trailing}
            </Text>
          ) : (
            trailing
          )}
          {trailingMeta ? (
            <Text variant="caption" color="text2" weight="400">
              {trailingMeta}
            </Text>
          ) : null}
        </View>
      )}
      {chevron && <Icon name="chevronRight" size={18} color={c.tertiary} />}
    </View>
  );
  return (
    <View>
      {!first && <View style={[styles.divider, { backgroundColor: c.outline }]} />}
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => pressed && { backgroundColor: c.subtle }}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={[styles.divider, { backgroundColor: c.outline }]} />;
}

const styles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xs,
    minHeight: 24,
  },
  card: { borderRadius: radius.card, overflow: "hidden" },
  padded: { paddingHorizontal: space.rowX, paddingVertical: space.lg },
  row: {
    minHeight: size.row,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.rowX,
    paddingVertical: space.md,
  },
  tile: {
    width: size.tile,
    height: size.tile,
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  trailing: { alignItems: "flex-end", gap: 2, maxWidth: "50%" },
  denseTitle: { fontSize: 14, lineHeight: 21 },
  denseMeta: { fontSize: 11, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.rowX, marginRight: space.rowX },
});
