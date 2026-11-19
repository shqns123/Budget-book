import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  Chip,
  EmptyState,
  FoldMenu,
  PrimaryButton,
  Section,
  Text,
  useFoldAnchor,
  Wheel,
  type Anchor,
  type WheelItem,
} from "@/components/ui";
import { won, type Account, type Transaction } from "@/lib/ledger";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

/**
 * Categorical slots, in fixed order (validated for colour-blind separation, light on the white
 * card and dark on the dark card). Contrast of a few light steps is under 3:1, so every slice is
 * also named in the legend beside it.
 */
const SLOTS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9"],
};
const OTHER = "기타";

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** The surface gap between slices. */
const GAP = 2;

type Slice = { name: string; amount: number; color: string };

/**
 * 통장별 지출: pick an account, see what its money went on this month as a donut, with a legend
 * of the categories (name, share, amount).
 *
 * A category keeps its colour on every account (colour follows the category, not its place on
 * one account): the month's seven biggest categories overall get the slots, in that order, and
 * the rest share the neutral 기타.
 */
export function AccountDonut({
  records,
  accounts,
  categoryOrder,
}: {
  /** The month's records (every account). */
  records: Transaction[];
  accounts: Account[];
  /** The month's categories, biggest spending first (all accounts together). */
  categoryOrder: string[];
}) {
  const { c, dark } = useTheme();
  const expenses = records.filter((r) => r.type === "expense");
  // Accounts that paid for something this month, in the order set in 가계부 설정.
  const spenders = accounts
    .map((account) => ({
      account,
      total: expenses.filter((r) => r.accountId === account.id).reduce((sum, r) => sum + Math.abs(r.amount), 0),
    }))
    .filter((row) => row.total > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const current = spenders.find((row) => row.account.id === picked) ?? spenders[0];
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();

  const slots = dark ? SLOTS.dark : SLOTS.light;
  const colorOf = (category: string) => {
    const slot = categoryOrder.indexOf(category);
    return slot >= 0 && slot < slots.length ? slots[slot] : c.strong;
  };

  const slices: Slice[] = [];
  if (current) {
    const sums = expenses
      .filter((r) => r.accountId === current.account.id)
      .reduce<Record<string, number>>((result, r) => {
        const name = colorOf(r.category) === c.strong ? OTHER : r.category;
        result[name] = (result[name] ?? 0) + Math.abs(r.amount);
        return result;
      }, {});
    Object.entries(sums)
      .sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : b[1] - a[1]))
      .forEach(([name, amount]) => slices.push({ name, amount, color: name === OTHER ? c.strong : colorOf(name) }));
  }

  return (
    <Section
      title="통장별 지출"
      padded
      action={
        current ? (
          <View ref={anchorRef} collapsable={false} style={styles.chipWrap}>
            <Chip
              label={current.account.name}
              trailingIcon="chevronDown"
              accessibilityLabel={`통장, ${current.account.name}`}
              onPress={show}
            />
          </View>
        ) : undefined
      }
    >
      {current ? (
        <View style={{ gap: space.lg }}>
          {anchor ? (
            <AccountWheelMenu
              items={spenders.map(({ account }) => ({ value: account.id, label: account.name }))}
              value={current.account.id}
              anchor={anchor}
              visible={open}
              onPick={setPicked}
              onClose={hide}
              onClosed={clear}
            />
          ) : null}
          <View style={styles.chart}>
            <Donut slices={slices} total={current.total} track={c.subtle} />
            <View style={styles.center} pointerEvents="none">
              <Text variant="caption" color="text2">
                지출
              </Text>
              <Text variant="headline" weight="700" tabular numberOfLines={1}>
                {won(current.total)}
              </Text>
            </View>
          </View>
          {/* The legend doubles as the table: every slice by name, share and amount. */}
          <View style={{ gap: space.sm }}>
            {slices.map((slice) => (
              <View key={slice.name} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: slice.color }]} />
                <Text variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                  {slice.name}
                </Text>
                <Text variant="footnote" color="text2" tabular>
                  {Math.round((slice.amount / current.total) * 100)}%
                </Text>
                <Text variant="subhead" weight="600" tabular style={styles.amount}>
                  {won(slice.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <EmptyState title="이번 달 지출이 없어요" />
      )}
    </Section>
  );
}

/**
 * The accounts on a wheel, unfolding out of the header chip. Mounted fresh for each opening; the
 * pick is shown when the panel closes (완료, or a tap outside).
 */
function AccountWheelMenu({
  items,
  value,
  anchor,
  visible,
  onPick,
  onClose,
  onClosed,
}: {
  items: WheelItem<string>[];
  value: string;
  anchor: Anchor;
  visible: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [pick, setPick] = useState(value);
  const close = () => {
    if (pick !== value) onPick(pick);
    onClose();
  };
  return (
    <FoldMenu
      anchor={anchor}
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      maxWidth={280}
      accessibilityLabel="통장 선택"
    >
      <View style={{ gap: space.md }}>
        <Wheel items={items} value={value} onChange={setPick} accessibilityLabel="통장" />
        <PrimaryButton label="완료" onPress={close} />
      </View>
    </FoldMenu>
  );
}

function Donut({ slices, total, track }: { slices: Slice[]; total: number; track: string }) {
  const gap = slices.length > 1 ? GAP : 0;
  const lengths = slices.map((slice) => (slice.amount / total) * CIRCUMFERENCE);
  const arcs = slices.map((slice, i) => ({
    ...slice,
    start: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
    length: Math.max(0, lengths[i] - gap),
  }));
  const summary = slices.map((s) => `${s.name} ${Math.round((s.amount / total) * 100)}%`).join(", ");
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`분류별 비율: ${summary}`}>
      {/* Starts at 12 o'clock and runs clockwise. */}
      <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={track} strokeWidth={STROKE} fill="none" />
        {arcs.map((arc) => (
          <Circle
            key={arc.name}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={arc.color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={-arc.start}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { maxWidth: 200 },
  chart: { alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SIZE - STROKE * 2 - space.sm * 2,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 28 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  amount: { minWidth: 88, textAlign: "right" },
});
