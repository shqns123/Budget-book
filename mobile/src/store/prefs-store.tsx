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
  /** Persist a scope's selection (the 저장 button): `ids`, or the current one. */
  saveSelected: (scope: Scope, ids?: string[]) => void;
  sortByDate: boolean;
  setSortByDate: (value: boolean) => void;
  /** Last accounts used for "자금 이동 같이 기록" (from → 월급통장). */
  linkTransfer: LinkTransfer;
  setLinkTransfer: (value: LinkTransfer) => void;
};

export type LinkTransfer = { from: string; to: string };

const PrefsContext = createContext<Prefs | null>(null);

const MONTH_KEY = "ledger-month";
const SORT_KEY = "ledger-transaction-sort";
const LINK_KEY = "ledger-link-transfer";
const selectionKey = (scope: Scope) => `ledger-selected-accounts:${scope}`;

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState(currentMonth);
  const [selected, setSelectedState] = useState<Record<Scope, string[]>>({
    overview: [],
    transactions: [],
    reports: [],
  });
  const [sortByDate, setSortState] = useState(false);
  const [linkTransfer, setLinkState] = useState<LinkTransfer>({ from: "", to: "" });

  useEffect(() => {
    void (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          MONTH_KEY,
          SORT_KEY,
          LINK_KEY,
          ...SCOPES.map(selectionKey),
        ]);
        const map = Object.fromEntries(entries);
        if (map[MONTH_KEY]) setMonthState(map[MONTH_KEY]);
        setSortState(map[SORT_KEY] === "date-desc");
        try {
          const link = JSON.parse(map[LINK_KEY] ?? "null") as Partial<LinkTransfer> | null;
          if (typeof link?.from === "string" && typeof link?.to === "string") {
            setLinkState({ from: link.from, to: link.to });
          }
        } catch {
          // ignore a broken value
        }
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
    (scope: Scope, ids: string[] = selected[scope]) => {
      void AsyncStorage.setItem(selectionKey(scope), JSON.stringify(ids)).catch(
        () => undefined,
      );
    },
    [selected],
  );

  const setSortByDate = useCallback((value: boolean) => {
    setSortState(value);
    void AsyncStorage.setItem(SORT_KEY, value ? "date-desc" : "created").catch(() => undefined);
  }, []);

  const setLinkTransfer = useCallback((next: LinkTransfer) => {
    setLinkState(next);
    void AsyncStorage.setItem(LINK_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      month,
      setMonth,
      selected,
      setSelected,
      saveSelected,
      sortByDate,
      setSortByDate,
      linkTransfer,
      setLinkTransfer,
    }),
    [month, setMonth, selected, setSelected, saveSelected, sortByDate, setSortByDate, linkTransfer, setLinkTransfer],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside PrefsProvider");
  return prefs;
}
