/**
 * 분류 아이디 in the app: transactions and 반복 항목 point at their category row by `categoryId`
 * and show its current names, so a rename in 가계부 설정 shows everywhere at once.
 *
 * The server owns the ids (lib/category-links.ts: it gives rows their ids and links and renames
 * the stored records on every save). Here the app only follows them for what it shows before the
 * next load: by id, or by the exact names for a record made in this session.
 */
import type { CategorySetting } from "@/lib/ledger";

type LinkedRecord = {
  type?: string;
  category: string;
  minorCategory?: string;
  categoryId?: string;
};

export function followCategoryNames<T extends LinkedRecord>(records: T[], categories: CategorySetting[]): T[] {
  const rows = categories.filter((row) => row.id);
  if (!rows.length) return records;
  const byId = new Map(rows.map((row) => [row.id as string, row]));
  let changed = false;
  const next = records.map((record) => {
    if (record.type === "transfer" || !record.category) return record;
    const type = record.type === "income" ? "income" : "expense";
    // Exact names win (moved to another category in an editor); else the id (the row was renamed).
    const exact = rows.find(
      (r) =>
        r.transactionType === type &&
        r.major === record.category &&
        (!record.minorCategory || r.minor === record.minorCategory),
    );
    const linked = record.categoryId ? byId.get(record.categoryId) : undefined;
    const row =
      exact && !record.minorCategory && linked?.major === record.category && linked.transactionType === type
        ? linked
        : (exact ?? linked);
    if (!row?.id) return record;
    const minorCategory = record.minorCategory ? row.minor : record.minorCategory;
    if (record.categoryId === row.id && record.category === row.major && record.minorCategory === minorCategory) {
      return record;
    }
    changed = true;
    return { ...record, categoryId: row.id, category: row.major, minorCategory };
  });
  return changed ? next : records;
}
