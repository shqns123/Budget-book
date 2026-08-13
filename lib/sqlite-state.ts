import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import importedLedger from "@/data/imported-ledger.json";
import sheet26Recurring from "@/data/sheet26-recurring.json";
import { defaultSavingsGoals, defaultSavingsPlan } from "@/lib/savings";

const databasePath =
  process.env.SQLITE_DATABASE_PATH ||
  path.join(process.cwd(), "data", "ledger.db");
let databasePromise: Promise<Database> | undefined;
let writeQueue = Promise.resolve();

const initialTransactions = importedLedger.transactions
  .map((transaction) => ({
    id: transaction.id,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? undefined,
    name: transaction.memo,
    category: transaction.category,
    minorCategory: transaction.minorCategory ?? undefined,
    amount:
      transaction.type === "income" ? transaction.amount : -transaction.amount,
    date: transaction.date.replaceAll("-", "."),
    type: transaction.type,
    fixed: transaction.isFixed,
  }))
  .sort((left, right) => right.date.localeCompare(left.date));

const initialAccounts = importedLedger.accounts.map((account) => ({
  id: account.id,
  code: account.accountCode,
  classification:
    account.classification === "asset"
      ? "자산"
      : account.classification === "short_liability"
        ? "단기부채"
        : "장기부채",
  major: account.majorCategory,
  minor: account.minorCategory,
  name: account.name,
  balance: account.openingBalance,
  memo: account.memo ?? "",
  kind: account.type,
  paymentDay: account.paymentDay ?? undefined,
  hidden: account.isHidden,
}));

const initialCategories = importedLedger.categories.map((category) => ({
  major: category.majorCategory,
  minor: category.minorCategory,
  fixed: category.isFixed,
}));

const defaults: Record<string, unknown> = {
  transactions: initialTransactions,
  budgets: [],
  recurring: sheet26Recurring,
  savingsGoals: defaultSavingsGoals,
  savingsEntries: [],
  savingsPlan: defaultSavingsPlan,
  settings: {
    accounts: initialAccounts,
    categories: initialCategories,
    startYear: importedLedger.settings.startYear,
    fiscalMonth: importedLedger.settings.fiscalStartMonth,
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

export async function readState(key: keyof typeof defaults) {
  const db = await getDatabase();
  const result = db.exec("SELECT value FROM app_state WHERE key = ?", [key]);
  if (!result[0]?.values[0]?.[0]) {
    const value = defaults[key];
    await writeState(key, value);
    return value;
  }
  try {
    const storedValue = JSON.parse(String(result[0].values[0][0]));
    const normalizedValue = normalizeStateValue(key, storedValue);
    if (JSON.stringify(normalizedValue) !== JSON.stringify(storedValue)) {
      try {
        await writeState(key, normalizedValue);
      } catch {
        // Reading valid data should still succeed if a one-time migration
        // cannot be written immediately. A later read will retry it.
      }
    }
    return normalizedValue;
  } catch {
    return defaults[key];
  }
}

export async function writeState(key: keyof typeof defaults, value: unknown) {
  const normalizedValue = normalizeStateValue(key, value);
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await getDatabase();
      db.run(
        `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(normalizedValue)],
      );
      persist(db);
    });
  return writeQueue;
}
