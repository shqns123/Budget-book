import { shortDate } from "@/lib/dates";
import { accountName, typeLabel, won, type Account, type Transaction } from "@/lib/ledger";
import { Row, Tag } from "@/components/ui";

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
  linked,
}: {
  item: Transaction;
  accounts: Account[];
  first?: boolean;
  onPress?: () => void;
  /** The transfer recorded together with this expense ("자금 이동 같이 기록"). */
  linked?: Transaction;
}) {
  const amount = amountText(item);
  return (
    <Row
      dense
      first={first}
      onPress={onPress}
      icon={item.type === "transfer" ? "transfer" : item.type === "income" ? "income" : "expense"}
      iconTone={item.type === "transfer" ? "neutral" : item.type === "income" ? "income" : "expense"}
      title={item.name}
      meta={`${categoryText(item)} · ${accountText(accounts, item)}`}
      trailing={amount}
      trailingColor={item.type === "income" ? "income" : item.type === "transfer" ? "text2" : "text"}
      trailingMeta={shortDate(item.date)}
      badge={linked ? <Tag label={`자금 이동 · ${accountText(accounts, linked)}`} tone="accent" /> : undefined}
      accessibilityLabel={`${item.name}, ${typeLabel(item.type)} ${won(item.amount)}, ${shortDate(item.date)}, ${categoryText(item)}, ${accountText(accounts, item)}${linked ? `, 자금 이동 함께 기록됨: ${accountText(accounts, linked)}` : ""}`}
    />
  );
}
