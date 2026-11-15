import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { MonthChip } from "@/components/ledger/ScopeControls";
import { ChipRow, Row, Screen, Section, Text } from "@/components/ui";
import { lastDayOfMonth, monthLabel } from "@/lib/dates";
import { calculateAccountBalances, signedWon, won, type Account } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

const cardGroup = (account: Account) => (account.minorCategory.includes("할부") ? "할부" : "일시불");

export default function BalanceScreen() {
  const { c } = useTheme();
  const { data, accounts } = useLedger();
  const { month } = usePrefs();

  const view = useMemo(() => {
    const amounts = calculateAccountBalances(accounts, data.transactions, lastDayOfMonth(month));
    const groupBy = (list: Account[], key: (a: Account) => string) =>
      Object.values(
        list.reduce<Record<string, Account[]>>((result, account) => {
          (result[key(account)] ??= []).push(account);
          return result;
        }, {}),
      );
    const assets = groupBy(
      accounts.filter((a) => a.classification === "asset"),
      (a) => a.majorCategory,
    );
    const order = (a: Account) => (a.type === "card" ? (cardGroup(a) === "할부" ? 1 : 0) : 2);
    const liabilities = groupBy(
      accounts.filter((a) => a.classification !== "asset"),
      (a) => (a.type === "card" ? cardGroup(a) : a.majorCategory),
    ).sort((l, r) => order(l[0]) - order(r[0]));
    const assetTotal = accounts
      .filter((a) => a.classification === "asset")
      .reduce((sum, a) => sum + (amounts.get(a.id) ?? 0), 0);
    const liabilityTotal = accounts
      .filter((a) => a.classification !== "asset")
      .reduce((sum, a) => sum + Math.abs(amounts.get(a.id) ?? 0), 0);
    return { amounts, assets, liabilities, assetTotal, liabilityTotal };
  }, [accounts, data.transactions, month]);

  const net = view.assetTotal - view.liabilityTotal;

  return (
    <Screen
      title="잔고"
      above={
        <ChipRow>
          <MonthChip />
        </ChipRow>
      }
    >
      <View style={{ gap: space.sm }}>
        <Text variant="subhead" color="text2">
          {monthLabel(month)} 말 순자산
        </Text>
        <Text variant="title1" tabular>
          {signedWon(net)}
        </Text>
        <View style={styles.split}>
          <Text variant="subhead" color="text2">
            자산 <Text variant="subhead" weight="600">{signedWon(view.assetTotal)}</Text>
          </Text>
          <View style={[styles.dot, { backgroundColor: c.outline }]} />
          <Text variant="subhead" color="text2">
            부채 <Text variant="subhead" weight="600">{won(view.liabilityTotal)}</Text>
          </Text>
        </View>
      </View>

      <BalanceGroups heading="자산" groups={view.assets} amounts={view.amounts} signed />
      <BalanceGroups heading="부채" groups={view.liabilities} amounts={view.amounts} />
    </Screen>
  );
}

function BalanceGroups({
  heading,
  groups,
  amounts,
  signed,
}: {
  heading: string;
  groups: Account[][];
  amounts: Map<string, number>;
  signed?: boolean;
}) {
  const show = (amount: number) => (signed ? signedWon(amount) : won(amount));
  if (!groups.length) return null;
  return (
    <View style={{ gap: space.lg }}>
      <Text variant="headline" accessibilityRole="header">
        {heading}
      </Text>
      {groups.map((group) => {
        const label = group[0].type === "card" ? cardGroup(group[0]) : group[0].majorCategory;
        const sum = group.reduce((total, a) => {
          const amount = amounts.get(a.id) ?? 0;
          return total + (signed ? amount : Math.abs(amount));
        }, 0);
        return (
          <Section key={`${heading}-${label}`} title={`${label} · ${show(sum)}`}>
            {group.map((account, index) => (
              <Row
                key={account.id}
                first={index === 0}
                title={account.name}
                meta={account.minorCategory || undefined}
                trailing={show(amounts.get(account.id) ?? 0)}
                dimmed={account.hidden}
              />
            ))}
          </Section>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
