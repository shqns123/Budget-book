"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownUp,
  Repeat2,
  Search,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  accounts,
  categories,
  formatNumber,
  hydrateLedgerSettings,
  inferCategoryTransactionType,
  initialTransactions,
  parseNumberInput,
  type RecurringExpenseTemplate,
  type Transaction,
  won,
} from "@/lib/ledger";
import { readSharedState, saveSharedState } from "@/lib/shared-state";

const makeCategoryOptions = (type: "income" | "expense") =>
  categories
    .filter((category) => category.transactionType === type)
    .reduce<Record<string, string[]>>((result, category) => {
      const options = result[category.majorCategory] ?? [];
      if (!options.includes(category.minorCategory)) {
        options.push(category.minorCategory);
      }
      result[category.majorCategory] = options;
      return result;
    }, {});

const isDebt = (id: string) =>
  ["card", "loan"].includes(
    accounts.find((account) => account.id === id)?.type ?? "",
  );
const isDate = (value: string | null) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [records, setRecords] = useState(initialTransactions);
  const [composer, setComposer] = useState(false);
  const [detailRecord, setDetailRecord] = useState<Transaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
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
  const [, setSettingsVersion] = useState(0);
  const recordsChangedBeforeLoad = useRef(false);
  const lastTouchRef = useRef<{ id: string; at: number } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [formError, setFormError] = useState("");
  const isRepayment = type === "transfer" && isDebt(toAccountId);
  const currentCategoryOptions = makeCategoryOptions(
    type === "income" ? "income" : "expense",
  );
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setEditingId(null);
      const requestedAccountId = searchParams.get("account");
      if (accounts.some((account) => account.id === requestedAccountId)) {
        setAccountId(requestedAccountId!);
      }
      setDate(isDate(searchParams.get("date")) ? searchParams.get("date")! : today());
      setComposer(true);
    }
  }, [searchParams]);
  useEffect(() => {
    void Promise.all([
      readSharedState("settings", {
        accounts: [],
        categories: [] as Array<{
          major: string;
          minor: string;
          fixed: boolean;
          transactionType?: "income" | "expense";
        }>,
      }),
      readSharedState("transactions", initialTransactions),
      readSharedState("recurring", [] as RecurringExpenseTemplate[]),
    ]).then(([settings, savedRecords, savedRecurring]) => {
      const migratedCategories = settings.categories.map((category) => ({
        ...category,
        transactionType:
          category.transactionType ??
          inferCategoryTransactionType(
            category.major,
            category.minor,
            savedRecords,
          ),
      }));
      const migratedSettings = {
        ...settings,
        categories: migratedCategories,
      };
      hydrateLedgerSettings(migratedSettings);
      setSettingsVersion((version) => version + 1);
      setAccountId(
        (id) =>
          id ||
          accounts.find((account) => !isDebt(account.id))?.id ||
          accounts[0]?.id ||
          "",
      );
      setToAccountId(
        (id) =>
          id ||
          accounts.find((account) => account.id !== id)?.id ||
          accounts[0]?.id ||
          "",
      );
      // A record entered before the first API response must not be replaced
      // by that older response.
      if (!recordsChangedBeforeLoad.current) setRecords(savedRecords);
      setCustomRecurring(savedRecurring);
      if (settings.categories.some((category) => !category.transactionType)) {
        void saveSharedState("settings", migratedSettings);
      }
    });
  }, []);
  async function persistRecords(next: Transaction[]) {
    recordsChangedBeforeLoad.current = true;
    setRecords(next);
    setSaveError("");
    try {
      await saveSharedState("transactions", next);
      return true;
    } catch {
      setSaveError("거래 내역을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
  }
  function closeComposer() {
    setComposer(false);
    setEditingId(null);
    setName("");
    setAmount("");
    setRecurringBatch(null);
    setFormError("");
    if (searchParams.get("add") === "true") {
      router.replace("/transactions", { scroll: false });
    }
  }
  function includeRecordAccounts(
    selected: string[],
    updateSelected: (next: string[]) => void,
    ids: Array<string | undefined>,
  ) {
    if (!selected.length) return;
    const next = [...selected];
    ids.forEach((id) => {
      if (id && !next.includes(id)) next.push(id);
    });
    if (next.length !== selected.length) updateSelected(next);
  }
  async function registerRecurringBatch(
    month: string,
    selected: string[],
    updateSelected: (next: string[]) => void,
  ) {
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
    if (await persistRecords(next)) {
      recordsToAdd.forEach((record) =>
        includeRecordAccounts(selected, updateSelected, [
          record.accountId,
          record.toAccountId,
        ]),
      );
      closeComposer();
    }
  }
  function openEditor(record: Transaction) {
    const options =
      record.type === "income"
        ? makeCategoryOptions("income")
        : makeCategoryOptions("expense");
    const fallbackCategory = Object.keys(options)[0] ?? "";
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
        (record.type === "transfer" ? "" : options[nextCategory]?.[0] ?? ""),
    );
    setComposer(true);
  }
  function openDetails(record: Transaction) {
    setDetailRecord(record);
  }
  function changeTransactionType(nextType: Transaction["type"]) {
    setType(nextType);
    if (nextType === "transfer") return;
    const options = makeCategoryOptions(nextType);
    const firstCategory = Object.keys(options)[0] ?? "";
    setCategory(firstCategory);
    setMinorCategory(options[firstCategory]?.[0] ?? "");
  }
  async function save(
    month: string,
    selected: string[],
    updateSelected: (next: string[]) => void,
  ) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("금액을 1원 이상 입력해 주세요.");
      return;
    }
    if (!name.trim()) {
      setFormError("내용을 입력해 주세요.");
      return;
    }
    if (!accounts.some((account) => account.id === accountId)) {
      setFormError("출금 통장을 다시 선택해 주세요.");
      return;
    }
    if (
      type === "transfer" &&
      !accounts.some((account) => account.id === toAccountId)
    ) {
      setFormError("입금 통장을 다시 선택해 주세요.");
      return;
    }
    setFormError("");
    const record: Transaction = {
      id: editingId ?? crypto.randomUUID(),
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      name: name.trim(),
      category: type === "transfer" ? "이동" : category,
      minorCategory: type === "transfer" ? undefined : minorCategory,
      amount: type === "income" ? numericAmount : -numericAmount,
      date: (date || `${month}-01`).replaceAll("-", "."),
      type,
    };
    const next = editingId
      ? records.map((item) => (item.id === editingId ? record : item))
      : [record, ...records];
    if (await persistRecords(next)) {
      includeRecordAccounts(selected, updateSelected, [
        record.accountId,
        record.toAccountId,
      ]);
      closeComposer();
    }
  }
  function removeRecord(id: string) {
    const next = records.filter((item) => item.id !== id);
    void persistRecords(next).then((saved) => {
      if (saved) {
        setDetailRecord(null);
        closeComposer();
      }
    });
  }
  return (
    <AppShell>
      {({ selected, month, updateSelected }) => {
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
              {saveError && <p className="save-error">{saveError}</p>}
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
                  onDoubleClick={() => openDetails(item)}
                  onTouchEnd={() => {
                    const now = Date.now();
                    const previous = lastTouchRef.current;
                    if (previous?.id === item.id && now - previous.at < 380) {
                      lastTouchRef.current = null;
                      openDetails(item);
                      return;
                    }
                    lastTouchRef.current = { id: item.id, at: now };
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      openDetails(item);
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
                      <small className="ledger-date">{item.date}</small>
                      <b>{item.name}</b>
                      <small className="ledger-mobile-meta">
                        {item.type === "transfer"
                          ? "이동"
                          : item.minorCategory
                            ? `${item.category} · ${item.minorCategory}`
                            : item.category}
                        {" / "}
                        {
                          accounts.find(
                            (account) => account.id === item.accountId,
                          )?.name
                        }
                        {item.toAccountId &&
                          ` → ${accounts.find((account) => account.id === item.toAccountId)?.name}`}
                      </small>
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
            {detailRecord && (
              <div className="sheet-backdrop detail-backdrop">
                <section
                  className="record-detail"
                  role="dialog"
                  aria-modal="true"
                  aria-label="거래 상세"
                >
                  <button
                    type="button"
                    className="sheet-close"
                    onClick={() => setDetailRecord(null)}
                    aria-label="상세 닫기"
                  >
                    <X size={20} />
                  </button>
                  <span className="record-detail-label">거래 상세</span>
                  <h2>{detailRecord.name}</h2>
                  <dl>
                    <div><dt>날짜</dt><dd>{detailRecord.date}</dd></div>
                    <div><dt>유형</dt><dd>{detailRecord.type === "transfer" ? "이동" : detailRecord.type === "income" ? "수입" : "지출"}</dd></div>
                    <div><dt>분류</dt><dd>{detailRecord.type === "transfer" ? "이동" : [detailRecord.category, detailRecord.minorCategory].filter(Boolean).join(" · ")}</dd></div>
                    <div><dt>통장</dt><dd>{accounts.find((account) => account.id === detailRecord.accountId)?.name}{detailRecord.toAccountId && ` → ${accounts.find((account) => account.id === detailRecord.toAccountId)?.name}`}</dd></div>
                    <div><dt>금액</dt><dd>{won(detailRecord.amount)}</dd></div>
                  </dl>
                  <div className="record-detail-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailRecord(null);
                        openEditor(detailRecord);
                      }}
                    >
                      <Pencil size={15} /> 수정
                    </button>
                    <button
                      type="button"
                      className="delete-record"
                      onClick={() => removeRecord(detailRecord.id)}
                    >
                      <Trash2 size={15} /> 삭제
                    </button>
                  </div>
                </section>
              </div>
            )}
            {composer && (
              <div className="sheet-backdrop">
                <form
                  className="record-sheet compact-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(month, selected, updateSelected);
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
                      onClick={() => changeTransactionType("expense")}
                    >
                      지출
                    </button>
                    <button
                      type="button"
                      className={type === "income" ? "selected" : ""}
                      onClick={() => changeTransactionType("income")}
                    >
                      수입
                    </button>
                    <button
                      type="button"
                      className={type === "transfer" ? "selected" : ""}
                      onClick={() => changeTransactionType("transfer")}
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
                          onClick={() =>
                            void registerRecurringBatch(
                              month,
                              selected,
                              updateSelected,
                            )
                          }
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
                  <label>
                    내용
                    <input
                      lang="ko-KR"
                      inputMode="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={type === "transfer" ? "예: 카드 결제" : "예: 점심 식사"}
                    />
                  </label>
                  {type === "transfer" ? (
                    <div className="form-split">
                      <label>
                        출금 통장
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
                                currentCategoryOptions[next]?.[0] ?? "",
                              );
                            }}
                          >
                            {Object.keys(currentCategoryOptions).map((item) => (
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
                            {(currentCategoryOptions[category] ?? []).map((item) => (
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
                  {formError && <p className="save-error">{formError}</p>}
                </form>
              </div>
            )}
          </>
        );
      }}
    </AppShell>
  );
}
