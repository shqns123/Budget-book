import { useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { monthLabel } from "@/lib/dates";
import type { AccountKind } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs, type Scope } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import {
  CheckRow,
  Chip,
  FoldMenu,
  PrimaryButton,
  SecondaryButton,
  Text,
  useFoldAnchor,
  useSwipePager,
  type Anchor,
  type IconName,
} from "@/components/ui";

export const accountIcon: Record<AccountKind, IconName> = {
  bank: "bank",
  card: "card",
  loan: "loan",
  savings: "piggy",
  cash: "wallet",
};

/**
 * The month filter chip. Tapping it unfolds a month panel out of the chip (FoldMenu); picking a
 * month or tapping outside folds it back into the chip.
 * `compact` (overview header, where the title already names the month) is just a calendar icon.
 */
export function MonthChip({ compact }: { compact?: boolean }) {
  const { month } = usePrefs();
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();
  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Chip
          label={compact ? undefined : monthLabel(month)}
          icon={compact ? "calendar" : undefined}
          trailingIcon={compact ? undefined : "chevronDown"}
          accessibilityLabel={`조회 월, ${monthLabel(month)}`}
          onPress={show}
        />
      </View>
      {anchor ? (
        <FoldMenu anchor={anchor} visible={open} onClose={hide} onClosed={clear}>
          <MonthPicker onPicked={hide} />
        </FoldMenu>
      ) : null}
    </>
  );
}

