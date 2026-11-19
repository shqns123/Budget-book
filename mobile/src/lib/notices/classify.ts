/**
 * What a captured notice should become in the ledger: 지출, 수입 or 이동, which accounts, which
 * 분류, and whether it is one of the 반복 항목 (a 고정비). Pure functions, so the 대기함 can work
 * them out again whenever the rules or the ledger change.
 *
 * Order for money going out (first match wins):
 *   1. a 반복 항목 the 상대방 was linked to before, or with the same name
 *   2. what the same 상대방 was registered as last time (remembered on 등록)
 *   3. 상대방 is one of "내 이름" → 이동 (to the account a matching 입금 notice came into)
 *   4. 상대방 holds a ledger account's name ("생활비이체" ↔ 생활비 통장) → 이동 to it
 *   5. 상대방 holds a 소분류 name ("식비이체" ↔ 식비) → 지출 in that 분류
 *   6. an 이체 keyword (카드대금, 이체) → 이동, 받는 통장 left to pick
 *   7. otherwise 지출, in the 분류 the same name had last time
 * A 반복 항목 that matches on account, day and amount but not by name is offered, not applied.
 */
import type { Account, LedgerCategory, RecurringTemplate, Transaction, TransactionType } from "@/lib/ledger";
import { counterpartyKey, type ParsedNotice } from "./parse";

/** What registering a 상대방 taught: used the next time it shows up. */
export type CounterpartyMemory = {
  type: TransactionType;
  name: string;
  category: string;
  minorCategory: string;
  toAccountId: string;
};

export type NoticeRules = {
  /** "내 이름": money sent to these is a move between my own accounts. */
  myNames: string[];
  /** Memo words that mean a move between accounts. */
  transferKeywords: string[];
  /** Card / account in the notices (ParsedNotice.source.key) → ledger account id. */
  sources: Record<string, string>;
  /** counterpartyKey → what it was registered as. */
  memory: Record<string, CounterpartyMemory>;
  /** counterpartyKey → the 반복 항목 it was confirmed as. */
  recurringAlias: Record<string, string>;
};

export const defaultRules = (): NoticeRules => ({
  myNames: [],
  transferKeywords: ["카드대금", "대금", "이체"],
  sources: {},
  memory: {},
  recurringAlias: {},
});

export type NoticeDraft = {
  type: TransactionType;
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  accountId: string;
  toAccountId: string;
  category: string;
  minorCategory: string;
  fixed: boolean;
  recurringId: string;
};

export type Classification = {
  draft: NoticeDraft;
  /** Why it was filled in this way, shown under the item. */
  reason: string;
  /** This month's record of the linked 반복 항목, when it is already in the ledger. */
  registeredId?: string;
  /** For a 취소 notice: the payment it cancels, when found. */
  cancelOf?: string;
  /** A 반복 항목 that fits on account, day and amount but isn't confirmed yet. */
  suggestion?: RecurringTemplate;
};

export type ClassifyContext = {
  accounts: Account[];
  categories: LedgerCategory[];
  recurring: RecurringTemplate[];
  transactions: Transaction[];
  rules: NoticeRules;
  /** The account a matching 입금 notice (same amount, minutes apart) came into, if any. */
  pairedToAccountId?: string;
};

const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const ledgerDate = (iso: string) => iso.replaceAll("-", ".");
const monthOf = (iso: string) => iso.slice(0, 7).replace("-", ".");

/** An account's name without the generic words: "생활비 통장" → "생활비". */
const accountCore = (name: string) => compact(name).replace(/통장|계좌|카드|은행|뱅크|입출금|저축|적금/g, "");

function daysApart(day: number, iso: string) {
  const [year, month, date] = iso.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return Math.abs(Math.min(day, last) - date);
}

/** The 반복 항목's record in the notice's month, if it was registered already. */
export function registeredThisMonth(template: RecurringTemplate, iso: string, transactions: Transaction[]) {
  const month = monthOf(iso);
  const type = template.type ?? "expense";
  return transactions.find(
    (t) =>
      t.date.startsWith(month) &&
      !t.linkedTo &&
      (t.recurringId
        ? t.recurringId === template.id
        : t.type === type &&
          t.name.trim() === template.name.trim() &&
          t.accountId === template.accountId &&
          (type === "transfer" || t.category === template.category)),
  );
}

function fromTemplate(template: RecurringTemplate, base: NoticeDraft): NoticeDraft {
  const type = template.type ?? "expense";
  return {
    ...base,
    type,
    name: template.name,
    accountId: base.accountId || template.accountId,
    toAccountId: type === "transfer" ? (template.toAccountId ?? "") : "",
    category: type === "transfer" ? "" : template.category,
    minorCategory: type === "transfer" ? "" : template.minorCategory,
    fixed: type === "expense",
    recurringId: template.id,
  };
}

