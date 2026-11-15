import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { currentMonth } from "@/lib/dates";

/** Screens that keep their own account selection, as on the web. */
export type Scope = "overview" | "transactions" | "reports";
const SCOPES: Scope[] = ["overview", "transactions", "reports"];

type Prefs = {
  month: string;
  setMonth: (month: string) => void;
  selected: Record<Scope, string[]>;
  setSelected: (scope: Scope, ids: string[]) => void;
  /** Persist the current selection of a scope (the 저장 button). */
  saveSelected: (scope: Scope) => void;
  sortByDate: boolean;
  setSortByDate: (value: boolean) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

const MONTH_KEY = "ledger-month";
const SORT_KEY = "ledger-transaction-sort";
const selectionKey = (scope: Scope) => `ledger-selected-accounts:${scope}`;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState(currentMonth);
  const [selected, setSelectedState] = useState<Record<Scope, string[]>>({
    overview: [],
    transactions: [],
    reports: [],
  });
  const [sortByDate, setSortState] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          MONTH_KEY,
          SORT_KEY,
          ...SCOPES.map(selectionKey),
        ]);
        const map = Object.fromEntries(entries);
        if (map[MONTH_KEY]) setMonthState(map[MONTH_KEY]);
        setSortState(map[SORT_KEY] === "date-desc");
        const next = { overview: [], transactions: [], reports: [] } as Record<Scope, string[]>;
        for (const scope of SCOPES) {
          try {
            const parsed = JSON.parse(map[selectionKey(scope)] ?? "[]");
            next[scope] = Array.isArray(parsed)
              ? parsed.filter((id): id is string => typeof id === "string")
              : [];
          } catch {
            next[scope] = [];
          }
        }
        setSelectedState(next);
      } catch {
        // Preferences are conveniences; defaults are fine.
      }
    })();
  }, []);

  const setMonth = useCallback((next: string) => {
    setMonthState(next);
    void AsyncStorage.setItem(MONTH_KEY, next).catch(() => undefined);
  }, []);

  const setSelected = useCallback((scope: Scope, ids: string[]) => {
    setSelectedState((current) => ({ ...current, [scope]: ids }));
  }, []);

  const saveSelected = useCallback(
    (scope: Scope) => {
      void AsyncStorage.setItem(selectionKey(scope), JSON.stringify(selected[scope])).catch(
        () => undefined,
      );
    },
    [selected],
  );

  const setSortByDate = useCallback((value: boolean) => {
    setSortState(value);
    void AsyncStorage.setItem(SORT_KEY, value ? "date-desc" : "created").catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ month, setMonth, selected, setSelected, saveSelected, sortByDate, setSortByDate }),
    [month, setMonth, selected, setSelected, saveSelected, sortByDate, setSortByDate],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside PrefsProvider");
  return prefs;
}
