"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  CreditCard,
  EyeOff,
  GripVertical,
  Landmark,
  PiggyBank,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MembersPanel } from "@/components/members-panel";
import { useAccountOrderDrag } from "@/components/use-account-order-drag";
import { type MonthlyBudget } from "@/lib/budgets";
import { readSharedState, saveSharedState } from "@/lib/shared-state";
import {
  formatNumber,
  hydrateLedgerSettings,
  classificationLabel,
  inferCategoryTransactionType,
  majorLabel,
  moveAccount,
  moveAccountTo,
  moveCategoryType,
  parseNumberInput,
  type RecurringExpenseTemplate,
  type Transaction,
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
type Category = {
  major: string;
  minor: string;
  fixed: boolean;
  transactionType: "income" | "expense";
};
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
const initialSettings: SharedSettings = {
  accounts: [],
  categories: [],
  startYear: new Date().getFullYear(),
  fiscalMonth: 1,
};
const money = (value: number) => `${formatNumber(value)}원`;

export default function SettingsPage() {
  const settingsLoaded = useRef(false);
  const budgetsChangedBeforeLoad = useRef(false);
  const [accounts, setAccounts] = useState<AccountSetting[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMoveError, setCategoryMoveError] = useState("");
  const [startYear, setStartYear] = useState(initialSettings.startYear);
  const [fiscalMonth, setFiscalMonth] = useState(initialSettings.fiscalMonth);
  const [view, setView] = useState<
    "accounts" | "categories" | "budgets" | "recurring" | "members"
  >("accounts");
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpenseTemplate[]>([]);
  const [budgetSaveError, setBudgetSaveError] = useState("");
  const [recurringDraft, setRecurringDraft] = useState({
    type: "expense" as "income" | "expense" | "transfer",
    name: "",
    category: "🏬식비",
    minorCategory: "식료품",
    accountId: "",
    toAccountId: "",
    amount: "",
    day: "1",
  });
  const [showAdd, setShowAdd] = useState(false);
  const [reordering, setReordering] = useState(false);
  const orderDrag = useAccountOrderDrag((id, targetId) =>
    setAccounts((rows) => moveAccountTo(rows, id, targetId)),
  );
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
  const categoryGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        major: string;
        transactionType: "income" | "expense";
        rows: Array<{ category: Category; index: number }>;
      }
    >();
    categories.forEach((category, index) => {
      const key = `${category.transactionType}:${category.major}`;
      const group = groups.get(key) ?? {
        major: category.major,
        transactionType: category.transactionType,
        rows: [],
      };
      group.rows.push({ category, index });
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [categories]);
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
      readSharedState("transactions", [] as Transaction[]),
    ]).then(
      ([sharedSettings, sharedBudgets, sharedRecurring, sharedTransactions]) => {
      const migratedCategories = sharedSettings.categories.map((category) => ({
        ...category,
        transactionType:
          category.transactionType ??
          inferCategoryTransactionType(
            category.major,
            category.minor,
            sharedTransactions,
          ),
      }));
      const migratedSettings = {
        ...sharedSettings,
        categories: migratedCategories,
      };
      hydrateLedgerSettings(migratedSettings);
      setAccounts(sharedSettings.accounts);
      setCategories(migratedCategories);
      setStartYear(sharedSettings.startYear);
      setFiscalMonth(sharedSettings.fiscalMonth);
      // Keep an amount the user entered while the initial API request was in
      // flight instead of replacing it with the older saved value.
      if (!budgetsChangedBeforeLoad.current) setBudgets(sharedBudgets);
      setRecurring(sharedRecurring);
      settingsLoaded.current = true;
      if (
        sharedSettings.categories.some(
          (category) => !category.transactionType,
        )
      ) {
        void saveSharedState("settings", migratedSettings);
      }
    });
  }, []);
  useEffect(() => {
    if (!settingsLoaded.current) return;
    const nextSettings = {
      accounts,
      categories,
      startYear,
      fiscalMonth,
    };
    hydrateLedgerSettings(nextSettings);
    void saveSharedState("settings", nextSettings);
  }, [accounts, categories, startYear, fiscalMonth]);
  function updateBudget(accountId: string, amount: string) {
    const nextAmount = Math.max(0, Number(parseNumberInput(amount)) || 0);
    const withoutCurrent = budgets.filter(
      (item) => item.accountId !== accountId,
    );
    const next = nextAmount
      ? [...withoutCurrent, { accountId, amount: nextAmount }]
      : withoutCurrent;
    budgetsChangedBeforeLoad.current = true;
    setBudgets(next);
    setBudgetSaveError("");
    void saveSharedState("budgets", next).catch(() => {
      setBudgetSaveError("예산을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    });
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
  function addCategoryGroup() {
    const base = "새 대분류";
    let major = base;
    let suffix = 2;
    while (
      categories.some(
        (category) =>
          category.transactionType === "expense" && category.major === major,
      )
    ) {
      major = `${base} ${suffix}`;
      suffix += 1;
    }
    setCategories((items) => [
      ...items,
      {
        major,
        minor: "새 소분류",
        fixed: false,
        transactionType: "expense",
      },
    ]);
  }
  function updateCategoryGroup(
    transactionType: Category["transactionType"],
    major: string,
    updates: Pick<Category, "major">,
  ) {
    setCategories((items) =>
      items.map((item) =>
        item.transactionType === transactionType && item.major === major
          ? { ...item, ...updates }
          : item,
      ),
    );
  }
  function changeCategoryType(
    type: Category["transactionType"],
    major: string,
    nextType: Category["transactionType"],
    rowIndex?: number,
  ) {
    if (type === nextType) return;
    const next = moveCategoryType(categories, type, major, nextType, rowIndex);
    if (next === categories) {
      setCategoryMoveError(`${nextType === "income" ? "수입" : "지출"}의 ${major}에 같은 이름의 소분류가 있어요.`);
      return;
    }
    setCategoryMoveError("");
    setCategories(next);
  }
  function addMinorCategory(
    transactionType: Category["transactionType"],
    major: string,
  ) {
    const siblings = categories.filter(
      (category) =>
        category.transactionType === transactionType && category.major === major,
    );
    const base = "새 소분류";
    let minor = base;
    let suffix = 2;
    while (siblings.some((category) => category.minor === minor)) {
      minor = `${base} ${suffix}`;
      suffix += 1;
    }
    setCategories((items) => [
      ...items,
      { major, minor, fixed: false, transactionType },
    ]);
  }
  /** One place up (-1) or down (+1) within its group; saved with the settings like any edit. */
  function move(id: string, step: -1 | 1) {
    setAccounts((rows) => moveAccount(rows, id, step));
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
              카테고리
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
            <button
              onClick={() => setView("members")}
              className={view === "members" ? "chosen" : ""}
            >
              멤버
            </button>
          </div>
          {view === "members" ? (
            <MembersPanel />
          ) : view === "accounts" ? (
            <section className="setting-table">
              <header>
                <h2>계좌와 시작 잔액</h2>
                <div className="header-actions">
                  <button
                    onClick={() => {
                      orderDrag.cancel();
                      setReordering(!reordering);
                    }}
                    className={reordering ? "chosen" : ""}
                    aria-pressed={reordering}
                  >
                    {reordering ? <Check size={16} /> : <ArrowUpDown size={16} />}
                    {reordering ? "완료" : "순서 변경"}
                  </button>
                  {!reordering && (
                    <button onClick={() => setShowAdd(true)}>
                      <CirclePlus size={16} /> 계좌 추가
                    </button>
                  )}
                </div>
              </header>
              {reordering && (
                <p className="setting-guide">
                  계좌를 길게 누른 뒤 원하는 위치로 끌어 놓으세요.
                </p>
              )}
              {grouped.map(({ classification, rows }) => (
                <div className="account-group" key={classification}>
                  <h3>{classificationLabel(classification)}</h3>
                  {rows.map((account, index) => {
                    const Icon = icons[account.kind];
                    if (reordering)
                      return (
                        <article
                          key={account.id}
                          data-order-account={account.id}
                          className={[
                            "account-setting reordering",
                            account.hidden && "is-hidden",
                            orderDrag.preview?.id === account.id && "is-dragging",
                            orderDrag.preview?.targetId === account.id &&
                              orderDrag.preview.id !== account.id && "is-drop-target",
                          ].filter(Boolean).join(" ")}
                          style={orderDrag.preview?.id === account.id ? {
                            transform: `translateY(${orderDrag.preview.offset}px)`,
                          } : undefined}
                          onPointerDown={(event) => orderDrag.start(event, account.id)}
                          onPointerMove={orderDrag.move}
                          onPointerUp={orderDrag.finish}
                          onPointerCancel={orderDrag.finish}
                          onLostPointerCapture={orderDrag.finish}
                          onContextMenu={(event) => event.preventDefault()}
                        >
                          <span className="account-code">{account.code}</span>
                          <i>
                            <Icon size={16} />
                          </i>
                          <div>
                            <b>{account.name}</b>
                            <small>
                              {majorLabel(account.major)} · {account.minor}
                            </small>
                          </div>
                          <div className="move-buttons">
                            <GripVertical size={16} aria-hidden="true" className="account-drag-grip" />
                            <button
                              disabled={index === 0}
                              aria-label={`${account.name} 위로`}
                              title="위로"
                              onClick={() => move(account.id, -1)}
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              disabled={index === rows.length - 1}
                              aria-label={`${account.name} 아래로`}
                              title="아래로"
                              onClick={() => move(account.id, 1)}
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        </article>
                      );
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
                            {majorLabel(account.major)} · {account.minor}
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
                <button onClick={addCategoryGroup}>
                  <CirclePlus size={16} /> 대분류 추가
                </button>
              </header>
              {categoryMoveError && <p className="setting-guide" role="alert">{categoryMoveError}</p>}
              <div className="category-group-list">
                {categoryGroups.map((group) => (
                  <article
                    className="category-group"
                    key={group.rows[0].index}
                  >
                  <div className="category-group-head">
                    <select
                      value={group.transactionType}
                      aria-label={`${group.major} 거래 유형`}
                      onChange={(event) =>
                        changeCategoryType(group.transactionType, group.major, event.target.value as Category["transactionType"])
                      }
                    >
                      <option value="expense">지출</option>
                      <option value="income">수입</option>
                    </select>
                    <input
                      value={group.major}
                      aria-label="대분류"
                      onChange={(event) =>
                        updateCategoryGroup(
                          group.transactionType,
                          group.major,
                          { major: event.target.value },
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        addMinorCategory(group.transactionType, group.major)
                      }
                    >
                      <CirclePlus size={14} /> 소분류 추가
                    </button>
                  </div>
                  <div className="category-minor-list">
                    {group.rows.map(({ category, index }) => (
                      <div
                        className="category-minor-row"
                        key={index}
                      >
                        <input
                          value={category.minor}
                          aria-label={`${group.major} 소분류`}
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
                        <select
                          value={category.transactionType}
                          aria-label={`${category.minor} 거래 유형`}
                          onChange={(event) =>
                            changeCategoryType(group.transactionType, group.major, event.target.value as Category["transactionType"], index)
                          }
                        >
                          <option value="expense">지출</option>
                          <option value="income">수입</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCategories((items) =>
                              items.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                  </article>
                ))}
              </div>
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
              {budgetSaveError && (
                <p className="save-error">{budgetSaveError}</p>
              )}
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
                        updateBudget(account.id, event.target.value)
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
                      categories.find((item) => item.major === category)
                        ?.minor ?? "";
                    setRecurringDraft({
                      ...recurringDraft,
                      category,
                      minorCategory,
                    });
                  }}
                >
                  {[
                    ...new Set(categories.map((item) => item.major)),
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
                  {categories
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
                      <option value="단기부채">미결제 금액</option>
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
