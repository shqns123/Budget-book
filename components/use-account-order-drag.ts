import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

const HOLD_MS = 350;
const MOVE_TOLERANCE = 8;

type Preview = { id: string; targetId: string; offset: number };
type Gesture = {
  pointerId: number;
  startY: number;
  lastY: number;
  timer: number;
  scrolling: boolean;
  center: number;
  rows: { id: string; center: number }[];
  preview: Preview | null;
};

export function useAccountOrderDrag(onDrop: (id: string, targetId: string) => void) {
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const cancel = useCallback(() => {
    if (!gesture.current) return;
    window.clearTimeout(gesture.current.timer);
    gesture.current = null;
    setPreview(null);
  }, []);
  useEffect(() => () => window.clearTimeout(gesture.current?.timer), []);

  const start = (event: PointerEvent<HTMLElement>, id: string) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("button")) return;
    const row = event.currentTarget;
    row.setPointerCapture(event.pointerId);
    const touch: Gesture = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      timer: 0,
      scrolling: false,
      center: 0,
      rows: [],
      preview: null,
    };
    gesture.current = touch;
    touch.timer = window.setTimeout(() => {
      touch.rows = Array.from(row.parentElement?.querySelectorAll<HTMLElement>("[data-order-account]") ?? [], (item) => {
        const box = item.getBoundingClientRect();
        return { id: item.dataset.orderAccount!, center: box.top + box.height / 2 };
      });
      const source = touch.rows.find((item) => item.id === id);
      if (!source || touch.rows.length < 2) return;
      touch.center = source.center;
      touch.preview = { id, targetId: id, offset: 0 };
      setPreview(touch.preview);
    }, HOLD_MS);
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const touch = gesture.current;
    if (!touch || event.pointerId !== touch.pointerId) return;
    if (!touch.preview) {
      if (Math.abs(event.clientY - touch.startY) > MOVE_TOLERANCE) {
        window.clearTimeout(touch.timer);
        touch.scrolling = event.pointerType === "touch";
      }
      if (touch.scrolling) window.scrollBy(0, touch.lastY - event.clientY);
      touch.lastY = event.clientY;
      return;
    }
    const first = touch.rows[0].center;
    const last = touch.rows[touch.rows.length - 1].center;
    const center = Math.max(first, Math.min(last, touch.center + event.clientY - touch.startY));
    const closest = touch.rows.reduce((best, item) =>
      Math.abs(item.center - center) < Math.abs(best.center - center) ? item : best,
    );
    touch.preview = { id: touch.preview.id, targetId: closest.id, offset: center - touch.center };
    setPreview(touch.preview);
  };

  const finish = (event: PointerEvent<HTMLElement>) => {
    const touch = gesture.current;
    if (!touch || event.pointerId !== touch.pointerId) return;
    const dropped = touch.preview;
    cancel();
    if (event.type === "pointerup" && dropped && dropped.id !== dropped.targetId) {
      onDrop(dropped.id, dropped.targetId);
    }
  };

  return { preview, start, move, finish, cancel };
}
