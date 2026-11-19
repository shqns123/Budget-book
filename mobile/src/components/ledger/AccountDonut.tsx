import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import {
  CardTitle,
  Chip,
  EmptyState,
  FoldMenu,
  Icon,
  Section,
  Text,
  useFoldAnchor,
  Wheel,
  type Anchor,
  type WheelItem,
} from "@/components/ui";
import { markChartTouch, useOutsideChartTouch } from "@/lib/chart-touch";
import { shortDate } from "@/lib/dates";
import { donutGeometry } from "@/lib/donut-segment";
import { won, type Account, type Transaction } from "@/lib/ledger";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

/**
 * Categorical colors for the light and dark themes. Every slice also has a text label in the legend.
 */
const SLOTS = {
  light: [
    "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6",
    "#8c573b", "#00869a", "#ad3561", "#6a7d20", "#486292", "#ae6c16", "#8558a0",
  ],
  dark: [
    "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9",
    "#bb856b", "#34a6bc", "#eb6ca0", "#9ca640", "#7293ca", "#e08b3e", "#b98ad2",
  ],
};
const OTHER = "기타";
const UNCLASSIFIED = "미분류";
const categoryName = (item: Transaction) => item.category?.trim() || UNCLASSIFIED;

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const TIP_WIDTH = 148;

const OPEN_MS = 280;
const CLOSE_MS = 220;
const EASE = Easing.bezier(0.2, 0, 0, 1);

type Slice = { name: string; amount: number; color: string; items: Transaction[] };

/**
 * 통장별 지출: pick an account, see what its money went on this month as a donut, with a legend
 * of the categories (name, share, amount).
 *
 * Press or drag across the ring to see each slice's name, share and amount; touch a
 * legend row to open it into a card listing that category's spending.
 *
 * Each recorded category keeps its own name and uses the same color across accounts for the month.
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
  // The slice whose table is showing, and the legend row that is open.
  const [active, setActive] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [closeTip] = useState(() => () => setActive(null));
  useOutsideChartTouch(closeTip);

  const slots = dark ? SLOTS.dark : SLOTS.light;
  const colorOrder = [...new Set([...categoryOrder.map((name) => name.trim()), ...expenses.map(categoryName)])];
  const colorOf = (name: string) =>
    name === OTHER || name === UNCLASSIFIED ? c.strong : slots[colorOrder.indexOf(name) % slots.length];

  const slices: Slice[] = [];
  if (current) {
    const groups = expenses
      .filter((r) => r.accountId === current.account.id)
      .reduce((result, item) => {
        const name = categoryName(item);
        const rows = result.get(name) ?? [];
        rows.push(item);
        result.set(name, rows);
        return result;
      }, new Map<string, Transaction[]>());
    Array.from(groups)
      .map(([name, items]) => ({
        name,
        amount: items.reduce((sum, r) => sum + Math.abs(r.amount), 0),
        color: colorOf(name),
        items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => (a.name === OTHER ? 1 : b.name === OTHER ? -1 : b.amount - a.amount))
      .forEach((slice) => slices.push(slice));
  }

  const pickAccount = (id: string) => {
    setPicked(id);
    setActive(null);
    setOpenRow(null);
  };

  return (
    <Section padded>
      <View style={{ gap: space.lg }}>
        <CardTitle
          title="통장별 지출"
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
        />
        {current ? (
          <>
            {anchor ? (
              <AccountWheelMenu
                items={spenders.map(({ account }) => ({ value: account.id, label: account.name }))}
                value={current.account.id}
                anchor={anchor}
                visible={open}
                onPick={pickAccount}
                onClose={hide}
                onClosed={clear}
              />
            ) : null}
            <DonutChart
              slices={slices}
              total={current.total}
              active={active}
              onSelect={setActive}
            />
            {/* The legend doubles as the table: every slice by name, share and amount. */}
            <View style={{ gap: space.xs }}>
              {slices.map((slice) => (
                <SliceRow
                  key={slice.name}
                  slice={slice}
                  total={current.total}
                  open={openRow === slice.name}
                  onToggle={() => setOpenRow((now) => (now === slice.name ? null : slice.name))}
                />
              ))}
            </View>
          </>
        ) : (
          <EmptyState title="이번 달 지출이 없어요" />
        )}
      </View>
    </Section>
  );
}

