"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Wheel } from "@/components/wheel-picker";
import { type Account, type Transaction, won } from "@/lib/ledger";

/**
 * Categorical slots, in fixed order (the app's light palette, validated for colour-blind
 * separation on white). A few steps are under 3:1 contrast, so every slice is also named in the
 * legend beside it.
 */
const SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const OTHER = "기타";
const OTHER_COLOR = "#8b8f99";

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** The surface gap between slices. */
const GAP = 2;

type Slice = { name: string; amount: number; color: string };

/**
 * 통장별 지출 (as in the app): pick an account on a wheel, see what its money went on this month
 * as a donut, with a legend of the categories (name, share, amount).
 *
 * Accounts follow the order set in 가계부 설정. A category keeps its colour on every account: the
 * month's seven biggest categories overall get the slots, in that order, and the rest share 기타.
 */
export function AccountDonut({
  records,
  accounts,
  categoryOrder,
}: {
  /** The month's records. */
  records: Transaction[];
  accounts: Account[];
  /** The month's categories, biggest spending first (all accounts together). */
  categoryOrder: string[];
}) {
  const expenses = records.filter((item) => item.type === "expense");
  const spenders = accounts
    .map((account) => ({
      account,
      total: expenses
        .filter((item) => item.accountId === account.id)
        .reduce((sum, item) => sum + Math.abs(item.amount), 0),
    }))
    .filter((row) => row.total > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current =
    spenders.find((row) => row.account.id === picked) ?? spenders[0];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const colorOf = (category: string) => {
    const slot = categoryOrder.indexOf(category);
    return slot >= 0 && slot < SLOTS.length ? SLOTS[slot] : OTHER_COLOR;
  };
  const slices: Slice[] = [];
  if (current) {
    const sums = expenses
      .filter((item) => item.accountId === current.account.id)
      .reduce<Record<string, number>>((result, item) => {
        const name = colorOf(item.category) === OTHER_COLOR ? OTHER : item.category;
        result[name] = (result[name] ?? 0) + Math.abs(item.amount);
        return result;
      }, {});
    Object.entries(sums)
      .sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : b[1] - a[1]))
      .forEach(([name, amount]) =>
        slices.push({
          name,
          amount,
          color: name === OTHER ? OTHER_COLOR : colorOf(name),
        }),
      );
  }

  return (
    <section className="report-surface account-donut">
      <header>
        <div>
          <h2>통장별 지출</h2>
        </div>
        {current ? (
          <div className="account-filter" ref={menuRef}>
            <button
              type="button"
              className="account-control"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span>{current.account.name}</span>
              <ChevronDown size={15} />
            </button>
            {menuOpen && (
              <div className="account-menu wheel-menu">
                <Wheel
                  label="통장"
                  items={spenders.map(({ account }) => ({
                    value: account.id,
                    label: account.name,
                  }))}
                  value={current.account.id}
                  onChange={setPicked}
                />
                <button
                  type="button"
                  className="wheel-done"
                  onClick={() => setMenuOpen(false)}
                >
                  완료
                </button>
              </div>
            )}
          </div>
        ) : null}
      </header>
      {current ? (
        <div className="donut-body">
          <div className="donut-chart">
            <Donut slices={slices} total={current.total} />
            <div className="donut-center" aria-hidden>
              <span>지출</span>
              <strong>{won(current.total)}</strong>
            </div>
          </div>
          {/* The legend doubles as the table: every slice by name, share and amount. */}
          <ul className="donut-legend">
            {slices.map((slice) => (
              <li key={slice.name}>
                <i style={{ background: slice.color }} />
                <b>{slice.name}</b>
                <span>{Math.round((slice.amount / current.total) * 100)}%</span>
                <strong>{won(slice.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="donut-empty">이번 달 지출이 없어요</p>
      )}
    </section>
  );
}

function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const gap = slices.length > 1 ? GAP : 0;
  const lengths = slices.map((slice) => (slice.amount / total) * CIRCUMFERENCE);
  const summary = slices
    .map((slice) => `${slice.name} ${Math.round((slice.amount / total) * 100)}%`)
    .join(", ");
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`분류별 비율: ${summary}`}
      // Starts at 12 o'clock and runs clockwise.
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        stroke="var(--mist)"
        strokeWidth={STROKE}
        fill="none"
      />
      {slices.map((slice, i) => {
        const start = lengths.slice(0, i).reduce((sum, l) => sum + l, 0);
        const length = Math.max(0, lengths[i] - gap);
        return (
          <circle
            key={slice.name}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={slice.color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
            strokeDashoffset={-start}
          >
            <title>{`${slice.name} ${won(slice.amount)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
