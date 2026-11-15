import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AccountChip, MonthChip, useScopeSelection } from "@/components/ledger/ScopeControls";
import {
  accountText,
  amountText,
  categoryText,
  TransactionRow,
} from "@/components/ledger/TransactionRow";
import {
  Chip,
  ChipRow,
  EmptyState,
  Icon,
  PrimaryButton,
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
import { typeLabel, type Transaction, type TransactionType } from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { confirm } from "@/lib/confirm";

type TypeFilter = "all" | TransactionType;

export default function TransactionsScreen() {
  const { c } = useTheme();
  const { data, accounts, save } = useLedger();
  const { month, sortByDate, setSortByDate } = usePrefs();
  const { selected } = useScopeSelection("transactions");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [detail, setDetail] = useState<Transaction | null>(null);

  const activeFilters = [typeFilter !== "all", Boolean(fromFilter), Boolean(toFilter)].filter(Boolean).length;

  const visible = useMemo(() => {
    const prefix = month.replace("-", ".");
    const list = data.transactions.filter(
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

  const remove = async (record: Transaction) => {
    const ok = await confirm({
      title: "거래를 삭제할까요?",
      message: `${record.name} ${amountText(record)}\n삭제하면 되돌릴 수 없어요.`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    if (await save("transactions", (rows) => rows.filter((r) => r.id !== record.id))) setDetail(null);
  };

  return (
    <Screen
      title="거래 내역"
      above={
        <ChipRow>
          <MonthChip />
          <AccountChip scope="transactions" />
        </ChipRow>
      }
    >
      <View style={[styles.guide, { backgroundColor: c.card }]}>
        <Icon name="transfer" size={20} color={c.text2} />
        <Text variant="footnote" weight="400" color="text2" style={{ flex: 1 }}>
          카드 사용은 해당 카드의 지출로, 결제·상환은 출금 통장에서 카드·대출 계좌로 이동으로 기록해요. 이동은 소비로 중복 집계되지 않아요.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="내역 검색"
          accessibilityLabel="내역 검색"
          returnKeyType="search"
        />
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
      </View>

      <Section title={`${monthLabel(month)} · ${visible.length}건`}>
        {visible.length ? (
          visible.map((item, index) => (
            <TransactionRow
              key={item.id}
              item={item}
              accounts={accounts}
              first={index === 0}
              onPress={() => setDetail(item)}
            />
          ))
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
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <SecondaryButton
              style={{ flex: 1 }}
              label="초기화"
              onPress={() => {
                setTypeFilter("all");
                setFromFilter("");
                setToFilter("");
              }}
            />
            <PrimaryButton style={{ flex: 1 }} label="적용" onPress={() => setShowFilters(false)} />
          </View>
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
          <>
            <View style={[styles.detail, { backgroundColor: c.card }]}>
              <DetailLine label="날짜" value={spokenDate(detail.date)} />
              <DetailLine label="유형" value={typeLabel(detail.type)} />
              <DetailLine label="분류" value={categoryText(detail)} />
              <DetailLine label="통장" value={accountText(accounts, detail)} />
              <DetailLine label="금액" value={amountText(detail)} strong />
              {detail.memo ? <DetailLine label="메모" value={detail.memo} /> : null}
            </View>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <SecondaryButton
                style={{ flex: 1 }}
                icon="edit"
                label="수정"
                onPress={() => {
                  const id = detail.id;
                  setDetail(null);
                  router.push({ pathname: "/compose", params: { id } });
                }}
              />
              <SecondaryButton style={{ flex: 1 }} icon="trash" tone="danger" label="삭제" onPress={() => remove(detail)} />
            </View>
          </>
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
  guide: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    alignItems: "flex-start",
  },
  detail: { borderRadius: radius.card, paddingHorizontal: space.rowX, paddingVertical: space.sm },
  detailLine: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
});
