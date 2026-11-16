import { useEffect, useMemo, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { PeriodChip } from "@/components/ledger/ScopeControls";
import {
  EmptyState,
  ProgressBar,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
} from "@/components/ui";
import { monthLabel, shortDate, shortMonthLabel } from "@/lib/dates";
import { inMonth, totals, withinSelected, won } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import type { ColorTokens } from "@/theme/tokens";

/** Reports cover every account (no account filter on this screen). */
const ALL_ACCOUNTS: string[] = [];

/**
 * Touches on the reports screen, so the chart's month table closes on a touch anywhere outside the
 * chart section. The section marks its own touches first (touch events bubble from the innermost
 * view), and the screen then tells the listeners about any touch that was not marked.
 */
const outsideChartListeners = new Set<() => void>();
let touchInChart = false;
const markChartTouch = () => {
  touchInChart = true;
};
const onScreenTouch = () => {
  if (touchInChart) touchInChart = false;
  else outsideChartListeners.forEach((close) => close());
};

/** The first tab: the monthly / yearly report (it replaced the old overview). */
export default function ReportsScreen() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const { month } = usePrefs();
  return (
    <View style={{ flex: 1 }} onTouchStart={onScreenTouch}>
      {/* The title names the month / year covered; the calendar chip beside it picks another. */}
      <Screen
        title={period === "month" ? shortMonthLabel(month) : `${month.slice(0, 4)}년`}
        right={<PeriodChip period={period} />}
      >
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "월간" },
            { value: "year", label: "연간" },
          ]}
          accessibilityLabel="보고서 기간"
        />
        {period === "month" ? <MonthlyReport /> : <YearlyReport />}
      </Screen>
    </View>
  );
}

