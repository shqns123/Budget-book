import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useRef, useState, type ComponentProps, type ComponentRef } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useScopeSelection } from "@/components/ledger/ScopeControls";
import {
  Banner,
  DateField,
  FieldRow,
  FoldSection,
  Icon,
  IconButton,
  MoneyField,
  LoadingView,
  Popup,
  Section,
  Segmented,
  SelectField,
  Tag,
  Text,
  TextButton,
  TextField,
  PopupActions,
  PopupTool,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { closeCompose, finishCompose, lastComposeDate, rememberComposeDate, useCompose } from "@/lib/compose";
import { todayIso } from "@/lib/dates";
import {
  categoryOptions,
  isDebtAccount,
  linkedTransfer,
  newId,
  type RecurringTemplate,
  type Transaction,
  type TransactionType,
} from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";

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

/**
 * Add / edit a transaction: a popup above the floating tab bar, opened with openCompose().
 * Mounted once in the tab layout, before the tab bar.
 */
export function ComposePopup() {
  const { request, open } = useCompose();
  const { status } = useLedger();
  if (!request) return null;
  const popup: PopupFrame = {
    visible: open,
    onRequestClose: closeCompose,
    onClosed: () => finishCompose(request.key),
    title: request.id ? "거래 수정" : "거래 기록",
    from: request.from,
  };
  if (status !== "ready") {
    return (
      <Popup key={request.key} {...popup} footer={<PopupActions onCancel={closeCompose} />}>
        <LoadingView />
      </Popup>
    );
  }
  return <ComposeForm key={request.key} params={request} popup={popup} />;
}

type PopupFrame = Omit<ComponentProps<typeof Popup>, "children" | "footer">;

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
      date: isIsoDate(params.date) ? params.date! : (lastComposeDate() ?? todayIso()),
      accountId: from,
      toAccountId: accounts.find((a) => a.id !== from)?.id ?? "",
      category,
      minorCategory: opts[category]?.[0] ?? "",
    };
  });
  return initial;
}