/** Applies a 반복 항목 to a draft: what picking it in the 대기함 does. */
export const applyTemplate = fromTemplate;

function matchRecurring(notice: ParsedNotice, accountId: string, ctx: ClassifyContext) {
  const key = counterpartyKey(notice.counterparty);
  const fits = (t: RecurringTemplate) => {
    const type = t.type ?? "expense";
    return notice.direction === "in" ? type === "income" : type !== "income";
  };
  const templates = ctx.recurring.filter(fits);
  const aliased = templates.find((t) => t.id === ctx.rules.recurringAlias[key]);
  if (aliased) return { template: aliased, confirmed: true };
  const named = templates.find(
    (t) => counterpartyKey(t.name) === key && (!accountId || t.accountId === accountId),
  );
  if (named) return { template: named, confirmed: true };
  if (!accountId) return null;
  // Same account, within three days of its day (weekends move it), and the same amount, or close
  // to it (통신비, 관리비) when part of the name matches.
  const close = templates
    .filter((t) => t.accountId === accountId && daysApart(t.day, notice.date) <= 3)
    .find((t) => {
      if (t.amount === notice.amount) return true;
      const near = t.amount > 0 && Math.abs(t.amount - notice.amount) / t.amount <= 0.2;
      const name = counterpartyKey(t.name);
      return near && (key.includes(name) || name.includes(key));
    });
  return close ? { template: close, confirmed: false } : null;
}

/** The 분류 the same name was last recorded with. */
function lastCategory(name: string, type: "income" | "expense", transactions: Transaction[]) {
  const key = counterpartyKey(name);
  return transactions.find((t) => t.type === type && counterpartyKey(t.name) === key && t.category);
}

function categoryInName(counterparty: string, categories: LedgerCategory[], type: "income" | "expense") {
  const text = compact(counterparty);
  return categories
    .filter((c) => c.transactionType === type && compact(c.minorCategory).length >= 2)
    .sort((a, b) => b.minorCategory.length - a.minorCategory.length)
    .find((c) => text.includes(compact(c.minorCategory)));
}

