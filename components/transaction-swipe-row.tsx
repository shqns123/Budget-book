"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

const swipeDistance = (width: number) => Math.max(110, Math.min(180, width * 0.4));

export function TransactionSwipeRow({
  children,
  onDetails,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const drag = useRef<{ id: number; x: number; y: number; horizontal: boolean; width: number } | null>(null);
  const suppressClick = useRef(false);
  const [translation, setTranslation] = useState<number | null>(null);

  const start = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      horizontal: false,
      width: event.currentTarget.getBoundingClientRect().width,
    };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const touch = drag.current;
    if (!touch || touch.id !== event.pointerId) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    if (!touch.horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        drag.current = null;
        suppressClick.current = true;
        return;
      }
      if (Math.abs(dx) <= 8 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
      touch.horizontal = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const limit = Math.min(touch.width / 2, swipeDistance(touch.width) + 16);
    setTranslation(Math.max(-limit, Math.min(limit, dx)));
  };
  const finish = (event: PointerEvent<HTMLElement>) => {
    const touch = drag.current;
    if (!touch || touch.id !== event.pointerId) return;
    drag.current = null;
    if (!touch.horizontal) return;
    setTranslation(null);
    if (event.type !== "pointerup") return;
    const offset = event.clientX - touch.x;
    const required = swipeDistance(touch.width);
    if (offset >= required) onEdit();
    else if (offset <= -required) onDelete();
  };

  return (
    <div className="ledger-swipe-row">
      <article
        className={`ledger-row editable-row${translation !== null ? " swiping" : ""}`}
        style={{ transform: `translateX(${translation ?? 0}px)` }}
        role="button"
        tabIndex={0}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) finish(event);
        }}
        onPointerLeave={() => {
          if (!drag.current?.horizontal) drag.current = null;
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onDetails();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onDetails();
          else if (event.key === "ArrowRight") onEdit();
          else if (event.key === "ArrowLeft") onDelete();
          else return;
          event.preventDefault();
        }}
      >
        {children}
      </article>
      <div className="ledger-swipe-action edit" aria-hidden="true"><RefreshCw size={20} /></div>
      <div className="ledger-swipe-action delete" aria-hidden="true"><Trash2 size={20} /></div>
    </div>
  );
}
