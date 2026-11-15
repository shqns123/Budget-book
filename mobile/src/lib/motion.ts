import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// The OS "reduce motion" setting, readable outside React (event handlers, LayoutAnimation).
let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => undefined);
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => (reduceMotion = v));

export const prefersReducedMotion = () => reduceMotion;

export function useReducedMotion() {
  const [reduce, setReduce] = useState(reduceMotion);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}
