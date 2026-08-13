"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownUp,
  Repeat2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  accounts,
  formatNumber,
  initialTransactions,
  parseNumberInput,
  type RecurringExpenseTemplate,
  type Transaction,
  won,
} from "@/lib/ledger";
import importedLedger from "@/data/imported-ledger.json";
import { readSharedState, saveSharedState } from "@/lib/shared-state";

const makeCategoryOptions = (type: "income" | "expense") =>
  importedLedger.categories
    .filter((category) => category.transactionType === type)
    .reduce<Record<string, string[]>>((result, category) => {
      const options = result[category.majorCategory] ?? [];
      if (!options.includes(category.minorCategory)) {
        options.push(category.minorCategory);
      }
      result[category.majorCategory] = options;
      return result;
    }, {});

const categoryOptions = makeCategoryOptions("expense");
const incomeCategoryOptions = makeCategoryOptions("income");
const isDebt = (id: string) =>
  ["card", "loan"].includes(
    accounts.find((account) => account.id === id)?.type ?? "",
  );

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [records, setRecords] = useState(initialTransactions);
  const [composer, setComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("2026-08-13");
  const [accountId, setAccountId] = useState("kb");
  const [toAccountId, setToAccountId] = useState("shinhan");
  const [category, setCategory] = useState("🏬식비");
  const [minorCategory, setMinorCategory] = useState("식료품");
  const [query, setQuery] = useState("");
  const [sortedByDate, setSortedByDate] = useState(false);
  const [recurringBatch, setRecurringBatch] = useState<
    RecurringExpenseTemplate[] | null
  >(null);
  const [customRecurring, setCustomRecurring] = useState<
    RecurringExpenseTemplate[]
  >([]);
  const isRepayment = type === "transfer" && isDebt(toAccountId);
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setEditingId(null);
      setDate("2026-08-13");
      setComposer(true);
    }
  }, [searchParams]);
  useEffect(() => {
    void readSharedState("transactions", initialTransactions).then(setRecords);
    void readSharedState("recurring", [] as RecurringExpenseTemplate[]).then(
      setCustomRecurring,
    );
  }, []);
  function closeComposer() {
    setComposer(false);
    setEditingId(null);
    setName("");
    setAmount("");
    setRecurringBatch(null);
  }
  function registerRecurringBatch(month: string) {
    if (!recurringBatch?.length) return;
    const recordsToAdd: Transaction[] = recurringBatch.map((item) => ({
      id: crypto.randomUUID(),
      accountId: item.accountId,
      toAccountId: item.type === "transfer" ? item.toAccountId : undefined,
      name: item.name,
      category: item.type === "transfer" ? "이동" : item.category,
      minorCategory: item.type === "transfer" ? undefined : item.minorCategory,
      amount: item.type === "income" ? item.amount : -item.amount,
      date: `${month.replace("-", ".")}.${String(Math.min(31, Math.max(1, item.day))).padStart(2, "0")}`,
      type: item.type ?? "expense",
    }));
    const next = [...recordsToAdd, ...records];
    setRecords(next);
    void saveSharedState("transactions", next);
    closeComposer();
  }
  function openEditor(record: Transaction) {
    const options =
      record.type === "income" ? incomeCategoryOptions : categoryOptions;
    const fallbackCategory = record.type === "income" ? "💸근로소득" : "🏬식비";
    const nextCategory =
      record.type === "transfer"
        ? "이동"
        : options[record.category]
          ? record.category
          : fallbackCategory;
    setEditingId(record.id);
    setType(record.type);
    setName(record.name);
    setAmount(String(Math.abs(record.amount)));
    setDate(record.date.replaceAll(".", "-"));
    setAccountId(record.accountId);
    setToAccountId(record.toAccountId ?? "shinhan");
    setCategory(nextCategory);
    setMinorCategory(
      record.minorCategory ??
        (record.type === "transfer" ? "" : options[nextCategory][0]),
    );
    setComposer(true);
  }
  function save(month: string) {
    if (!amount || (type !== "transfer" && !name)) return;
    const record: Transaction = {
      id: editingId ?? crypto.randomUUID(),
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      name:
        type === "transfer"
          ? `${accounts.find((item) => item.id === toAccountId)?.name} ${isRepayment ? "상환" : "이동"}`
          : name,
      category: type === "transfer" ? "이동" : category,
      minorCategory: type === "transfer" ? undefined : minorCategory,
      amount: type === "income" ? Number(amount) : -Number(amount),
      date: date || `${month.replace("-", ".")}.13`,
      type,
    };
    const next = editingId
      ? records.map((item) => (item.id === editingId ? record : item))
      : [record, ...records];
    setRecords(next);
    void saveSharedState("transactions", next);
    closeComposer();
  }
  function removeRecord() {
    if (!editingId) return;
    const next = records.filter((item) => item.id !== editingId);
    setRecords(next);
    void saveSharedState("transactions", next);
    closeComposer();
  }
  return (
    <AppShell>
      {({ selected, month }) => {
        const visible = records.filter(
          (item) =>
            item.date.startsWith(month.replace("-", ".")) &&
            (!selected.length ||
              selected.includes(item.accountId) ||
              (item.toAccountId && selected.includes(item.toAccountId))) &&
            item.name.includes(query),
        );
        const sortedVisible = sortedByDate
          ? [...visible].sort((left, right) =>
              right.date.localeCompare(left.date),
            )
          : visible;
        return (
          <>
            <aside className="transfer-guide">
              <ArrowLeftRight size={17} />
              <p>
                <b>카드·대출은 이렇게 기록해요.</b> 카드 사용은 해당 카드의{" "}
                <strong>지출</strong>로 기록하고, 결제/상환할 때는 출금 통장에서
                카드·대출 계좌로 <strong>이동</strong> 처리합니다. 이동은 소비로
                중복 집계되지 않고, 카드·대출 사용액만 줄입니다.
              </p>
            </aside>
            <section className="ledger-surface">
              <div className="ledger-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="내역 검색"
                  />
                </div>
                <button
                  type="button"
                  className="record-sort"
                  onClick={() => setSortedByDate(true)}
                >
                  <ArrowDownUp size={14} /> 정리
                </button>
              </div>
              <div className="ledger-head">
                <span>날짜</span>
                <span>내용</span>
                <span>분류</span>
                <span>통장 / 이동</span>
                <span>금액</span>
              </div>
              {sortedVisible.map((item) => (
                <article
                  className="ledger-row editable-row"
                  key={item.id}
                  onClick={() => openEditor(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      openEditor(item);
                  }}
                >
                  <time>{item.date}</time>
                  <div className="ledger-name">
                    <i>
                      {item.type === "transfer" ? (
                        <ArrowLeftRight size={15} />
                      ) : item.amount > 0 ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <ArrowDownRight size={16} />
                      )}
                    </i>
                    <span>
                      <b>{item.name}</b>
                      {item.memo && <small>{item.memo}</small>}
                    </span>
                  </div>
                  <span className="pill">
                    {item.type === "transfer"
                      ? "이동"
                      : item.minorCategory
                        ? `${item.category} · ${item.minorCategory}`
                        : item.category}
                  </span>
                  <span className="account-cell">
                    {
                      accounts.find((account) => account.id === item.accountId)
                        ?.name
                    }
                    {item.toAccountId && (
                      <>
                        {" "}
                        →{" "}
                        {
                          accounts.find(
                            (account) => account.id === item.toAccountId,
                          )?.name
                        }
                      </>
                    )}
                  </span>
                  <strong
                    className={
                      item.type === "income"
                        ? "up"
                        : item.type === "transfer"
                          ? "transfer-amount"
                          : ""
                    }
                  >
                    {item.type === "income"
                      ? "+"
                      : item.type === "transfer"
                        ? "↔"
                        : "-"}
                    {won(item.amount)}
                  </strong>
                </article>
              ))}
            </section>
            {composer && (
              <div className="sheet-backdrop">
                <form
                  className="record-sheet compact-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    save(month);
                  }}
                >
                  <button
                    type="button"
                    className="sheet-close"
                    onClick={closeComposer}
                  >
                    <X size={20} />
                  </button>
                  <div className="type-switch">
                    <button
                      type="button"
                      className={type === "expense" ? "selected" : ""}
                      onClick={() => {
                        setType("expense");
                        setCategory("🏬식비");
                        setMinorCategory("식료품");
                      }}
                    >
                      지출
                    </button>
                    <button
                      type="button"
                      className={type === "income" ? "selected" : ""}
                      onClick={() => {
                        setType("income");
                        setCategory("💸근로소득");
                        setMinorCategory("월급");
                      }}
                    >
                      수입
                    </button>
                    <button
                      type="button"
                      className={type === "transfer" ? "selected" : ""}
                      onClick={() => setType("transfer")}
                    >
                      이동
                    </button>
                    <button
                      className="recurring-icon-trigger"
                      type="button"
                      onClick={() =>
                        setRecurringBatch(
                          customRecurring.map((item) => ({ ...item })),
                        )
                      }
                      disabled={!customRecurring.length}
                      aria-label="반복 항목 일괄 등록"
                      title="반복 항목 일괄 등록"
                    >
                      <Repeat2 size={17} />
                    </button>
                  </div>
                  {recurringBatch && (
                    <section className="recurring-picker">
                      <div className="recurring-batch">
                        <p>
                          이번 달에 등록할 항목만 남기고 내용을 수정한 뒤 일괄
                          등록하세요.
                        </p>
                        {recurringBatch.map((item) => (
                          <div key={item.id}>
                            <span
                              className={`recurring-type recurring-type-${item.type ?? "expense"}`}
                            >
                              {item.type === "transfer"
                                ? "이동"
                                : item.type === "income"
                                  ? "수입"
                                  : "지출"}
                            </span>
                            <input
                              value={item.name}
                              onChange={(event) =>
                                setRecurringBatch(
                                  (rows) =>
                                    rows?.map((row) =>
                                      row.id === item.id
                                        ? { ...row, name: event.target.value }
                                        : row,
                                    ) ?? null,
                                )
                              }
                              aria-label="반복 지출 내용"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumber(item.amount)}
                              onChange={(event) =>
                                setRecurringBatch(
                                  (rows) =>
                                    rows?.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            amount: Number(
                                              parseNumberInput(
                                                event.target.value,
                                              ),
                                            ),
                                          }
                                        : row,
                                    ) ?? null,
                                )
                              }
                              aria-label="반복 지출 금액"
                            />
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={item.day}
                              onChange={(event) =>
                                setRecurringBatch(
                                  (rows) =>
                                    rows?.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            day: Number(event.target.value),
                                          }
                                        : row,
                                    ) ?? null,
                                )
                              }
                              aria-label="반복 지출 일자"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setRecurringBatch(
                                  (rows) =>
                                    rows?.filter((row) => row.id !== item.id) ??
                                    null,
                                )
                              }
                            >
                              제외
                            </button>
                          </div>
                        ))}
                        <button
                          className="register-recurring-batch"
                          type="button"
                          onClick={() => registerRecurringBatch(month)}
                        >
                          선택 항목 일괄 등록
                        </button>
                      </div>
                    </section>
                  )}
                  <label>
                    날짜
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  {type !== "transfer" && (
                    <label>
                      내용
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="예: 점심 식사"
                        autoFocus
                      />
                    </label>
                  )}
                  {type === "transfer" ? (
                    <div className="form-split">
                      <label>
                        출금 통장
                        <select
                          value={accountId}
                          onChange={(event) => setAccountId(event.target.value)}
                        >
                          {accounts
                            .filter((item) => !isDebt(item.id))
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        입금 통장
                        <select
                          value={toAccountId}
                          onChange={(event) =>
                            setToAccountId(event.target.value)
                          }
                        >
                          {accounts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <>
                      <div className="form-split">
                        <label>
                          대분류
                          <select
                            value={category}
                            onChange={(event) => {
                              const next = event.target.value;
                              setCategory(next);
                              setMinorCategory(
                                (type === "income"
                                  ? incomeCategoryOptions
                                  : categoryOptions)[next][0],
                              );
                            }}
                          >
                            {Object.keys(
                              type === "income"
                                ? incomeCategoryOptions
                                : categoryOptions,
                            ).map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          소분류
                          <select
                            value={minorCategory}
                            onChange={(event) =>
                              setMinorCategory(event.target.value)
                            }
                          >
                            {(type === "income"
                              ? incomeCategoryOptions
                              : categoryOptions)[category].map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        {type === "income" ? "입금 통장" : "출금 통장"}
                        <select
                          value={accountId}
                          onChange={(event) => setAccountId(event.target.value)}
                        >
                          {accounts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    금액
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumber(amount)}
                      onChange={(event) =>
                        setAmount(parseNumberInput(event.target.value))
                      }
                      placeholder="0"
                    />
                  </label>
                  <button className="save-record" type="submit">
                    {editingId
                      ? "거래 수정 저장"
                      : type === "transfer"
                        ? isRepayment
                          ? "상환 이동 기록"
                          : "이동 기록"
                        : type === "expense"
                          ? "지출 기록하기"
                          : "수입 기록하기"}
                  </button>
                  {editingId && (
                    <button
                      className="delete-record"
                      type="button"
                      onClick={removeRecord}
                    >
                      <Trash2 size={15} /> 삭제
                    </button>
                  )}
                </form>
              </div>
            )}
          </>
        );
      }}
    </AppShell>
  );
}
