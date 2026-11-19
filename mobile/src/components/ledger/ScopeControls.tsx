import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { monthLabel } from "@/lib/dates";
import type { AccountKind } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs, type Scope } from "@/store/prefs-store";
import { space } from "@/theme/tokens";
import {
  Chip,
  FoldMenu,
  Text,
  useFoldAnchor,
  Wheel,
  WheelRow,
  type Anchor,
  type IconName,
  type WheelItem,
} from "@/components/ui";

export const accountIcon: Record<AccountKind, IconName> = {
  bank: "bank",
  card: "card",
  loan: "loan",
  savings: "piggy",
  cash: "wallet",
};

/**
 * The month filter chip. Tapping it unfolds a year · month wheel out of the chip (FoldMenu); the
 * month changes when the panel closes.
 * `compact` (a header where the title already names the month) is just a calendar icon.
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
      {anchor ? <PeriodMenu period="month" anchor={anchor} visible={open} onClose={hide} onClosed={clear} /> : null}
    </>
  );
}

/** Years on the wheel: ten back from the earlier of this year and the picked one, five ahead. */
function yearItems(picked: number): WheelItem<number>[] {
  const now = new Date().getFullYear();
  const from = Math.min(now, picked) - 10;
  const to = Math.max(now, picked) + 5;
  return Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: `${from + i}년` }));
}

const MONTH_ITEMS: WheelItem<number>[] = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }));

/**
 * The month (year · month wheels) or year (one wheel) picker in a fold-out panel. Mounted fresh
 * for each opening; the pick is written once, when it closes, so the tabs recompute only once.
 */
function PeriodMenu({
  period,
  anchor,
  visible,
  onClose,
  onClosed,
}: {
  period: "month" | "year";
  anchor: Anchor;
  visible: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { month, setMonth } = usePrefs();
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [monthNo, setMonthNo] = useState(Number(month.slice(5)));
  const [years] = useState(() => yearItems(year));
  const close = () => {
    const next = `${year}-${String(monthNo).padStart(2, "0")}`;
    if (next !== month) setMonth(next);
    onClose();
  };
  return (
    <FoldMenu
      anchor={anchor}
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      maxWidth={period === "month" ? 300 : 240}
      accessibilityLabel={period === "month" ? "조회 월 선택" : "조회 연도 선택"}
    >
      {period === "month" ? (
        <WheelRow>
          <Wheel bare flex={1.3} items={years} value={year} onChange={setYear} accessibilityLabel="연도" />
          <Wheel bare items={MONTH_ITEMS} value={monthNo} onChange={setMonthNo} accessibilityLabel="월" />
        </WheelRow>
      ) : (
        <Wheel items={years} value={year} onChange={setYear} accessibilityLabel="연도" />
      )}
    </FoldMenu>
  );
}

/**
 * A calendar-icon chip that picks the month (월간) or the year (연간): the wheel grows out of the
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
      {anchor ? <PeriodMenu period={period} anchor={anchor} visible={open} onClose={hide} onClosed={clear} /> : null}
    </>
  );
}

export function accountFilterLabel(selected: string[], names: (id: string) => string) {
  if (!selected.length) return "전체 통장";
  if (selected.length === 1) return names(selected[0]) || "통장 1개";
  return `통장 ${selected.length}개 선택`;
}

const ACCOUNT_HINT = "선택한 통장의 거래만 합산해요. 창을 닫으면 선택이 저장돼요.";
const ALL = "";

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

/**
 * One account (or 전체 통장) on a wheel. Mounted fresh for each opening; the pick is written once,
 * when the panel closes: writing the app-wide selection while the wheel turns would make every
 * open tab recompute its totals. Closing the panel also saves a changed selection.
 */
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
  const { accounts } = useLedger();
  const { selected, setSelected, saveSelected } = usePrefs();
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  // A list picked before the wheel (several accounts) shows as 전체 until the wheel is turned.
  const initial = current.length === 1 ? current[0] : ALL;
  const [pick, setPick] = useState(initial);
  const [items] = useState<WheelItem<string>[]>(() => [
    { value: ALL, label: "전체 통장" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ]);
  const close = () => {
    if (pick !== initial) {
      const next = pick === ALL ? [] : [pick];
      setSelected(scope, next);
      saveSelected(scope, next);
    }
    onClose();
  };
  return (
    <FoldMenu
      anchor={anchor}
      visible={visible}
      onClose={close}
      onClosed={onClosed}
      maxWidth={320}
      accessibilityLabel="통장 선택"
    >
      <View style={{ gap: space.md }}>
        <View style={styles.accountHead}>
          <Text variant="headline" accessibilityRole="header">
            통장 선택
          </Text>
          <Text variant="footnote" weight="400" color="text2">
            {ACCOUNT_HINT}
          </Text>
        </View>
        <Wheel items={items} value={initial} onChange={setPick} accessibilityLabel="통장" />
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
  accountHead: { gap: space.xs, paddingHorizontal: space.xs },
});
