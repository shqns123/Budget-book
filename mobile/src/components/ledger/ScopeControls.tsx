import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { monthLabel, shiftMonth } from "@/lib/dates";
import type { AccountKind } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs, type Scope } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import {
  CheckRow,
  Chip,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  Sheet,
  Text,
  type IconName,
} from "@/components/ui";

export const accountIcon: Record<AccountKind, IconName> = {
  bank: "bank",
  card: "card",
  loan: "loan",
  savings: "piggy",
  cash: "wallet",
};

export function MonthChip() {
  const { c } = useTheme();
  const { month, setMonth } = usePrefs();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.slice(0, 4));
  return (
    <>
      <Chip
        label={monthLabel(month)}
        trailingIcon="chevronDown"
        accessibilityLabel={`조회 월, ${monthLabel(month)}`}
        onPress={() => {
          setYear(month.slice(0, 4));
          setOpen(true);
        }}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="월 선택">
        <View style={styles.yearRow}>
          <IconButton icon="chevronLeft" label="이전 해" filled onPress={() => setYear(String(Number(year) - 1))} />
          <Text variant="headline">{year}년</Text>
          <IconButton icon="chevronRight" label="다음 해" filled onPress={() => setYear(String(Number(year) + 1))} />
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map((value) => {
            const selected = value === month;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setMonth(value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={monthLabel(value)}
                style={({ pressed }) => [
                  styles.monthCell,
                  { backgroundColor: selected ? c.primaryContainer : pressed ? c.fill : c.card },
                ]}
              >
                <Text variant="subhead" weight={selected ? "700" : "500"} color={selected ? "onPrimaryContainer" : "text"}>
                  {Number(value.slice(5))}월
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <SecondaryButton style={{ flex: 1 }} label="이전 달" onPress={() => setMonth(shiftMonth(month, -1))} />
          <SecondaryButton style={{ flex: 1 }} label="다음 달" onPress={() => setMonth(shiftMonth(month, 1))} />
        </View>
      </Sheet>
    </>
  );
}

export function accountFilterLabel(selected: string[], names: (id: string) => string) {
  if (!selected.length) return "전체 통장";
  if (selected.length === 1) return names(selected[0]) || "통장 1개";
  return `통장 ${selected.length}개 선택`;
}

/** Choose which accounts a screen adds up. 저장 keeps the choice for next time. */
export function AccountSheet({
  scope,
  visible,
  onClose,
  title = "통장 선택",
}: {
  scope: Scope;
  visible: boolean;
  onClose: () => void;
  title?: string;
}) {
  const { accounts } = useLedger();
  const { selected, setSelected, saveSelected } = usePrefs();
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  const toggle = (id: string) =>
    setSelected(scope, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle="선택한 통장의 거래만 합산해요. 저장하면 다음에도 유지돼요."
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <SecondaryButton style={{ flex: 1 }} label="전체 통장" onPress={() => setSelected(scope, [])} />
          <PrimaryButton
            style={{ flex: 1 }}
            label="저장"
            onPress={() => {
              saveSelected(scope);
              onClose();
            }}
          />
        </View>
      }
    >
      <View style={{ gap: space.xs }}>
        {accounts.map((account) => (
          <CheckRow
            key={account.id}
            label={account.name}
            meta={account.kind === account.type ? undefined : account.kind}
            icon={accountIcon[account.type] ?? "bank"}
            checked={current.includes(account.id)}
            onToggle={() => toggle(account.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}

export function AccountChip({ scope }: { scope: Scope }) {
  const { accounts } = useLedger();
  const { selected } = usePrefs();
  const [open, setOpen] = useState(false);
  const current = selected[scope].filter((id) => accounts.some((a) => a.id === id));
  const label = accountFilterLabel(current, (id) => accounts.find((a) => a.id === id)?.name ?? "");
  return (
    <>
      <Chip
        label={label}
        selected={current.length > 0}
        trailingIcon="chevronDown"
        accessibilityLabel={`통장 범위, ${label}`}
        onPress={() => setOpen(true)}
      />
      <AccountSheet scope={scope} visible={open} onClose={() => setOpen(false)} />
    </>
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
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  monthCell: {
    width: "31.5%",
    minHeight: 48,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
});
