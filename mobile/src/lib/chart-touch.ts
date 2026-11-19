import { useEffect } from "react";

/**
 * Touches on the reports screen, so a chart's tip closes on a touch anywhere outside that chart.
 * A chart marks its own touches first (touch events bubble from the innermost view), and the
 * screen then tells the listeners about any touch that was not marked.
 *
 * Wire it up with `onTouchStart={onScreenTouch}` on the screen and `onTouchStart={markChartTouch}`
 * on each chart; a chart closes its tip with `useOutsideChartTouch(close)`.
 */
const outsideChartListeners = new Set<() => void>();
let touchInChart = false;

export const markChartTouch = () => {
  touchInChart = true;
};

export const onScreenTouch = () => {
  if (touchInChart) touchInChart = false;
  else outsideChartListeners.forEach((close) => close());
};

export function useOutsideChartTouch(close: () => void) {
  useEffect(() => {
    outsideChartListeners.add(close);
    return () => {
      outsideChartListeners.delete(close);
    };
  }, [close]);
}
