"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export type WheelItem<T extends string | number> = { value: T; label: string };

const ITEM_H = 40;
/** Rows on show: the picked one in the middle, two above and two below. */
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/**
 * An iOS-style wheel: a column that scrolls and snaps one row at a time (CSS scroll snap), the
 * picked row in the middle band, the rows above and below turning away. Drag, scroll, click
 * a row or use the arrow keys to move it. `onChange` reports the nearest row while scrolling.
 *
 * `value` sets where it starts; turning the wheel doesn't wait for `value` to come back.
 */
export function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  label,
  bare,
}: {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Leave out the middle band (WheelRow draws one across its wheels). */
  bare?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [start] = useState(() => Math.max(0, items.findIndex((item) => item.value === value)));
  const [index, setIndex] = useState(start);
  const pickedIndex = useRef(start);
  const dragCleanup = useRef<(() => void) | null>(null);
  const ignoreClick = useRef(false);
  const clampIndex = (i: number) => Math.min(items.length - 1, Math.max(0, i));

  // Tilt and fade each row by its distance from the middle.
  const paint = () => {
    const list = listRef.current;
    if (!list) return;
    const center = list.scrollTop;
    Array.from(list.children).forEach((child, i) => {
      const d = Math.max(-2, Math.min(2, (i * ITEM_H - center) / ITEM_H));
      const el = child.firstElementChild as HTMLElement;
      el.style.opacity = String(1 - Math.abs(d) * 0.37);
      el.style.transform = `perspective(600px) rotateX(${-d * 25}deg) scale(${1 - Math.abs(d) * 0.07})`;
    });
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = start * ITEM_H;
    paint();
    return () => dragCleanup.current?.();
    // Mount only: place the wheel on the starting value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickIndex = (next: number) => {
    const item = items[next];
    if (!item || next === pickedIndex.current) return;
    pickedIndex.current = next;
    setIndex(next);
    onChange(item.value);
  };

  const rollTo = (next: number) => {
    const target = clampIndex(next);
    listRef.current?.scrollTo({ top: target * ITEM_H });
    pickIndex(target);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    ignoreClick.current = false;
    // Touch and trackpad scrolling use the browser's native momentum.
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragCleanup.current?.();
    event.preventDefault();
    const list = event.currentTarget;
    list.focus({ preventScroll: true });
    const { pointerId, clientY: startY } = event;
    const startTop = list.scrollTop;
    let moved = false;

    // Listen on the window so dragging continues after the pointer leaves the column.
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      if ((next.buttons & 1) === 0) {
        finish();
        return;
      }
      const dy = startY - next.clientY;
      if (!moved) {
        if (Math.abs(dy) < 5) return;
        moved = true;
        ignoreClick.current = true;
        list.dataset.dragging = "true";
      }
      list.scrollTop = startTop + dy;
      pickIndex(clampIndex(Math.round(list.scrollTop / ITEM_H)));
    };
    const finish = (next?: globalThis.PointerEvent) => {
      if (next && next.pointerId !== pointerId) return;
      const index = Math.round(list.scrollTop / ITEM_H);
      cleanup();
      if (moved) rollTo(index);
    };
    const blur = () => finish();
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", blur);
      delete list.dataset.dragging;
      dragCleanup.current = null;
    };
    dragCleanup.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("blur", blur);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") rollTo(pickedIndex.current + 1);
    else if (event.key === "ArrowUp") rollTo(pickedIndex.current - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="wheel" style={{ height: ITEM_H * VISIBLE }}>
      {bare ? null : <div className="wheel-band" aria-hidden />}
      <div
        ref={listRef}
        className="wheel-list"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={startDrag}
        style={{ paddingBlock: PAD }}
        onScroll={(event) => {
          paint();
          const next = Math.round(event.currentTarget.scrollTop / ITEM_H);
          pickIndex(clampIndex(next));
        }}
      >
        {items.map((item, i) => (
          <div
            key={String(item.value)}
            role="option"
            aria-selected={i === index}
            className="wheel-item"
            onClick={() => {
              if (!ignoreClick.current) rollTo(i);
            }}
          >
            <span className="wheel-item-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Wheels side by side (year · month) over one shared middle band. Give the wheels `bare`. */
export function WheelRow({ children }: { children: ReactNode }) {
  return (
    <div className="wheel-row">
      <div className="wheel-band" aria-hidden />
      {children}
    </div>
  );
}
