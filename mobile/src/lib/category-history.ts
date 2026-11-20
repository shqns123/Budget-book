/**
 * 분류 추천 from the ledger's own records: the 대분류 / 소분류 a name like this one was recorded with
 * last. Used by the 결제 알림 대기함 and the photo import before asking the server's model.
 */
import type { Transaction } from "@/lib/ledger";

/** "쿠팡 (쿠페이)" → "쿠팡쿠페이": no spaces or brackets, lower case. */
export const nameKey = (value: string) => value.replace(/[\s()[\]]/g, "").toLowerCase();

/** The name without what is in brackets: "쿠팡(쿠페이)" → "쿠팡". */
const nameRoot = (value: string) => nameKey(value.replace(/\([^)]*\)|\[[^\]]*\]/g, ""));

/** One name starts with the other, the shorter at least three letters: "스타벅스" ↔ "스타벅스강남점". */
function sharesStart(a: string, b: string) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

/**
 * The newest record of this type whose name is the same, the same without brackets, or starts the
 * same, that has a 분류. Records are newest first in the ledger.
 */
export function pastCategory(name: string, type: "income" | "expense", transactions: Transaction[]) {
  const key = nameKey(name);
  const root = nameRoot(name);
  if (!key) return undefined;
  const rows = transactions.filter((t) => t.type === type && t.category && !t.linkedTo);
  return (
    rows.find((t) => nameKey(t.name) === key) ??
    (root.length >= 2 ? rows.find((t) => nameRoot(t.name) === root) : undefined) ??
    rows.find((t) => sharesStart(nameRoot(t.name), root))
  );
}

/** Where a filled-in 분류 came from, for the tag beside it. */
export type CategorySource = "history" | "model";

/**
 * A 분류 the server's model suggested for a name ("" when it couldn't tell), with the row's id
 * (분류 아이디) so a later rename still fills it in.
 */
export type SuggestedCategory = { category: string; minorCategory: string; categoryId?: string };

/** The key a model suggestion is kept under: the name and the type it was asked for. */
export const suggestionKey = (name: string, type: "income" | "expense") => `${type}|${nameKey(name)}`;
