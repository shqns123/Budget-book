import AsyncStorage from "@react-native-async-storage/async-storage";
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
import * as Capture from "../../modules/notification-capture";
import { apiJson } from "@/lib/api";
import { suggestionKey, type SuggestedCategory } from "@/lib/category-history";
import { currentCategory } from "@/lib/ledger";
import { confirm } from "@/lib/confirm";
import { defaultRules, type NoticeDraft, type NoticeRules } from "@/lib/notices/classify";
import type { InboxItem } from "@/lib/notices/inbox";
import { looksLikePayment, parseNotice, sourceFor, type RawNotice } from "@/lib/notices/parse";
import { useLedger } from "@/store/ledger-store";

// The 대기함 lives on this phone only: the notices' text never goes to the ledger server (only a
// notice the rules can't read is sent to the server's model, and only its text).
const ITEMS_KEY = "ledger-notice-inbox";
const RULES_KEY = "ledger-notice-rules";
const FILTER_KEY = "ledger-notice-filter";
const MAX_ITEMS = 300;
/** The model's 분류 추천 by name, so each 가맹점 is asked once. */
const SUGGEST_KEY = "ledger-notice-category-suggestions";
const MAX_SUGGESTIONS = 500;
const SUGGEST_BATCH = 20;
/** Asked once per app start (not on every remount of the signed-in screens). */
let accessAsked = false;

type ModelNotice = {
  isTransaction: boolean;
  direction: "out" | "in" | "cancel";
  amount: number;
  currency: string;
  date: string;
  time: string;
  counterparty: string;
  number: string;
  kind: "card" | "account";
  installment: number;
  category: string;
  minorCategory: string;
};

type InboxStore = {
  ready: boolean;
  items: InboxItem[];
  rules: NoticeRules;
  /** Android with the native module (not Expo Go, not iOS). */
  supported: boolean;
  /** 알림 접근 is on. */
  access: boolean;
  checkAccess: () => void;
  openAccess: () => void;
  /** Reads newly captured notices into the 대기함. */
  sync: () => Promise<void>;
  edit: (id: string, patch: Partial<NoticeDraft>) => void;
  resetEdits: (id: string) => void;
  remove: (ids: string[]) => void;
  retry: (id: string) => void;
  setRules: (update: (rules: NoticeRules) => NoticeRules) => void;
  /** The 출처 wheel's pick ("" = 전체). */
  filter: string;
  setFilter: (key: string) => void;
  /** 분류 the server model suggested, by suggestionKey ("" when it couldn't tell). */
  suggested: Record<string, SuggestedCategory>;
  /** Asks the model once for names with no 분류 and no similar record yet. */
  suggestCategories: (wanted: { name: string; type: "income" | "expense" }[]) => void;
};

const InboxContext = createContext<InboxStore | null>(null);

