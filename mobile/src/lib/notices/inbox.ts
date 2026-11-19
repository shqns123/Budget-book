/**
 * The 대기함's items and what each one shows: the captured notice, what the rules make of it
 * (lib/notices/classify), and the user's own changes on top. Pure, like classify.
 */
import { classify, type Classification, type ClassifyContext, type NoticeDraft } from "./classify";
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
  modelCategory?: { category: string; minorCategory: string };
  /** What the user changed in the editor: laid over what the rules filled in. */
  edits: Partial<NoticeDraft>;
};

export type InboxView = {
  item: InboxItem;
  classification: Classification;
  /** What 등록 records: the rules' draft with the user's edits. */
  draft: NoticeDraft;
  /** The 입금 notice of the same move (my own money arriving), shown as part of this one. */
  paired?: InboxItem;
  /** Filter key: the ledger account, or the notice's card / account until it's linked. */
  sourceKey: string;
  sourceLabel: string;
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
  const model = item.modelCategory;
  if (model?.category && !result.draft.category && result.draft.type !== "transfer") {
    return { ...result, draft: { ...result.draft, ...model } };
  }
  return result;
}

const PAIR_WINDOW = 10 * 60 * 1000;

/**
 * Every item's view, newest first. A withdrawal that turns out to be a move between my accounts
 * takes the matching deposit notice (same amount, within ten minutes, another account) as its
 * 받는 통장, and that deposit isn't listed on its own.
 */
export function buildViews(items: InboxItem[], ctx: ClassifyContext, accountName: (id: string) => string) {
  const sorted = [...items].sort((a, b) => b.postedAt - a.postedAt);
  const first = new Map(sorted.map((item) => [item.id, classifyItem(item, ctx)]));
  const pairedIn = new Map<string, InboxItem>();
  const taken = new Set<string>();
  for (const item of sorted) {
    const result = first.get(item.id)!;
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
      const paired = pairedIn.get(item.id);
      const pairedTo = paired?.parsed ? ctx.rules.sources[paired.parsed.source.key] : undefined;
      const classification = pairedTo
        ? classifyItem(item, { ...ctx, pairedToAccountId: pairedTo })
        : first.get(item.id)!;
      const draft = { ...classification.draft, ...item.edits };
      const linked = Boolean(draft.accountId && ctx.accounts.some((a) => a.id === draft.accountId));
      const sourceKey = linked ? `account:${draft.accountId}` : `source:${item.parsed?.source.key ?? "?"}`;
      const sourceLabel = linked
        ? accountName(draft.accountId)
        : item.parsed
          ? `${item.parsed.source.label} (미연결)`
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
