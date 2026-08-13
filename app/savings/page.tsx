"use client";

import { useEffect, useMemo, useState } from "react";
import { CirclePlus, Settings2, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { accounts, formatNumber, parseNumberInput, won } from "@/lib/ledger";
import importedLedger from "@/data/imported-ledger.json";
import {
  readSavingsEntries,
  readSavingsGoals,
  readSavingsPlan,
  saveSavingsEntries,
  saveSavingsGoals,
  saveSavingsPlan,
  type SavingsEntry,
  type SavingsGoal,
  type SavingsPlanItem,
} from "@/lib/savings";

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [plan, setPlan] = useState<SavingsPlanItem[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState("home");
  const [showForm, setShowForm] = useState(false);
  const [showPlanSettings, setShowPlanSettings] = useState(false);
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
    setGoals(readSavingsGoals());
    setEntries(readSavingsEntries());
    setPlan(readSavingsPlan());
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
    saveSavingsGoals(next);
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
    saveSavingsEntries(next);
    setDraft((current) => ({ ...current, amount: "", memo: "" }));
    setShowForm(false);
  }
  function removeEntry(id: string) {
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    saveSavingsEntries(next);
  }
  function savePlan(items: SavingsPlanItem[]) {
    setPlan(items);
    saveSavingsPlan(items);
  }
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);
  const selectedPlan = plan.filter((item) => item.goalId === selectedGoalId);
  function addGoal() {
    const goal = {
      id: crypto.randomUUID(),
      name: "새 저축 계획",
      targetAmount: 0,
    };
    const next = [...goals, goal];
    setGoals(next);
    saveSavingsGoals(next);
    setSelectedGoalId(goal.id);
  }
  const accountBalances = useMemo(() => {
    const amounts = new Map(
      importedLedger.accounts.map((account) => [
        account.id,
        account.openingBalance,
      ]),
    );
    const isLiability = (accountId: string) =>
      importedLedger.accounts.find((account) => account.id === accountId)
        ?.classification !== "asset";
    const apply = (accountId: string, assetChange: number) =>
      amounts.set(
        accountId,
        (amounts.get(accountId) ?? 0) +
          (isLiability(accountId) ? -assetChange : assetChange),
      );
    importedLedger.transactions.forEach((item) => {
      if (item.type === "income") apply(item.accountId, item.amount);
      if (item.type === "expense") apply(item.accountId, -item.amount);
      if (item.type === "transfer") {
        apply(item.accountId, -item.amount);
        if (item.toAccountId) apply(item.toAccountId, item.amount);
      }
    });
    return importedLedger.accounts.map((account) => ({
      account,
      amount: amounts.get(account.id) ?? 0,
    }));
  }, []);
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
                const percent = selectedGoal.targetAmount
                  ? Math.min(100, (saved / selectedGoal.targetAmount) * 100)
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
                      <button
                        className="savings-settings"
                        type="button"
                        onClick={() => setShowPlanSettings(true)}
                        aria-label="저축 계획 설정"
                      >
                        <Settings2 size={17} />
                      </button>
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
                      남은 금액 {won(selectedGoal.targetAmount - saved)}
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
                <label>
                  추구 저축 금액
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(selectedGoal.targetAmount)}
                    onChange={(event) =>
                      saveGoal(selectedGoal.id, {
                        targetAmount: Number(
                          parseNumberInput(event.target.value),
                        ),
                      })
                    }
                  />
                </label>
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
