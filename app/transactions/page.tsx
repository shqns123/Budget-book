"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownUp,
  Repeat2,
  ImagePlus,
  LoaderCircle,
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
import type { ImageTransactionDraft } from "@/lib/transaction-image";

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
  const [imageBatch, setImageBatch] = useState<ImageTransactionDraft[] | null>(
    null,
  );
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [imageError, setImageError] = useState("");
  const [customRecurring, setCustomRecurring] = useState<
    RecurringExpenseTemplate[]
  >([]);
  const [, setSettingsVersion] = useState(0);
  const recordsChangedBeforeLoad = useRef(false);
  const lastTouchRef = useRef<{ id: string; at: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
    setImageBatch(null);
    setImageError("");
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
  async function analyzeImage(
    image: File,
    month: string,
    defaultAccountId: string,
  ) {
    setImageAnalyzing(true);
    setImageError("");
    setImageBatch(null);
    try {
      const formData = new FormData();
      formData.append("image", image);
      formData.append(
        "context",
        JSON.stringify({
          month,
          defaultAccountId,
          accounts: accounts.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
          })),
          categories: categories.map((item) => ({
            majorCategory: item.majorCategory,
            minorCategory: item.minorCategory,
            transactionType: item.transactionType,
          })),
        }),
      );
      const response = await fetch("/api/transactions/analyze-image", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        transactions?: ImageTransactionDraft[];
        error?: string;
      };
      if (!response.ok || !payload.transactions?.length) {
        throw new Error(payload.error || "사진에서 거래를 찾지 못했습니다.");
      }
      setImageBatch(payload.transactions);
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "사진 분석 중 오류가 발생했습니다.",
      );
    } finally {
      setImageAnalyzing(false);
    }
  }
  function updateImageDraft(
    id: string,
    patch: Partial<ImageTransactionDraft>,
  ) {
    setImageBatch((rows) =>
      rows?.map((row) => (row.id === id ? { ...row, ...patch } : row)) ?? null,
    );
  }
  function changeImageDraftType(
    draft: ImageTransactionDraft,
    nextType: Transaction["type"],
  ) {
    if (nextType === "transfer") {
      updateImageDraft(draft.id, {
        type: nextType,
        category: "이동",
        minorCategory: "",
        toAccountId:
          draft.toAccountId ||
          accounts.find((item) => item.id !== draft.accountId)?.id ||
          "",
      });
      return;
    }
    const options = makeCategoryOptions(nextType);
    const nextCategory = Object.keys(options)[0] ?? "";
    updateImageDraft(draft.id, {
      type: nextType,
      category: nextCategory,
      minorCategory: options[nextCategory]?.[0] ?? "",
      toAccountId: "",
    });
  }
  async function registerImageBatch(
    selected: string[],
    updateSelected: (next: string[]) => void,
  ) {
    if (!imageBatch?.length) return;
    const invalid = imageBatch.some(
      (item) =>
        !item.name.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0 ||
        !accounts.some((account) => account.id === item.accountId) ||
        (item.type === "transfer" &&
          (!accounts.some((account) => account.id === item.toAccountId) ||
            item.accountId === item.toAccountId)),
    );
    if (invalid) {
      setImageError("내용, 금액, 통장 정보를 다시 확인해 주세요.");
      return;
    }
    const recordsToAdd: Transaction[] = imageBatch.map((item) => ({
      id: crypto.randomUUID(),
      accountId: item.accountId,
      toAccountId: item.type === "transfer" ? item.toAccountId : undefined,
      name: item.name.trim(),
      category: item.type === "transfer" ? "이동" : item.category,
      minorCategory:
        item.type === "transfer" ? undefined : item.minorCategory,
      amount: item.type === "income" ? item.amount : -item.amount,
      date: item.date.replaceAll("-", "."),
      type: item.type,
    }));
    if (await persistRecords([...recordsToAdd, ...records])) {
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
                  <input
                    ref={imageInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => {
                      const image = event.target.files?.[0];
                      event.target.value = "";
                      if (image) {
                        void analyzeImage(
                          image,
                          month,
                          accountId || selected[0] || "",
                        );
                      }
                    }}
                  />
                  <button
                    className="photo-import-trigger"
                    type="button"
                    disabled={imageAnalyzing || !accounts.length}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {imageAnalyzing ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ImagePlus size={17} />
                    )}
                    {imageAnalyzing
                      ? "사진에서 거래를 읽고 있어요"
                      : "사진에서 거래 불러오기"}
                  </button>
                  {imageError && <p className="photo-import-error">{imageError}</p>}
                  {imageBatch && (
                    <section className="image-transaction-picker">
                      <header>
                        <div>
                          <b>사진에서 {imageBatch.length}건을 찾았어요</b>
                          <small>내용을 확인하고 잘못 읽은 항목은 수정하거나 제외하세요.</small>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setImageBatch(null);
                            setImageError("");
                          }}
                        >
                          모두 취소
                        </button>
                      </header>
                      <div className="image-draft-list">
                        {imageBatch.map((draft) => {
                          const draftCategoryOptions = makeCategoryOptions(
                            draft.type === "income" ? "income" : "expense",
                          );
                          return (
                            <article className="image-draft" key={draft.id}>
                              <div className="image-draft-head">
                                <select
                                  value={draft.type}
                                  onChange={(event) =>
                                    changeImageDraftType(
                                      draft,
                                      event.target.value as Transaction["type"],
                                    )
                                  }
                                  aria-label={`${draft.name} 거래 유형`}
                                >
                                  <option value="expense">지출</option>
                                  <option value="income">수입</option>
                                  <option value="transfer">이동</option>
                                </select>
                                {draft.confidence < 0.75 && (
                                  <span>확인 필요</span>
                                )}
                                <button
                                  type="button"
                                  aria-label={`${draft.name} 제외`}
                                  onClick={() =>
                                    setImageBatch(
                                      (rows) =>
                                        rows?.filter((row) => row.id !== draft.id) ??
                                        null,
                                    )
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <div className="image-draft-main">
                                <input
                                  type="date"
                                  value={draft.date}
                                  onChange={(event) =>
                                    updateImageDraft(draft.id, {
                                      date: event.target.value,
                                    })
                                  }
                                  aria-label={`${draft.name} 날짜`}
                                />
                                <input
                                  value={draft.name}
                                  lang="ko-KR"
                                  onChange={(event) =>
                                    updateImageDraft(draft.id, {
                                      name: event.target.value,
                                    })
                                  }
                                  aria-label="사진 거래 내용"
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatNumber(draft.amount)}
                                  onChange={(event) =>
                                    updateImageDraft(draft.id, {
                                      amount: Number(
                                        parseNumberInput(event.target.value),
                                      ),
                                    })
                                  }
                                  aria-label={`${draft.name} 금액`}
                                />
                              </div>
                              <div className="image-draft-meta">
                                <select
                                  value={draft.accountId}
                                  onChange={(event) =>
                                    updateImageDraft(draft.id, {
                                      accountId: event.target.value,
                                    })
                                  }
                                  aria-label={`${draft.name} ${draft.type === "income" ? "입금" : "출금"} 통장`}
                                >
                                  {accounts.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                                {draft.type === "transfer" ? (
                                  <select
                                    value={draft.toAccountId}
                                    onChange={(event) =>
                                      updateImageDraft(draft.id, {
                                        toAccountId: event.target.value,
                                      })
                                    }
                                    aria-label={`${draft.name} 입금 통장`}
                                  >
                                    {accounts
                                      .filter((item) => item.id !== draft.accountId)
                                      .map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name}
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <>
                                    <select
                                      value={draft.category}
                                      onChange={(event) => {
                                        const nextCategory = event.target.value;
                                        updateImageDraft(draft.id, {
                                          category: nextCategory,
                                          minorCategory:
                                            draftCategoryOptions[nextCategory]?.[0] ??
                                            "",
                                        });
                                      }}
                                      aria-label={`${draft.name} 대분류`}
                                    >
                                      {Object.keys(draftCategoryOptions).map(
                                        (item) => (
                                          <option key={item}>{item}</option>
                                        ),
                                      )}
                                    </select>
                                    <select
                                      value={draft.minorCategory}
                                      onChange={(event) =>
                                        updateImageDraft(draft.id, {
                                          minorCategory: event.target.value,
                                        })
                                      }
                                      aria-label={`${draft.name} 소분류`}
                                    >
                                      {(
                                        draftCategoryOptions[draft.category] ?? []
                                      ).map((item) => (
                                        <option key={item}>{item}</option>
                                      ))}
                                    </select>
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      <button
                        className="register-image-batch"
                        type="button"
                        disabled={!imageBatch.length}
                        onClick={() =>
                          void registerImageBatch(selected, updateSelected)
                        }
                      >
                        확인한 {imageBatch.length}건 일괄 등록
                      </button>
                      <small className="photo-privacy-note">
                        사진은 거래 분석에만 사용되며 이 가계부에 저장되지 않습니다.
                      </small>
                    </section>
                  )}
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
