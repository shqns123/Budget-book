"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CirclePlus, Settings2, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  accounts,
  accountDetails,
  formatNumber,
  hydrateLedgerSettings,
  initialTransactions,
  parseNumberInput,
  type Transaction,
  won,
} from "@/lib/ledger";
import {
  defaultSavingsGoals,
  defaultSavingsPlan,
  type SavingsEntry,
  type SavingsGoal,
  type MonthlySavingsPlan,
  type MonthlySavingsMonth,
  type SavingsPlanItem,
} from "@/lib/savings";
import { readSharedState, saveSharedState } from "@/lib/shared-state";

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [plan, setPlan] = useState<SavingsPlanItem[]>([]);
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlySavingsPlan[]>([]);
  const [monthlyMonths, setMonthlyMonths] = useState<MonthlySavingsMonth[]>([]);
  const [records, setRecords] = useState<Transaction[]>(initialTransactions);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [selectedGoalId, setSelectedGoalId] = useState("home");
  const [showForm, setShowForm] = useState(false);
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [showMonthlySettings, setShowMonthlySettings] = useState(false);
  const [draft, setDraft] = useState({
    goalId: "home",
    date: "2026-08-13",
    amount: "",
    accountId:
      accounts.find((account) => account.type === "savings")?.id ??
      accounts[0]?.id ??
      "",
    memo: "",
  });
  useEffect(() => {
    void readSharedState("settings", { accounts: [], categories: [] }).then(
      (settings) => {
        hydrateLedgerSettings(settings);
        setSettingsVersion((version) => version + 1);
      },
    );
    void Promise.all([
      readSharedState("savingsGoals", defaultSavingsGoals),
      readSharedState("savingsEntries", [] as SavingsEntry[]),
      readSharedState("savingsPlan", defaultSavingsPlan),
      readSharedState("monthlySavingsPlans", [] as MonthlySavingsPlan[]),
      readSharedState("monthlySavingsMonths", [] as MonthlySavingsMonth[]),
      readSharedState("transactions", initialTransactions),
    ]).then(([nextGoals, nextEntries, nextPlan, nextMonthlyPlans, nextMonthlyMonths, nextRecords]) => {
      setGoals(nextGoals);
      setEntries(nextEntries);
      setPlan(nextPlan);
      setMonthlyPlans(nextMonthlyPlans);
      const knownMonthKeys = new Set(
        nextMonthlyMonths.map((item) => `${item.goalId}:${item.month}`),
      );
      const migratedMonths = [
        ...nextMonthlyMonths,
        ...nextMonthlyPlans
          .filter((item) => !knownMonthKeys.has(`${item.goalId}:${item.month}`))
          .map((item) => ({
            id: crypto.randomUUID(),
            goalId: item.goalId,
            month: item.month,
          })),
      ];
      setMonthlyMonths(migratedMonths);
      if (migratedMonths.length !== nextMonthlyMonths.length) {
        void saveSharedState("monthlySavingsMonths", migratedMonths);
      }
      setRecords(nextRecords);
      if (!nextGoals.some((goal) => goal.id === selectedGoalId)) {
        setSelectedGoalId(nextGoals[0]?.id ?? "home");
      }
    });
  }, []);
  const savedByGoal = useMemo(
    () =>
      entries.reduce<Record<string, number>>((result, entry) => {
        result[entry.goalId] = (result[entry.goalId] ?? 0) + entry.amount;
        return result;
      }, {}),
    [entries],
  );
  function saveGoal(id: string, updates: Partial<SavingsGoal>) {
    const next = goals.map((goal) =>
      goal.id === id ? { ...goal, ...updates } : goal,
    );
    setGoals(next);
    void saveSharedState("savingsGoals", next);
  }
  function addEntry() {
    if (!draft.amount || !draft.goalId) return;
    const next = [
      {
        id: crypto.randomUUID(),
        goalId: draft.goalId,
        date: draft.date,
        amount: Number(draft.amount),
        accountId: draft.accountId,
        memo: draft.memo,
      },
      ...entries,
    ];
    setEntries(next);
    void saveSharedState("savingsEntries", next);
    setDraft((current) => ({ ...current, amount: "", memo: "" }));
    setShowForm(false);
  }
  function removeEntry(id: string) {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    void saveSharedState("savingsEntries", next);
  }
  function savePlan(items: SavingsPlanItem[]) {
    setPlan(items);
    void saveSharedState("savingsPlan", items);
    const totals = items.reduce<Record<string, number>>((result, item) => {
      result[item.goalId] = (result[item.goalId] ?? 0) + item.amount;
      return result;
    }, {});
    const nextGoals = goals.map((goal) => ({
      ...goal,
      targetAmount: totals[goal.id] ?? 0,
    }));
    setGoals(nextGoals);
    void saveSharedState("savingsGoals", nextGoals);
  }
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);
  const selectedPlan = plan.filter((item) => item.goalId === selectedGoalId);
  const selectedPlanTotal = selectedPlan.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const currentMonth = new Date().toISOString().slice(0, 7);
  const selectedMonthlyMonths = monthlyMonths
    .filter((item) => item.goalId === selectedGoalId)
    .sort((left, right) => left.month.localeCompare(right.month));
  function saveMonthlyPlans(items: MonthlySavingsPlan[]) {
    setMonthlyPlans(items);
    void saveSharedState("monthlySavingsPlans", items);
  }
  function saveMonthlyMonths(items: MonthlySavingsMonth[]) {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = `${item.goalId}:${item.month}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setMonthlyMonths(unique);
    void saveSharedState("monthlySavingsMonths", unique);
  }
  function updateMonthlyMonth(id: string, month: string) {
    const current = monthlyMonths.find((item) => item.id === id);
    if (!current) return;
    saveMonthlyMonths(
      monthlyMonths.map((item) => (item.id === id ? { ...item, month } : item)),
    );
    saveMonthlyPlans(
      monthlyPlans.map((item) =>
        item.goalId === current.goalId && item.month === current.month
          ? { ...item, month }
          : item,
      ),
    );
  }
  function removeMonthlyMonth(item: MonthlySavingsMonth) {
    const planIds = monthlyPlans
      .filter((planItem) => planItem.goalId === item.goalId && planItem.month === item.month)
      .map((planItem) => planItem.id);
    saveMonthlyMonths(monthlyMonths.filter((month) => month.id !== item.id));
    saveMonthlyPlans(
      monthlyPlans.filter(
        (planItem) => !(planItem.goalId === item.goalId && planItem.month === item.month),
      ),
    );
    const nextEntries = entries.filter(
      (entry) => !entry.monthlyPlanId || !planIds.includes(entry.monthlyPlanId),
    );
    setEntries(nextEntries);
    void saveSharedState("savingsEntries", nextEntries);
  }
  function updateMonthlyPlan(
    id: string,
    updates: Partial<MonthlySavingsPlan>,
  ) {
    saveMonthlyPlans(
      monthlyPlans.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  }
  function removeMonthlyPlan(id: string) {
    saveMonthlyPlans(monthlyPlans.filter((item) => item.id !== id));
    const nextEntries = entries.filter((entry) => entry.monthlyPlanId !== id);
    setEntries(nextEntries);
    void saveSharedState("savingsEntries", nextEntries);
  }
  function toggleMonthlyPlanRecord(item: MonthlySavingsPlan, checked: boolean) {
    const existing = entries.find((entry) => entry.monthlyPlanId === item.id);
    if (!checked) {
      const next = entries.filter((entry) => entry.id !== existing?.id);
      setEntries(next);
      void saveSharedState("savingsEntries", next);
      return;
    }
    if (item.amount <= 0) return;
    const entry: SavingsEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      goalId: item.goalId,
      date: `${item.month}-${String(new Date().getDate()).padStart(2, "0")}`,
      amount: item.amount,
      accountId: item.accountId,
      memo: `${Number(item.month.slice(5))}월 ${item.name}`,
      monthlyMonth: item.month,
      monthlyPlanId: item.id,
    };
    const next = existing
      ? entries.map((record) => (record.id === existing.id ? entry : record))
      : [entry, ...entries];
    setEntries(next);
    void saveSharedState("savingsEntries", next);
  }
  function openMonthlySettings() {
    setShowMonthlySettings(true);
  }
  function addGoal() {
    const goal = {
      id: crypto.randomUUID(),
      name: "새 저축 계획",
      targetAmount: 0,
    };
    const next = [...goals, goal];
    setGoals(next);
    void saveSharedState("savingsGoals", next);
    setSelectedGoalId(goal.id);
  }
  function removeGoal(id: string) {
    if (!window.confirm("이 저축 계획과 관련된 세부 계획·월 저축 계획·저축 기록을 모두 삭제할까요?")) {
      return;
    }
    const nextGoals = goals.filter((goal) => goal.id !== id);
    const nextPlan = plan.filter((item) => item.goalId !== id);
    const nextMonthlyPlans = monthlyPlans.filter((item) => item.goalId !== id);
    const nextEntries = entries.filter((entry) => entry.goalId !== id);
    setGoals(nextGoals);
    setPlan(nextPlan);
    setMonthlyPlans(nextMonthlyPlans);
    setEntries(nextEntries);
    void saveSharedState("savingsGoals", nextGoals);
    void saveSharedState("savingsPlan", nextPlan);
    void saveSharedState("monthlySavingsPlans", nextMonthlyPlans);
    void saveSharedState("savingsEntries", nextEntries);
    setSelectedGoalId(nextGoals[0]?.id ?? "");
    setShowPlanSettings(false);
  }
  const accountBalances = useMemo(() => {
    const amounts = new Map(
      accountDetails.map((account) => [
        account.id,
        account.openingBalance,
      ]),
    );
    const isLiability = (accountId: string) =>
      accountDetails.find((account) => account.id === accountId)
        ?.classification !== "asset";
    const apply = (accountId: string, assetChange: number) =>
      amounts.set(
        accountId,
        (amounts.get(accountId) ?? 0) +
          (isLiability(accountId) ? -assetChange : assetChange),
      );
    records.forEach((item) => {
      if (item.type === "income") apply(item.accountId, item.amount);
      if (item.type === "expense")
        apply(item.accountId, -Math.abs(item.amount));
      if (item.type === "transfer") {
        apply(item.accountId, -Math.abs(item.amount));
        if (item.toAccountId) apply(item.toAccountId, Math.abs(item.amount));
      }
    });
    return accountDetails.map((account) => ({
      account,
      amount: amounts.get(account.id) ?? 0,
    }));
  }, [records, settingsVersion]);
  function addAccountToPlan(accountId: string) {
    const found = accountBalances.find((item) => item.account.id === accountId);
    if (!found) return;
    savePlan([
      ...plan,
      {
        id: crypto.randomUUID(),
        goalId: selectedGoalId,
        accountId,
        name: found.account.name,
        amount: Math.abs(found.amount),
      },
    ]);
  }
  return (
    <AppShell>
      {() => (
        <>
          <section className="savings-summary">
            {selectedGoal &&
              (() => {
                const saved = savedByGoal[selectedGoal.id] ?? 0;
                const percent = selectedPlanTotal
                  ? Math.min(100, (saved / selectedPlanTotal) * 100)
                  : 0;
                return (
                  <article>
                    <div className="savings-summary-head">
                      <select
                        value={selectedGoalId}
                        onChange={(event) =>
                          setSelectedGoalId(event.target.value)
                        }
                        aria-label="저축 계획 선택"
                      >
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.name}
                          </option>
                        ))}
                      </select>
                      <div className="savings-summary-actions">
                        <button
                          className="savings-settings"
                          type="button"
                          onClick={openMonthlySettings}
                          aria-label="월별 예상 저축 설정"
                        >
                          <CalendarDays size={17} />
                        </button>
                        <button
                          className="savings-settings"
                          type="button"
                          onClick={() => setShowPlanSettings(true)}
                          aria-label="저축 계획 설정"
                        >
                          <Settings2 size={17} />
                        </button>
                      </div>
                    </div>
                    <input
                      value={selectedGoal.name}
                      onChange={(event) =>
                        saveGoal(selectedGoal.id, { name: event.target.value })
                      }
                      aria-label="저축 목표 이름"
                    />
                    <strong>{won(saved)}</strong>
                    <span>{Math.round(percent)}%</span>
                    <div className="progress">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                    <small>
                      남은 금액 {won(selectedPlanTotal - saved)}
                    </small>
                  </article>
                );
              })()}
          </section>
          <section className="savings-grid savings-record-grid">
            <article className="savings-surface">
              <h2>저축 기록</h2>
              {entries.filter((entry) => entry.goalId === selectedGoalId)
                .length ? (
                entries
                  .filter((entry) => entry.goalId === selectedGoalId)
                  .map((entry) => (
                    <div className="savings-entry" key={entry.id}>
                      <time>{entry.date}</time>
                      <span>
                        <b>
                          {entry.memo ||
                            goals.find((goal) => goal.id === entry.goalId)
                              ?.name}
                        </b>
                        <small>
                          {
                            accounts.find(
                              (account) => account.id === entry.accountId,
                            )?.name
                          }
                        </small>
                      </span>
                      <strong>+{won(entry.amount)}</strong>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        aria-label="저축 기록 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
              ) : (
                <p className="savings-empty">아직 기록된 저축이 없어요.</p>
              )}
            </article>
          </section>
          {showPlanSettings && selectedGoal && (
            <div className="sheet-backdrop">
              <section className="record-sheet savings-plan-sheet">
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => setShowPlanSettings(false)}
                  aria-label="저축 계획 설정 닫기"
                >
                  <X size={20} />
                </button>
                <h2>저축 계획 설정</h2>
                <div className="goal-setting-row">
                  <label>
                    저축 계획 이름
                    <input
                      value={selectedGoal.name}
                      onChange={(event) =>
                        saveGoal(selectedGoal.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="delete-goal"
                    onClick={() => removeGoal(selectedGoal.id)}
                  >
                    <Trash2 size={15} /> 계획 삭제
                  </button>
                </div>
                <p className="plan-target-note">
                  추구 저축 금액은 세부 계획 합계인 <strong>{won(selectedPlanTotal)}</strong>으로 자동 설정됩니다.
                </p>
                <h3>세부 계획</h3>
                {selectedPlan.map((item) => (
                  <div className="plan-item" key={item.id}>
                    <input
                      value={item.name}
                      onChange={(event) =>
                        savePlan(
                          plan.map((row) =>
                            row.id === item.id
                              ? { ...row, name: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(item.amount)}
                      onChange={(event) =>
                        savePlan(
                          plan.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  amount: Number(
                                    parseNumberInput(event.target.value),
                                  ),
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        savePlan(plan.filter((row) => row.id !== item.id))
                      }
                      aria-label="계획 항목 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="plan-setting-actions">
                  <button
                    className="add-plan-item"
                    type="button"
                    onClick={() =>
                      savePlan([
                        ...plan,
                        {
                          id: crypto.randomUUID(),
                          goalId: selectedGoalId,
                          name: "새 항목",
                          amount: 0,
                        },
                      ])
                    }
                  >
                    <CirclePlus size={15} /> 항목 추가
                  </button>
                  <select
                    className="add-plan-account"
                    defaultValue=""
                    onChange={(event) => {
                      if (event.target.value)
                        addAccountToPlan(event.target.value);
                      event.target.value = "";
                    }}
                  >
                    <option value="">보유 계좌 불러오기</option>
                    {accountBalances.map(({ account, amount }) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {won(Math.abs(amount))}
                      </option>
                    ))}
                  </select>
                </div>
                <footer className="plan-total">
                  <span>계획 합계</span>
                  <strong>
                    {won(
                      selectedPlan.reduce((sum, item) => sum + item.amount, 0),
                    )}
                  </strong>
                </footer>
                <button
                  className="add-savings-plan"
                  type="button"
                  onClick={addGoal}
                >
                  <CirclePlus size={17} /> 저축 계획 추가
                </button>
              </section>
            </div>
          )}
          {showMonthlySettings && selectedGoal && (
            <div className="sheet-backdrop">
              <section className="record-sheet monthly-savings-sheet">
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => setShowMonthlySettings(false)}
                  aria-label="월 저축 설정 닫기"
                >
                  <X size={20} />
                </button>
                <h2>월 저축 설정</h2>
                <p className="plan-target-note">
                  {selectedGoal.name}의 월별 예상 저축을 등록하고, 실제로 저축한 항목만 체크하세요.
                </p>
                <div className="monthly-plan-list">
                  {selectedMonthlyMonths.map((monthItem) => (
                    <section className="monthly-plan-group" key={monthItem.id}>
                      <header>
                        <input
                          value={monthItem.month}
                          onChange={(event) => updateMonthlyMonth(monthItem.id, event.target.value)}
                          placeholder="2026-08"
                          aria-label="저축 계획 연월"
                        />
                        <button type="button" onClick={() => removeMonthlyMonth(monthItem)} aria-label="연월 계획 삭제">
                          <Trash2 size={15} />
                        </button>
                      </header>
                      {monthlyPlans
                        .filter((item) => item.goalId === selectedGoalId && item.month === monthItem.month)
                        .map((item) => {
                          const completed = entries.some((entry) => entry.monthlyPlanId === item.id);
                          return (
                            <div className="monthly-plan-item" key={item.id}>
                              <input value={item.name} onChange={(event) => updateMonthlyPlan(item.id, { name: event.target.value })} aria-label="저축 항목" placeholder="예: 기본 저축, 상여" />
                              <input type="text" inputMode="numeric" value={formatNumber(item.amount)} onChange={(event) => updateMonthlyPlan(item.id, { amount: Number(parseNumberInput(event.target.value)) })} aria-label="예상 저축 금액" />
                              <label className="monthly-plan-check"><input type="checkbox" checked={completed} onChange={(event) => toggleMonthlyPlanRecord(item, event.target.checked)} />완료</label>
                              <button type="button" onClick={() => removeMonthlyPlan(item.id)} aria-label="월 저축 항목 삭제"><Trash2 size={15} /></button>
                            </div>
                          );
                        })}
                      <button
                        type="button"
                        className="add-monthly-plan-item"
                        onClick={() => saveMonthlyPlans([...monthlyPlans, { id: crypto.randomUUID(), goalId: selectedGoalId, month: monthItem.month, name: "새 항목", amount: 0, accountId: accounts.find((account) => account.type === "savings")?.id ?? accounts[0]?.id ?? "" }])}
                      ><CirclePlus size={14} /> 항목 추가</button>
                    </section>
                  ))}
                </div>
                <button
                  type="button"
                  className="add-plan-item"
                  onClick={() =>
                    saveMonthlyMonths([
                      ...monthlyMonths,
                      { id: crypto.randomUUID(), goalId: selectedGoalId, month: currentMonth },
                    ])
                  }
                >
                  <CirclePlus size={15} /> 연·월 추가
                </button>
              </section>
            </div>
          )}
          {showForm && (
            <div className="sheet-backdrop">
              <form
                className="record-sheet savings-sheet"
                onSubmit={(event) => {
                  event.preventDefault();
                  addEntry();
                }}
              >
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => setShowForm(false)}
                >
                  ×
                </button>
                <h2>저축 기록</h2>
                <label>
                  목표
                  <select
                    value={draft.goalId}
                    onChange={(event) =>
                      setDraft({ ...draft, goalId: event.target.value })
                    }
                  >
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  날짜
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      setDraft({ ...draft, date: event.target.value })
                    }
                  />
                </label>
                <label>
                  저축 통장
                  <select
                    value={draft.accountId}
                    onChange={(event) =>
                      setDraft({ ...draft, accountId: event.target.value })
                    }
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  금액
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(draft.amount)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        amount: parseNumberInput(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  메모
                  <input
                    value={draft.memo}
                    onChange={(event) =>
                      setDraft({ ...draft, memo: event.target.value })
                    }
                    placeholder="예: 8월 저축"
                  />
                </label>
                <button className="save-record" type="submit">
                  저축 기록 추가
                </button>
              </form>
            </div>
          )}
          <button
            className="floating-add"
            onClick={() => {
              setDraft((current) => ({ ...current, goalId: selectedGoalId }));
              setShowForm(true);
            }}
            aria-label="저축 기록 추가"
          >
            <CirclePlus size={25} />
          </button>
        </>
      )}
    </AppShell>
  );
}
