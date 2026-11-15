import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  CheckRow,
  DateField,
  EmptyState,
  FieldRow,
  IconButton,
  MoneyField,
  OptionSheet,
  PrimaryButton,
  ProgressBar,
  Row,
  Screen,
  SecondaryButton,
  Section,
  SelectField,
  Sheet,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import { currentMonth, shiftMonth, shortDate, todayIso } from "@/lib/dates";
import { calculateAccountBalances, formatNumber, newId, won } from "@/lib/ledger";
import type { MonthlySavingsMonth, MonthlySavingsPlan, SavingsEntry, SavingsPlanItem } from "@/lib/savings";
import { useLedger } from "@/store/ledger-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { confirm } from "@/lib/confirm";

const TYPING = { debounce: 500 };

export default function SavingsScreen() {
  const { c } = useTheme();
  const { data, accounts, save, status } = useLedger();
  const goals = data.savingsGoals;
  const entries = data.savingsEntries;
  const plan = data.savingsPlan;
  const monthlyPlans = data.monthlySavingsPlans;
  const monthlyMonths = data.monthlySavingsMonths;

  const [pickedGoalId, setSelectedGoalId] = useState("home");
  const selectedGoalId = goals.some((g) => g.id === pickedGoalId) ? pickedGoalId : (goals[0]?.id ?? "");
  const [showForm, setShowForm] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [pickAccount, setPickAccount] = useState(false);
  const defaultSavingsAccount = accounts.find((a) => a.type === "savings")?.id ?? accounts[0]?.id ?? "";
  const [draft, setDraft] = useState({ goalId: "home", date: todayIso(), amount: "", accountId: "", memo: "" });

  // Months that only exist in older monthly plans get their own month entry (web migration).
  useEffect(() => {
    if (status !== "ready") return;
    const known = new Set(monthlyMonths.map((m) => `${m.goalId}:${m.month}`));
    const missing = monthlyPlans.filter((p) => !known.has(`${p.goalId}:${p.month}`));
    if (!missing.length) return;
    const seen = new Set<string>();
    const additions = missing
      .filter((p) => {
        const key = `${p.goalId}:${p.month}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => ({ id: newId(), goalId: p.goalId, month: p.month }));
    void save("monthlySavingsMonths", [...monthlyMonths, ...additions]);
  }, [status, monthlyMonths, monthlyPlans, save]);

  const balances = useMemo(() => {
    const amounts = calculateAccountBalances(accounts, data.transactions);
    return accounts.map((account) => ({ account, amount: amounts.get(account.id) ?? 0 }));
  }, [accounts, data.transactions]);

  const resolvePlanAmount = (item: SavingsPlanItem) => {
    if (!item.accountId) return item.amount;
    const linked = balances.find(({ account }) => account.id === item.accountId);
    return linked ? Math.abs(linked.amount) : item.amount;
  };

  const goal = goals.find((g) => g.id === selectedGoalId);
  const goalPlan = plan.filter((p) => p.goalId === selectedGoalId);
  const planTotal = goalPlan.reduce((sum, item) => sum + resolvePlanAmount(item), 0);
  const saved = entries.filter((e) => e.goalId === selectedGoalId).reduce((sum, e) => sum + e.amount, 0);
  const percent = planTotal ? Math.min(100, (saved / planTotal) * 100) : 0;
  const goalEntries = entries.filter((e) => e.goalId === selectedGoalId);

  const renameGoal = (name: string) =>
    void save("savingsGoals", (rows) => rows.map((g) => (g.id === selectedGoalId ? { ...g, name } : g)), TYPING);

  const savePlan = (items: SavingsPlanItem[], options?: { debounce?: number }) => {
    void save("savingsPlan", items, options);
    const sums = items.reduce<Record<string, number>>((result, item) => {
      result[item.goalId] = (result[item.goalId] ?? 0) + resolvePlanAmount(item);
      return result;
    }, {});
    void save("savingsGoals", (rows) => rows.map((g) => ({ ...g, targetAmount: sums[g.id] ?? 0 })), options);
  };

  const addEntry = () => {
    if (!draft.amount || !draft.goalId) return;
    const entry: SavingsEntry = {
      id: newId(),
      goalId: draft.goalId,
      date: draft.date,
      amount: Number(draft.amount),
      accountId: draft.accountId || defaultSavingsAccount,
      memo: draft.memo,
    };
    void save("savingsEntries", [entry, ...entries]);
    setDraft((d) => ({ ...d, amount: "", memo: "" }));
    setShowForm(false);
  };

  const removeEntry = async (entry: SavingsEntry) => {
    const ok = await confirm({
      title: "저축 기록을 삭제할까요?",
      message: `${entry.memo || goal?.name || ""} ${won(entry.amount)}`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (ok) void save("savingsEntries", entries.filter((e) => e.id !== entry.id));
  };

  const addGoal = () => {
    const next = { id: newId(), name: "새 저축 계획", targetAmount: 0 };
    void save("savingsGoals", [...goals, next]);
    setSelectedGoalId(next.id);
  };

  const removeGoal = async (id: string) => {
    const ok = await confirm({
      title: "저축 계획을 삭제할까요?",
      message: "이 계획의 세부 계획, 월 저축 계획, 저축 기록이 모두 삭제돼요.",
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    const nextGoals = goals.filter((g) => g.id !== id);
    void save("savingsGoals", nextGoals);
    void save("savingsPlan", plan.filter((p) => p.goalId !== id));
    void save("monthlySavingsPlans", monthlyPlans.filter((p) => p.goalId !== id));
    void save("savingsEntries", entries.filter((e) => e.goalId !== id));
    setSelectedGoalId(nextGoals[0]?.id ?? "");
    setShowPlan(false);
  };

  // Monthly plans
  const goalMonths = monthlyMonths
    .filter((m) => m.goalId === selectedGoalId)
    .sort((a, b) => a.month.localeCompare(b.month));
  const nextMonth = (() => {
    const latest = goalMonths.map((m) => m.month).sort().at(-1);
    return latest && /^\d{4}-\d{2}$/.test(latest) ? shiftMonth(latest, 1) : currentMonth();
  })();
  const saveMonths = (items: MonthlySavingsMonth[], options?: { debounce?: number }) => {
    const seen = new Set<string>();
    void save(
      "monthlySavingsMonths",
      items.filter((item) => {
        const key = `${item.goalId}:${item.month}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
      options,
    );
  };
  const updateMonth = (item: MonthlySavingsMonth, month: string) => {
    saveMonths(monthlyMonths.map((m) => (m.id === item.id ? { ...m, month } : m)), TYPING);
    void save(
      "monthlySavingsPlans",
      monthlyPlans.map((p) => (p.goalId === item.goalId && p.month === item.month ? { ...p, month } : p)),
      TYPING,
    );
  };
  const removeMonth = (item: MonthlySavingsMonth) => {
    const planIds = monthlyPlans
      .filter((p) => p.goalId === item.goalId && p.month === item.month)
      .map((p) => p.id);
    saveMonths(monthlyMonths.filter((m) => m.id !== item.id));
    void save(
      "monthlySavingsPlans",
      monthlyPlans.filter((p) => !(p.goalId === item.goalId && p.month === item.month)),
    );
    void save(
      "savingsEntries",
      entries.filter((e) => !e.monthlyPlanId || !planIds.includes(e.monthlyPlanId)),
    );
  };
  const updateMonthlyPlan = (id: string, updates: Partial<MonthlySavingsPlan>) =>
    void save("monthlySavingsPlans", (rows) => rows.map((p) => (p.id === id ? { ...p, ...updates } : p)), TYPING);
  const removeMonthlyPlan = (id: string) => {
    void save("monthlySavingsPlans", monthlyPlans.filter((p) => p.id !== id));
    void save("savingsEntries", entries.filter((e) => e.monthlyPlanId !== id));
  };
  const toggleMonthlyRecord = (item: MonthlySavingsPlan, checked: boolean) => {
    const existing = entries.find((e) => e.monthlyPlanId === item.id);
    if (!checked) {
      void save("savingsEntries", entries.filter((e) => e.id !== existing?.id));
      return;
    }
    if (item.amount <= 0) return;
    const entry: SavingsEntry = {
      id: existing?.id ?? newId(),
      goalId: item.goalId,
      date: `${item.month}-${String(new Date().getDate()).padStart(2, "0")}`,
      amount: item.amount,
      accountId: item.accountId,
      memo: `${Number(item.month.slice(5))}월 ${item.name}`,
      monthlyMonth: item.month,
      monthlyPlanId: item.id,
    };
    void save("savingsEntries", existing ? entries.map((e) => (e.id === existing.id ? entry : e)) : [entry, ...entries]);
  };

  return (
    <Screen
      title="저축 내역"
      back
      inTabs={false}
      right={
        goal ? (
          <>
            <IconButton icon="calendar" label="월 저축 설정" onPress={() => setShowMonthly(true)} />
            <IconButton icon="settings" label="저축 계획 설정" onPress={() => setShowPlan(true)} />
          </>
        ) : null
      }
    >
      {goals.length > 1 && (
        <SelectField
          label="저축 계획"
          value={selectedGoalId}
          options={goals.map((g) => ({ value: g.id, label: g.name }))}
          onChange={setSelectedGoalId}
        />
      )}

      {goal ? (
        <Section tone="accent" padded>
          <View style={{ gap: space.md }}>
            <Text variant="headline" color="onPrimaryContainer">
              {goal.name}
            </Text>
            <View style={styles.amountLine}>
              <Text variant="title1" color="onPrimaryContainer" tabular style={{ flexShrink: 1 }}>
                {won(saved)}
              </Text>
              <Text variant="headline" color="onPrimaryContainer">
                {Math.round(percent)}%
              </Text>
            </View>
            <ProgressBar value={percent} />
            <Text variant="footnote" weight="400" color="onPrimaryContainer">
              목표 {won(planTotal)} · 남은 금액 {won(planTotal - saved)}
            </Text>
          </View>
        </Section>
      ) : (
        <Section padded>
          <EmptyState title="저축 계획이 없어요" body="계획을 추가하면 목표와 기록을 함께 볼 수 있어요." />
          <SecondaryButton label="저축 계획 추가" icon="plus" onPress={addGoal} />
        </Section>
      )}

      {goal && (
        <PrimaryButton
          label="저축 기록 추가"
          icon="plus"
          onPress={() => {
            setDraft((d) => ({ ...d, goalId: selectedGoalId, accountId: d.accountId || defaultSavingsAccount }));
            setShowForm(true);
          }}
        />
      )}

      {goal && (
        <Section title="저축 기록">
          {goalEntries.length ? (
            goalEntries.map((entry, index) => (
              <Row
                key={entry.id}
                first={index === 0}
                title={entry.memo || goal.name}
                meta={`${shortDate(entry.date)} · ${accounts.find((a) => a.id === entry.accountId)?.name ?? ""}`}
                trailing={`+${won(entry.amount)}`}
                trailingColor="income"
                onPress={() => removeEntry(entry)}
                accessibilityLabel={`${entry.memo || goal.name} ${won(entry.amount)}, 눌러서 삭제`}
              />
            ))
          ) : (
            <EmptyState title="아직 기록된 저축이 없어요" />
          )}
        </Section>
      )}

      {/* 저축 기록 추가 */}
      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title="저축 기록"
        footer={<PrimaryButton label="저축 기록 추가" disabled={!draft.amount} onPress={addEntry} />}
      >
        <SelectField
          label="목표"
          value={draft.goalId}
          options={goals.map((g) => ({ value: g.id, label: g.name }))}
          onChange={(goalId) => setDraft({ ...draft, goalId })}
        />
        <MoneyField label="금액" value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} />
        <DateField label="날짜" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
        <SelectField
          label="저축 통장"
          value={draft.accountId || defaultSavingsAccount}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(accountId) => setDraft({ ...draft, accountId })}
        />
        <TextField
          label="메모"
          value={draft.memo}
          onChangeText={(memo) => setDraft({ ...draft, memo })}
          placeholder="예: 8월 저축"
        />
      </Sheet>

      {/* 저축 계획 설정 */}
      <Sheet visible={showPlan && Boolean(goal)} onClose={() => setShowPlan(false)} title="저축 계획 설정">
        {goal && (
          <>
            <TextField label="저축 계획 이름" defaultValue={goal.name} onChangeText={renameGoal} />
            <Text variant="footnote" weight="400" color="text2">
              목표 금액은 세부 계획 합계인 {won(planTotal)}으로 자동 설정돼요. 통장을 불러온 항목은 그 통장의 현재 잔액을 따라가요.
            </Text>
            <Section title="세부 계획">
              <View style={{ padding: space.lg, gap: space.md }}>
                {goalPlan.map((item) => (
                  <View key={item.id} style={styles.planRow}>
                    <TextField
                      compact
                      defaultValue={item.name}
                      accessibilityLabel="계획 항목 이름"
                      onChangeText={(name) =>
                        savePlan(plan.map((p) => (p.id === item.id ? { ...p, name } : p)), TYPING)
                      }
                      style={{ flex: 1.2 }}
                    />
                    {item.accountId ? (
                      <View style={[styles.readonly, { backgroundColor: c.subtle }]}>
                        <Text variant="subhead" color="text2" tabular numberOfLines={1}>
                          {formatNumber(resolvePlanAmount(item))}원
                        </Text>
                      </View>
                    ) : (
                      <MoneyField
                        compact
                        accessibilityLabel={`${item.name} 계획 금액`}
                        value={item.amount}
                        onChange={(digits) =>
                          savePlan(plan.map((p) => (p.id === item.id ? { ...p, amount: Number(digits) } : p)), TYPING)
                        }
                      />
                    )}
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`${item.name} 삭제`}
                      onPress={() => savePlan(plan.filter((p) => p.id !== item.id))}
                    />
                  </View>
                ))}
                <View style={styles.actionsRow}>
                  <TextButton
                    icon="plus"
                    label="항목 추가"
                    onPress={() =>
                      savePlan([...plan, { id: newId(), goalId: selectedGoalId, name: "새 항목", amount: 0 }])
                    }
                  />
                  <TextButton icon="bank" label="보유 계좌 불러오기" onPress={() => setPickAccount(true)} />
                </View>
                <View style={styles.totalRow}>
                  <Text variant="subhead" color="text2">
                    계획 합계
                  </Text>
                  <Text variant="headline" tabular>
                    {won(planTotal)}
                  </Text>
                </View>
              </View>
            </Section>
            <SecondaryButton icon="plus" label="저축 계획 추가" onPress={addGoal} />
            <SecondaryButton icon="trash" tone="danger" label="이 계획 삭제" onPress={() => removeGoal(goal.id)} />
          </>
        )}
      </Sheet>
      <OptionSheet
        visible={pickAccount}
        title="보유 계좌 불러오기"
        value=""
        options={balances.map(({ account, amount }) => ({
          value: account.id,
          label: account.name,
          meta: won(Math.abs(amount)),
        }))}
        onClose={() => setPickAccount(false)}
        onSelect={(accountId) => {
          const found = balances.find((b) => b.account.id === accountId);
          setPickAccount(false);
          if (!found) return;
          savePlan([
            ...plan,
            {
              id: newId(),
              goalId: selectedGoalId,
              accountId,
              name: found.account.name,
              amount: Math.abs(found.amount),
            },
          ]);
        }}
      />

      {/* 월 저축 설정 */}
      <Sheet
        visible={showMonthly && Boolean(goal)}
        onClose={() => setShowMonthly(false)}
        title="월 저축 설정"
        subtitle={goal ? `${goal.name}의 월별 예상 저축을 등록하고, 실제로 저축한 항목만 완료로 체크해요.` : undefined}
      >
        {goalMonths.map((monthItem) => (
          <Section
            key={monthItem.id}
            title={monthItem.month}
            action={<TextButton label="연월 삭제" tone="danger" onPress={() => removeMonth(monthItem)} />}
          >
            <View style={{ padding: space.lg, gap: space.md }}>
              <TextField
                compact
                label="연월 (YYYY-MM)"
                defaultValue={monthItem.month}
                keyboardType="numbers-and-punctuation"
                onChangeText={(value) => updateMonth(monthItem, value)}
              />
              {monthlyPlans
                .filter((p) => p.goalId === selectedGoalId && p.month === monthItem.month)
                .map((item) => {
                  const completed = entries.some((e) => e.monthlyPlanId === item.id);
                  return (
                    <View key={item.id} style={[styles.monthlyItem, { backgroundColor: c.bg }]}>
                      <FieldRow>
                        <TextField
                          compact
                          defaultValue={item.name}
                          placeholder="예: 기본 저축, 상여"
                          accessibilityLabel="저축 항목"
                          onChangeText={(name) => updateMonthlyPlan(item.id, { name })}
                        />
                        <MoneyField
                          compact
                          accessibilityLabel="예상 저축 금액"
                          value={item.amount}
                          onChange={(digits) => updateMonthlyPlan(item.id, { amount: Number(digits) })}
                        />
                      </FieldRow>
                      <View style={styles.planRow}>
                        <View style={{ flex: 1 }}>
                          <CheckRow
                            label="완료"
                            meta={completed ? "저축 기록에 추가됨" : undefined}
                            checked={completed}
                            onToggle={() => toggleMonthlyRecord(item, !completed)}
                          />
                        </View>
                        <IconButton
                          icon="trash"
                          tone="danger"
                          label="월 저축 항목 삭제"
                          onPress={() => removeMonthlyPlan(item.id)}
                        />
                      </View>
                    </View>
                  );
                })}
              <TextButton
                icon="plus"
                label="항목 추가"
                onPress={() =>
                  void save("monthlySavingsPlans", [
                    ...monthlyPlans,
                    {
                      id: newId(),
                      goalId: selectedGoalId,
                      month: monthItem.month,
                      name: "새 항목",
                      amount: 0,
                      accountId: defaultSavingsAccount,
                    },
                  ])
                }
              />
            </View>
          </Section>
        ))}
        <SecondaryButton
          icon="plus"
          label="연·월 추가"
          onPress={() => saveMonths([...monthlyMonths, { id: newId(), goalId: selectedGoalId, month: nextMonth }])}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  planRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  readonly: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  actionsRow: { flexDirection: "row", gap: space.lg, flexWrap: "wrap" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: space.sm },
  monthlyItem: { borderRadius: radius.card, padding: space.md, gap: space.sm },
});
