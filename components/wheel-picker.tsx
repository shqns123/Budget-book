"use client";

import { useEffect, useState, type ReactNode } from "react";

export type WheelItem<T extends string | number> = { value: T; label: string };

/** A compact dropdown, retaining the existing picker API for its callers. */
export function Wheel<T extends string | number>({ items, value, onChange, label }: {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  bare?: boolean;
}) {
  const [selected, setSelected] = useState(value);
  useEffect(() => setSelected(value), [value]);
  const index = items.findIndex((item) => item.value === selected);
  return (
    <div className="wheel">
      <select
        className="picker-dropdown"
        aria-label={label}
        value={index < 0 ? "" : String(index)}
        onChange={(event) => {
          const item = items[Number(event.target.value)];
          if (item) { setSelected(item.value); onChange(item.value); }
        }}
      >
        {index < 0 && <option value="" disabled>선택</option>}
        {items.map((item, i) => <option key={String(item.value)} value={String(i)}>{item.label}</option>)}
      </select>
    </div>
  );
}

export function WheelRow({ children }: { children: ReactNode }) {
  return <div className="wheel-row">{children}</div>;
}
