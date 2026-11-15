import { useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { monthLabel, pad, shiftMonth, spokenDate, todayIso } from "@/lib/dates";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { TextButton } from "./Button";
import { Text } from "./Text";
import { useSwipePager } from "./useSwipePager";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * A month calendar in the app's own style: swipe sideways to change month, tap a day to pick it.
 * The picked day is peach, today has a ring. `width` is the space it has (cells are width / 7).
 */
export function Calendar({
  value,
  onPick,
  width,
}: {
  /** YYYY-MM-DD, or "" */
  value: string;
  onPick: (iso: string) => void;
  width: number;
}) {
  const { c } = useTheme();
  const today = todayIso();
  const [month, setMonth] = useState((/^\d{4}-\d{2}/.test(value) ? value : today).slice(0, 7));
  const pager = useSwipePager(width, (dir) => setMonth((m) => shiftMonth(m, dir)));

  const [year, m] = month.split("-").map(Number);
  const lead = new Date(year, m - 1, 1).getDay();
  const days = new Date(year, m, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);
  const cell = Math.floor(width / 7);

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={monthLabel(month)}
          accessibilityHint="옆으로 밀어 달을 바꿔요"
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => pager.turn(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          style={{ flex: 1, paddingLeft: space.xs }}
        >
          <Text variant="headline">{monthLabel(month)}</Text>
        </View>
        <TextButton
          label="오늘"
          onPress={() => {
            setMonth(today.slice(0, 7));
            onPick(today);
          }}
        />
      </View>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAYS.map((d) => (
          <Text key={d} variant="caption" color="text2" align="center" style={{ width: cell }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ overflow: "hidden" }} {...pager.panHandlers}>
        <Animated.View style={[styles.grid, pager.pageStyle]}>
          {cells.map((iso, i) => {
            if (!iso) return <View key={`blank-${i}`} style={{ width: cell, height: CELL_HEIGHT }} />;
            const selected = iso === value;
            const isToday = iso === today;
            return (
              <Pressable
                key={iso}
                onPress={() => onPick(iso)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${spokenDate(iso)}${isToday ? ", 오늘" : ""}`}
                style={{ width: cell, height: CELL_HEIGHT, alignItems: "center", justifyContent: "center" }}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.day,
                      selected
                        ? { backgroundColor: c.primaryContainer }
                        : pressed
                          ? { backgroundColor: c.fill }
                          : null,
                      isToday && !selected && { borderWidth: 1.5, borderColor: c.strong },
                    ]}
                  >
                    <Text
                      variant="subhead"
                      tabular
                      weight={selected || isToday ? "700" : "500"}
                      color={selected ? "onPrimaryContainer" : "text"}
                    >
                      {Number(iso.slice(8))}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const CELL_HEIGHT = 42;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", minHeight: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