function MonthPicker({ onPicked }: { onPicked: () => void }) {
  const { c } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { month, setMonth } = usePrefs();
  const [year, setYear] = useState(month.slice(0, 4));
  const width = Math.min(320, screenW - space.lg * 2);

  // Swipe sideways to turn the year (left = next year).
  const pager = useSwipePager(width, (dir) => setYear((y) => String(Number(y) + dir)));

  return (
    <View style={{ overflow: "hidden" }} {...pager.panHandlers}>
      <Animated.View style={[{ gap: space.md }, pager.pageStyle]}>
        <View
          style={styles.yearRow}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${year}년`}
          accessibilityHint="옆으로 밀어 해를 바꿔요"
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => pager.turn(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <Text variant="headline" tabular>
            {year}
          </Text>
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((value) => {
            const selected = value === month;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setMonth(value);
                  onPicked();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={monthLabel(value)}
                style={({ pressed }) => [
                  styles.monthCell,
                  { backgroundColor: selected ? c.primaryContainer : pressed ? c.fill : c.card },
                ]}
              >
                <Text
                  variant="subhead"
                  weight={selected ? "700" : "500"}
                  color={selected ? "onPrimaryContainer" : "text"}
                >
                  {Number(value.slice(5))}월
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

/** 12 years per page (swipe for earlier / later); picking one keeps the month (2026-11 → 2025-11). */
function YearPicker({ onPicked }: { onPicked: () => void }) {
  const { c } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const { month, setMonth } = usePrefs();
  const year = Number(month.slice(0, 4));
  // Pages of 12 years; the first page holds the current one.
  const [first, setFirst] = useState(year - ((year - 1) % 12));
  const width = Math.min(320, screenW - space.lg * 2);
  const pager = useSwipePager(width, (dir) => setFirst((f) => f + dir * 12));
  return (
    <View style={{ overflow: "hidden" }} {...pager.panHandlers}>
      <Animated.View style={[{ gap: space.md }, pager.pageStyle]}>
        <View
          style={styles.yearRow}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${first}년부터 ${first + 11}년까지`}
          accessibilityHint="옆으로 밀어 다른 연도를 봐요"
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => pager.turn(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <Text variant="headline" tabular>
            {first} – {first + 11}
          </Text>
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, i) => first + i).map((value) => {
            const selected = value === year;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setMonth(`${value}${month.slice(4)}`);
                  onPicked();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${value}년`}
                style={({ pressed }) => [
                  styles.monthCell,
                  { backgroundColor: selected ? c.primaryContainer : pressed ? c.fill : c.card },
                ]}
              >
                <Text
                  variant="subhead"
                  tabular
                  weight={selected ? "700" : "500"}
                  color={selected ? "onPrimaryContainer" : "text"}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * A calendar-icon chip that picks the month (월간) or the year (연간): the picker grows out of the
 * chip. For the report tab's header.
 */
export function PeriodChip({ period }: { period: "month" | "year" }) {
  const { month } = usePrefs();
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();
  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Chip
          icon="calendar"
          accessibilityLabel={period === "month" ? `조회 월, ${monthLabel(month)}` : `조회 연도, ${month.slice(0, 4)}년`}
          onPress={show}
        />
      </View>
      {anchor ? (
        <FoldMenu anchor={anchor} visible={open} onClose={hide} onClosed={clear}>
          {period === "month" ? <MonthPicker onPicked={hide} /> : <YearPicker onPicked={hide} />}
        </FoldMenu>
      ) : null}
    </>
  );
}

export function accountFilterLabel(selected: string[], names: (id: string) => string) {
  if (!selected.length) return "전체 통장";
  if (selected.length === 1) return names(selected[0]) || "통장 1개";
  return `통장 ${selected.length}개 선택`;
}

const ACCOUNT_HINT = "선택한 통장의 거래만 합산해요. 저장하면 다음에도 유지돼요.";

/**
 * The account choice being edited. Taps change only this draft, so a tap repaints just the
 * picker: writing the app-wide selection on every tap made every open tab recompute its totals
 * and the checkboxes lag. `apply()` writes it once, when the picker closes; `save()` also keeps it
 * for next time. `reset()` starts over from the current selection.
 */
function useAccountDraft(scope: Scope) {
  const { accounts } = useLedger();
  const { selected, setSelected, saveSelected } = usePrefs();
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  const [draft, setDraft] = useState(current);
  return {
    accounts,
    draft,
    toggle: (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id])),
    all: () => setDraft([]),
    reset: () => setDraft(current),
    apply: () => {
      if (draft.length !== current.length || draft.some((id) => !current.includes(id))) setSelected(scope, draft);
    },
    save: () => saveSelected(scope, draft),
  };
}

function AccountChecks({ draft }: { draft: ReturnType<typeof useAccountDraft> }) {
  return (
    <View style={{ gap: space.xs }}>
      {draft.accounts.map((account) => (
        <CheckRow
          key={account.id}
          label={account.name}
          meta={account.kind === account.type ? undefined : account.kind}
          icon={accountIcon[account.type] ?? "bank"}
          checked={draft.draft.includes(account.id)}
          onToggle={() => draft.toggle(account.id)}
        />
      ))}
    </View>
  );
}

function AccountButtons({ draft, onClose }: { draft: ReturnType<typeof useAccountDraft>; onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <SecondaryButton style={{ flex: 1 }} label="전체 통장" onPress={draft.all} />
      <PrimaryButton
        style={{ flex: 1 }}
        label="저장"
        onPress={() => {
          draft.save();
          onClose();
        }}
      />
    </View>
  );
}

/** The account filter chip. Tapping it unfolds the account list out of the chip (FoldMenu). */
export function AccountChip({ scope }: { scope: Scope }) {
  const { accounts } = useLedger();
  const { selected } = usePrefs();
  const { ref: anchorRef, anchor, open, show, hide, clear } = useFoldAnchor();
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  const label = accountFilterLabel(current, (id) => accounts.find((a) => a.id === id)?.name ?? "");
  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Chip
          label={label}
          selected={current.length > 0}
          trailingIcon="chevronDown"
          accessibilityLabel={`통장 범위, ${label}`}
          onPress={show}
        />
      </View>
      {anchor ? (
        <AccountMenu scope={scope} anchor={anchor} visible={open} onClose={hide} onClosed={clear} />
      ) : null}
    </>
  );
}

function AccountMenu({
  scope,
  anchor,
  visible,
  onClose,
  onClosed,
}: {
  scope: Scope;
  anchor: Anchor;
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  // Mounted fresh for each opening, so the draft starts from the current selection.
  const draft = useAccountDraft(scope);
  const close = () => {
    draft.apply();
    onClose();
  };
  return (
    <FoldMenu
      anchor={anchor}
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      maxWidth={360}
      accessibilityLabel="통장 선택"
    >
      <View style={styles.accountHead}>
        <Text variant="headline" accessibilityRole="header">
          통장 선택
        </Text>
        <Text variant="footnote" weight="400" color="text2">
          {ACCOUNT_HINT}
        </Text>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingVertical: space.sm }}>
        <AccountChecks draft={draft} />
      </ScrollView>
      <View style={{ paddingTop: space.sm }}>
        <AccountButtons draft={draft} onClose={close} />
      </View>
    </FoldMenu>
  );
}

/** Selected accounts for a scope, ignoring ids that no longer exist. */
export function useScopeSelection(scope: Scope) {
  const { accounts } = useLedger();
  const { selected, setSelected } = usePrefs();
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  /** After saving a record, keep its accounts visible in a filtered list. */
  const include = (ids: (string | undefined)[]) => {
    if (!current.length) return;
    const next = [...current];
    ids.forEach((id) => {
      if (id && !next.includes(id)) next.push(id);
    });
    if (next.length !== current.length) setSelected(scope, next);
  };
  return { selected: current, include };
}

const styles = StyleSheet.create({
  accountHead: { gap: space.xs, paddingHorizontal: space.xs, paddingBottom: space.xs },
  yearRow: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  monthCell: {
    width: "31%",
    minHeight: 48,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
});