/** The payment a 취소 notice undoes: same account and amount, up to 60 days before. */
function findCancelled(notice: ParsedNotice, accountId: string, ctx: ClassifyContext) {
  const until = notice.date;
  const from = new Date(notice.date);
  from.setDate(from.getDate() - 60);
  const since = from.toISOString().slice(0, 10);
  const key = counterpartyKey(notice.counterparty);
  const remembered = ctx.rules.memory[key]?.name;
  const candidates = ctx.transactions.filter((t) => {
    const date = t.date.replaceAll(".", "-");
    return (
      t.type === "expense" &&
      Math.abs(t.amount) === notice.amount &&
      date >= since &&
      date <= until &&
      (!accountId || t.accountId === accountId)
    );
  });
  return (
    candidates.find((t) => counterpartyKey(t.name) === key || (remembered && t.name === remembered)) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

export function classify(notice: ParsedNotice, ctx: ClassifyContext): Classification {
  const { rules, accounts } = ctx;
  const known = (id?: string) => Boolean(id && accounts.some((a) => a.id === id));
  const mapped = rules.sources[notice.source.key];
  const accountId = known(mapped) ? mapped : "";
  const key = counterpartyKey(notice.counterparty);
  const base: NoticeDraft = {
    type: notice.direction === "in" ? "income" : "expense",
    name: notice.counterparty,
    amount: notice.amount,
    date: notice.date,
    accountId,
    toAccountId: "",
    category: "",
    minorCategory: "",
    fixed: false,
    recurringId: "",
  };
  const withCategory = (draft: NoticeDraft): NoticeDraft => {
    if (draft.type === "transfer" || draft.category) return draft;
    const last = lastCategory(draft.name, draft.type === "income" ? "income" : "expense", ctx.transactions);
    return last ? { ...draft, category: last.category, minorCategory: last.minorCategory ?? "" } : draft;
  };

  if (notice.direction === "cancel") {
    const original = findCancelled(notice, accountId, ctx);
    return {
      draft: { ...base, type: "income", name: `${notice.counterparty} 취소` },
      cancelOf: original?.id,
      reason: original ? "취소된 결제를 장부에서 찾았어요" : "취소된 결제를 장부에서 찾지 못했어요",
    };
  }

  // 1. 반복 항목
  const recurring = matchRecurring(notice, accountId, ctx);
  if (recurring?.confirmed) {
    const draft = fromTemplate(recurring.template, base);
    return {
      draft,
      registeredId: registeredThisMonth(recurring.template, notice.date, ctx.transactions)?.id,
      reason: `반복 항목 '${recurring.template.name}'`,
    };
  }
  const suggestion = recurring?.template;
  const result = (draft: NoticeDraft, reason: string): Classification => ({
    draft: withCategory(draft),
    reason,
    suggestion,
  });

  // 2. what this 상대방 was last time
  const memory = rules.memory[key];
  if (memory) {
    const toAccountId = memory.type === "transfer" ? ctx.pairedToAccountId || memory.toAccountId : "";
    return result(
      {
        ...base,
        type: memory.type,
        name: memory.name || base.name,
        category: memory.type === "transfer" ? "" : memory.category,
        minorCategory: memory.type === "transfer" ? "" : memory.minorCategory,
        toAccountId: known(toAccountId) ? toAccountId : "",
      },
      "지난번과 같은 내용으로 채웠어요",
    );
  }

  const mine = rules.myNames.some((n) => n.trim() && compact(n) === compact(notice.counterparty));

  if (notice.direction === "in") {
    if (mine) {
      // From another of my accounts: an 이동 into this one (보내는 통장 left to pick).
      return result(
        { ...base, type: "transfer", accountId: "", toAccountId: accountId },
        "내 이름으로 들어온 돈이에요",
      );
    }
    return result(base, "입금");
  }

  // 3. 내 이름
  if (mine) {
    return result(
      { ...base, type: "transfer", toAccountId: ctx.pairedToAccountId ?? "" },
      "내 이름으로 보낸 돈이라 계좌 간 이동이에요",
    );
  }
  // 4. a ledger account's name in the memo
  const text = compact(notice.counterparty);
  const target = accounts
    .filter((a) => a.id !== accountId && !a.hidden && accountCore(a.name).length >= 2)
    .find((a) => text.includes(accountCore(a.name)));
  if (target) {
    return result({ ...base, type: "transfer", toAccountId: target.id }, `메모에 '${target.name}'이 있어요`);
  }
  // 5. a 소분류 in the memo
  const category = categoryInName(notice.counterparty, ctx.categories, "expense");
  if (category) {
    return result(
      { ...base, category: category.majorCategory, minorCategory: category.minorCategory },
      `메모에 '${category.minorCategory}'가 있어요`,
    );
  }
  // 6. 이체 keyword
  if (rules.transferKeywords.some((word) => word.trim() && text.includes(compact(word)))) {
    return result(
      { ...base, type: "transfer", toAccountId: ctx.pairedToAccountId ?? "" },
      "이체 메모라 계좌 간 이동으로 채웠어요",
    );
  }
  // 7. 지출
  return result(base, notice.source.kind === "card" ? "카드 결제" : "출금");
}

/** A record like this one already in the ledger (the other member may have added it). */
export function similarRecord(draft: NoticeDraft, transactions: Transaction[]) {
  const date = ledgerDate(draft.date);
  return transactions.find(
    (t) =>
      !t.linkedTo &&
      t.date === date &&
      t.accountId === draft.accountId &&
      Math.abs(t.amount) === draft.amount &&
      t.type === draft.type,
  );
}

/** The ledger record a draft becomes. */
export function toTransaction(draft: NoticeDraft, id: string): Transaction {
  const transfer = draft.type === "transfer";
  return {
    id,
    accountId: draft.accountId,
    toAccountId: transfer ? draft.toAccountId : undefined,
    name: draft.name.trim(),
    category: transfer ? "이동" : draft.category,
    minorCategory: transfer ? undefined : draft.minorCategory,
    amount: draft.type === "income" ? draft.amount : -draft.amount,
    date: ledgerDate(draft.date),
    type: draft.type,
    ...(draft.type === "expense" && draft.fixed ? { fixed: true } : {}),
    ...(draft.recurringId ? { recurringId: draft.recurringId } : {}),
  };
}

/** What's missing before a draft can be registered, or "". */
export function draftProblem(draft: NoticeDraft, accounts: Account[]) {
  const known = (id: string) => accounts.some((a) => a.id === id);
  if (!draft.name.trim()) return "내용을 입력해 주세요.";
  if (!(draft.amount > 0)) return "금액을 입력해 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "날짜를 골라 주세요.";
  if (draft.type === "transfer") {
    if (!known(draft.accountId)) return "보내는 통장을 골라 주세요.";
    if (!known(draft.toAccountId) || draft.toAccountId === draft.accountId) return "받는 통장을 골라 주세요.";
    return "";
  }
  if (!known(draft.accountId)) return draft.type === "income" ? "입금 통장을 골라 주세요." : "출금 통장·카드를 골라 주세요.";
  if (!draft.category) return "분류를 골라 주세요.";
  return "";
}
