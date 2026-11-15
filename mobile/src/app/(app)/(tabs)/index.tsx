import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccountSheet, MonthChip, useScopeSelection } from "@/components/ledger/ScopeControls";
import { ChipRow, Icon, ProgressBar, Row, Screen, Section, Text, TextButton } from "@/components/ui";
import { monthLabel, shiftMonth } from "@/lib/dates";
import { calculateAccountBalances, inMonth, signedWon, totals, won } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

function change(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export default function OverviewScreen() {
  const { data, accounts } = useLedger();
  const { month } = usePrefs();
  const { selected } = useScopeSelection("overview");
  const [pickAccounts, setPickAccounts] = useState(false);

  const summary = useMemo(() => {
    const now = totals(inMonth(data.transactions, month));
    const before = totals(inMonth(data.transactions, shiftMonth(month, -1)));
    const balances = calculateAccountBalances(accounts, data.transactions, `${month}-31`);
    const budgets = selected.length
      ? data.budgets.filter((b) => selected.includes(b.accountId))
      : [];
    const budget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const details = budgets.map((b) => ({
      ...b,
      name: accounts.find((a) => a.id === b.accountId)?.name ?? "",
      balance: balances.get(b.accountId) ?? 0,
    }));
    const remaining = details.reduce((sum, d) => sum + d.balance, 0);
    const used = Math.min(budget, Math.max(0, budget - remaining));
    return {
      income: now.income,
      expense: now.expense,
      incomeChange: change(now.income, before.income),
      expenseChange: change(now.expense, before.expense),
      budget,
      details,
      remaining,
      used,
    };
  }, [data.transactions, data.budgets, accounts, month, selected]);

  const net = summary.income - summary.expense;

  return (
    <Screen
      title="개요"
      above={
        <ChipRow>
          <MonthChip />
        </ChipRow>
      }
    >
      <View style={{ gap: space.sm }}>
        <Text variant="subhead" color="text2">
          {monthLabel(month)}의 흐름
        </Text>
        <Text variant="title1" tabular accessibilityLabel={`이번 달 순수입 ${signedWon(net)}`}>
          {net >= 0 ? "+" : "−"}
          {won(net)}
        </Text>
        <Text variant="subhead" color="text2">
          {net > 0
            ? "들어온 돈이 나간 돈보다 많아요."
            : net < 0
              ? "나간 돈이 들어온 돈보다 많아요."
              : "들어온 돈과 나간 돈이 같아요."}
        </Text>
      </View>

      <View style={styles.pair}>
        <StatCard label="이번 달 수입" value={summary.income} delta={summary.incomeChange} positiveIsGood />
        <StatCard label="이번 달 지출" value={summary.expense} delta={summary.expenseChange} />
      </View>

      <Section
        title={summary.budget ? "이번 달 남은 예산" : "이번 달 예산"}
        action={<TextButton label="통장 선택" icon="settings" onPress={() => setPickAccounts(true)} />}
        tone="accent"
        padded
      >
        {!selected.length ? (
          <EmptyBudget title="통장을 선택해 주세요" body="예산을 확인할 통장을 고르면 남은 금액을 보여드려요." />
        ) : !summary.budget ? (
          <EmptyBudget
            title="예산이 지정되지 않았어요"
            body="선택한 통장에는 이번 달 예산이 없어요. 가계부 설정의 월 예산에서 지정할 수 있어요."
          />
        ) : (
          <View style={{ gap: space.md }}>
            <Text variant="title1" color="onPrimaryContainer" tabular>
              {signedWon(summary.remaining)}
            </Text>
            <ProgressBar value={(summary.used / summary.budget) * 100} />
            <Text variant="footnote" weight="400" color="onPrimaryContainer">
              예산 {won(summary.budget)} 중 {won(summary.used)} 사용
            </Text>
            <View style={{ gap: space.xs, marginTop: space.xs }}>
              {summary.details.map((d) => (
                <View key={d.accountId} style={styles.budgetLine}>
                  <Text variant="subhead" color="onPrimaryContainer" numberOfLines={1} style={{ flex: 1 }}>
                    {d.name}
                  </Text>
                  <Text variant="subhead" weight="600" color="onPrimaryContainer" tabular>
                    {signedWon(d.balance)} 남음
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Section>

      <RecentSection />
      <AccountSheet scope="overview" visible={pickAccounts} onClose={() => setPickAccounts(false)} title="예산 통장 선택" />
    </Screen>
  );
}

function EmptyBudget({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="headline" color="onPrimaryContainer">
        {title}
      </Text>
      <Text variant="subhead" color="onPrimaryContainer">
        {body}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  delta,
  positiveIsGood,
}: {
  label: string;
  value: number;
  delta: number | null;
  positiveIsGood?: boolean;
}) {
  const { c } = useTheme();
  const up = (delta ?? 0) >= 0;
  const good = positiveIsGood ? up : !up;
  return (
    <View style={[styles.stat, { backgroundColor: c.card }]}>
      <Text variant="footnote" color="text2">
        {label}
      </Text>
      <Text variant="headline" tabular numberOfLines={1} adjustsFontSizeToFit={false}>
        {won(value)}
      </Text>
      {delta === null ? (
        <Text variant="caption" weight="400" color="text2">
          지난달 기록 없음
        </Text>
      ) : (
        <View style={styles.delta}>
          <Icon name={up ? "income" : "expense"} size={14} color={good ? c.income : c.expense} />
          <Text variant="caption" style={{ color: good ? c.income : c.expense }}>
            지난달보다 {Math.abs(delta).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

function RecentSection() {
  const { data, accounts } = useLedger();
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!recent.length) return null;
  return (
    <Section title="최근 거래">
      {recent.map((item, index) => (
        <Row
          key={item.id}
          first={index === 0}
          title={item.name}
          meta={item.date}
          icon={item.type === "transfer" ? "transfer" : item.type === "income" ? "income" : "expense"}
          iconTone={item.type === "transfer" ? "neutral" : item.type === "income" ? "income" : "expense"}
          trailing={`${item.type === "income" ? "+" : item.type === "transfer" ? "↔ " : "−"}${won(item.amount)}`}
          trailingColor={item.type === "income" ? "income" : item.type === "transfer" ? "text2" : "text"}
          trailingMeta={accounts.find((a) => a.id === item.accountId)?.name}
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: space.md },
  stat: {
    flex: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.xs,
  },
  delta: { flexDirection: "row", alignItems: "center", gap: 2 },
  budgetLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
