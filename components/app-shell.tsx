"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  ChevronDown,
  CirclePlus,
  CreditCard,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  WalletCards,
  X,
} from "lucide-react";
import { accounts, hydrateLedgerSettings } from "@/lib/ledger";
import { readDefaultAccountIds } from "@/lib/budgets";
import { readSharedState } from "@/lib/shared-state";
import { Wheel, WheelRow, type WheelItem } from "@/components/wheel-picker";

type Scope = {
  selected: string[];
  activeLabel: string;
  month: string;
  updateSelected: (next: string[]) => void;
  setMonth: (next: string) => void;
};

const nav = [
  { href: "/", label: "보고서", icon: BarChart3 },
  { href: "/transactions", label: "거래 내역", icon: CreditCard },
  { href: "/balance", label: "잔고", icon: WalletCards },
  { href: "/savings", label: "저축 내역", icon: PiggyBank },
  { href: "/settings", label: "가계부 설정", icon: Settings },
];
/** Years on the wheel: ten back from the earlier of this year and the picked one, five ahead. */
function yearItems(picked: number): WheelItem<number>[] {
  const now = new Date().getFullYear();
  const from = Math.min(now, picked) - 10;
  const to = Math.max(now, picked) + 5;
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    value: from + i,
    label: `${from + i}년`,
  }));
}
const MONTH_ITEMS: WheelItem<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}월`,
}));

/** Year · month wheels. The year list is fixed when the menu opens, so the wheel never shifts. */
function MonthWheels({
  month,
  onYear,
  onMonth,
}: {
  month: string;
  onYear: (year: number) => void;
  onMonth: (month: number) => void;
}) {
  const [years] = useState(() => yearItems(Number(month.slice(0, 4))));
  return (
    <WheelRow>
      <Wheel
        bare
        label="연도"
        items={years}
        value={Number(month.slice(0, 4))}
        onChange={onYear}
      />
      <Wheel
        bare
        label="월"
        items={MONTH_ITEMS}
        value={Number(month.slice(5))}
        onChange={onMonth}
      />
    </WheelRow>
  );
}

export function AppShell({
  children,
}: {
  children: (scope: Scope) => ReactNode;
}) {
  const pathname = usePathname();
  const [selected, setSelected] = useState<string[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showMonths, setShowMonths] = useState(false);
  const [openNav, setOpenNav] = useState(false);
  const [month, setMonth] = useState("2026-08");
  const [settingsReady, setSettingsReady] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pendingMonth = useRef<string | null>(null);
  const pendingAccounts = useRef<string[] | null>(null);
  const pickMonth = useCallback((next: string) => {
    setMonth(next);
    window.localStorage.setItem("ledger-month", next);
  }, []);
  const closePickers = useCallback(() => {
    if (pendingMonth.current !== null) {
      pickMonth(pendingMonth.current);
      pendingMonth.current = null;
    }
    if (pendingAccounts.current !== null) {
      setSelected(pendingAccounts.current);
      window.localStorage.setItem(
        `ledger-selected-accounts:${pathname}`,
        JSON.stringify(pendingAccounts.current),
      );
      pendingAccounts.current = null;
    }
    setShowMonths(false);
    setShowAccounts(false);
  }, [pathname, pickMonth]);
  useEffect(() => {
    const savedMonth = window.localStorage.getItem("ledger-month");
    if (savedMonth) setMonth(savedMonth);
  }, []);
  useEffect(() => {
    void readSharedState("settings", {
      accounts: [],
      categories: [],
      startYear: new Date().getFullYear(),
      fiscalMonth: 1,
    }).then((settings) => {
      hydrateLedgerSettings(settings);
      setSettingsReady(true);
    });
  }, []);
  useEffect(() => {
    const storageKey = `ledger-selected-accounts:${pathname}`;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === null) {
      setSelected(readDefaultAccountIds());
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setSelected(
        Array.isArray(parsed)
          ? parsed.filter(
              (id): id is string =>
                typeof id === "string" &&
                accounts.some((account) => account.id === id),
            )
          : [],
      );
    } catch {
      setSelected([]);
    }
  }, [pathname, settingsReady]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) closePickers();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePickers();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closePickers]);
  const activeLabel = selected.length
    ? selected
        .map((id) => accounts.find((item) => item.id === id)?.name)
        .join(" · ")
    : "전체 통장";
  const filterLabel =
    selected.length === 0
      ? "전체 통장"
      : selected.length === 1
        ? activeLabel
        : `통장 ${selected.length}개 선택`;
  const isAccountScoped = pathname !== "/balance";
  const showHeaderControls =
    pathname === "/transactions" ||
    pathname === "/" ||
    pathname === "/balance";
  const updateSelected = (next: string[]) => {
    setSelected(next);
  };
  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
  const changeMonth = (next: string) => {
    closePickers();
    pickMonth(next);
  };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };
  return (
    <div className="app-frame">
      <aside className={openNav ? "sidebar opened" : "sidebar"}>
        <div className="side-top">
          <Link className="brand" href="/">
            <span>ㅈ</span> 잔잔한 가계부
          </Link>
          <button className="mobile-close" onClick={() => setOpenNav(false)}>
            <X size={19} />
          </button>
        </div>
        <nav>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              onClick={() => setOpenNav(false)}
              key={href}
              className={pathname === href ? "nav-active" : ""}
              href={href}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="side-note">
          <p>이번 달</p>
          <strong>2026년 8월</strong>
          <span>
            차분히 기록하는
            <br />
            나의 소비 흐름
          </span>
        </div>
        <button
          className="logout-button"
          onClick={() => void logout()}
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </aside>
      <div className="mobile-shade" onClick={() => setOpenNav(false)} />
      <main className="app-main">
        <header className="page-header">
          <button className="menu-button" onClick={() => setOpenNav(true)}>
            <Menu size={20} />
          </button>
          {showHeaderControls && (
            <div className="header-controls" ref={controlsRef}>
              <div className="month-picker">
                <button
                  className="month-control"
                  aria-expanded={showMonths}
                  onClick={() => {
                    closePickers();
                    setShowMonths(!showMonths);
                  }}
                >
                  {monthLabel} <ChevronDown size={15} />
                </button>
                {showMonths && (
                  <div className="month-menu wheel-menu">
                    <MonthWheels
                      month={month}
                      onYear={(year) => {
                        pendingMonth.current = `${year}-${(pendingMonth.current ?? month).slice(5)}`;
                      }}
                      onMonth={(monthNo) => {
                        const year = (pendingMonth.current ?? month).slice(0, 4);
                        pendingMonth.current = `${year}-${String(monthNo).padStart(2, "0")}`;
                      }}
                    />
                  </div>
                )}
              </div>
              {isAccountScoped && (
                <div className="account-filter">
                  <button
                    className="account-control"
                    aria-expanded={showAccounts}
                    onClick={() => {
                      closePickers();
                      setShowAccounts(!showAccounts);
                    }}
                  >
                    <span>{filterLabel}</span>
                    <ChevronDown size={15} />
                  </button>
                  {showAccounts && (
                    <div className="account-menu wheel-menu">
                      <p className="wheel-hint">
                        선택한 통장의 거래만 합산해요. 창을 닫으면 선택이 저장돼요.
                      </p>
                      <Wheel
                        label="통장"
                        items={[
                          { value: "", label: "전체 통장" },
                          ...accounts.map((account) => ({ value: account.id, label: account.name })),
                        ]}
                        value={selected.length === 1 ? selected[0] : ""}
                        onChange={(id) => {
                          pendingAccounts.current = id ? [id] : [];
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </header>
        <div className="page-content">
          {children({
            selected: isAccountScoped ? selected : [],
            activeLabel,
            month,
            updateSelected,
            setMonth: changeMonth,
          })}
        </div>
      </main>
      {pathname === "/transactions" && (
        <Link
          className="floating-add"
          href={`/transactions?add=true${selected[0] ? `&account=${encodeURIComponent(selected[0])}` : ""}`}
          aria-label="거래 기록 추가"
        >
          <CirclePlus size={25} />
        </Link>
      )}
      <nav className="mobile-tabs">
        {/* 보고서 · 거래 내역 · 잔고 */}
        {nav.slice(0, 3).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "tab-active" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
