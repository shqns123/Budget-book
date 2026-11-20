/**
 * The 대기함's items and what each one shows: the captured notice, what the rules make of it
 * (lib/notices/classify), and the user's own changes on top. Pure, like classify.
 */
import {
  classify,
  guessAccount,
  sourceAccount,
  type Classification,
  type ClassifyContext,
  type NoticeDraft,
} from "./classify";
import { currentCategory } from "@/lib/ledger";
import type { ParsedNotice } from "./parse";

export type InboxItem = {
  /** The id the phone gave the notice (a hash of its app and text). */
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  /** Epoch milliseconds */
  postedAt: number;
  /** null while the model reads it, or when nothing could. */
  parsed: ParsedNotice | null;
  status: "ready" | "analyzing" | "unread";
  /** The 분류 the model suggested, for a notice only it could read. */
  modelCategory?: { category: string; minorCategory: string; categoryId?: string };
  /** What the user changed in the editor: laid over what the rules filled in. */
  edits: Partial<NoticeDraft>;
};

export type InboxView = {
  item: InboxItem;
  classification: Classification;
  /** What 등록 records: the rules' draft with the user's edits. */
  draft: NoticeDraft;
  /**
   * The second notice of the same payment, shown as part of this one: the card company's 카드 대금
   * notice (`parsed.bill`), or the 입금 notice of the same move (my own money arriving).
   */
  paired?: InboxItem;
  /** Filter key: the ledger account, or the notice's card / account while it has none. */
  sourceKey: string;
  sourceLabel: string;
  /** The draft has a ledger account (found by 메모 number, or picked). */
  linked: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** For a notice nobody could read: the text as the 내용, the rest left to fill in. */
function unreadClassification(item: InboxItem): Classification {
  const firstLine = `${item.title} ${item.text}`.replace(/\s+/g, " ").trim().slice(0, 40);
  return {
    draft: {
      type: "expense",
      name: firstLine,
      amount: 0,
      date: isoOf(item.postedAt),
      accountId: "",
      toAccountId: "",
      category: "",
      minorCategory: "",
      fixed: false,
      recurringId: "",
    },
    reason: item.status === "analyzing" ? "알림을 읽고 있어요" : "알림을 읽지 못했어요. 직접 채워 주세요",
  };
}

function classifyItem(item: InboxItem, ctx: ClassifyContext): Classification {
  if (!item.parsed) return unreadClassification(item);
  const result = classify(item.parsed, ctx);
  const type = result.draft.type;
  if (!item.modelCategory?.category || result.draft.category || type === "transfer") return result;
  // The model's 분류 as it is now (by id, after a rename); a 분류 that is gone isn't filled in.
  const model = currentCategory(item.modelCategory, type, ctx.categories);
  if (!model) return result;
  return {
    ...result,
    draft: { ...result.draft, category: model.category, minorCategory: model.minorCategory },
    categoryFrom: "model",
  };
}

const PAIR_WINDOW = 10 * 60 * 1000;
/** A bank 출금 without "카드" in its memo is merged with a 카드 대금 notice only this close. */
const BILL_CLOSE = 2 * 60 * 1000;

/**
 * The card company's 카드 대금 notice of the same payment as this bank 출금: same amount, within ten
 * minutes when the bank's memo says 카드 ("KB카드출금"), else within two.
 */
function billNotice(item: InboxItem, sorted: InboxItem[], taken: Set<string>) {
  const parsed = item.parsed;
  if (!parsed || parsed.bill || parsed.direction !== "out" || parsed.source.kind !== "account") return undefined;
  const window = /카드/.test(parsed.counterparty) ? PAIR_WINDOW : BILL_CLOSE;
  return sorted.find(
    (other) =>
      !taken.has(other.id) &&
      other.parsed?.bill &&
      other.parsed.amount === parsed.amount &&
      Math.abs(other.postedAt - item.postedAt) <= window,
  );
}

/** A bank 출금 and the card company's notice of it: the card notice's 이동, from the bank's account. */
function classifyBill(bank: ParsedNotice, bill: ParsedNotice, ctx: ClassifyContext): Classification {
  const from = sourceAccount(bank, ctx);
  const result = classify(bill, { ...ctx, fromAccountId: from.accountId });
  return from.guessed && result.draft.accountId === from.accountId ? { ...result, accountGuessed: true } : result;
}

/**
 * Every item's view, newest first. Two notices of one payment are shown as one:
 * - a bank 출금 and the card company's 카드 대금 notice of it: the card notice's 이동 (its name,
 *   its card), from the bank notice's account;
 * - a withdrawal that turns out to be a move between my accounts and the matching deposit notice
 *   (same amount, within ten minutes, another account), which becomes its 받는 통장.
 * The second notice isn't listed on its own.
 */
export function buildViews(items: InboxItem[], ctx: ClassifyContext, accountName: (id: string) => string) {
  const sorted = [...items].sort((a, b) => b.postedAt - a.postedAt);
  const taken = new Set<string>();
  const bills = new Map<string, InboxItem>();
  for (const item of sorted) {
    const bill = billNotice(item, sorted, taken);
    if (bill) {
      bills.set(item.id, bill);
      taken.add(bill.id);
    }
  }
  const first = new Map(sorted.map((item) => [item.id, classifyItem(item, ctx)]));
  const pairedIn = new Map<string, InboxItem>();
  for (const item of sorted) {
    const result = first.get(item.id)!;
    if (bills.has(item.id) || taken.has(item.id)) continue;
    if (item.parsed?.direction !== "out" || result.draft.type !== "transfer" || item.edits.toAccountId) continue;
    const match = sorted.find(
      (other) =>
        !taken.has(other.id) &&
        other.parsed?.direction === "in" &&
        other.parsed.amount === item.parsed!.amount &&
        other.parsed.source.key !== item.parsed!.source.key &&
        Math.abs(other.postedAt - item.postedAt) <= PAIR_WINDOW,
    );
    if (match) {
      pairedIn.set(item.id, match);
      taken.add(match.id);
    }
  }

  return sorted
    .filter((item) => !taken.has(item.id))
    .map((item): InboxView => {
      const bill = bills.get(item.id);
      const paired = bill ?? pairedIn.get(item.id);
      const pairedTo = !bill && paired?.parsed ? guessAccount(paired.parsed.source, ctx.accounts) : undefined;
      const classification =
        bill?.parsed && item.parsed
          ? classifyBill(item.parsed, bill.parsed, ctx)
          : pairedTo
            ? classifyItem(item, { ...ctx, pairedToAccountId: pairedTo })
            : first.get(item.id)!;
      const draft = { ...classification.draft, ...item.edits };
      const linked = Boolean(draft.accountId && ctx.accounts.some((a) => a.id === draft.accountId));
      const sourceKey = linked ? `account:${draft.accountId}` : `source:${item.parsed?.source.key ?? "?"}`;
      const sourceLabel = linked
        ? accountName(draft.accountId)
        : item.parsed
          ? `${item.parsed.source.label} (통장 없음)`
          : "읽지 못한 알림";
      return { item, classification, draft, paired, sourceKey, sourceLabel, linked };
    });
}

/** The 출처 wheel's rows: each card / account with its count, most items first. */
export function sourceOptions(views: InboxView[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const view of views) {
    const entry = counts.get(view.sourceKey) ?? { label: view.sourceLabel, count: 0 };
    entry.count += 1;
    counts.set(view.sourceKey, entry);
  }
  return [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
