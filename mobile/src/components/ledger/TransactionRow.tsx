import { shortDate } from "@/lib/dates";
import { accountName, typeLabel, won, type Account, type Transaction } from "@/lib/ledger";
import { Row } from "@/components/ui";

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
}: {
  item: Transaction;
  accounts: Account[];
  first?: boolean;
  onPress?: () => void;
}) {
  const amount = amountText(item);
  return (
    <Row
      first={first}
      onPress={onPress}
      icon={item.type === "transfer" ? "transfer" : item.type === "income" ? "income" : "expense"}
      iconTone={item.type === "transfer" ? "neutral" : item.type === "income" ? "income" : "expense"}
      title={item.name}
      meta={`${categoryText(item)} · ${accountText(accounts, item)}`}
      trailing={amount}
      trailingColor={item.type === "income" ? "income" : item.type === "transfer" ? "text2" : "text"}
      trailingMeta={shortDate(item.date)}
      accessibilityLabel={`${item.name}, ${typeLabel(item.type)} ${won(item.amount)}, ${shortDate(item.date)}, ${categoryText(item)}, ${accountText(accounts, item)}`}
    />
  );
}
