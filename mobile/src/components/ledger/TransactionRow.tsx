import { shortDate } from "@/lib/dates";
import { accountName, typeLabel, won, type Account, type Transaction } from "@/lib/ledger";
import { Row, Tag } from "@/components/ui";
import { CategoryTile, categoryIcon } from "@/components/ledger/CategoryIcon";
import { useLedger } from "@/store/ledger-store";
import type { PressableProps } from "react-native";

export function amountText(item: Transaction) {
  const sign = item.type === "income" ? "+" : item.type === "transfer" ? "↔ " : "−";
  return `${sign}${won(item.amount)}`;
}

export function categoryText(item: Transaction) {
  if (item.type === "transfer") return "이동";
  return item.minorCategory ? `${item.category} · ${item.minorCategory}` : item.category;
}

export function accountText(accounts: Account[], item: Transaction) {
  const from = accountName(accounts, item.accountId);
  return item.toAccountId ? `${from} → ${accountName(accounts, item.toAccountId)}` : from;
}

export function TransactionRow({
  item,
  accounts,
  first,
  onPress,
  accessibilityActions,
  onAccessibilityAction,
  linked,
}: {
  item: Transaction;
  accounts: Account[];
  first?: boolean;
  onPress?: () => void;
  accessibilityActions?: PressableProps["accessibilityActions"];
  onAccessibilityAction?: PressableProps["onAccessibilityAction"];
  /** The transfer recorded together with this expense ("자금 이동 같이 기록"). */
  linked?: Transaction;
}) {
  const amount = amountText(item);
  const { data } = useLedger();
  // 지출 / 수입 show their 대분류's icon; an 이동 keeps the arrows.
  const leading =
    item.type === "transfer" ? undefined : (
      <CategoryTile icon={categoryIcon(data.settings.categories, item.type, item.category)} />
    );
  return (
    <Row
      dense
      first={first}
      onPress={onPress}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      leading={leading}
      icon={item.type === "transfer" ? "transfer" : item.type === "income" ? "income" : "expense"}
      iconTone={item.type === "transfer" ? "neutral" : item.type === "income" ? "income" : "expense"}
      title={item.name}
      // A transfer is just "from → to"; others "분류 · 소분류 · 통장".
      meta={item.type === "transfer" ? accountText(accounts, item) : `${categoryText(item)} · ${accountText(accounts, item)}`}
      trailing={amount}
      trailingColor={item.type === "income" ? "income" : item.type === "transfer" ? "text2" : "text"}
      trailingMeta={shortDate(item.date)}
      badge={linked ? <Tag label={`자금 이동 · ${accountText(accounts, linked)}`} tone="accent" /> : undefined}
      accessibilityLabel={`${item.name}, ${typeLabel(item.type)} ${won(item.amount)}, ${shortDate(item.date)}, ${categoryText(item)}, ${accountText(accounts, item)}${linked ? `, 자금 이동 함께 기록됨: ${accountText(accounts, linked)}` : ""}`}
    />
  );
}