function MonthlyReport() {
  const { data } = useLedger();
  const { month } = usePrefs();
  const selected = ALL_ACCOUNTS;
  const [category, setCategory] = useState<string | null>(null);

  const report = useMemo(() => {
    const current = withinSelected(inMonth(data.transactions, month), selected);
    const now = totals(current);
    const expenses = current.filter((i) => i.type === "expense");
    const byCategory = Object.entries(
      expenses.reduce<Record<string, number>>((result, item) => {
        result[item.category] = (result[item.category] ?? 0) + Math.abs(item.amount);
        return result;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
    const top = [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 4);
    const ratio = now.income ? Number(((now.expense / now.income) * 100).toFixed(1)) : 0;
    const fixedRatio = now.expense ? Math.round((now.fixedExpense / now.expense) * 100) : 0;
    return { current, now, byCategory, top, ratio, fixedRatio };
  }, [data.transactions, month, selected]);

  const categoryRecords = category
    ? report.current
        .filter((i) => i.type === "expense" && i.category === category)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const minorTotals = Object.entries(
    categoryRecords.reduce<Record<string, number>>((result, item) => {
      const minor = item.minorCategory?.trim() || "미분류";
      result[minor] = (result[minor] ?? 0) + Math.abs(item.amount);
      return result;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const categoryTotal = categoryRecords.reduce((sum, i) => sum + Math.abs(i.amount), 0);
  const maxCategory = report.byCategory[0]?.[1] ?? 1;

  return (
    <>
      <MetricGrid
        items={[
          { label: "총수입", value: report.now.income },
          { label: "총지출", value: -report.now.expense, neutral: true },
          { label: "순수입", value: report.now.income - report.now.expense },
          { label: "수입 대비 지출", value: report.ratio, percentage: true },
        ]}
      />

      <Section title="고정비와 변동비" padded>
        <View style={{ gap: space.lg }}>
          <SplitLine label="고정비" amount={report.now.fixedExpense} pct={report.fixedRatio} />
          <SplitLine label="변동비" amount={report.now.variableExpense} pct={report.now.expense ? 100 - report.fixedRatio : 0} tone="expense" />
        </View>
      </Section>

      <Section title="분류별 지출">
        {report.byCategory.length ? (
          report.byCategory.map(([name, amount], index) => (
            <View key={name}>
              <Row
                first={index === 0}
                title={name}
                trailing={`−${won(amount)}`}
                chevron
                onPress={() => setCategory(name)}
                accessibilityLabel={`${name} ${won(amount)}, 상세 내역 보기`}
              />
              <View style={styles.barInset}>
                <ProgressBar value={(amount / maxCategory) * 100} tone="expense" />
              </View>
            </View>
          ))
        ) : (
          <EmptyState title="이번 달 지출이 없어요" />
        )}
      </Section>

      {report.top.length > 0 && (
        <Section title="이번 달 큰 지출">
          {report.top.map((item, index) => (
            <Row
              key={item.id}
              first={index === 0}
              title={item.name}
              meta={`${index + 1}위 · ${shortDate(item.date)}`}
              trailing={`−${won(item.amount)}`}
            />
          ))}
        </Section>
      )}


      <Sheet
        visible={Boolean(category)}
        onClose={() => setCategory(null)}
        title={category ?? ""}
        subtitle={`${monthLabel(month)} · ${categoryRecords.length}건 · −${won(categoryTotal)}`}
      >
        <Section title="소분류">
          {minorTotals.map(([minor, amount], index) => (
            <Row key={minor} first={index === 0} title={minor} trailing={`−${won(amount)}`} />
          ))}
        </Section>
        <Section title="거래 내역">
          {categoryRecords.map((item, index) => (
            <Row
              key={item.id}
              first={index === 0}
              title={item.name}
              meta={`${shortDate(item.date)} · ${item.minorCategory?.trim() || "미분류"}`}
              trailing={`−${won(item.amount)}`}
            />
          ))}
        </Section>
      </Sheet>
    </>
  );
}

function YearlyReport() {
  const { data } = useLedger();
  const { month } = usePrefs();
  const selected = ALL_ACCOUNTS;
  const year = month.slice(0, 4);

  const rows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const key = `${year}-${String(index + 1).padStart(2, "0")}`;
        return { month: index + 1, ...totals(withinSelected(inMonth(data.transactions, key), selected)) };
      }),
    [data.transactions, year, selected],
  );
  const annual = rows.reduce(
    (sum, r) => ({
      income: sum.income + r.income,
      expense: sum.expense + r.expense,
      fixedExpense: sum.fixedExpense + r.fixedExpense,
    }),
    { income: 0, expense: 0, fixedExpense: 0 },
  );
  const fixedRatio = annual.expense ? Number(((annual.fixedExpense / annual.expense) * 100).toFixed(1)) : 0;

  return (
    <>
      <MetricGrid
        items={[
          { label: "연간 총수입", value: annual.income },
          { label: "연간 총지출", value: -annual.expense, neutral: true },
          { label: "연간 순수입", value: annual.income - annual.expense },
          { label: "고정비 비율", value: fixedRatio, percentage: true },
        ]}
      />
      <View onTouchStart={markChartTouch}>
        <Section title={`${year}년 월별 수입과 지출`} padded>
          <MonthBars rows={rows} year={year} />
          <View style={styles.legend}>
            <Legend color="chartIncome" label="수입" />
            <Legend color="chartExpense" label="지출" />
          </View>
        </Section>
      </View>
      <Section title="월별 상세">
        {rows.map((r, index) => {
          const net = r.income - r.expense;
          return (
            <Row
              key={r.month}
              first={index === 0}
              title={`${r.month}월`}
              meta={`수입 +${won(r.income)}
지출 −${won(r.expense)}`}
              metaLines={2}
              trailing={`${net >= 0 ? "+" : "−"}${won(net)}`}
              trailingColor={net >= 0 ? "income" : "expense"}
            />
          );
        })}
      </Section>
    </>
  );
}

const CHART_HEIGHT = 168;
const BAR_AREA = 140;
/** Space above the bars: the chart is bottom-aligned (bars, gap, month label). */
const BAR_TOP = CHART_HEIGHT - BAR_AREA - space.xs - 16;
const TIP_WIDTH = 156;

type ChartRow = { month: number; income: number; expense: number };

/**
 * Monthly income / expense bars. Touch a month, or drag across the chart, to see that month's
 * numbers in a small table beside its bars, level with the midpoint of the two bar tops. It stays
 * after you let go; tap the same month again to hide it.
 */
function MonthBars({ rows, year }: { rows: ChartRow[]; year: string }) {
  const { c, shadow } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [tipHeight, setTipHeight] = useState(0);
  const high = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const colWidth = width / rows.length;

  // A touch anywhere outside the chart section closes the table.
  useEffect(() => {
    const close = () => setActive(null);
    outsideChartListeners.add(close);
    return () => {
      outsideChartListeners.delete(close);
    };
  }, []);

  const indexAt = (x: number) => Math.max(0, Math.min(rows.length - 1, Math.floor(x / (colWidth || 1))));
  // Touch and drag both pick the month under the finger; a plain tap on the month already open
  // closes it. A mostly vertical drag lets the page scroll instead.
  const responder = useMemo(() => {
    const touch = { startX: 0, index: -1, dragged: false, wasOpen: false };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: (_, g) => Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderGrant: (e) => {
        touch.dragged = false;
        touch.startX = e.nativeEvent.locationX;
        touch.index = indexAt(touch.startX);
        setActive((current) => {
          touch.wasOpen = current === touch.index;
          return touch.index;
        });
      },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 4) touch.dragged = true;
        setActive(indexAt(touch.startX + g.dx));
      },
      onPanResponderRelease: () => {
        if (!touch.dragged && touch.wasOpen) setActive(null);
      },
    });
    // indexAt only depends on the column width.
  }, [colWidth, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = active === null ? null : rows[active];
  let tip: { left: number; top: number } | null = null;
  if (row && active !== null && width) {
    const incomeTop = BAR_TOP + BAR_AREA - (row.income / high) * BAR_AREA;
    const expenseTop = BAR_TOP + BAR_AREA - (row.expense / high) * BAR_AREA;
    const mid = (incomeTop + expenseTop) / 2;
    const center = colWidth * (active + 0.5);
    // Beside the bars (toward the roomier side), so they stay visible.
    const left = active < rows.length / 2 ? center + colWidth / 2 + space.xs : center - colWidth / 2 - space.xs - TIP_WIDTH;
    tip = {
      left: Math.max(0, Math.min(width - TIP_WIDTH, left)),
      top: Math.max(0, Math.min(CHART_HEIGHT - tipHeight, mid - tipHeight / 2)),
    };
  }
  const ratio = row && row.income ? `${((row.expense / row.income) * 100).toFixed(1)}%` : "—";

  return (
    <View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.chart}
        accessibilityLabel={`${year}년 월별 수입과 지출 막대 그래프. 누르거나 옆으로 밀면 그 달의 숫자를 보여 줘요. 자세한 숫자는 아래 월별 상세에도 있어요.`}
        {...responder.panHandlers}
      >
        {rows.map((r, i) => (
          <View
            key={r.month}
            pointerEvents="none"
            style={[styles.column, active !== null && active !== i && { opacity: 0.35 }]}
          >
            <View style={styles.pair}>
              <View style={[styles.bar, { height: (r.income / high) * BAR_AREA, backgroundColor: c.chartIncome }]} />
              <View style={[styles.bar, { height: (r.expense / high) * BAR_AREA, backgroundColor: c.chartExpense }]} />
            </View>
            <Text variant="caption" weight={active === i ? "700" : "500"} color={active === i ? "text" : "text2"}>
              {r.month}
            </Text>
          </View>
        ))}
      </View>
      {row && tip ? (
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
          <Text variant="footnote" weight="700">
            {year}년 {row.month}월
          </Text>
          <TipLine color="chartIncome" label="수입" value={`+${won(row.income)}`} />
          <TipLine color="chartExpense" label="지출" value={`−${won(row.expense)}`} />
          <TipLine label="지출 비율" value={ratio} />
        </View>
      ) : null}
    </View>
  );
}

