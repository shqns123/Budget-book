import { StyleSheet, View } from "react-native";
import {
  Banner,
  DateField,
  FieldRow,
  MoneyField,
  PrimaryButton,
  SecondaryButton,
  Segmented,
  SelectField,
  Sheet,
  SwitchRow,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import { categoryOptions, type Account, type LedgerCategory, type RecurringTemplate, type TransactionType } from "@/lib/ledger";
import { applyTemplate, type NoticeDraft } from "@/lib/notices/classify";
import type { InboxView } from "@/lib/notices/inbox";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "지출" },
  { value: "income" as const, label: "수입" },
  { value: "transfer" as const, label: "이동" },
];

const NO_RECURRING = "none";

/**
 * Editing a waiting notice before it is registered: every field of the record, the 반복 항목 it
 * belongs to (which makes it a 고정비), and the notice's own text to check against. Each change is
 * kept on the item right away, so closing the sheet doesn't lose it.
 */
export function InboxEditor({
  view,
  accounts,
  categories,
  recurring,
  error,
  onChange,
  onReset,
  onRegister,
  onAddRecurring,
  onRetry,
  onClose,
}: {
  view: InboxView | null;
  accounts: Account[];
  categories: LedgerCategory[];
  recurring: RecurringTemplate[];
  error: string;
  onChange: (patch: Partial<NoticeDraft>) => void;
  onReset: () => void;
  onRegister: () => void;
  /** Saves this record as a new 반복 항목 and links it. */
  onAddRecurring: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const draft = view?.draft;
  const accountOptions = accounts.filter((a) => !a.hidden).map((a) => ({ value: a.id, label: a.name }));
  const options = draft ? categoryOptions(categories, draft.type === "income" ? "income" : "expense") : {};
  const templates = draft
    ? recurring.filter((t) => ((t.type ?? "expense") === "income") === (draft.type === "income"))
    : [];

  const changeType = (type: TransactionType) => {
    if (!draft) return;
    if (type === "transfer") {
      onChange({ type, category: "", minorCategory: "", fixed: false, recurringId: "" });
      return;
    }
    const opts = categoryOptions(categories, type);
    const keep = opts[draft.category] ? draft.category : "";
    onChange({
      type,
      toAccountId: "",
      category: keep,
      minorCategory: keep ? draft.minorCategory : "",
      fixed: type === "expense" ? draft.fixed : false,
      recurringId: "",
    });
  };

  const pickRecurring = (id: string) => {
    if (!draft) return;
    if (id === NO_RECURRING) return onChange({ recurringId: "", fixed: false });
    const template = recurring.find((t) => t.id === id);
    if (!template) return;
    // The 반복 항목's 내용 and 분류, with the notice's own amount and date.
    const applied = applyTemplate(template, draft);
    onChange({ ...applied, amount: draft.amount, date: draft.date });
  };

  return (
    <Sheet
      visible={Boolean(view)}
      onClose={onClose}
      title="알림 내용 수정"
      subtitle={view?.item.appName}
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <SecondaryButton style={{ flex: 1 }} label="처음대로" onPress={onReset} />
          <PrimaryButton style={{ flex: 1 }} label="등록" onPress={onRegister} disabled={view?.item.status === "analyzing"} />
        </View>
      }
    >
      {view && draft ? (
        <>
          <View style={[styles.raw, { backgroundColor: c.subtle }]}>
            <Text variant="caption" color="text2">
              알림 원문
            </Text>
            <Text variant="footnote" weight="400" selectable>
              {[view.item.title, view.item.text].filter(Boolean).join("\n")}
            </Text>
            {view.item.status === "unread" ? (
              <TextButton label="다시 읽기" onPress={onRetry} />
            ) : null}
          </View>

          <Segmented value={draft.type} options={TYPE_OPTIONS} onChange={changeType} accessibilityLabel="거래 유형" />
          <MoneyField label="금액" value={draft.amount || ""} onChange={(digits) => onChange({ amount: Number(digits) || 0 })} />
          <TextField label="내용" value={draft.name} onChangeText={(name) => onChange({ name })} autoCorrect={false} />
          <DateField label="날짜" value={draft.date} onChange={(date) => onChange({ date })} />

          {draft.type === "transfer" ? (
            <FieldRow>
              <SelectField
                label="보내는 통장"
                value={draft.accountId}
                options={accountOptions}
                onChange={(accountId) => onChange({ accountId })}
              />
              <SelectField
                label="받는 통장"
                value={draft.toAccountId}
                options={accountOptions.filter((o) => o.value !== draft.accountId)}
                onChange={(toAccountId) => onChange({ toAccountId })}
              />
            </FieldRow>
          ) : (
            <>
              <SelectField
                label={draft.type === "income" ? "입금 통장" : "출금 통장·카드"}
                value={draft.accountId}
                options={accountOptions}
                onChange={(accountId) => onChange({ accountId })}
              />
              <FieldRow>
                <SelectField
                  label="대분류"
                  value={draft.category}
                  options={Object.keys(options).map((k) => ({ value: k, label: k }))}
                  onChange={(category) => onChange({ category, minorCategory: options[category]?.[0] ?? "" })}
                />
                <SelectField
                  label="소분류"
                  value={draft.minorCategory}
                  options={(options[draft.category] ?? []).map((k) => ({ value: k, label: k }))}
                  onChange={(minorCategory) => onChange({ minorCategory })}
                />
              </FieldRow>
            </>
          )}

          <SelectField
            label="반복 항목"
            value={draft.recurringId || NO_RECURRING}
            options={[
              { value: NO_RECURRING, label: "반복 항목 아님" },
              ...templates.map((t) => ({ value: t.id, label: t.name, meta: `매달 ${t.day}일` })),
            ]}
            onChange={pickRecurring}
          />
          {draft.type === "expense" ? (
            <SwitchRow label="고정비" value={draft.fixed} onChange={(fixed) => onChange({ fixed })} />
          ) : null}
          {!draft.recurringId ? (
            <TextButton label="이 거래를 반복 항목으로 추가" onPress={onAddRecurring} />
          ) : null}
          {error ? <Banner message={error} /> : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  raw: { borderRadius: radius.card, padding: space.md, gap: space.xs },
});