/**
 * The accounts on a wheel, unfolding out of the header chip. Mounted fresh for each opening; the
 * pick is shown when the panel closes.
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
      <Wheel items={items} value={value} onChange={setPick} accessibilityLabel="통장" />
    </FoldMenu>
  );
}

const pct = (amount: number, total: number) => Math.round((amount / total) * 100);

/**
 * Round joins connect the slices. Dragging switches the table; tapping the selected
 * slice, the hole, or outside the chart closes it.
 */
function DonutChart({
  slices,
  total,
  active,
  onSelect,
}: {
  slices: Slice[];
  total: number;
  active: string | null;
  onSelect: (name: string | null) => void;
}) {
  const { c, shadow } = useTheme();
  const [width, setWidth] = useState(0);
  const [tipHeight, setTipHeight] = useState(0);
  const gesture = useRef<{
    pageX: number;
    pageY: number;
    left: number;
    top: number;
    firstSlice: string;
    moved: boolean;
    wasOpen: boolean;
  } | null>(null);
  const { segments, indexAt } = donutGeometry(
    slices.map((slice) => slice.amount), SIZE / 2, R - STROKE / 2, R + STROKE / 2,
  );

  // Which slice is under a touch: by its angle from 12 o'clock, if it lands on the ring.
  const sliceAt = (x: number, y: number) => slices[indexAt(x - SIZE / 2, y - SIZE / 2)]?.name ?? null;
  const grantGesture = ({ nativeEvent }: GestureResponderEvent) => {
    const { locationX, locationY, pageX, pageY } = nativeEvent;
    const slice = sliceAt(locationX, locationY);
    if (slice === null) return;
    gesture.current = {
      pageX,
      pageY,
      left: pageX - locationX,
      top: pageY - locationY,
      firstSlice: slice,
      moved: false,
      wasOpen: active === slice,
    };
    onSelect(slice);
    // Keep Android's native scroll view from taking a drag that started on a slice.
    return true;
  };
  const moveGesture = ({ nativeEvent }: GestureResponderEvent) => {
    const touch = gesture.current;
    if (!touch) return;
    const { pageX, pageY } = nativeEvent;
    const slice = sliceAt(pageX - touch.left, pageY - touch.top);
    if (Math.hypot(pageX - touch.pageX, pageY - touch.pageY) > 4 || (slice !== null && slice !== touch.firstSlice)) {
      touch.moved = true;
    }
    if (touch.moved && slice !== null) onSelect(slice);
  };
  const endGesture = () => {
    const touch = gesture.current;
    gesture.current = null;
    if (touch && !touch.moved && touch.wasOpen) onSelect(null);
  };

  const activeIndex = slices.findIndex((slice) => slice.name === active);
  const activeSlice = activeIndex >= 0 ? slices[activeIndex] : null;
  const activeSegment = segments[activeIndex];
  let tip: { left: number; top: number } | null = null;
  if (activeSegment && width) {
    // Beside the middle of the slice, on its outer edge, toward the roomier side.
    const { angle } = activeSegment;
    const reach = R + STROKE / 2;
    const px = width / 2 + reach * Math.sin(angle);
    const py = SIZE / 2 - reach * Math.cos(angle);
    const left = Math.sin(angle) >= 0 ? px + space.sm : px - space.sm - TIP_WIDTH;
    tip = {
      left: Math.max(0, Math.min(width - TIP_WIDTH, left)),
      top: Math.max(0, Math.min(SIZE - tipHeight, py - tipHeight / 2)),
    };
  }

  const summary = slices.map((s) => `${s.name} ${pct(s.amount, total)}%`).join(", ");
  return (
    <View onTouchStart={markChartTouch} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.chart}>
      <View
        onStartShouldSetResponder={({ nativeEvent }) =>
          sliceAt(nativeEvent.locationX, nativeEvent.locationY) !== null
        }
        onTouchStart={({ nativeEvent }) => {
          if (!gesture.current && sliceAt(nativeEvent.locationX, nativeEvent.locationY) === null) onSelect(null);
        }}
        onResponderGrant={grantGesture}
        onResponderMove={moveGesture}
        onResponderRelease={endGesture}
        onResponderTerminationRequest={() => false}
        onResponderTerminate={() => { gesture.current = null; }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`분류별 비율: ${summary}. 조각을 누르거나 조각 사이를 밀어서 비율과 금액을 확인해요.`}
        style={styles.ring}
      >
        <Svg width={SIZE} height={SIZE} pointerEvents="none">
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={c.subtle} strokeWidth={STROKE} fill="none" />
          {segments.map((segment, i) => segment && (
            <Path
              key={slices[i].name}
              d={segment.path}
              fill={slices[i].color}
              fillOpacity={activeSlice && activeIndex !== i ? 0.35 : 1}
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text variant="caption" color="text2">
            지출
          </Text>
          <Text variant="headline" weight="700" tabular numberOfLines={1}>
            {won(total)}
          </Text>
        </View>
      </View>
      {activeSlice && tip ? (
        <View
          pointerEvents="none"
          onLayout={(e) => setTipHeight(e.nativeEvent.layout.height)}
          style={[
            styles.tip,
            shadow("float"),
            { backgroundColor: c.card, left: tip.left, top: tip.top, opacity: tipHeight ? 1 : 0 },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text variant="footnote" weight="700" numberOfLines={1}>
            {activeSlice.name}
          </Text>
          <TipLine color={activeSlice.color} label="비율" value={`${pct(activeSlice.amount, total)}%`} />
          <TipLine label="금액" value={`−${won(activeSlice.amount)}`} />
        </View>
      ) : null}
    </View>
  );
}

function TipLine({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <View style={styles.tipLine}>
      <View style={[styles.tipDot, color ? { backgroundColor: color } : null]} />
      <Text variant="caption" weight="400" color="text2" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="caption" tabular>
        {value}
      </Text>
    </View>
  );
}

/**
 * One legend row. Touching it opens it into a card (the row takes the canvas grey and the list
 * eases down under it) with that category's spending this month, newest first.
 */
function SliceRow({
  slice,
  total,
  open,
  onToggle,
}: {
  slice: Slice;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  // The list's full height, followed while it changes.
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
  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: [c.card, c.bg] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] });
  const share = pct(slice.amount, total);

  return (
    <Animated.View style={[styles.rowCard, { backgroundColor }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${slice.name} ${share}% ${won(slice.amount)}, ${slice.items.length}건, 지출 내역 ${open ? "접기" : "보기"}`}
        style={({ pressed }) => [styles.legendRow, pressed && { opacity: 0.6 }]}
      >
        <View style={[styles.swatch, { backgroundColor: slice.color }]} />
        <Text variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
          {slice.name}
        </Text>
        <Text variant="footnote" color="text2" tabular>
          {share}%
        </Text>
        <Text variant="subhead" weight="600" tabular style={styles.amount}>
          {won(slice.amount)}
        </Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name="chevronDown" size={16} color={c.text2} />
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.clip, { height, opacity }]} pointerEvents={open ? "auto" : "none"}>
        <View
          onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}
          style={[styles.body, { borderTopColor: c.outline }]}
        >
          {slice.items.map((item) => (
            <View key={item.id} style={styles.detail}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subhead" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="caption" weight="400" color="text2" numberOfLines={1}>
                  {shortDate(item.date)} · {item.minorCategory?.trim() || UNCLASSIFIED}
                </Text>
              </View>
              <Text variant="subhead" tabular>
                −{won(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { maxWidth: 200 },
  chart: { alignItems: "center", height: SIZE },
  ring: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SIZE - STROKE * 2 - space.sm * 2,
  },
  tip: {
    position: "absolute",
    width: TIP_WIDTH,
    borderRadius: radius.tile,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 3,
  },
  tipLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipDot: { width: 8, height: 8, borderRadius: 2 },
  // The row's own card: it reaches a little past the legend so the swatch stays in line.
  rowCard: { borderRadius: radius.control, marginHorizontal: -space.sm, overflow: "hidden" },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    paddingHorizontal: space.sm,
  },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  amount: { minWidth: 80, textAlign: "right" },
  clip: { overflow: "hidden" },
  // Absolute, so it keeps its own height while the clip around it animates.
  body: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    marginHorizontal: space.sm,
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detail: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
});