function ComposeForm({ params, popup }: { params: Params; popup: PopupFrame }) {
  const { c } = useTheme();
  const close = closeCompose;
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
  // "자금 이동 같이 기록": a transfer (보내는 통장 → 월급통장) saved with an expense, same amount
  // and date, hidden from lists. 월급통장 defaults to last time's.
  const { linkTransfer, setLinkTransfer } = usePrefs();
  const [link] = useState(() => {
    const existing = editing ? linkedTransfer(data.transactions, editing.id) : undefined;
    const exists = (id?: string) => Boolean(id && accounts.some((a) => a.id === id));
    const to = existing?.toAccountId ?? (exists(linkTransfer.to) ? linkTransfer.to : "");
    // 보내는 통장: the one account picked on the transactions tab (as for 출금 통장), else last time's.
    const picked = exists(params.account) && params.account !== to ? params.account : undefined;
    const from =
      existing?.accountId ??
      picked ??
      (exists(linkTransfer.from) ? linkTransfer.from : (accounts.find((a) => a.id !== to)?.id ?? ""));
    return { existing, on: Boolean(existing), from, to };
  });
  const [linkOn, setLinkOn] = useState(link.on);
  const [linkFrom, setLinkFrom] = useState(link.from);
  const [linkTo, setLinkTo] = useState(link.to);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // 금액's keypad "next" moves on to 내용 (nothing is focused when the popup opens).
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
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
    const withLink = type === "expense" && linkOn;
    if (withLink) {
      if (!accounts.some((a) => a.id === linkTo)) return setFormError("자금 이동을 받을 월급통장을 골라 주세요.");
      if (!accounts.some((a) => a.id === linkFrom) || linkFrom === linkTo)
        return setFormError("자금 이동을 보내는 통장을 월급통장과 다른 통장으로 골라 주세요.");
    }
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
    const transfer: Transaction | null = withLink
      ? {
          id: link.existing?.id ?? newId(),
          accountId: linkFrom,
          toAccountId: linkTo,
          name: `${record.name} 자금 이동`,
          category: "이동",
          amount: record.amount,
          date: record.date,
          type: "transfer",
          linkedTo: record.id,
        }
      : null;
    // The old linked transfer (if any) is replaced, or dropped when the box is off.
    const rest = data.transactions.filter((t) => t.linkedTo !== record.id);
    const withRecord = editing ? rest.map((t) => (t.id === editing.id ? record : t)) : [record, ...rest];
    const next = transfer
      ? withRecord.flatMap((t) => (t.id === record.id ? [t, transfer] : [t]))
      : withRecord;
    if (await persist(next)) {
      if (transfer) setLinkTransfer({ from: linkFrom, to: linkTo });
      include([record.accountId, record.toAccountId]);
      close();
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
      // Recurring expenses are the fixed costs.
      ...((item.type ?? "expense") === "expense" ? { fixed: true } : {}),
    }));
    if (await persist([...records, ...data.transactions])) {
      include(records.flatMap((r) => [r.accountId, r.toAccountId]));
      close();
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
      close();
    }
  };

  const saveLabel = "저장";
  const batchOpen = Boolean(imageBatch || recurringBatch);
  // The floating bar's main action follows what the popup shows.
  const action = imageBatch
    ? { label: "등록", onPress: registerImages, disabled: !imageBatch.length }
    : recurringBatch
      ? { label: "등록", onPress: registerRecurring, disabled: !recurringBatch.length }
      : { label: saveLabel, onPress: submit, disabled: false };

  return (
    <Popup
      {...popup}
      footer={
        <PopupActions
          onCancel={close}
          label={action.label}
          onPress={() => void action.onPress()}
          loading={saving}
          disabled={action.disabled}
          tools={
            editing ? null : (
              <>
                <PopupTool
                  icon="image"
                  label="사진에서 거래 불러오기 (최대 5장)"
                  busy={analyzing}
                  disabled={!accounts.length}
                  onPress={() => void pickImages()}
                />
                {data.recurring.length > 0 && (
                  <PopupTool
                    icon="repeat"
                    label={recurringBatch ? "반복 항목 일괄 등록 닫기" : "반복 항목 일괄 등록"}
                    active={Boolean(recurringBatch)}
                    onPress={() => {
                      // Pressed again, it goes back to the record form.
                      if (recurringBatch) return setRecurringBatch(null);
                      setImageBatch(null);
                      setRecurringBatch(data.recurring.map((item) => ({ ...item })));
                    }}
                  />
                )}
              </>
            )
          }
        />
      }
    >
      {analyzing ? <Banner tone="info" message="사진에서 거래를 읽고 있어요." /> : null}
      {imageError ? <Banner message={imageError} /> : null}

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
            {/* Each item folds open to edit; the trash on its side leaves it out of this month. */}
            {recurringBatch.map((item) => (
              <FoldSection
                key={item.id}
                inset
                padded
                smallTitle
                title={item.name || "이름 없음"}
                right={
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={`${item.name} 제외`}
                    onPress={() => setRecurringBatch((rows) => rows?.filter((r) => r.id !== item.id) ?? null)}
                  />
                }
              >
                <View style={{ gap: space.md }}>
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
              </FoldSection>
            ))}
          </View>
        </Section>
      )}

      {!batchOpen && (
        <>
          <Segmented value={type} options={TYPE_OPTIONS} onChange={changeType} accessibilityLabel="거래 유형" />
          <Section padded>
            <View style={{ gap: space.lg }}>
              {/* 금액 → (keypad's next) 내용 → (done) 저장. */}
              <MoneyField
                label="금액"
                value={amount}
                onChange={setAmount}
                inputRef={amountRef}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => nameRef.current?.focus()}
              />
              <TextField
                label="내용"
                value={name}
                onChangeText={setName}
                placeholder={type === "transfer" ? "예: 카드 결제" : "예: 점심 식사"}
                autoCorrect={false}
                inputRef={nameRef}
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
              <DateField
                label="날짜"
                value={date}
                onChange={(iso) => {
                  setDate(iso);
                  rememberComposeDate(iso);
                }}
              />
              {type === "transfer" ? (
                <FieldRow>
                  <SelectField label="출금 통장" value={accountId} options={accountOptions} onChange={setAccountId} />
                  <SelectField label="입금 통장" value={toAccountId} options={accountOptions} onChange={setToAccountId} />
                </FieldRow>
              ) : (
                <>
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
                  {type === "income" ? (
                    <SelectField label="입금 통장" value={accountId} options={accountOptions} onChange={setAccountId} />
                  ) : (
                    <View style={styles.accountRow}>
                      <SelectField label="출금 통장" value={accountId} options={accountOptions} onChange={setAccountId} />
                      <LinkToggle on={linkOn} onPress={() => setLinkOn((v) => !v)} />
                    </View>
                  )}
                  {type === "expense" && linkOn ? (
                    <View style={[styles.linkBox, { backgroundColor: c.bg }]}>
                      <Text variant="footnote" weight="400" color="text2">
                        같은 금액·날짜로 월급통장으로 보내는 이동도 함께 기록해요. 거래 내역에는 따로 보이지 않고,
                        이 지출에 표시돼요.
                      </Text>
                      <SelectField
                        label="보내는 통장"
                        value={linkFrom}
                        options={accountOptions.filter((o) => o.value !== linkTo)}
                        onChange={setLinkFrom}
                      />
                      <SelectField label="받는 통장 (월급통장)" value={linkTo} options={accountOptions} onChange={setLinkTo} />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </Section>
          {formError ? <Banner message={formError} /> : null}
        </>
      )}
    </Popup>
  );
}

/** The "자금 이동 같이 기록" switch beside 출금 통장. */
function LinkToggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel="자금 이동 같이 기록"
      style={({ pressed }) => [
        styles.linkToggle,
        { backgroundColor: on ? c.primaryContainer : pressed ? c.fill : c.subtle },
      ]}
    >
      <Icon name={on ? "checkbox" : "checkboxEmpty"} size={20} color={on ? c.onPrimaryContainer : c.tertiary} />
      <Text variant="subhead" weight="600" color={on ? "onPrimaryContainer" : "text2"}>
        자금 이동
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accountRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  linkToggle: {
    minHeight: size.control,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkBox: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  draft: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  draftHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
