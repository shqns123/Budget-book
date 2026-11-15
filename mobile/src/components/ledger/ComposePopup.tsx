import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useScopeSelection } from "@/components/ledger/ScopeControls";
import {
  Banner,
  DateField,
  FieldRow,
  IconButton,
  MoneyField,
  LoadingView,
  PrimaryButton,
  Screen,
  SecondaryButton,
  Section,
  Segmented,
  SelectField,
  Tag,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { todayIso } from "@/lib/dates";
import {
  categoryOptions,
  isDebtAccount,
  newId,
  typeLabel,
  type RecurringTemplate,
  type Transaction,
  type TransactionType,
} from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

type ImageDraft = {
  id: string;
  date: string;
  name: string;
  amount: number;
  type: TransactionType;
  accountId: string;
  toAccountId: string;
  category: string;
  minorCategory: string;
  confidence: number;
};

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "지출" },
  { value: "income" as const, label: "수입" },
  { value: "transfer" as const, label: "이동" },
];

const isIsoDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

type Params = { id?: string; account?: string; date?: string };

export default function ComposeScreen() {
  const params = useLocalSearchParams<Params>();
  const { status } = useLedger();
  if (status !== "ready") {
    return (
      <Screen
        title="거래 기록"
        inTabs={false}
        refreshable={false}
        right={<IconButton icon="close" label="닫기" filled onPress={() => router.back()} />}
      >
        <LoadingView />
      </Screen>
    );
  }
  return <ComposeForm params={params} />;
}

/** The form's starting values: the record being edited, or a new one. */
function useInitialForm(params: Params) {
  const { data, accounts, categories } = useLedger();
  const [initial] = useState(() => {
    const editing = params.id ? data.transactions.find((t) => t.id === params.id) : undefined;
    if (editing) {
      const opts = categoryOptions(categories, editing.type === "income" ? "income" : "expense");
      const category =
        editing.type === "transfer" ? "" : opts[editing.category] ? editing.category : (Object.keys(opts)[0] ?? "");
      return {
        editing,
        type: editing.type,
        name: editing.name,
        amount: String(Math.abs(editing.amount)),
        date: editing.date.replaceAll(".", "-"),
        accountId: editing.accountId,
        toAccountId: editing.toAccountId ?? accounts.find((a) => a.id !== editing.accountId)?.id ?? "",
        category,
        minorCategory: editing.minorCategory ?? opts[category]?.[0] ?? "",
      };
    }
    const requested = accounts.find((a) => a.id === params.account)?.id;
    const from = requested ?? accounts.find((a) => !isDebtAccount(accounts, a.id))?.id ?? accounts[0]?.id ?? "";
    const opts = categoryOptions(categories, "expense");
    const category = Object.keys(opts)[0] ?? "";
    return {
      editing: undefined,
      type: "expense" as TransactionType,
      name: "",
      amount: "",
      date: isIsoDate(params.date) ? params.date! : todayIso(),
      accountId: from,
      toAccountId: accounts.find((a) => a.id !== from)?.id ?? "",
      category,
      minorCategory: opts[category]?.[0] ?? "",
    };
  });
  return initial;
}

