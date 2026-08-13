"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CirclePlus,
  CreditCard,
  EyeOff,
  Landmark,
  PiggyBank,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import importedLedger from "@/data/imported-ledger.json";
import { type MonthlyBudget } from "@/lib/budgets";
import { readSharedState, saveSharedState } from "@/lib/shared-state";
import {
  formatNumber,
  parseNumberInput,
  type RecurringExpenseTemplate,
} from "@/lib/ledger";

type Kind = "bank" | "card" | "loan" | "savings" | "cash";
type AccountSetting = {
  id: string;
  code: string;
  classification: "자산" | "단기부채" | "장기부채";
  major: string;
  minor: string;
  name: string;
  balance: number;
  memo: string;
  kind: Kind;
  paymentDay?: number;
  hidden?: boolean;
};
type Category = { major: string; minor: string; fixed: boolean };
type SharedSettings = {
  accounts: AccountSetting[];
  categories: Category[];
  startYear: number;
  fiscalMonth: number;
};
const icons = {
  bank: Landmark,
  card: CreditCard,
  loan: Landmark,
  savings: PiggyBank,
  cash: WalletCards,
};
const initialAccounts: AccountSetting[] = importedLedger.accounts.map(
  (account) => ({
    id: account.id,
    code: account.accountCode,
    classification:
      account.classification === "asset"
        ? "자산"
        : account.classification === "short_liability"
          ? "단기부채"
          : "장기부채",
    major: account.majorCategory,
    minor: account.minorCategory,
    name: account.name,
    balance: account.openingBalance,
    memo: account.memo ?? "",
    kind: account.type as Kind,
    paymentDay: account.paymentDay ?? undefined,
    hidden: account.isHidden,
  }),
);
const initialCategories: Category[] = importedLedger.categories.map(
  (category) => ({
    major: category.majorCategory,
    minor: category.minorCategory,
    fixed: category.isFixed,
  }),
);
const initialSettings: SharedSettings = {
  accounts: initialAccounts,
  categories: initialCategories,
  startYear: importedLedger.settings.startYear,
  fiscalMonth: importedLedger.settings.fiscalStartMonth,
};
const money = (value: number) => `${formatNumber(value)}원`;

