/**
 * 분류 아이디: every category row (대분류 + 소분류) gets a stable id, and transactions and 반복 항목
 * point at it with `categoryId`. Their category / minorCategory names are then refreshed from the
 * row, so renaming a category (taking an emoji off, say) never cuts the link.
 *
 * The server applies this on every read and write of settings, transactions and recurring
 * (lib/sqlite-state.ts), so older app versions that know nothing of ids stay linked too.
 * mobile/src/lib/category-links.ts is the same logic for the app's own view; keep them in step.
 */

type CategoryRow = {
  id?: string;
  major: string;
  minor: string;
  transactionType?: "income" | "expense";
  [key: string]: unknown;
};

type LinkedRecord = {
  type?: string;
  category?: string;
  minorCategory?: string;
  categoryId?: string;
  [key: string]: unknown;
};

/**
 * A name with only its Hangul, Latin letters and digits: "🏠 주거비" → "주거비". Letter-like
 * symbols go too ("ℕ취미여가비" → "취미여가비"), since phones draw some emoji as them.
 */
export const categoryNameKey = (value: unknown) =>
  String(value ?? "")
    .replace(/[^0-9A-Za-zㄱ-ㆎ가-힣]/g, "")
    .toLowerCase();

/** FNV-1a, so the same row gets the same id wherever it is first given one. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const typeOf = (row: CategoryRow) => (row.transactionType === "income" ? "income" : "expense");
const rowKey = (row: CategoryRow) =>
  `${typeOf(row)}|${categoryNameKey(row.major)}|${categoryNameKey(row.minor)}`;

/**
 * Rows keep their id. A row without one takes the id it had before (`previous`: the stored
 * settings) by its name, or by its place when it was renamed before it ever had an id; a new row
 * gets one from its name.
 */
export function withCategoryIds<T extends CategoryRow>(categories: T[], previous: CategoryRow[] = []): T[] {
  const taken = new Set(categories.map((row) => row.id).filter((id): id is string => Boolean(id)));
  const previousByKey = new Map<string, string>();
  for (const row of previous) {
    if (row.id && !previousByKey.has(rowKey(row))) previousByKey.set(rowKey(row), row.id);
  }
  const free = (id: string | undefined) => (id && !taken.has(id) ? id : undefined);
  return categories.map((row, index) => {
    if (row.id) return row;
    const before = previous[index];
    let id =
      free(previousByKey.get(rowKey(row))) ??
      (before && typeOf(before) === typeOf(row) ? free(before.id) : undefined);
    if (!id) {
      const base = `c${hash(rowKey(row))}`;
      id = base;
      for (let n = 2; taken.has(id); n += 1) id = `${base}${n}`;
    }
    taken.add(id);
    return { ...row, id };
  });
}

/**
 * The row a record belongs to. Names that are a row's exact names win (the record was moved to
 * another category in an editor that kept the old id); then its id (the row was renamed, so the
 * old names are gone); then the names without emoji and spaces (records from before the ids).
 */
function findRow(record: LinkedRecord, categories: CategoryRow[], byId: Map<string, CategoryRow>) {
  const type = record.type === "income" ? "income" : "expense";
  const rows = categories.filter((row) => row.id && typeOf(row) === type);
  const major = String(record.category ?? "");
  const minor = String(record.minorCategory ?? "");
  const exact = rows.find((row) => row.major === major && (!minor || row.minor === minor));
  if (exact) {
    // Several rows can share a 대분류 when the minor is empty: keep the linked one among them.
    const linked = record.categoryId ? byId.get(record.categoryId) : undefined;
    return !minor && linked?.major === major && typeOf(linked) === type ? linked : exact;
  }
  if (record.categoryId && byId.has(record.categoryId)) return byId.get(record.categoryId);
  const majorKey = categoryNameKey(major);
  const minorKey = categoryNameKey(minor);
  if (!majorKey) return undefined;
  return rows.find(
    (row) => categoryNameKey(row.major) === majorKey && (!minorKey || categoryNameKey(row.minor) === minorKey),
  );
}

/**
 * Links each 지출 / 수입 record to its category row and takes the row's current names. A record
 * whose row is gone keeps its names (and id); one that matches no row is left as it was.
 */
export function linkRecords<T extends LinkedRecord>(records: T[], categories: CategoryRow[]): T[] {
  const byId = new Map(categories.filter((row) => row.id).map((row) => [row.id as string, row]));
  return records.map((record) => {
    if (!record || typeof record !== "object" || record.type === "transfer" || !record.category) return record;
    const row = findRow(record, categories, byId);
    if (!row?.id) return record;
    const minorCategory = record.minorCategory ? row.minor : record.minorCategory;
    if (record.categoryId === row.id && record.category === row.major && record.minorCategory === minorCategory) {
      return record;
    }
    return { ...record, categoryId: row.id, category: row.major, minorCategory };
  });
}