function ComposeForm({ params }: { params: Params }) {
  const { c } = useTheme();
  const { data, accounts, categories, save } = useLedger();
  const { month } = usePrefs();
  const { selected, include } = useScopeSelection("transactions");
  const initial = useInitialForm(params);
  const editing = initial.editing;

  const [type, setType] = useState<TransactionType>(initial.type);
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(initial.amount);
  const [date, setDate] = useState(initial.date);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId);
  const [category, setCategory] = useState(initial.category);
  const [minorCategory, setMinorCategory] = useState(initial.minorCategory);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recurringBatch, setRecurringBatch] = useState<RecurringTemplate[] | null>(null);
  const [imageBatch, setImageBatch] = useState<ImageDraft[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageError, setImageError] = useState("");

  const options = useMemo(
    () => categoryOptions(categories, type === "income" ? "income" : "expense"),
    [categories, type],
  );
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const changeType = (next: TransactionType) => {
    setType(next);
    if (next === "transfer") return;
    const opts = categoryOptions(categories, next);
    const first = Object.keys(opts)[0] ?? "";
    setCategory(first);
    setMinorCategory(opts[first]?.[0] ?? "");
  };

  const persist = async (records: Transaction[]) => {
    setSaving(true);
    const ok = await save("transactions", records);
    setSaving(false);
    return ok;
  };

  const submit = async () => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return setFormError("금액을 1원 이상 입력해 주세요.");
    if (!name.trim()) return setFormError("내용을 입력해 주세요.");
    if (!accounts.some((a) => a.id === accountId)) return setFormError("출금 통장을 다시 선택해 주세요.");
    if (type === "transfer" && !accounts.some((a) => a.id === toAccountId))
      return setFormError("입금 통장을 다시 선택해 주세요.");
    setFormError("");
    const record: Transaction = {
      id: editing?.id ?? newId(),
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      name: name.trim(),
      category: type === "transfer" ? "이동" : category,
      minorCategory: type === "transfer" ? undefined : minorCategory,
      amount: type === "income" ? numeric : -numeric,
      date: (date || `${month}-01`).replaceAll("-", "."),
      type,
      ...(editing?.memo ? { memo: editing.memo } : {}),
      ...(editing?.fixed !== undefined ? { fixed: editing.fixed } : {}),
    };
    const next = editing
      ? data.transactions.map((t) => (t.id === editing.id ? record : t))
      : [record, ...data.transactions];
    if (await persist(next)) {
      include([record.accountId, record.toAccountId]);
      router.back();
    }
  };

  const registerRecurring = async () => {
    if (!recurringBatch?.length) return;
    const records: Transaction[] = recurringBatch.map((item) => ({
      id: newId(),
      accountId: item.accountId,
      toAccountId: item.type === "transfer" ? item.toAccountId : undefined,
      name: item.name,
      category: item.type === "transfer" ? "이동" : item.category,
      minorCategory: item.type === "transfer" ? undefined : item.minorCategory,
      amount: item.type === "income" ? item.amount : -item.amount,
      date: `${month.replace("-", ".")}.${String(Math.min(31, Math.max(1, item.day))).padStart(2, "0")}`,
      type: item.type ?? "expense",
    }));
    if (await persist([...records, ...data.transactions])) {
      include(records.flatMap((r) => [r.accountId, r.toAccountId]));
      router.back();
    }
  };

  const pickImages = async () => {
    setImageError("");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return;
    setAnalyzing(true);
    setImageBatch(null);
    try {
      const form = new FormData();
      for (const [index, asset] of result.assets.slice(0, 5).entries()) {
        // Re-encode as JPEG and cap the width so uploads stay well under the server's 8MB limit.
        const context = ImageManipulator.manipulate(asset.uri);
        if (!asset.width || asset.width > 1600) context.resize({ width: 1600, height: null });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
        form.append("images", {
          uri: saved.uri,
          name: `photo-${index + 1}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }
      form.append(
        "context",
        JSON.stringify({
          month,
          defaultAccountId: accountId || selected[0] || "",
          accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
          categories: categories.map((cat) => ({
            majorCategory: cat.majorCategory,
            minorCategory: cat.minorCategory,
            transactionType: cat.transactionType,
          })),
        }),
      );
      const response = await apiFetch("/api/transactions/analyze-image", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        transactions?: ImageDraft[];
        error?: string;
      };
      if (!response.ok || !payload.transactions?.length) {
        throw new Error(payload.error || "사진에서 거래를 찾지 못했어요.");
      }
      setRecurringBatch(null);
      setImageBatch(payload.transactions);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "사진을 분석하지 못했어요.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateDraft = (id: string, patch: Partial<ImageDraft>) =>
    setImageBatch((rows) => rows?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null);

  const changeDraftType = (draft: ImageDraft, next: TransactionType) => {
    if (next === "transfer") {
      updateDraft(draft.id, {
        type: next,
        category: "이동",
        minorCategory: "",
        toAccountId: draft.toAccountId || accounts.find((a) => a.id !== draft.accountId)?.id || "",
      });
      return;
    }
    const opts = categoryOptions(categories, next);
    const first = Object.keys(opts)[0] ?? "";
    updateDraft(draft.id, { type: next, category: first, minorCategory: opts[first]?.[0] ?? "", toAccountId: "" });
  };

  const registerImages = async () => {
    if (!imageBatch?.length) return;
    const invalid = imageBatch.some(
      (item) =>
        !item.name.trim() ||
        !isIsoDate(item.date) ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0 ||
        !accounts.some((a) => a.id === item.accountId) ||
        (item.type === "transfer" &&
          (!accounts.some((a) => a.id === item.toAccountId) || item.accountId === item.toAccountId)),
    );
    if (invalid) return setImageError("내용, 금액, 통장 정보를 다시 확인해 주세요.");
    const records: Transaction[] = imageBatch.map((item) => ({
      id: newId(),
      accountId: item.accountId,
      toAccountId: item.type === "transfer" ? item.toAccountId : undefined,
      name: item.name.trim(),
      category: item.type === "transfer" ? "이동" : item.category,
      minorCategory: item.type === "transfer" ? undefined : item.minorCategory,
      amount: item.type === "income" ? item.amount : -item.amount,
      date: item.date.replaceAll("-", "."),
      type: item.type,
    }));
    if (await persist([...records, ...data.transactions])) {
      include(records.flatMap((r) => [r.accountId, r.toAccountId]));
      router.back();
    }
  };

  const isRepayment = type === "transfer" && isDebtAccount(accounts, toAccountId);
  const saveLabel = editing
    ? "거래 수정 저장"
    : type === "transfer"
      ? isRepayment
        ? "상환 이동 기록"
        : "이동 기록"
      : type === "expense"
        ? "지출 기록하기"
        : "수입 기록하기";
  const batchOpen = Boolean(imageBatch || recurringBatch);

  return (
    <Screen
      title={editing ? "거래 수정" : "거래 기록"}
      inTabs={false}
      refreshable={false}
      right={<IconButton icon="close" label="닫기" filled onPress={() => router.back()} />}
    >
      {!editing && (
        <View style={{ gap: space.md }}>
          <SecondaryButton
            icon="image"
            label={analyzing ? "사진에서 거래를 읽고 있어요" : "사진에서 거래 불러오기 (최대 5장)"}
            disabled={analyzing || !accounts.length}
            onPress={() => void pickImages()}
          />
          {data.recurring.length > 0 && (
            <SecondaryButton
              icon="repeat"
              label="반복 항목 일괄 등록"
              onPress={() => {
                setImageBatch(null);
                setRecurringBatch(data.recurring.map((item) => ({ ...item })));
              }}
            />
          )}
          {imageError ? <Banner message={imageError} /> : null}
        </View>
      )}

      {imageBatch && (
        <Section
          title={`사진에서 ${imageBatch.length}건을 찾았어요`}
          action={<TextButton label="모두 취소" tone="muted" onPress={() => setImageBatch(null)} />}
        >
          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text variant="footnote" weight="400" color="text2">
              내용을 확인하고 잘못 읽은 항목은 수정하거나 제외해 주세요. 사진은 분석에만 쓰이고 저장되지 않아요.
            </Text>
            {imageBatch.map((draft) => {
              const opts = categoryOptions(categories, draft.type === "income" ? "income" : "expense");
              return (
                <View key={draft.id} style={[styles.draft, { backgroundColor: c.bg }]}>
                  <View style={styles.draftHead}>
                    <Segmented
                      style={{ flex: 1 }}
                      value={draft.type}
                      options={TYPE_OPTIONS}
                      onChange={(next) => changeDraftType(draft, next)}
                      accessibilityLabel={`${draft.name} 거래 유형`}
                    />
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`${draft.name} 제외`}
                      onPress={() => setImageBatch((rows) => rows?.filter((r) => r.id !== draft.id) ?? null)}
                    />
                  </View>
                  {draft.confidence < 0.75 && <Tag label="확인 필요" tone="warn" />}
                  <TextField
                    label="내용"
                    value={draft.name}
                    onChangeText={(text) => updateDraft(draft.id, { name: text })}
                  />
                  <FieldRow>
                    <DateField label="날짜" value={draft.date} onChange={(iso) => updateDraft(draft.id, { date: iso })} compact />
                    <MoneyField
                      label="금액"
                      compact
                      value={draft.amount}
                      onChange={(digits) => updateDraft(draft.id, { amount: Number(digits) })}
                    />
                  </FieldRow>
                  <FieldRow>
                    <SelectField
                      compact
                      label={draft.type === "income" ? "입금 통장" : "출금 통장"}
                      value={draft.accountId}
                      options={accountOptions}
                      onChange={(value) => updateDraft(draft.id, { accountId: value })}
                    />
                    {draft.type === "transfer" ? (
                      <SelectField
                        compact
                        label="입금 통장"
                        value={draft.toAccountId}
                        options={accountOptions.filter((o) => o.value !== draft.accountId)}
                        onChange={(value) => updateDraft(draft.id, { toAccountId: value })}
                      />
                    ) : null}
                  </FieldRow>
                  {draft.type !== "transfer" && (
                    <FieldRow>
                      <SelectField
                        compact
                        label="대분류"
                        value={draft.category}
                        options={Object.keys(opts).map((k) => ({ value: k, label: k }))}
                        onChange={(value) =>
                          updateDraft(draft.id, { category: value, minorCategory: opts[value]?.[0] ?? "" })
                        }
                      />
                      <SelectField
                        compact
                        label="소분류"
                        value={draft.minorCategory}
                        options={(opts[draft.category] ?? []).map((k) => ({ value: k, label: k }))}
                        onChange={(value) => updateDraft(draft.id, { minorCategory: value })}
                      />
                    </FieldRow>
                  )}
                </View>
              );
            })}
            <PrimaryButton
              label={`확인한 ${imageBatch.length}건 일괄 등록`}
              disabled={!imageBatch.length}
              loading={saving}
              onPress={() => void registerImages()}
            />
          </View>
        </Section>
      )}

      {recurringBatch && (
        <Section
          title="반복 항목 일괄 등록"
          action={<TextButton label="취소" tone="muted" onPress={() => setRecurringBatch(null)} />}
        >
          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text variant="footnote" weight="400" color="text2">
              이번 달에 등록할 항목만 남기고 내용을 수정한 뒤 일괄 등록하세요.
            </Text>
            {recurringBatch.map((item) => (
              <View key={item.id} style={[styles.draft, { backgroundColor: c.bg }]}>
                <View style={styles.draftHead}>
                  <Tag label={typeLabel(item.type ?? "expense")} tone="accent" />
                  <View style={{ flex: 1 }} />
                  <TextButton
                    label="제외"
                    tone="danger"
                    onPress={() => setRecurringBatch((rows) => rows?.filter((r) => r.id !== item.id) ?? null)}
                  />
                </View>
                <TextField
                  label="내용"
                  value={item.name}
                  onChangeText={(text) =>
                    setRecurringBatch((rows) => rows?.map((r) => (r.id === item.id ? { ...r, name: text } : r)) ?? null)
                  }
                />
                <FieldRow>
                  <MoneyField
                    label="금액"
                    compact
                    value={item.amount}
                    onChange={(digits) =>
                      setRecurringBatch(
                        (rows) => rows?.map((r) => (r.id === item.id ? { ...r, amount: Number(digits) } : r)) ?? null,
                      )
                    }
                  />
                  <TextField
                    label="일자"
                    compact
                    keyboardType="number-pad"
                    value={String(item.day)}
                    suffix="일"
                    style={{ flex: 0.6 }}
                    onChangeText={(text) =>
                      setRecurringBatch(
                        (rows) =>
                          rows?.map((r) =>
                            r.id === item.id ? { ...r, day: Number(text.replace(/[^0-9]/g, "")) || 1 } : r,
                          ) ?? null,
                      )
                    }
                  />
                </FieldRow>
              </View>
            ))}
            <PrimaryButton
              label="선택 항목 일괄 등록"
              disabled={!recurringBatch.length}
              loading={saving}
              onPress={() => void registerRecurring()}
            />
          </View>
        </Section>
      )}

      {!batchOpen && (
        <>
          <Segmented value={type} options={TYPE_OPTIONS} onChange={changeType} accessibilityLabel="거래 유형" />
          <Section padded>
            <View style={{ gap: space.lg }}>
              <MoneyField label="금액" value={amount} onChange={setAmount} />
              <TextField
                label="내용"
                value={name}
                onChangeText={setName}
                placeholder={type === "transfer" ? "예: 카드 결제" : "예: 점심 식사"}
                autoCorrect={false}
              />
              <DateField label="날짜" value={date} onChange={setDate} />
              {type === "transfer" ? (
                <FieldRow>
                  <SelectField label="출금 통장" value={accountId} options={accountOptions} onChange={setAccountId} />
                  <SelectField label="입금 통장" value={toAccountId} options={accountOptions} onChange={setToAccountId} />
                </FieldRow>
              ) : (
                <>
                  <FieldRow>
                    <SelectField
                      label="대분류"
                      value={category}
                      options={Object.keys(options).map((k) => ({ value: k, label: k }))}
                      onChange={(value) => {
                        setCategory(value);
                        setMinorCategory(options[value]?.[0] ?? "");
                      }}
                    />
                    <SelectField
                      label="소분류"
                      value={minorCategory}
                      options={(options[category] ?? []).map((k) => ({ value: k, label: k }))}
                      onChange={setMinorCategory}
                    />
                  </FieldRow>
                  <SelectField
                    label={type === "income" ? "입금 통장" : "출금 통장"}
                    value={accountId}
                    options={accountOptions}
                    onChange={setAccountId}
                  />
                </>
              )}
            </View>
          </Section>
          {formError ? <Banner message={formError} /> : null}
          <PrimaryButton label={saveLabel} loading={saving} onPress={() => void submit()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  draft: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  draftHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
