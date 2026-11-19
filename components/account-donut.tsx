"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Wheel } from "@/components/wheel-picker";
import { type Account, type Transaction, won } from "@/lib/ledger";
import { donutGeometry } from "@/mobile/src/lib/donut-segment";

/**
 * Categorical colors in the same order as the app's light palette. Every slice also has a
 * text label in the legend.
 */
const SLOTS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6",
  "#8c573b", "#00869a", "#ad3561", "#6a7d20", "#486292", "#ae6c16", "#8558a0",
];
const OTHER = "기타";
const UNCLASSIFIED = "미분류";
const OTHER_COLOR = "#8b8f99";

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const TIP_WIDTH = 148;

type Slice = { name: string; amount: number; color: string; items: Transaction[] };

const pct = (amount: number, total: number) => Math.round((amount / total) * 100);
const categoryName = (item: Transaction) => item.category?.trim() || UNCLASSIFIED;
const shortDate = (date: string) => {
  const [, month, day] = date.replaceAll(".", "-").split("-");
  return `${Number(month)}월 ${Number(day)}일`;
};

/**
 * 통장별 지출 (as in the app): pick an account on a wheel, see what its money went on this month
 * as a donut, with a legend of the categories (name, share, amount).
 *
 * Press or drag across the ring to see each slice's name, share and amount; click a legend row to open it
 * into a card listing that category's spending.
 *
 * Accounts follow the order set in 가계부 설정. Each recorded category keeps its own name and
 * uses the same color across accounts for the month.
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
  const [active, setActive] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingAccount = useRef<string | null>(null);
  const current =
    spenders.find((row) => row.account.id === picked) ?? spenders[0];

  const closeMenu = useCallback(() => {
    if (pendingAccount.current !== null) {
      setPicked(pendingAccount.current);
      pendingAccount.current = null;
      setActive(null);
      setOpenRow(null);
    }
    setMenuOpen(false);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [menuOpen, closeMenu]);

  const colorOrder = [...new Set([...categoryOrder.map((name) => name.trim()), ...expenses.map(categoryName)])];
  const colorOf = (name: string) =>
    name === OTHER || name === UNCLASSIFIED ? OTHER_COLOR : SLOTS[colorOrder.indexOf(name) % SLOTS.length];
  const slices: Slice[] = [];
  if (current) {
    const groups = expenses
      .filter((item) => item.accountId === current.account.id)
      .reduce((result, item) => {
        const name = categoryName(item);
        const rows = result.get(name) ?? [];
        rows.push(item);
        result.set(name, rows);
        return result;
      }, new Map<string, Transaction[]>());
    Array.from(groups)
      .map(([name, items]) => ({
        name,
        amount: items.reduce((sum, item) => sum + Math.abs(item.amount), 0),
        color: colorOf(name),
        items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) =>
        a.name === OTHER ? 1 : b.name === OTHER ? -1 : b.amount - a.amount,
      )
      .forEach((slice) => slices.push(slice));
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
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
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
                  onChange={(id) => {
                    pendingAccount.current = id === current.account.id ? null : id;
                  }}
                />
              </div>
            )}
          </div>
        ) : null}
      </header>
      {current ? (
        <div className="donut-body">
          <Donut
            slices={slices}
            total={current.total}
            active={active}
            onSelect={setActive}
          />
          {/* The legend doubles as the table: every slice by name, share and amount. */}
          <ul className="donut-legend">
            {slices.map((slice) => {
              const open = openRow === slice.name;
              return (
                <li key={slice.name} className={open ? "open" : ""}>
                  <button
                    type="button"
                    className="donut-row"
                    aria-expanded={open}
                    onClick={() => setOpenRow(open ? null : slice.name)}
                  >
                    <i style={{ background: slice.color }} />
                    <b>{slice.name}</b>
                    <span>{pct(slice.amount, current.total)}%</span>
                    <strong>{won(slice.amount)}</strong>
                    <ChevronDown size={15} className="donut-row-chevron" />
                  </button>
                  {/* Eases open (grid rows 0fr → 1fr); hidden from tab order while shut. */}
                  <div className="donut-fold" inert={!open}>
                    <div>
                      {slice.items.map((item) => (
                        <div className="donut-item" key={item.id}>
                          <div>
                            <b>{item.name}</b>
                            <small>
                              {shortDate(item.date)} ·{" "}
                              {item.minorCategory?.trim() || UNCLASSIFIED}
                            </small>
                          </div>
                          <strong>−{won(item.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="donut-empty">이번 달 지출이 없어요</p>
      )}
    </section>
  );
}

/**
 * Round joins connect the slices. Dragging switches the table; tapping the selected
 * slice, the hole, or outside the chart closes it.
 */
function Donut({
  slices,
  total,
  active,
  onSelect,
}: {
  slices: Slice[];
  total: number;
  active: string | null;
  onSelect: (name: string | null) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    firstSlice: string;
    moved: boolean;
    wasOpen: boolean;
  } | null>(null);
  const [bounds, setBounds] = useState({ min: -Infinity, max: Infinity });
  const { segments, indexAt } = donutGeometry(
    slices.map((slice) => slice.amount), SIZE / 2, R - STROKE / 2, R + STROKE / 2,
  );

  // A click anywhere outside the chart closes the table.
  useEffect(() => {
    if (!active) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) onSelect(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [active, onSelect]);

  // Which slice is under the pointer: by its angle from 12 o'clock, if it lands on the ring.
  const sliceAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - box.left) / box.width) * SIZE - SIZE / 2;
    const dy = ((event.clientY - box.top) / box.height) * SIZE - SIZE / 2;
    return slices[indexAt(dx, dy)]?.name ?? null;
  };
  const startGesture = (event: PointerEvent<SVGSVGElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const slice = sliceAt(event);
    if (slice === null) {
      onSelect(null);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const card = chartRef.current?.closest(".report-surface")?.getBoundingClientRect();
    if (card) {
      setBounds({
        min: card.left + 12 - box.left,
        max: card.right - 12 - box.left - TIP_WIDTH,
      });
    }
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      firstSlice: slice,
      moved: false,
      wasOpen: active === slice,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(slice);
  };
  const moveGesture = (event: PointerEvent<SVGSVGElement>) => {
    const touch = gesture.current;
    if (!touch || touch.id !== event.pointerId) return;
    const slice = sliceAt(event);
    if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 4 || (slice !== null && slice !== touch.firstSlice)) {
      touch.moved = true;
    }
    if (touch.moved && slice !== null) onSelect(slice);
  };
  const endGesture = (event: PointerEvent<SVGSVGElement>) => {
    const touch = gesture.current;
    if (!touch || touch.id !== event.pointerId) return;
    gesture.current = null;
    if (event.type === "pointerup" && !touch.moved && touch.wasOpen) onSelect(null);
  };

  const activeIndex = slices.findIndex((slice) => slice.name === active);
  const activeSlice = activeIndex >= 0 ? slices[activeIndex] : null;
  const activeSegment = segments[activeIndex];
  let tipStyle: { left: number; top: number; transform: string } | null = null;
  if (activeSegment) {
    // Beside the middle of the slice, on its outer edge, toward the roomier side.
    const { angle } = activeSegment;
    const reach = R + STROKE / 2;
    const px = SIZE / 2 + reach * Math.sin(angle);
    const py = SIZE / 2 - reach * Math.cos(angle);
    const right = Math.sin(angle) >= 0;
    const left = right ? px + 8 : px - 8 - TIP_WIDTH;
    tipStyle = {
      left: Math.max(bounds.min, Math.min(bounds.max, left)),
      top: py,
      transform: "translateY(-50%)",
    };
  }
  const summary = slices
    .map((slice) => `${slice.name} ${pct(slice.amount, total)}%`)
    .join(", ");

  return (
    <div className="donut-chart" ref={chartRef}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`분류별 비율: ${summary}`}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
      >
        <g>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="var(--mist)"
            strokeWidth={STROKE}
            fill="none"
          />
          {segments.map((segment, i) => segment && (
            <path
              key={slices[i].name}
              d={segment.path}
              fill={slices[i].color}
              fillOpacity={activeSlice && activeIndex !== i ? 0.35 : 1}
            />
          ))}
        </g>
      </svg>
      <div className="donut-center" aria-hidden>
        <span>지출</span>
        <strong>{won(total)}</strong>
      </div>
      {activeSlice && tipStyle ? (
        <div className="donut-tip" style={tipStyle} role="status">
          <b>{activeSlice.name}</b>
          <p>
            <i style={{ background: activeSlice.color }} />
            <span>비율</span>
            <strong>{pct(activeSlice.amount, total)}%</strong>
          </p>
          <p>
            <i />
            <span>금액</span>
            <strong>−{won(activeSlice.amount)}</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}
