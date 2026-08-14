import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
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
