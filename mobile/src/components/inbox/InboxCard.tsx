import { Pressable, StyleSheet, View } from "react-native";
import { Icon, PrimaryButton, SecondaryButton, Tag, Text, TextButton } from "@/components/ui";
import { shortDate } from "@/lib/dates";
import { accountName, typeLabel, won, type Account, type Transaction } from "@/lib/ledger";
import type { InboxView } from "@/lib/notices/inbox";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

export type CardActions = {
  onEdit: () => void;
  onDismiss: () => void;
  onRegister: () => void;
  /** 반복 항목 already registered this month: done with this notice. */
  onConfirm: () => void;
  /** …and the notice's amount / date differ: copy them onto the record. */
  onSyncRegistered: () => void;
  /** A 취소 notice whose payment was found: delete that payment. */
  onDeleteCancelled: () => void;
  /** Fill in the 반복 항목 the notice looks like. */
  onApplySuggestion: () => void;
};

function draftMeta(view: InboxView, accounts: Account[]) {
  const { draft } = view;
  const from = accountName(accounts, draft.accountId) || view.sourceLabel;
  if (draft.type === "transfer") {
    const to = accountName(accounts, draft.toAccountId) || "받는 통장 선택";
    return `이동 · ${draft.accountId ? from : "보내는 통장 선택"} → ${to}`;
  }
  const category = draft.category
    ? `${draft.category}${draft.minorCategory ? ` · ${draft.minorCategory}` : ""}`
    : "분류 선택";
  return `${typeLabel(draft.type)} · ${category} · ${from}`;
}

/** One waiting notice: what it will be recorded as, and its actions. */
export function InboxCard({
  view,
  accounts,
  registered,
  actions,
}: {
  view: InboxView;
  accounts: Account[];
  /** This month's record of its 반복 항목, when there is one. */
  registered?: Transaction;
  actions: CardActions;
}) {
  const { c } = useTheme();
  const { item, draft, classification } = view;
  const parsed = item.parsed;
  const tone = draft.type === "income" ? c.income : draft.type === "transfer" ? c.text2 : c.expense;
  const tile = draft.type === "income" ? c.incomeContainer : draft.type === "transfer" ? c.subtle : c.expenseContainer;
  const sign = draft.type === "income" ? "+" : draft.type === "transfer" ? "↔ " : "−";
  const when = `${shortDate(draft.date)}${parsed?.time ? ` ${parsed.time}` : ""}`;
  const cancelled = parsed?.direction === "cancel";
  const differs =
    registered &&
    (Math.abs(registered.amount) !== draft.amount || registered.date !== draft.date.replaceAll("-", "."));
  const suggestion = !draft.recurringId ? classification.suggestion : undefined;

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <Pressable
        onPress={actions.onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${draft.name}, ${typeLabel(draft.type)} ${won(draft.amount)}, ${when}. 눌러서 수정`}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.6 }]}
      >
        <View style={[styles.tile, { backgroundColor: tile }]}>
          <Icon
            name={draft.type === "transfer" ? "transfer" : draft.type === "income" ? "income" : "expense"}
            size={20}
            color={tone}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" weight="600" numberOfLines={1}>
            {draft.name || "내용 없음"}
          </Text>
          <Text variant="footnote" weight="400" color="text2" numberOfLines={2}>
            {draftMeta(view, accounts)}
          </Text>
        </View>
        <View style={styles.amount}>
          <Text variant="headline" weight="700" tabular style={{ color: draft.amount ? tone : c.muted }}>
            {draft.amount ? `${sign}${won(draft.amount)}` : "금액 입력"}
          </Text>
          <Text variant="caption" color="text2" weight="400">
            {when}
          </Text>
        </View>
      </Pressable>

      <View style={styles.tags}>
        {draft.recurringId ? <Tag label={draft.fixed ? "반복 · 고정비" : "반복"} tone="accent" /> : null}
        {registered ? <Tag label="이번 달 이미 등록됨" tone="accent" /> : null}
        {cancelled ? <Tag label="승인 취소" tone="warn" /> : null}
        {item.status === "analyzing" ? <Tag label="읽는 중" /> : null}
        {item.status === "unread" ? <Tag label="직접 입력" tone="warn" /> : null}
        {parsed && parsed.installment > 0 ? <Tag label={`할부 ${parsed.installment}개월`} /> : null}
        {parsed && parsed.currency !== "KRW" ? <Tag label={`외화 ${parsed.currency}`} tone="warn" /> : null}
        {!view.linked && parsed ? <Tag label="통장 미연결" tone="warn" /> : null}
        {view.linked && classification.accountGuessed && !item.edits.accountId ? (
          <Tag label="통장 추정 · 등록하면 연결" />
        ) : null}
        {classification.toAccountGuessed && !item.edits.toAccountId ? <Tag label="받는 카드 추정" /> : null}
        {view.paired ? <Tag label={view.paired.parsed?.bill ? "카드사 알림과 묶음" : "입금 알림과 묶음"} /> : null}
      </View>
      <Text variant="footnote" weight="400" color="text2">
        {classification.reason}
      </Text>

      {suggestion ? (
        <View style={[styles.suggest, { backgroundColor: c.primaryContainer }]}>
          <Icon name="repeat" size={18} color={c.onPrimaryContainer} />
          <Text variant="footnote" color="onPrimaryContainer" style={{ flex: 1 }}>
            반복 항목 &apos;{suggestion.name}&apos;과 통장·날짜·금액이 맞아요.
          </Text>
          <TextButton label={`${suggestion.name}로 채우기`} onPress={actions.onApplySuggestion} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {registered ? (
          <>
            <TextButton label="무시" tone="muted" onPress={actions.onDismiss} />
            {differs ? (
              <SecondaryButton style={{ flex: 1 }} label="금액·날짜 맞추기" onPress={actions.onSyncRegistered} />
            ) : null}
            <PrimaryButton style={{ flex: 1 }} label="확인" onPress={actions.onConfirm} />
          </>
        ) : cancelled && classification.cancelOf ? (
          <>
            <TextButton label="무시" tone="muted" onPress={actions.onDismiss} />
            <SecondaryButton style={{ flex: 1 }} label="수정" onPress={actions.onEdit} />
            <PrimaryButton style={{ flex: 1 }} label="원래 결제 삭제" onPress={actions.onDeleteCancelled} />
          </>
        ) : (
          <>
            <TextButton label="무시" tone="muted" onPress={actions.onDismiss} />
            <SecondaryButton style={{ flex: 1 }} label="수정" onPress={actions.onEdit} />
            <PrimaryButton
              style={{ flex: 1 }}
              label="등록"
              disabled={item.status === "analyzing"}
              onPress={actions.onRegister}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  tile: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  amount: { alignItems: "flex-end", gap: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  suggest: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.control,
    paddingLeft: space.md,
    paddingVertical: space.xs,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
});
