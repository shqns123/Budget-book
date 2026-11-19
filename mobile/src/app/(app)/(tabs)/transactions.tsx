import { router, useIsFocused } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccountChip, MonthChip, useScopeSelection } from "@/components/ledger/ScopeControls";
import {
  accountText,
  amountText,
  categoryText,
  TransactionRow,
} from "@/components/ledger/TransactionRow";
import { TransactionSwipeRow } from "@/components/ledger/TransactionSwipeRow";
import {
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  Section,
  SecondaryButton,
  SelectField,
  Sheet,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import { monthLabel, spokenDate } from "@/lib/dates";
import { linkedTransfer, listed, typeLabel, type Transaction, type TransactionType } from "@/lib/ledger";
import { useInbox } from "@/store/inbox-store";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { openCompose } from "@/lib/compose";
import { confirm } from "@/lib/confirm";

type TypeFilter = "all" | TransactionType;

export default function TransactionsScreen() {
  const focused = useIsFocused();
  const { c } = useTheme();
  const { data, accounts, save } = useLedger();
  const { month, sortByDate, setSortByDate } = usePrefs();
  const { selected } = useScopeSelection("transactions");
  const inbox = useInbox();
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [detail, setDetail] = useState<Transaction | null>(null);

  const activeFilters = [typeFilter !== "all", Boolean(fromFilter), Boolean(toFilter)].filter(Boolean).length;

  const visible = useMemo(() => {
    const prefix = month.replace("-", ".");
    const list = listed(data.transactions).filter(
      (item) =>
        item.date.startsWith(prefix) &&
        (!selected.length ||
          selected.includes(item.accountId) ||
          (item.toAccountId ? selected.includes(item.toAccountId) : false)) &&
        item.name.includes(query) &&
        (typeFilter === "all" || item.type === typeFilter) &&
        (!fromFilter || item.accountId === fromFilter) &&
        (!toFilter || item.toAccountId === toFilter),
    );
    return sortByDate ? [...list].sort((a, b) => b.date.localeCompare(a.date)) : list;
  }, [data.transactions, month, selected, query, typeFilter, fromFilter, toFilter, sortByDate]);

  const accountOptions = [
    { value: "", label: "전체 통장" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];

  const detailLinked = detail ? linkedTransfer(data.transactions, detail.id) : undefined;

  const edit = (record: Transaction) => {
    openCompose({ id: record.id, from: "center" });
  };

  const remove = async (record: Transaction) => {
    const ok = await confirm({
      title: "거래를 삭제할까요?",
      message: `${record.name} ${amountText(record)}\n삭제하면 되돌릴 수 없어요.`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    // The transfer recorded together with it goes too.
    const gone = (r: Transaction) => r.id === record.id || r.linkedTo === record.id;
    if (await save("transactions", (rows) => rows.filter((r) => !gone(r)))) setDetail(null);
  };

  return (
    <Screen
      title="거래 내역"
      above={
        <ChipRow>
          <MonthChip />
          <AccountChip scope="transactions" />
          {inbox.supported || inbox.items.length ? (
            <Chip
              icon="inbox"
              count={inbox.items.length}
              selected={inbox.items.length > 0}
              accessibilityLabel={`결제 알림 대기함, ${inbox.items.length}건`}
              onPress={() => router.push("/inbox")}
            />
          ) : null}
        </ChipRow>
      }
    >
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="내역 검색"
        accessibilityLabel="내역 검색"
        returnKeyType="search"
      />

      {/* 필터 and the sort order sit on the list's heading line, right of the month and count. */}
      <Section
        title={`${monthLabel(month)} · ${visible.length}건`}
        action={
          <ChipRow>
            <Chip
              label="필터"
              icon="filter"
              selected={activeFilters > 0}
              count={activeFilters}
              onPress={() => setShowFilters(true)}
            />
            <Chip
              label={sortByDate ? "날짜순" : "입력순"}
              icon="sort"
              selected={sortByDate}
              accessibilityLabel={`정렬, ${sortByDate ? "날짜 최신순" : "입력한 순서"}`}
              onPress={() => setSortByDate(!sortByDate)}
            />
          </ChipRow>
        }
      >
        {visible.length ? (
          <View style={[styles.rows, { backgroundColor: c.bg }]}>
            {visible.map((item) => (
              <TransactionSwipeRow
                key={item.id}
                focused={focused}
                onEdit={() => edit(item)}
                onDelete={() => void remove(item)}
              >
                <TransactionRow
                  item={item}
                  accounts={accounts}
                  first
                  linked={linkedTransfer(data.transactions, item.id)}
                  onPress={() => setDetail(item)}
                  accessibilityActions={[
                    { name: "edit", label: "수정" },
                    { name: "delete", label: "삭제" },
                  ]}
                  onAccessibilityAction={({ nativeEvent }) => {
                    if (nativeEvent.actionName === "edit") edit(item);
                    if (nativeEvent.actionName === "delete") void remove(item);
                  }}
                />
              </TransactionSwipeRow>
            ))}
          </View>
        ) : (
          <EmptyState
            title="거래가 없어요"
            body={query || activeFilters ? "검색어나 필터를 바꿔 보세요." : "아래 + 버튼으로 첫 거래를 기록해 보세요."}
          />
        )}
      </Section>

      <Sheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="필터"
        footer={
          <SecondaryButton
            label="초기화"
            onPress={() => {
              setTypeFilter("all");
              setFromFilter("");
              setToFilter("");
            }}
          />
        }
      >
        <SelectField<TypeFilter>
          label="거래 유형"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "전체" },
            { value: "expense", label: "지출" },
            { value: "income", label: "수입" },
            { value: "transfer", label: "이동" },
          ]}
        />
        <SelectField label="출금 / 기준 통장" value={fromFilter} onChange={setFromFilter} options={accountOptions} />
        <SelectField label="입금 통장" value={toFilter} onChange={setToFilter} options={accountOptions} />
      </Sheet>

      <Sheet visible={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name} subtitle="거래 상세">
        {detail && (
          <View style={[styles.detail, { backgroundColor: c.card }]}>
            <DetailLine label="날짜" value={spokenDate(detail.date)} />
            <DetailLine label="유형" value={typeLabel(detail.type)} />
            <DetailLine label="분류" value={categoryText(detail)} />
            <DetailLine label="통장" value={accountText(accounts, detail)} />
            <DetailLine label="금액" value={amountText(detail)} strong />
            {detail.memo ? <DetailLine label="메모" value={detail.memo} /> : null}
            {detailLinked ? (
              <DetailLine label="자금 이동" value={accountText(accounts, detailLinked)} />
            ) : null}
          </View>
        )}
      </Sheet>
      {!data.transactions.length && !accounts.length ? (
        <TextButton label="가계부 설정에서 통장 먼저 만들기" onPress={() => router.push("/settings")} />
      ) : null}
    </Screen>
  );
}

function DetailLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.detailLine}>
      <Text variant="subhead" color="text2" style={{ width: 56 }}>
        {label}
      </Text>
      <Text variant={strong ? "headline" : "subhead"} weight={strong ? "700" : "500"} style={{ flex: 1 }} align="right">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.sm },
  detail: { borderRadius: radius.card, paddingHorizontal: space.rowX, paddingVertical: space.sm },
  detailLine: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
});
