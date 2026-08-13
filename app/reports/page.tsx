"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { initialTransactions, type Transaction, won } from "@/lib/ledger";
import { readSharedState } from "@/lib/shared-state";

type Scope = { month: string };

function totals(items: Transaction[]) {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const fixedExpense = items
    .filter((item) => item.type === "expense" && item.fixed)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  return {
    income,
    expense,
    fixedExpense,
    variableExpense: expense - fixedExpense,
  };
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [records, setRecords] = useState<Transaction[]>(initialTransactions);
  useEffect(() => {
    void readSharedState("transactions", initialTransactions).then(setRecords);
  }, []);
  return (
    <AppShell>
      {(scope) => (
        <>
          <section className="report-controls">
            <div className="period-tabs">
              <button
                onClick={() => setPeriod("month")}
                className={period === "month" ? "active" : ""}
              >
                월간
              </button>
              <button
                onClick={() => setPeriod("year")}
                className={period === "year" ? "active" : ""}
              >
                연간
              </button>
            </div>
          </section>
          {period === "month" ? (
            <MonthlyReport scope={scope} records={records} />
          ) : (
            <YearlyReport scope={scope} records={records} />
          )}
        </>
      )}
    </AppShell>
  );
}

function MonthlyReport({
  scope,
  records,
}: {
  scope: Scope;
  records: Transaction[];
}) {
  const current = records.filter((item) =>
    item.date.replaceAll(".", "-").startsWith(scope.month),
  );
  const [year, month] = scope.month.split("-").map(Number);
  const previousKey = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
  const previous = records.filter((item) =>
    item.date.replaceAll(".", "-").startsWith(previousKey),
  );
  const now = totals(current);
  const before = totals(previous);
  const categoryTotals = Object.entries(
    current
      .filter((item) => item.type === "expense")
      .reduce<Record<string, number>>((result, item) => {
        result[item.category] =
          (result[item.category] ?? 0) + Math.abs(item.amount);
        return result;
      }, {}),
  ).sort((left, right) => right[1] - left[1]);
  const topExpenses = current
    .filter((item) => item.type === "expense")
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .slice(0, 4);
  const ratio = now.income
    ? Number(((now.expense / now.income) * 100).toFixed(1))
    : 0;
  const fixedRatio = now.expense
    ? Math.round((now.fixedExpense / now.expense) * 100)
    : 0;
  return (
    <>
      <section className="report-metrics">
        <Metric label="이번 달 총수입" value={now.income} />
        <Metric label="이번 달 총지출" value={-now.expense} />
        <Metric label="이번 달 순수입" value={now.income - now.expense} />
        <Metric label="수입 대비 지출" value={ratio} percentage />
      </section>
      <section className="report-grid">
        <article className="report-surface">
          <header>
            <div>
              <h2>분류별 지출</h2>
            </div>
            <span>이번 달</span>
          </header>
          {categoryTotals.map(([category, amount]) => (
            <div className="report-category" key={category}>
              <b>{category}</b>
              <strong>−{won(amount)}</strong>
              <ChevronRight size={15} />
            </div>
          ))}
        </article>
        <article className="report-surface top-expenses">
          <h2>이번 달 큰 지출</h2>
          {topExpenses.map((item, index) => (
            <div key={item.id}>
              <span>#{index + 1}</span>
              <b>{item.name}</b>
              <strong>−{won(item.amount)}</strong>
            </div>
          ))}
        </article>
      </section>
      <section className="report-surface fixed-report">
        <header>
          <div>
            <h2>고정비와 변동비</h2>
          </div>
          <span>이번 달 지출 기준</span>
        </header>
        <div className="fixed-bars">
          <div>
            <b>고정비</b>
            <i>
              <span style={{ width: `${fixedRatio}%` }} />
            </i>
            <strong>
              {won(now.fixedExpense)} · {fixedRatio}%
            </strong>
          </div>
          <div>
            <b>변동비</b>
            <i>
              <span style={{ width: `${100 - fixedRatio}%` }} />
            </i>
            <strong>
              {won(now.variableExpense)} · {100 - fixedRatio}%
            </strong>
          </div>
        </div>
      </section>
    </>
  );
}

function YearlyReport({
  scope,
  records,
}: {
  scope: Scope;
  records: Transaction[];
}) {
  const year = scope.month.slice(0, 4);
  const rows = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const values = totals(
      records.filter((item) => item.date.replaceAll(".", "-").startsWith(key)),
    );
    return { month: `${index + 1}월`, ...values };
  });
  const annual = rows.reduce(
    (sum, row) => ({
      income: sum.income + row.income,
      expense: sum.expense + row.expense,
      fixedExpense: sum.fixedExpense + row.fixedExpense,
    }),
    { income: 0, expense: 0, fixedExpense: 0 },
  );
  const high = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]));
  const fixedRatio = annual.expense
    ? Number(((annual.fixedExpense / annual.expense) * 100).toFixed(1))
    : 0;
  return (
    <>
      <section className="report-metrics">
        <Metric label="연간 총수입" value={annual.income} />
        <Metric label="연간 총지출" value={-annual.expense} />
        <Metric label="연간 순수입" value={annual.income - annual.expense} />
        <Metric label="고정비 지출 비율" value={fixedRatio} percentage />
      </section>
      <section className="report-surface yearly-surface">
        <header>
          <div>
            <h2>월별 수입과 지출</h2>
          </div>
          <span>{year}년</span>
        </header>
        <div className="annual-chart">
          {rows.map((row) => (
            <div className="annual-column" key={row.month}>
              <div className="chart-pair">
                <i
                  className="income-bar"
                  style={{ height: `${(row.income / high) * 160}px` }}
                />
                <i
                  className="expense-bar"
                  style={{ height: `${(row.expense / high) * 160}px` }}
                />
              </div>
              <b>{row.month}</b>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span>
            <i className="income-bar" />
            수입
          </span>
          <span>
            <i className="expense-bar" />
            지출
          </span>
        </div>
      </section>
      <section className="report-surface annual-table">
        <header>
          <div>
            <h2>월별 상세</h2>
          </div>
          <span>고정·변동 지출 포함</span>
        </header>
        {rows.map((row) => (
          <div key={row.month}>
            <b>{row.month}</b>
            <span>+{won(row.income)}</span>
            <span>−{won(row.expense)}</span>
            <strong className={row.income - row.expense >= 0 ? "up" : "down"}>
              {row.income - row.expense >= 0 ? "+" : "−"}
              {won(row.income - row.expense)}
            </strong>
          </div>
        ))}
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  percentage,
}: {
  label: string;
  value: number;
  percentage?: boolean;
}) {
  const positive = value >= 0;
  return (
    <article>
      <span>{label}</span>
      <strong
        className={
          label.includes("지출") && !percentage ? "" : positive ? "up" : "down"
        }
      >
        {percentage ? `${value}%` : `${value >= 0 ? "+" : "−"}${won(value)}`}
      </strong>
    </article>
  );
}
