"use client";

import { ArrowDownRight, ArrowUpRight, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { accounts, initialTransactions, won } from "@/lib/ledger";
import { type MonthlyBudget } from "@/lib/budgets";
import { readSharedState } from "@/lib/shared-state";

export default function OverviewPage() {
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [records, setRecords] = useState(initialTransactions);
  const [showAccounts, setShowAccounts] = useState(false);
  const budgetMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void readSharedState("budgets", [] as MonthlyBudget[]).then(setBudgets);
    void readSharedState("transactions", initialTransactions).then(setRecords);
  }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!budgetMenuRef.current?.contains(event.target as Node))
        setShowAccounts(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <AppShell>
      {({ selected, month, updateSelected, saveSelected }) => {
        const inMonth = records.filter((item) =>
          item.date.startsWith(month.replace("-", ".")),
        );
        const filtered = selected.length
          ? inMonth.filter(
              (item) =>
                selected.includes(item.accountId) ||
                (item.toAccountId && selected.includes(item.toAccountId)),
            )
          : inMonth;
        const income = inMonth
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + item.amount, 0);
        const expense = inMonth
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        const selectedBudgets = selected.length
          ? budgets.filter((item) => selected.includes(item.accountId))
          : [];
        const budget = selectedBudgets.reduce(
          (sum, item) => sum + item.amount,
          0,
        );
        const budgetedExpense = filtered
          .filter(
            (item) =>
              item.type === "expense" && selected.includes(item.accountId),
          )
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        const budgetDetails = selectedBudgets.map((budgetItem) => ({
          ...budgetItem,
          used: filtered
            .filter(
              (item) =>
                item.type === "expense" &&
                item.accountId === budgetItem.accountId,
            )
            .reduce((sum, item) => sum + Math.abs(item.amount), 0),
        }));
        return (
          <>
            <section className="overview-cards">
              <article>
                <span>이번 달 수입</span>
                <strong>{won(income)}</strong>
                <small className="up">
                  <ArrowUpRight size={13} /> 지난달보다 4.1%
                </small>
              </article>
              <article>
                <span>이번 달 지출</span>
                <strong>{won(expense)}</strong>
                <small className="down">
                  <ArrowDownRight size={13} /> 지난달보다 12.0%
                </small>
              </article>
              <article className="overview-budget" ref={budgetMenuRef}>
                <button
                  className="budget-settings-link"
                  onClick={() => setShowAccounts(!showAccounts)}
                  aria-label="통장 선택"
                >
                  <Settings size={15} />
                </button>
                <span>{budget ? "이번 달 남은 예산" : "이번 달 예산"}</span>
                {showAccounts && (
                  <div className="budget-account-menu">
                    <div className="budget-account-actions">
                      <button
                        onClick={() => {
                          updateSelected([]);
                        }}
                      >
                        전체 통장
                      </button>
                      <button
                        className="budget-selection-save"
                        onClick={saveSelected}
                      >
                        저장
                      </button>
                    </div>
                    <div className="budget-account-list">
                      {accounts.map((account) => (
                        <label key={account.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(account.id)}
                            onChange={() => {
                              updateSelected(
                                selected.includes(account.id)
                                  ? selected.filter((id) => id !== account.id)
                                  : [...selected, account.id],
                              );
                            }}
                          />
                          {account.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <strong
                  className={!selected.length || !budget ? "budget-empty" : ""}
                >
                  {!selected.length
                    ? "통장을 선택해 주세요"
                    : budget
                      ? won(budget - budgetedExpense)
                      : "예산이 지정되지 않았어요"}
                </strong>
                {selected.length && budget ? (
                  <>
                    <div className="progress">
                      <i
                        style={{
                          width: `${Math.min(100, (budgetedExpense / budget) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>
                      예산 {won(budget)} 중 {won(budgetedExpense)} 사용
                    </small>
                    <div className="budget-preview">
                      {budgetDetails.slice(0, 2).map((item) => (
                        <span key={item.accountId}>
                          {
                            accounts.find(
                              (account) => account.id === item.accountId,
                            )?.name
                          }{" "}
                          {won(item.amount - item.used)} 남음
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <small>
                    {selected.length
                      ? "선택한 통장에는 이번 달 예산이 지정되지 않았어요."
                      : "상단에서 예산을 확인할 통장을 선택해 주세요."}
                  </small>
                )}
              </article>
            </section>
            <section className="overview-recent">
              <header>
                <h2>최근 거래</h2>
                <a href="/transactions">전체 보기 →</a>
              </header>
              {filtered.slice(0, 5).map((item) => (
                <article key={item.id}>
                  <i>
                    {item.type === "income" ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                  </i>
                  <div>
                    <b>{item.name}</b>
                    <small>
                      {item.category} ·{" "}
                      {
                        accounts.find(
                          (account) => account.id === item.accountId,
                        )?.name
                      }
                    </small>
                  </div>
                  <time>{item.date}</time>
                  <strong className={item.type === "income" ? "up" : ""}>
                    {item.type === "income" ? "+" : "−"}
                    {won(item.amount)}
                  </strong>
                </article>
              ))}
            </section>
          </>
        );
      }}
    </AppShell>
  );
}
