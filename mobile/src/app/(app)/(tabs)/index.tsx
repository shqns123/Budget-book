import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccountChip, MonthChip, useScopeSelection } from "@/components/ledger/ScopeControls";
import {
  ChipRow,
  EmptyState,
  ProgressBar,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
} from "@/components/ui";
import { monthLabel, shortDate } from "@/lib/dates";
import { inMonth, totals, withinSelected, won } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import type { ColorTokens } from "@/theme/tokens";

export default function ReportsScreen() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  return (
    <Screen
      title="보고서"
      above={
        <ChipRow>
          <MonthChip />
          <AccountChip scope="reports" />
        </ChipRow>
      }
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
  );
}

function MonthlyReport() {
  const { data } = useLedger();
  const { month } = usePrefs();
  const { selected } = useScopeSelection("reports");
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

      <Section title="고정비와 변동비" padded>
        <View style={{ gap: space.lg }}>
          <SplitLine label="고정비" amount={report.now.fixedExpense} pct={report.fixedRatio} />
          <SplitLine label="변동비" amount={report.now.variableExpense} pct={report.now.expense ? 100 - report.fixedRatio : 0} tone="expense" />
        </View>
      </Section>

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
  const { c } = useTheme();
  const { data } = useLedger();
  const { month } = usePrefs();
  const { selected } = useScopeSelection("reports");
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
  const high = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
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
      <Section title={`${year}년 월별 수입과 지출`} padded>
        <View
          style={styles.chart}
          accessibilityLabel={`${year}년 월별 수입과 지출 막대 그래프. 자세한 숫자는 아래 월별 상세에 있어요.`}
        >
          {rows.map((r) => (
            <View key={r.month} style={styles.column}>
              <View style={styles.pair}>
                <View style={[styles.bar, { height: (r.income / high) * 140, backgroundColor: c.chartIncome }]} />
                <View style={[styles.bar, { height: (r.expense / high) * 140, backgroundColor: c.chartExpense }]} />
              </View>
              <Text variant="caption" weight="500" color="text2">
                {r.month}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Legend color="chartIncome" label="수입" />
          <Legend color="chartExpense" label="지출" />
        </View>
      </Section>
      <Section title="월별 상세">
        {rows.map((r, index) => {
          const net = r.income - r.expense;
          return (
            <Row
              key={r.month}
              first={index === 0}
              title={`${r.month}월`}
              meta={`수입 +${won(r.income)} · 지출 −${won(r.expense)}`}
              trailing={`${net >= 0 ? "+" : "−"}${won(net)}`}
              trailingColor={net >= 0 ? "income" : "expense"}
            />
          );
        })}
      </Section>
    </>
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
            <Text variant="headline" color={color} tabular numberOfLines={1}>
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
  barInset: { paddingHorizontal: space.rowX, paddingBottom: space.md, marginTop: -space.xs },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 168, gap: 2 },
  column: { flex: 1, alignItems: "center", gap: space.xs, justifyContent: "flex-end" },
  pair: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 140 },
  bar: { width: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 1 },
  legend: { flexDirection: "row", gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  splitHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