export default function SettingsPage() {
  const settingsLoaded = useRef(false);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [categories, setCategories] = useState(initialCategories);
  const [startYear, setStartYear] = useState(importedLedger.settings.startYear);
  const [fiscalMonth, setFiscalMonth] = useState(
    importedLedger.settings.fiscalStartMonth,
  );
  const [view, setView] = useState<
    "accounts" | "categories" | "budgets" | "recurring"
  >("accounts");
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseTemplate[]>([]);
  const [recurringDraft, setRecurringDraft] = useState({
    type: "expense" as "income" | "expense" | "transfer",
    name: "",
    category: "🏬식비",
    minorCategory: "식료품",
    accountId: initialAccounts[0]?.id ?? "",
    toAccountId: initialAccounts[1]?.id ?? "",
    amount: "",
    day: "1",
  });
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    kind: "bank" as Kind,
    classification: "자산" as AccountSetting["classification"],
    major: "💰현금·예금",
    minor: "보통예금",
    balance: "0",
    memo: "",
    paymentDay: "",
  });
  const grouped = useMemo(
    () =>
      ["자산", "단기부채", "장기부채"].map((classification) => ({
        classification,
        rows: accounts.filter(
          (account) => account.classification === classification,
        ),
      })),
    [accounts],
  );
  const budgetableAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.classification === "자산" &&
          (account.kind === "bank" || account.kind === "cash"),
      ),
    [accounts],
  );
  useEffect(() => {
    void Promise.all([
      readSharedState("settings", initialSettings),
      readSharedState("budgets", [] as MonthlyBudget[]),
      readSharedState("recurring", [] as RecurringExpenseTemplate[]),
    ]).then(([sharedSettings, sharedBudgets, sharedRecurring]) => {
      setAccounts(sharedSettings.accounts);
      setCategories(sharedSettings.categories);
      setStartYear(sharedSettings.startYear);
      setFiscalMonth(sharedSettings.fiscalMonth);
      setBudgets(sharedBudgets);
      setRecurring(sharedRecurring);
      settingsLoaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    void saveSharedState("settings", {
      accounts,
      categories,
      startYear,
      fiscalMonth,
    });
  }, [accounts, categories, startYear, fiscalMonth]);
  function updateBudget(accountId: string, amount: string) {
    const next = budgets.some((item) => item.accountId === accountId)
      ? budgets.map((item) =>
          item.accountId === accountId
            ? { ...item, amount: Number(amount || 0) }
            : item,
        )
      : [...budgets, { accountId, amount: Number(amount || 0) }];
    setBudgets(next);
    void saveSharedState("budgets", next);
  }
  function saveRecurring(items: RecurringExpenseTemplate[]) {
    setRecurring(items);
    void saveSharedState("recurring", items);
  }
  function addRecurring() {
    if (!recurringDraft.name || !recurringDraft.amount) return;
    saveRecurring([
      ...recurring,
      {
        id: crypto.randomUUID(),
        name: recurringDraft.name,
        category: recurringDraft.category,
        minorCategory:
          recurringDraft.type === "transfer"
            ? ""
            : recurringDraft.minorCategory,
        accountId: recurringDraft.accountId,
        toAccountId:
          recurringDraft.type === "transfer"
            ? recurringDraft.toAccountId
            : undefined,
        amount: Number(recurringDraft.amount),
        day: Number(recurringDraft.day || 1),
        type: recurringDraft.type,
      },
    ]);
    setRecurringDraft((draft) => ({ ...draft, name: "", amount: "" }));
  }
  function updateRecurring(
    id: string,
    updates: Partial<RecurringExpenseTemplate>,
  ) {
    saveRecurring(
      recurring.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  }
  function toggleHidden(id: string) {
    setAccounts((rows) =>
      rows.map((account) =>
        account.id === id ? { ...account, hidden: !account.hidden } : account,
      ),
    );
  }
  function addAccount() {
    if (!draft.name) return;
    const prefix =
      draft.classification === "자산"
        ? "1"
        : draft.classification === "단기부채"
          ? "201"
          : "202";
    setAccounts((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        code: `${prefix}${String(rows.length + 1).padStart(5, "0")}`,
        name: draft.name,
        kind: draft.kind,
        classification: draft.classification,
        major: draft.major,
        minor: draft.minor,
        balance: Number(draft.balance || 0),
        memo: draft.memo,
        paymentDay: draft.paymentDay ? Number(draft.paymentDay) : undefined,
      },
    ]);
    setShowAdd(false);
  }
  return (
    <AppShell>
      {() => (
        <>
          <section className="setting-basics">
            <label>
              시작 연도
              <select
                value={startYear}
                onChange={(event) => setStartYear(Number(event.target.value))}
              >
                {[2024, 2025, 2026].map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
            <label>
              회계기준월
              <select
                value={fiscalMonth}
                onChange={(event) => setFiscalMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (month) => (
                    <option key={month} value={month}>
                      {month}월
                    </option>
                  ),
                )}
              </select>
            </label>
          </section>
          <div className="settings-tabs">
            <button
              onClick={() => setView("accounts")}
              className={view === "accounts" ? "chosen" : ""}
            >
              계좌 · 잔고
            </button>
            <button
              onClick={() => setView("categories")}
              className={view === "categories" ? "chosen" : ""}
            >
              카테고리 · 고정비
            </button>
            <button
              onClick={() => setView("budgets")}
              className={view === "budgets" ? "chosen" : ""}
            >
              월 예산
            </button>
            <button
              onClick={() => setView("recurring")}
              className={view === "recurring" ? "chosen" : ""}
            >
              반복 지출
            </button>
          </div>
          {view === "accounts" ? (
            <section className="setting-table">
              <header>
                <h2>계좌와 시작 잔액</h2>
                <button onClick={() => setShowAdd(true)}>
                  <CirclePlus size={16} /> 계좌 추가
                </button>
              </header>
              {grouped.map(({ classification, rows }) => (
                <div className="account-group" key={classification}>
                  <h3>{classification}</h3>
                  {rows.map((account) => {
                    const Icon = icons[account.kind];
                    return (
                      <article
                        key={account.id}
                        className={
                          account.hidden
                            ? "account-setting is-hidden"
                            : "account-setting"
                        }
                      >
                        <span className="account-code">{account.code}</span>
                        <i>
                          <Icon size={16} />
                        </i>
                        <div>
                          <b>{account.name}</b>
                          <small>
                            {account.major} · {account.minor}
                            {account.paymentDay
                              ? ` · ${account.paymentDay}일 결제/상환`
                              : ""}
                          </small>
                        </div>
                        <span className="opening-balance">
                          {money(account.balance)}
                        </span>
                        <button
                          disabled={account.balance !== 0}
                          title={
                            account.balance !== 0
                              ? "잔액이 0원인 계좌만 숨길 수 있습니다"
                              : "계좌 숨기기"
                          }
                          onClick={() => toggleHidden(account.id)}
                        >
                          {account.hidden ? (
                            <Check size={15} />
                          ) : (
                            <EyeOff size={15} />
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ))}
            </section>
          ) : view === "categories" ? (
            <section className="setting-table category-table">
              <header>
                <h2>대분류와 소분류</h2>
                <button
                  onClick={() =>
                    setCategories((items) => [
                      ...items,
                      { major: "기타", minor: "새 분류", fixed: false },
                    ])
                  }
                >
                  <CirclePlus size={16} /> 분류 추가
                </button>
              </header>
              {categories.map((category, index) => (
                <article
                  className="category-setting"
                  key={`${category.major}-${category.minor}-${index}`}
                >
                  <input
                    value={category.major}
                    onChange={(event) =>
                      setCategories((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, major: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <input
                    value={category.minor}
                    onChange={(event) =>
                      setCategories((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, minor: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={category.fixed}
                      onChange={() =>
                        setCategories((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, fixed: !item.fixed }
                              : item,
                          ),
                        )
                      }
                    />{" "}
                    고정
                  </label>
                  <button
                    onClick={() =>
                      setCategories((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    삭제
                  </button>
                </article>
              ))}
            </section>
          ) : view === "budgets" ? (
            <section className="setting-table budget-table">
              <header>
                <h2>월 예산</h2>
              </header>
              <p className="setting-guide">
                생활비처럼 월별로 관리할 통장에만 금액을 입력하세요. 저장 즉시
                오버뷰의 통장별 예산과 사용 현황에 반영됩니다.
              </p>
              {budgetableAccounts.map((account) => {
                const budget = budgets.find(
                  (item) => item.accountId === account.id,
                );
                return (
                  <label className="budget-setting" key={account.id}>
                    <span>{account.name}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(budget?.amount || "")}
                      placeholder="예산 없음"
                      onChange={(event) =>
                        updateBudget(
                          account.id,
                          parseNumberInput(event.target.value),
                        )
                      }
                    />
                    <b>원</b>
                  </label>
                );
              })}
            </section>
          ) : (
            <section className="setting-table recurring-settings">
              <header>
                <h2>반복 지출</h2>
              </header>
              <p className="setting-guide">
                반복할 지출·수입·이동을 등록해 두면 거래 내역에서 선택한 항목만
                수정·제외한 뒤 한 번에 등록할 수 있어요.
              </p>
              <div className="recurring-column-head">
                <span>유형</span>
                <span>내용</span>
                <span>분류 / 입금 통장</span>
                <span>출금 통장</span>
                <span>금액</span>
                <span>일자</span>
              </div>
              <div className="recurring-settings-form">
                <select
                  value={recurringDraft.type}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      type: event.target.value as typeof recurringDraft.type,
                    })
                  }
                >
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
                  <option value="transfer">이동</option>
                </select>
                <input
                  value={recurringDraft.name}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      name: event.target.value,
                    })
                  }
                  placeholder="내용"
                />
                <select
                  value={recurringDraft.category}
                  onChange={(event) => {
                    const category = event.target.value;
                    const minorCategory =
                      initialCategories.find((item) => item.major === category)
                        ?.minor ?? "";
                    setRecurringDraft({
                      ...recurringDraft,
                      category,
                      minorCategory,
                    });
                  }}
                >
                  {[
                    ...new Set(initialCategories.map((item) => item.major)),
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                {recurringDraft.type === "transfer" && (
                  <select
                    value={recurringDraft.toAccountId}
                    onChange={(event) =>
                      setRecurringDraft({
                        ...recurringDraft,
                        toAccountId: event.target.value,
                      })
                    }
                  >
                    {accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        입금: {item.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={recurringDraft.minorCategory}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      minorCategory: event.target.value,
                    })
                  }
                >
                  {initialCategories
                    .filter((item) => item.major === recurringDraft.category)
                    .map((item) => (
                      <option key={item.minor}>{item.minor}</option>
                    ))}
                </select>
                <select
                  value={recurringDraft.accountId}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      accountId: event.target.value,
                    })
                  }
                >
                  {accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {recurringDraft.type === "income" ? "입금" : "출금"}:{" "}
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(recurringDraft.amount)}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      amount: parseNumberInput(event.target.value),
                    })
                  }
                  placeholder="금액"
                />
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringDraft.day}
                  onChange={(event) =>
                    setRecurringDraft({
                      ...recurringDraft,
                      day: event.target.value,
                    })
                  }
                  placeholder="일"
                />
                <button type="button" onClick={addRecurring}>
                  추가
                </button>
              </div>
              {recurring.map((item) => (
                <article className="recurring-setting" key={item.id}>
                  <select
                    value={item.type ?? "expense"}
                    onChange={(event) =>
                      updateRecurring(item.id, {
                        type: event.target.value as NonNullable<
                          RecurringExpenseTemplate["type"]
                        >,
                      })
                    }
                  >
                    <option value="expense">지출</option>
                    <option value="income">수입</option>
                    <option value="transfer">이동</option>
                  </select>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateRecurring(item.id, { name: event.target.value })
                    }
                  />
                  {item.type === "transfer" ? (
                    <select
                      value={item.toAccountId ?? accounts[0]?.id}
                      onChange={(event) =>
                        updateRecurring(item.id, {
                          toAccountId: event.target.value,
                        })
                      }
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          입금: {account.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>
                      {item.category} · {item.minorCategory}
                    </span>
                  )}
                  <select
                    value={item.accountId}
                    onChange={(event) =>
                      updateRecurring(item.id, {
                        accountId: event.target.value,
                      })
                    }
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {item.type === "income" ? "입금" : "출금"}:{" "}
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(item.amount)}
                    onChange={(event) =>
                      updateRecurring(item.id, {
                        amount: Number(parseNumberInput(event.target.value)),
                      })
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={item.day}
                    onChange={(event) =>
                      updateRecurring(item.id, {
                        day: Number(event.target.value),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      saveRecurring(
                        recurring.filter((row) => row.id !== item.id),
                      )
                    }
                  >
                    삭제
                  </button>
                </article>
              ))}
            </section>
          )}
          {showAdd && (
            <div className="sheet-backdrop">
              <form
                className="record-sheet settings-sheet"
                onSubmit={(event) => {
                  event.preventDefault();
                  addAccount();
                }}
              >
                <button
                  type="button"
                  className="sheet-close"
                  onClick={() => setShowAdd(false)}
                >
                  <X size={20} />
                </button>
                <label>
                  계좌 이름
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="예: 국민카드 일시불"
                    autoFocus
                  />
                </label>
                <div className="form-split">
                  <label>
                    구분
                    <select
                      value={draft.classification}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          classification: event.target
                            .value as AccountSetting["classification"],
                        })
                      }
                    >
                      <option>자산</option>
                      <option>단기부채</option>
                      <option>장기부채</option>
                    </select>
                  </label>
                  <label>
                    계좌 종류
                    <select
                      value={draft.kind}
                      onChange={(event) =>
                        setDraft({ ...draft, kind: event.target.value as Kind })
                      }
                    >
                      <option value="bank">입출금 통장</option>
                      <option value="card">신용/체크카드</option>
                      <option value="loan">대출</option>
                      <option value="savings">저축투자</option>
                      <option value="cash">현금</option>
                    </select>
                  </label>
                </div>
                <div className="form-split">
                  <label>
                    대분류
                    <input
                      value={draft.major}
                      onChange={(event) =>
                        setDraft({ ...draft, major: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    소분류
                    <input
                      value={draft.minor}
                      onChange={(event) =>
                        setDraft({ ...draft, minor: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  시작 잔액
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(draft.balance)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        balance: parseNumberInput(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  결제일 / 상환일 (선택)
                  <input
                    type="number"
                    value={draft.paymentDay}
                    onChange={(event) =>
                      setDraft({ ...draft, paymentDay: event.target.value })
                    }
                    placeholder="예: 25"
                  />
                </label>
                <label>
                  메모 (선택)
                  <input
                    value={draft.memo}
                    onChange={(event) =>
                      setDraft({ ...draft, memo: event.target.value })
                    }
                  />
                </label>
                <button className="save-record" type="submit">
                  계좌 추가
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