const readJson = <T,>(raw: string | null | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function InboxProvider({ children }: { children: ReactNode }) {
  const { categories } = useLedger();
  const [ready, setReady] = useState(false);
  const [items, setItemsState] = useState<InboxItem[]>([]);
  const [rules, setRulesState] = useState<NoticeRules>(defaultRules);
  const [filter, setFilterState] = useState("");
  const [access, setAccess] = useState(() => Capture.hasAccess());
  const itemsRef = useRef(items);
  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  const syncing = useRef<Promise<void> | null>(null);
  const [suggested, setSuggestedState] = useState<Record<string, SuggestedCategory>>({});
  const suggestedRef = useRef(suggested);
  const asking = useRef(new Set<string>());
  const suggestFailedAt = useRef(0);

  const suggestCategories = useCallback((wanted: { name: string; type: "income" | "expense" }[]) => {
    if (Date.now() - suggestFailedAt.current < 60_000 || !categoriesRef.current.length) return;
    const fresh = new Map<string, { name: string; type: "income" | "expense" }>();
    for (const item of wanted) {
      const key = suggestionKey(item.name, item.type);
      if (item.name.trim() && !(key in suggestedRef.current) && !asking.current.has(key)) fresh.set(key, item);
    }
    const batch = [...fresh.entries()].slice(0, SUGGEST_BATCH);
    if (!batch.length) return;
    for (const [key] of batch) asking.current.add(key);
    void (async () => {
      try {
        const { suggestions } = await apiJson<{ suggestions: SuggestedCategory[] }>(
          "/api/transactions/suggest-category",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: batch.map(([, item]) => item),
              categories: categoriesRef.current.map((c) => ({
                majorCategory: c.majorCategory,
                minorCategory: c.minorCategory,
                transactionType: c.transactionType,
              })),
            }),
          },
        );
        // Kept even when empty, so a name the model couldn't place isn't asked again.
        const next = { ...suggestedRef.current };
        batch.forEach(([key, item], index) => {
          const s = suggestions?.[index];
          const names = { category: s?.category ?? "", minorCategory: s?.minorCategory ?? "" };
          // With the row's id, so the suggestion survives a rename of the 분류.
          const row = names.category ? currentCategory(names, item.type, categoriesRef.current) : undefined;
          next[key] = row?.categoryId ? { ...names, categoryId: row.categoryId } : names;
        });
        const trimmed = Object.fromEntries(Object.entries(next).slice(-MAX_SUGGESTIONS));
        suggestedRef.current = trimmed;
        setSuggestedState(trimmed);
        void AsyncStorage.setItem(SUGGEST_KEY, JSON.stringify(trimmed)).catch(() => undefined);
      } catch {
        // Offline or the server said no: try again a minute later.
        suggestFailedAt.current = Date.now();
      } finally {
        for (const [key] of batch) asking.current.delete(key);
      }
    })();
  }, []);

  const setItems = useCallback((update: (current: InboxItem[]) => InboxItem[]) => {
    const next = update(itemsRef.current).slice(0, MAX_ITEMS);
    itemsRef.current = next;
    setItemsState(next);
    return AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const analyze = useCallback(
    async (item: InboxItem) => {
      try {
        const { notice } = await apiJson<{ notice: ModelNotice }>("/api/transactions/analyze-notice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            text: item.text,
            appName: item.appName,
            postedAt: item.postedAt,
            categories: categoriesRef.current.map((c) => ({
              majorCategory: c.majorCategory,
              minorCategory: c.minorCategory,
              transactionType: c.transactionType,
            })),
          }),
        });
        if (!notice.isTransaction) {
          // Not a payment after all (an ad the rules let through): drop it.
          await setItems((current) => current.filter((i) => i.id !== item.id));
          return;
        }
        await setItems((current) =>
          current.map((i) =>
            i.id !== item.id
              ? i
              : {
                  ...i,
                  status: "ready",
                  parsed: {
                    direction: notice.direction,
                    amount: notice.amount,
                    currency: notice.currency,
                    date: notice.date,
                    time: notice.time,
                    counterparty: notice.counterparty || i.appName,
                    source: sourceFor(i, notice.number, notice.kind),
                    installment: notice.installment,
                    via: "model",
                  },
                  modelCategory: notice.category
                    ? (() => {
                        const names = { category: notice.category, minorCategory: notice.minorCategory };
                        const type = notice.direction === "in" ? "income" : "expense";
                        const row = currentCategory(names, type, categoriesRef.current);
                        return row?.categoryId ? { ...names, categoryId: row.categoryId } : names;
                      })()
                    : undefined,
                },
          ),
        );
      } catch {
        await setItems((current) => current.map((i) => (i.id === item.id ? { ...i, status: "unread" } : i)));
      }
    },
    [setItems],
  );

  const sync = useCallback(() => {
    // One read at a time: the event and the app coming to the front can arrive together.
    if (syncing.current) return syncing.current;
    const run = (async () => {
      const captured = Capture.getPending();
      if (!captured.length) return;
      const have = new Set(itemsRef.current.map((i) => i.id));
      const fresh: InboxItem[] = captured
        .filter((c) => !have.has(c.id) && looksLikePayment(`${c.title}\n${c.text}`))
        .map((c) => {
          const raw: RawNotice = c;
          const parsed = parseNotice(raw);
          return { ...c, parsed, status: parsed ? "ready" : "analyzing", edits: {} };
        });
      await setItems((current) => [...fresh, ...current]);
      // Only now that the 대기함 holds them, the phone's queue lets them go.
      Capture.removePending(captured.map((c) => c.id));
      for (const item of fresh.filter((i) => i.status === "analyzing")) await analyze(item);
    })().finally(() => {
      syncing.current = null;
    });
    syncing.current = run;
    return run;
  }, [analyze, setItems]);

  useEffect(() => {
    void (async () => {
      try {
        const entries = Object.fromEntries(
          await AsyncStorage.multiGet([ITEMS_KEY, RULES_KEY, FILTER_KEY, SUGGEST_KEY]),
        );
        const cached = readJson<Record<string, SuggestedCategory>>(entries[SUGGEST_KEY], {});
        suggestedRef.current = cached && typeof cached === "object" ? cached : {};
        setSuggestedState(suggestedRef.current);
        const saved = readJson<InboxItem[]>(entries[ITEMS_KEY], []);
        itemsRef.current = Array.isArray(saved) ? saved : [];
        setItemsState(itemsRef.current);
        setRulesState({ ...defaultRules(), ...readJson<Partial<NoticeRules>>(entries[RULES_KEY], {}) });
        setFilterState(entries[FILTER_KEY] ?? "");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void sync();
    // Items left reading when the app closed: read them again.
    for (const item of itemsRef.current.filter((i) => i.status === "analyzing")) void analyze(item);
    const subscription = Capture.addNoticeListener(() => void sync());
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setAccess(Capture.hasAccess());
      void sync();
    });
    return () => {
      subscription?.remove();
      appState.remove();
    };
  }, [ready, sync, analyze]);

  // Each time the app starts with 알림 접근 off: offer to turn it on.
  useEffect(() => {
    if (accessAsked || !Capture.isSupported || Capture.hasAccess()) return;
    accessAsked = true;
    void confirm({
      title: "결제 알림 읽기를 켤까요?",
      message:
        "카드 승인·출금 알림을 결제 알림 대기함에 모으려면 알림 접근이 필요해요. 설정 화면에서 잔잔한 가계부를 켜 주세요.",
      confirmLabel: "켜기",
    }).then((ok) => {
      if (ok) Capture.openAccessSettings();
    });
  }, []);

  const edit = useCallback(
    (id: string, patch: Partial<NoticeDraft>) =>
      void setItems((current) => current.map((i) => (i.id === id ? { ...i, edits: { ...i.edits, ...patch } } : i))),
    [setItems],
  );

  const resetEdits = useCallback(
    (id: string) => void setItems((current) => current.map((i) => (i.id === id ? { ...i, edits: {} } : i))),
    [setItems],
  );

  const remove = useCallback(
    (ids: string[]) => void setItems((current) => current.filter((i) => !ids.includes(i.id))),
    [setItems],
  );

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      void setItems((current) => current.map((i) => (i.id === id ? { ...i, status: "analyzing" } : i))).then(() =>
        analyze(item),
      );
    },
    [analyze, setItems],
  );

  const setRules = useCallback((update: (rules: NoticeRules) => NoticeRules) => {
    setRulesState((current) => {
      const next = update(current);
      void AsyncStorage.setItem(RULES_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const setFilter = useCallback((key: string) => {
    setFilterState(key);
    void AsyncStorage.setItem(FILTER_KEY, key).catch(() => undefined);
  }, []);

  const value = useMemo<InboxStore>(
    () => ({
      ready,
      items,
      rules,
      supported: Capture.isSupported,
      access,
      checkAccess: () => setAccess(Capture.hasAccess()),
      openAccess: () => void Capture.openAccessSettings(),
      sync,
      edit,
      resetEdits,
      remove,
      retry,
      setRules,
      filter,
      setFilter,
      suggested,
      suggestCategories,
    }),
    [
      ready,
      items,
      rules,
      access,
      sync,
      edit,
      resetEdits,
      remove,
      retry,
      setRules,
      filter,
      setFilter,
      suggested,
      suggestCategories,
    ],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const store = useContext(InboxContext);
  if (!store) throw new Error("useInbox must be used inside InboxProvider");
  return store;
}