function TipLine({ color, label, value }: { color?: keyof ColorTokens; label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.tipLine}>
      {color ? <View style={[styles.tipDot, { backgroundColor: c[color] }]} /> : <View style={styles.tipDot} />}
      <Text variant="caption" weight="400" color="text2" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="caption" tabular>
        {value}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: keyof ColorTokens; label: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: c[color] }]} />
      <Text variant="footnote" weight="400" color="text2">
        {label}
      </Text>
    </View>
  );
}

function SplitLine({
  label,
  amount,
  pct,
  tone,
}: {
  label: string;
  amount: number;
  pct: number;
  tone?: "expense";
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.splitHead}>
        <Text variant="subhead" weight="600">
          {label}
        </Text>
        <Text variant="subhead" color="text2" tabular>
          {won(amount)} · {pct}%
        </Text>
      </View>
      <ProgressBar value={pct} tone={tone} />
    </View>
  );
}

function MetricGrid({
  items,
}: {
  items: { label: string; value: number; percentage?: boolean; neutral?: boolean }[];
}) {
  const { c } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const positive = item.value >= 0;
        const color: keyof ColorTokens =
          item.neutral || item.percentage ? "text" : positive ? "income" : "expense";
        return (
          <View key={item.label} style={[styles.metric, { backgroundColor: c.card }]}>
            <Text variant="footnote" color="text2">
              {item.label}
            </Text>
            <Text variant="headline" color={color} tabular numberOfLines={1} style={styles.metricValue}>
              {item.percentage ? `${item.value}%` : `${item.value > 0 ? "+" : item.value < 0 ? "−" : ""}${won(item.value)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  metric: {
    width: "48%",
    flexGrow: 1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.xs,
  },
  // headline 17px less 2px, so year totals fit the half-width card.
  metricValue: { fontSize: 15, lineHeight: 22 },
  barInset: { paddingHorizontal: space.rowX, paddingBottom: space.md, marginTop: -space.xs },
  chart: { flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT, gap: 2 },
  column: { flex: 1, alignItems: "center", gap: space.xs, justifyContent: "flex-end" },
  pair: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: BAR_AREA },
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
  bar: { width: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 1 },
  legend: { flexDirection: "row", gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  splitHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
