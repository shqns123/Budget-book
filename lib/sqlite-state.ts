import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { linkRecords, withCategoryIds } from "@/lib/category-links";
import { defaultSavingsGoals, defaultSavingsPlan } from "@/lib/savings";

const databasePath =
  process.env.SQLITE_DATABASE_PATH ||
  path.join(process.cwd(), "data", "ledger.db");
let databasePromise: Promise<Database> | undefined;
let writeQueue = Promise.resolve();

const defaults: Record<string, unknown> = {
  transactions: [],
  budgets: [],
  recurring: [],
  savingsGoals: defaultSavingsGoals,
  savingsEntries: [],
  savingsPlan: defaultSavingsPlan,
  monthlySavingsPlans: [],
  monthlySavingsMonths: [],
  settings: {
    accounts: [],
    categories: [],
    startYear: new Date().getFullYear(),
    fiscalMonth: 1,
  },
};

function getDatabasePath() {
  return databasePath.startsWith("/") || /^[A-Za-z]:/.test(databasePath)
    ? databasePath
    : path.join(process.cwd(), databasePath);
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await initSqlJs({
        locateFile: (file) =>
          path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
      });
      const target = getDatabasePath();
      mkdirSync(path.dirname(target), { recursive: true });
      const db = new SQL.Database(
        existsSync(target) ? readFileSync(target) : undefined,
      );
      db.run(`CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      persist(db);
      return db;
    })().catch((error) => {
      // Do not permanently poison the in-memory connection after one failed
      // initialization attempt (for example, while the data volume mounts).
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

function persist(db: Database) {
  writeFileSync(getDatabasePath(), Buffer.from(db.export()));
}

function normalizeStateValue(key: keyof typeof defaults, value: unknown) {
  if (key !== "transactions" || !Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const transaction = item as Record<string, unknown>;
    return typeof transaction.date === "string"
      ? { ...transaction, date: transaction.date.replaceAll("-", ".") }
      : transaction;
  });
}

export function isStateKey(key: string): key is keyof typeof defaults {
  return key in defaults;
}

const UPSERT = `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`;

function storedValue(db: Database, key: string): unknown {
  const raw = db.exec("SELECT value FROM app_state WHERE key = ?", [key])[0]?.values[0]?.[0];
  if (!raw) return undefined;
  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
}

type CategoryRows = Parameters<typeof withCategoryIds>[0];
type Records = Parameters<typeof linkRecords>[0];

const categoriesOf = (settings: unknown): CategoryRows => {
  const rows = (settings as { categories?: unknown } | undefined)?.categories;
  return Array.isArray(rows) ? (rows as CategoryRows) : [];
};

/**
 * What storing `value` under `key` writes, with the 분류 아이디 kept up (lib/category-links): settings
 * rows get their ids and the stored transactions / 반복 항목 follow a rename; transactions and
 * 반복 항목 are linked to the stored settings' rows and take their current names.
 */
function withCategoryLinks(db: Database, key: string, value: unknown): [string, unknown][] {
  if (key === "settings" && value && typeof value === "object") {
    const previous = categoriesOf(storedValue(db, "settings"));
    const settings = { ...(value as object), categories: withCategoryIds(categoriesOf(value), previous) };
    const updates: [string, unknown][] = [["settings", settings]];
    for (const recordsKey of ["transactions", "recurring"]) {
      const rows = storedValue(db, recordsKey);
      if (!Array.isArray(rows)) continue;
      const linked = linkRecords(rows as Records, settings.categories);
      if (linked.some((row, index) => row !== rows[index])) updates.push([recordsKey, linked]);
    }
    return updates;
  }
  if ((key === "transactions" || key === "recurring") && Array.isArray(value)) {
    // Settings not given ids yet get the same ids their own first read gives them.
    const stored = categoriesOf(storedValue(db, "settings"));
    return [[key, linkRecords(value as Records, withCategoryIds(stored, stored))]];
  }
  return [[key, value]];
}

export async function readState(key: keyof typeof defaults) {
  const db = await getDatabase();
  const stored = storedValue(db, key);
  if (stored === undefined) {
    const value = defaults[key];
    await writeState(key, value);
    return value;
  }
  const [[, value], ...cascade] = withCategoryLinks(db, key, normalizeStateValue(key, stored));
  if (cascade.length || JSON.stringify(value) !== JSON.stringify(stored)) {
    try {
      await writeState(key, value);
    } catch {
      // Reading valid data should still succeed if a one-time migration
      // cannot be written immediately. A later read will retry it.
    }
  }
  return value;
}

export async function writeState(key: keyof typeof defaults, value: unknown) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await getDatabase();
      for (const [rowKey, rowValue] of withCategoryLinks(db, key, normalizeStateValue(key, value))) {
        db.run(UPSERT, [rowKey, JSON.stringify(rowValue)]);
      }
      persist(db);
    });
  return writeQueue;
}

/**
 * Server-only values kept in the same table under keys the state API never serves (it only
 * accepts the keys in `defaults`), e.g. the member list.
 */
export async function readPrivateState<T>(key: `__${string}`, fallback: T): Promise<T> {
  const db = await getDatabase();
  const result = db.exec("SELECT value FROM app_state WHERE key = ?", [key]);
  const raw = result[0]?.values[0]?.[0];
  if (!raw) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export async function writePrivateState(key: `__${string}`, value: unknown) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await getDatabase();
      db.run(
        `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value)],
      );
      persist(db);
    });
  return writeQueue;
}
