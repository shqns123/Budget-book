import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { readState, writeState } from "@/lib/api";
import {
  emptySettings,
  migrateSettings,
  normalizeSettings,
  type MonthlyBudget,
  type RecurringTemplate,
  type SharedSettings,
  type Transaction,
} from "@/lib/ledger";
import type {
  MonthlySavingsMonth,
  MonthlySavingsPlan,
  SavingsEntry,
  SavingsGoal,
  SavingsPlanItem,
} from "@/lib/savings";

export type LedgerData = {
  transactions: Transaction[];
  budgets: MonthlyBudget[];
  recurring: RecurringTemplate[];
  settings: SharedSettings;
  savingsGoals: SavingsGoal[];
  savingsEntries: SavingsEntry[];
  savingsPlan: SavingsPlanItem[];
  monthlySavingsPlans: MonthlySavingsPlan[];
  monthlySavingsMonths: MonthlySavingsMonth[];
};

export type LedgerKey = keyof LedgerData;

const KEYS: LedgerKey[] = [
  "settings",
  "transactions",
  "budgets",
  "recurring",
  "savingsGoals",
  "savingsEntries",
  "savingsPlan",
  "monthlySavingsPlans",
  "monthlySavingsMonths",
];

const initialData = (): LedgerData => ({
  transactions: [],
  budgets: [],
  recurring: [],
  settings: emptySettings(),
  savingsGoals: [],
  savingsEntries: [],
  savingsPlan: [],
  monthlySavingsPlans: [],
  monthlySavingsMonths: [],
});

type SaveOptions = {
  /** Wait this long for more edits before writing (typing into a field). */
  debounce?: number;
};

type LedgerStore = {
  data: LedgerData;
  status: "loading" | "ready" | "error";
  loadError: string;
  saveError: string;
  clearSaveError: () => void;
  refreshing: boolean;
  refresh: () => Promise<void>;
  save: <K extends LedgerKey>(
    key: K,
    next: LedgerData[K] | ((current: LedgerData[K]) => LedgerData[K]),
    options?: SaveOptions,
  ) => Promise<boolean>;
  accounts: ReturnType<typeof normalizeSettings>["accounts"];
  categories: ReturnType<typeof normalizeSettings>["categories"];
};

const LedgerContext = createContext<LedgerStore | null>(null);

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LedgerData>(initialData);
  const dataRef = useRef(data);
  const [status, setStatus] = useState<LedgerStore["status"]>("loading");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const queues = useRef(new Map<LedgerKey, Promise<void>>());
  const timers = useRef(new Map<LedgerKey, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<LedgerKey, unknown>());

  const commit = useCallback((next: LedgerData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const flush = useCallback((key: LedgerKey) => {
    if (!pending.current.has(key)) return queues.current.get(key) ?? Promise.resolve();
    const value = pending.current.get(key);
    pending.current.delete(key);
    const previous = queues.current.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => writeState(key, value));
    queues.current.set(key, next);
    return next;
  }, []);

  const load = useCallback(async () => {
    const values = await Promise.all(KEYS.map((key) => readState<unknown>(key)));
    const loaded = Object.fromEntries(KEYS.map((key, i) => [key, values[i]])) as LedgerData;
    loaded.settings = { ...emptySettings(), ...(loaded.settings ?? {}) };
    const { settings, migrated } = migrateSettings(loaded.settings, loaded.transactions ?? []);
    loaded.settings = settings;
    // Keep anything the user changed while this request was in flight.
    const current = dataRef.current;
    const merged = { ...loaded } as LedgerData;
    for (const key of KEYS) {
      if (pending.current.has(key) || timers.current.has(key)) {
        (merged as Record<LedgerKey, unknown>)[key] = current[key];
      }
    }
    commit(merged);
    if (migrated) void writeState("settings", settings).catch(() => undefined);
  }, [commit]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      setStatus("ready");
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error, "가계부를 불러오지 못했어요."));
      setStatus((s) => (s === "ready" ? s : "error"));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    // load() only touches state after its network await, so nothing here renders synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then(() => {
        setStatus("ready");
        setLoadError("");
      })
      .catch((error) => {
        setLoadError(errorMessage(error, "가계부를 불러오지 못했어요."));
        setStatus("error");
      });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [load, refresh]);

  const save = useCallback<LedgerStore["save"]>(
    async (key, next, options = {}) => {
      const current = dataRef.current;
      const value =
        typeof next === "function"
          ? (next as (c: LedgerData[typeof key]) => LedgerData[typeof key])(current[key])
          : next;
      commit({ ...current, [key]: value });
      pending.current.set(key, value);
      const timer = timers.current.get(key);
      if (timer) clearTimeout(timer);
      timers.current.delete(key);
      const run = async () => {
        try {
          await flush(key);
          setSaveError("");
          return true;
        } catch (error) {
          setSaveError(errorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
          return false;
        }
      };
      if (options.debounce) {
        timers.current.set(
          key,
          setTimeout(() => {
            timers.current.delete(key);
            void run();
          }, options.debounce),
        );
        return true;
      }
      return run();
    },
    [commit, flush],
  );

  const normalized = useMemo(() => normalizeSettings(data.settings), [data.settings]);

  const value = useMemo<LedgerStore>(
    () => ({
      data,
      status,
      loadError,
      saveError,
      clearSaveError: () => setSaveError(""),
      refreshing,
      refresh,
      save,
      accounts: normalized.accounts,
      categories: normalized.categories,
    }),
    [data, status, loadError, saveError, refreshing, refresh, save, normalized],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const store = useContext(LedgerContext);
  if (!store) throw new Error("useLedger must be used inside LedgerProvider");
  return store;
}
