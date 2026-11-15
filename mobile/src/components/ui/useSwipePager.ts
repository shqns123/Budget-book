import { useMemo, useState } from "react";
import { Animated, Easing, PanResponder, type PanResponderGestureState } from "react-native";
import { useReducedMotion } from "@/lib/motion";

/** A swipe this far (or this fast) sideways turns the page. */
const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 0.4;
const EASE = Easing.bezier(0.2, 0, 0, 1);

/**
 * Sideways paging for a panel (years in the month picker, months in the calendar): the page
 * follows the finger, slides out, and the next one slides in from the other side. Swiping left
 * goes forward (+1), right goes back (−1).
 *
 * Spread `panHandlers` on the swipe area and `pageStyle` on the page (an Animated.View inside a
 * clipped parent). `turn(dir)` pages programmatically (screen-reader actions).
 */
export function useSwipePager(width: number, onTurn: (dir: 1 | -1) => void) {
  const reduceMotion = useReducedMotion();
  const [slide] = useState(() => new Animated.Value(0));
  const { turn, panHandlers } = useMemo(() => {
    const turn = (dir: 1 | -1) => {
      if (reduceMotion) {
        onTurn(dir);
        slide.setValue(0);
        return;
      }
      Animated.timing(slide, {
        toValue: -dir * width,
        duration: 140,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        onTurn(dir);
        slide.setValue(dir * width);
        Animated.timing(slide, { toValue: 0, duration: 240, easing: EASE, useNativeDriver: true }).start();
      });
    };
    const sideways = (_: unknown, g: PanResponderGestureState) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
    const settle = () => Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    const pan = PanResponder.create({
      // Capture, so a swipe that starts on a button pages instead of tapping it.
      onMoveShouldSetPanResponderCapture: sideways,
      onMoveShouldSetPanResponder: sideways,
      onPanResponderMove: (_, g) => slide.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_DISTANCE || g.vx <= -SWIPE_VELOCITY) turn(1);
        else if (g.dx >= SWIPE_DISTANCE || g.vx >= SWIPE_VELOCITY) turn(-1);
        else settle();
      },
      onPanResponderTerminate: settle,
    });
    return { turn, panHandlers: pan.panHandlers };
    // onTurn is expected to be a state setter call; a stale closure is fine.
  }, [slide, width, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageStyle = {
    opacity: slide.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0], extrapolate: "clamp" }),
    transform: [{ translateX: slide }],
  };
  return { turn, panHandlers, pageStyle };
}
