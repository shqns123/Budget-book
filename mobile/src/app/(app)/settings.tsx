import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AccountOrderRows } from "@/components/ledger/AccountOrderRows";
import {
  CATEGORY_ICON_KEYS,
  CATEGORY_ICONS,
  CategoryTile,
  categoryIcon,
  type CategoryIconKey,
} from "@/components/ledger/CategoryIcon";
import { accountIcon } from "@/components/ledger/ScopeControls";
import {
  Banner,
  EmptyState,
  FieldRow,
  FoldSection,
  IconButton,
  MoneyField,
  PrimaryButton,
  Row,
  Screen,
  SecondaryButton,
  Section,
  Segmented,
  SelectField,
  Sheet,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import {
  classificationLabel,
  formatNumber,
  majorLabel,
  moveAccount,
  moveAccountTo,
  moveCategoryType,
  newId,
  typeLabel,
  unmarkedRecurringExpenses,
  type AccountKind,
  type AccountSetting,
  type CategorySetting,
  type RecurringTemplate,
  type SharedSettings,
  type TransactionType,
} from "@/lib/ledger";
import { useLedger } from "@/store/ledger-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { confirm } from "@/lib/confirm";

type View_ = "accounts" | "categories" | "budgets" | "recurring";
const TYPING = { debounce: 500 };
const KIND_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: "bank", label: "입출금 통장" },
  { value: "card", label: "신용/체크카드" },
  { value: "loan", label: "대출" },
  { value: "savings", label: "저축투자" },
  { value: "cash", label: "현금" },
];
const CLASSIFICATIONS: AccountSetting["classification"][] = ["자산", "단기부채", "장기부채"];

export default function SettingsScreen() {
  const { data, save } = useLedger();
  const settings = data.settings;
  const [view, setView] = useState<View_>("accounts");
  const [draggingAccount, setDraggingAccount] = useState(false);

  const update = (fn: (s: SharedSettings) => SharedSettings, typing?: boolean) =>
    void save("settings", fn, typing ? TYPING : undefined);

  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([2024, 2025, 2026, thisYear, thisYear + 1, settings.startYear])).sort();

  return (
    <Screen title="가계부 설정" back inTabs={false} scrollEnabled={!draggingAccount}>
      <Section padded>
        <FieldRow>
          <SelectField
            label="시작 연도"
            value={String(settings.startYear)}
            options={years.map((y) => ({ value: String(y), label: `${y}년` }))}
            onChange={(v) => update((s) => ({ ...s, startYear: Number(v) }))}
          />
          <SelectField
            label="회계기준월"
            value={String(settings.fiscalMonth)}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` }))}
            onChange={(v) => update((s) => ({ ...s, fiscalMonth: Number(v) }))}
          />
        </FieldRow>
      </Section>
      <Segmented
        value={view}
        onChange={setView}
        accessibilityLabel="설정 항목"
        options={[
          { value: "accounts", label: "계좌" },
          { value: "categories", label: "분류" },
          { value: "budgets", label: "월 예산" },
          { value: "recurring", label: "반복" },
        ]}
      />
      {view === "accounts" ? (
        <AccountsView settings={settings} update={update} onDragChange={setDraggingAccount} />
      ) : view === "categories" ? (
        <CategoriesView settings={settings} update={update} />
      ) : view === "budgets" ? (
        <BudgetsView settings={settings} />
      ) : (
        <RecurringView settings={settings} />
      )}
    </Screen>
  );
}

type UpdateFn = (fn: (s: SharedSettings) => SharedSettings, typing?: boolean) => void;

function AccountsView({
  settings,
  update,
  onDragChange,
}: {
  settings: SharedSettings;
  update: UpdateFn;
  onDragChange: (active: boolean) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const blank = {
    name: "",
    kind: "bank" as AccountKind,
    classification: "자산" as AccountSetting["classification"],
    major: "💰현금·예금",
    minor: "보통예금",
    balance: "0",
    memo: "",
    paymentDay: "",
  };
  const [draft, setDraft] = useState(blank);
  // 계좌 수정: name, 메모 (card / account numbers for 결제 알림 matching) and 결제일. The id stays,
  // so its transactions and notice links are untouched.
  const [editing, setEditing] = useState<{ id: string; name: string; memo: string; paymentDay: string } | null>(
    null,
  );
  const openEdit = (account: AccountSetting) =>
    setEditing({
      id: account.id,
      name: account.name,
      memo: account.memo ?? "",
      paymentDay: account.paymentDay ? String(account.paymentDay) : "",
    });
  const saveEdit = () => {
    if (!editing?.name.trim()) return;
    const { id, name, memo, paymentDay } = editing;
    update((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === id
          ? { ...a, name: name.trim(), memo: memo.trim(), paymentDay: paymentDay ? Number(paymentDay) : undefined }
          : a,
      ),
    }));
    setEditing(null);
  };

  const addAccount = () => {
    if (!draft.name.trim()) return;
    update((s) => {
      const prefix = draft.classification === "자산" ? "1" : draft.classification === "단기부채" ? "201" : "202";
      const account: AccountSetting = {
        id: newId(),
        code: `${prefix}${String(s.accounts.length + 1).padStart(5, "0")}`,
        name: draft.name.trim(),
        kind: draft.kind,
        classification: draft.classification,
        major: draft.major,
        minor: draft.minor,
        balance: Number(draft.balance || 0),
        memo: draft.memo,
        paymentDay: draft.paymentDay ? Number(draft.paymentDay) : undefined,
      };
      return { ...s, accounts: [...s.accounts, account] };
    });
    setDraft(blank);
    setShowAdd(false);
  };

  const toggleHidden = (id: string) =>
    update((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, hidden: !a.hidden } : a)),
    }));

  const [reordering, setReordering] = useState(false);
  const move = (id: string, step: -1 | 1) => update((s) => ({ ...s, accounts: moveAccount(s.accounts, id, step) }));
  const drop = (id: string, targetId: string) =>
    update((s) => ({ ...s, accounts: moveAccountTo(s.accounts, id, targetId) }));

  return (
    <>
      <View style={styles.accountActions}>
        <SecondaryButton
          icon="plus"
          label="계좌 추가"
          onPress={() => setShowAdd(true)}
          disabled={reordering}
          style={{ flex: 1 }}
        />
        <SecondaryButton
          icon={reordering ? "check" : "sort"}
          label={reordering ? "완료" : "순서 변경"}
          tone={reordering ? "accent" : "neutral"}
          onPress={() => setReordering((v) => !v)}
          style={{ flex: 1 }}
        />
      </View>
      {CLASSIFICATIONS.map((classification) => {
        const rows = settings.accounts.filter((a) => a.classification === classification);
        if (!rows.length) return null;
        return (
          // Remounted on 순서 변경 so every group opens for it (and folds again after).
          <FoldSection
            key={`${classification}-${reordering}`}
            title={classificationLabel(classification)}
            meta={`${rows.length}개`}
            defaultOpen={reordering}
          >
            {reordering ? (
              <AccountOrderRows rows={rows} onDragChange={onDragChange} onDrop={drop} onStep={move} />
            ) : rows.map((account, index) => (
              <Row
                key={account.id}
                first={index === 0}
                icon={accountIcon[account.kind] ?? "bank"}
                title={account.name}
                meta={`${majorLabel(account.major)} · ${account.minor}${account.paymentDay ? ` · ${account.paymentDay}일 결제/상환` : ""}${account.memo ? ` · ${account.memo}` : ""}`}
                dimmed={account.hidden}
                onPress={() => openEdit(account)}
                trailing={
                  <View style={styles.accountTrailing}>
                    <Text variant="subhead" weight="600" tabular>
                      {formatNumber(account.balance)}원
                    </Text>
                    {(account.balance === 0 || account.hidden) && (
                      <IconButton
                        icon={account.hidden ? "eye" : "eyeOff"}
                        label={account.hidden ? `${account.name} 다시 보이기` : `${account.name} 숨기기`}
                        onPress={() => toggleHidden(account.id)}
                      />
                    )}
                  </View>
                }
              />
            ))}
          </FoldSection>
        );
      })}
      <Text variant="footnote" weight="400" color="text2">
        {reordering
          ? "계좌를 길게 누른 뒤 원하는 위치로 끌어 놓으세요."
          : "계좌를 누르면 이름, 메모, 결제일을 고칠 수 있어요. 시작 잔액이 0원인 계좌만 숨길 수 있어요."}
      </Text>
      <Sheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="계좌 수정"
        footer={<PrimaryButton label="저장" disabled={!editing?.name.trim()} onPress={saveEdit} />}
      >
        {editing ? (
          <>
            <TextField
              label="계좌 이름"
              value={editing.name}
              onChangeText={(name) => setEditing({ ...editing, name })}
            />
            <TextField
              label="메모 (선택)"
              value={editing.memo}
              onChangeText={(memo) => setEditing({ ...editing, memo })}
              placeholder="예: 9003-3071-1234-6 또는 카드 끝 4자리"
              autoCorrect={false}
            />
            <Text variant="footnote" weight="400" color="text2">
              결제 알림을 이 계좌로 맞추는 데 쓰여요. 카드와 카카오뱅크는 끝 4자리, 다른 은행은 계좌번호 전체를 적어
              주세요.
            </Text>
            <TextField
              label="결제일 / 상환일 (선택)"
              keyboardType="number-pad"
              value={editing.paymentDay}
              onChangeText={(text) => setEditing({ ...editing, paymentDay: text.replace(/[^0-9]/g, "") })}
              placeholder="예: 25"
              suffix="일"
            />
          </>
        ) : null}
      </Sheet>
      <Sheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title="계좌 추가"
        footer={<PrimaryButton label="계좌 추가" disabled={!draft.name.trim()} onPress={addAccount} />}
      >
        <TextField
          label="계좌 이름"
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="예: 국민카드 일시불"
        />
        <FieldRow>
          <SelectField
            label="구분"
            value={draft.classification}
            options={CLASSIFICATIONS.map((v) => ({ value: v, label: classificationLabel(v) }))}
            onChange={(classification) => setDraft({ ...draft, classification })}
          />
          <SelectField
            label="계좌 종류"
            value={draft.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => setDraft({ ...draft, kind })}
          />
        </FieldRow>
        <FieldRow>
          <TextField label="대분류" value={draft.major} onChangeText={(major) => setDraft({ ...draft, major })} />
          <TextField label="소분류" value={draft.minor} onChangeText={(minor) => setDraft({ ...draft, minor })} />
        </FieldRow>
        <MoneyField label="시작 잔액" value={draft.balance} onChange={(balance) => setDraft({ ...draft, balance })} />
        <TextField
          label="결제일 / 상환일 (선택)"
          keyboardType="number-pad"
          value={draft.paymentDay}
          onChangeText={(text) => setDraft({ ...draft, paymentDay: text.replace(/[^0-9]/g, "") })}
          placeholder="예: 25"
          suffix="일"
        />
        <TextField label="메모 (선택)" value={draft.memo} onChangeText={(memo) => setDraft({ ...draft, memo })} />
      </Sheet>
    </>
  );
}

function CategoriesView({ settings, update }: { settings: SharedSettings; update: UpdateFn }) {
  const { c } = useTheme();
  const [type, setType] = useState<CategorySetting["transactionType"]>("expense");
  const [moveError, setMoveError] = useState("");
  const allGroups = useMemo(() => {
    const map = new Map<string, { major: string; transactionType: CategorySetting["transactionType"]; rows: { category: CategorySetting; index: number }[] }>();
    settings.categories.forEach((category, index) => {
      const key = `${category.transactionType}:${category.major}`;
      const group = map.get(key) ?? { major: category.major, transactionType: category.transactionType, rows: [] };
      group.rows.push({ category, index });
      map.set(key, group);
    });
    return [...map.values()];
  }, [settings.categories]);
  const groups = allGroups.filter((group) => group.transactionType === type);

  const updateGroup = (
    type: CategorySetting["transactionType"],
    major: string,
    patch: Partial<Pick<CategorySetting, "major" | "icon">>,
    typing?: boolean,
  ) =>
    update(
      (s) => ({
        ...s,
        categories: s.categories.map((item) =>
          item.transactionType === type && item.major === major ? { ...item, ...patch } : item,
        ),
      }),
      typing,
    );

  const updateRow = (index: number, patch: Partial<CategorySetting>, typing?: boolean) =>
    update((s) => ({ ...s, categories: s.categories.map((item, i) => (i === index ? { ...item, ...patch } : item)) }), typing);

  const changeType = (
    currentType: CategorySetting["transactionType"],
    major: string,
    nextType: CategorySetting["transactionType"],
    rowIndex?: number,
  ) => {
    if (currentType === nextType) return;
    if (moveCategoryType(settings.categories, currentType, major, nextType, rowIndex) === settings.categories) {
      setMoveError(`${nextType === "income" ? "수입" : "지출"}의 ${major}에 같은 이름의 소분류가 있어요.`);
      return;
    }
    update((s) => ({
      ...s,
      categories: moveCategoryType(s.categories, currentType, major, nextType, rowIndex),
    }));
    setMoveError("");
    setType(nextType);
  };

  // 대분류 추가: filled in on a sheet, created on 추가.
  const blankGroup = { transactionType: type, major: "", minor: "" };
  const [newGroup, setNewGroup] = useState<typeof blankGroup | null>(null);
  const newMajor = newGroup?.major.trim() ?? "";
  const duplicate = Boolean(
    newGroup && settings.categories.some((cat) => cat.transactionType === newGroup.transactionType && cat.major === newMajor),
  );
  const addGroup = () => {
    if (!newGroup || !newMajor || !newGroup.minor.trim() || duplicate) return;
    const group = newGroup;
    update((s) => ({
      ...s,
      categories: [
        ...s.categories,
        { major: newMajor, minor: group.minor.trim(), fixed: false, transactionType: group.transactionType },
      ],
    }));
    setType(group.transactionType);
    setNewGroup(null);
  };

  const addMinor = (type: CategorySetting["transactionType"], major: string) =>
    update((s) => {
      const siblings = s.categories.filter((cat) => cat.transactionType === type && cat.major === major);
      let minor = "새 소분류";
      let suffix = 2;
      while (siblings.some((cat) => cat.minor === minor)) minor = `새 소분류 ${suffix++}`;
      return { ...s, categories: [...s.categories, { major, minor, fixed: false, transactionType: type }] };
    });

  return (
    <>
      <Segmented
        value={type}
        onChange={(nextType) => {
          setMoveError("");
          setType(nextType);
        }}
        options={[
          { value: "expense", label: "지출" },
          { value: "income", label: "수입" },
        ]}
        accessibilityLabel="분류 유형"
      />
      <SecondaryButton icon="plus" label="대분류 추가" onPress={() => setNewGroup(blankGroup)} />
      {moveError ? <Banner message={moveError} /> : null}
      {groups.map((group) => (
        <FoldSection
          key={group.rows[0].index}
          title={group.major}
          meta={`${group.rows.length}개`}
          leading={<CategoryTile icon={categoryIcon(settings.categories, group.transactionType, group.major)} size={32} />}
          padded
        >
          <View style={{ gap: space.md }}>
            <TextField
              label="대분류"
              value={group.major}
              onChangeText={(major) => updateGroup(group.transactionType, group.major, { major }, true)}
            />
            <IconPicker
              value={categoryIcon(settings.categories, group.transactionType, group.major)}
              onChange={(icon) => updateGroup(group.transactionType, group.major, { icon })}
            />
            <SelectField
              label="대분류 거래 유형"
              value={group.transactionType}
              options={[
                { value: "expense", label: "지출" },
                { value: "income", label: "수입" },
              ]}
              onChange={(nextType) => changeType(group.transactionType, group.major, nextType)}
            />
            <Text variant="footnote" color="text2">
              소분류
            </Text>
            {group.rows.map(({ category, index }) => (
              <View key={index} style={[styles.minor, { backgroundColor: c.bg }]}>
                <View style={styles.minorHead}>
                  <TextField
                    compact
                    accessibilityLabel={`${group.major} 소분류`}
                    value={category.minor}
                    onChangeText={(minor) => updateRow(index, { minor }, true)}
                  />
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={`${category.minor} 삭제`}
                    onPress={async () => {
                      const ok = await confirm({
                        title: "소분류를 삭제할까요?",
                        message: category.minor,
                        confirmLabel: "삭제",
                        destructive: true,
                      });
                      if (ok) update((s) => ({ ...s, categories: s.categories.filter((_, i) => i !== index) }));
                    }}
                  />
                </View>
                <TextButton
                  label={group.transactionType === "expense" ? "수입으로 이동" : "지출로 이동"}
                  onPress={() => changeType(group.transactionType, group.major, group.transactionType === "expense" ? "income" : "expense", index)}
                />
              </View>
            ))}
            <TextButton icon="plus" label="소분류 추가" onPress={() => addMinor(group.transactionType, group.major)} />
          </View>
        </FoldSection>
      ))}
      <Sheet
        visible={Boolean(newGroup)}
        onClose={() => setNewGroup(null)}
        title="대분류 추가"
        footer={
          <PrimaryButton
            label="추가"
            disabled={!newMajor || !newGroup?.minor.trim() || duplicate}
            onPress={addGroup}
          />
        }
      >
        {newGroup && (
          <>
            <Segmented
              value={newGroup.transactionType}
              onChange={(transactionType) => setNewGroup({ ...newGroup, transactionType })}
              options={[
                { value: "expense", label: "지출" },
                { value: "income", label: "수입" },
              ]}
              accessibilityLabel="거래 유형"
            />
            <TextField
              label="대분류 이름"
              value={newGroup.major}
              onChangeText={(major) => setNewGroup({ ...newGroup, major })}
              placeholder="예: 🍚식비"
            />
            {duplicate ? <Banner message="같은 유형에 이미 있는 대분류예요." /> : null}
            <TextField
              label="첫 소분류"
              value={newGroup.minor}
              onChangeText={(minor) => setNewGroup({ ...newGroup, minor })}
              placeholder="예: 외식"
            />
          </>
        )}
      </Sheet>
    </>
  );
}

/** The 대분류's icon: every drawing on its tile, the current one ringed. */
function IconPicker({ value, onChange }: { value: CategoryIconKey; onChange: (icon: CategoryIconKey) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="footnote" color="text2">
        아이콘
      </Text>
      <View style={styles.iconGrid}>
        {CATEGORY_ICON_KEYS.map((key) => {
          const selected = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${CATEGORY_ICONS[key].label} 아이콘`}
              style={({ pressed }) => [
                styles.iconChoice,
                { borderColor: selected ? c.primary : "transparent" },
                pressed && { opacity: 0.6 },
              ]}
            >
              <CategoryTile icon={key} size={40} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BudgetsView({ settings }: { settings: SharedSettings }) {
  const { data, save } = useLedger();
  const budgetable = settings.accounts.filter(
    (a) => a.classification === "자산" && (a.kind === "bank" || a.kind === "cash"),
  );
  const setBudget = (accountId: string, digits: string) => {
    const amount = Math.max(0, Number(digits) || 0);
    void save(
      "budgets",
      (rows) => {
        const rest = rows.filter((b) => b.accountId !== accountId);
        return amount ? [...rest, { accountId, amount }] : rest;
      },
      TYPING,
    );
  };
  return (
    <>
      <Banner
        tone="info"
        message="생활비처럼 월별로 관리할 통장에만 금액을 입력하세요. 개요의 통장별 예산과 사용 현황에 바로 반영돼요."
      />
      <Section padded>
        {budgetable.length ? (
          <View style={{ gap: space.lg }}>
            {budgetable.map((account) => (
              <MoneyField
                key={account.id}
                label={account.name}
                placeholder="예산 없음"
                value={data.budgets.find((b) => b.accountId === account.id)?.amount ?? ""}
                onChange={(digits) => setBudget(account.id, digits)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="예산을 둘 통장이 없어요" body="자산으로 분류된 입출금 통장이나 현금 계좌를 추가해 주세요." />
        )}
      </Section>
    </>
  );
}

const RECURRING_GROUPS: { type: TransactionType; label: string }[] = [
  { type: "expense", label: "지출" },
  { type: "transfer", label: "이동" },
  { type: "income", label: "수입" },
];

type RecurringDraft = {
  id?: string;
  type: TransactionType;
  name: string;
  category: string;
  minorCategory: string;
  accountId: string;
  toAccountId: string;
  amount: string;
  day: string;
};

function RecurringView({ settings }: { settings: SharedSettings }) {
  const { data, save, accounts } = useLedger();
  const [draft, setDraft] = useState<RecurringDraft | null>(null);
  // Older expenses that match a recurring item but were recorded before those were marked fixed.
  const unmarked = useMemo(
    () => unmarkedRecurringExpenses(data.transactions, data.recurring),
    [data.transactions, data.recurring],
  );
  const markFixed = async () => {
    const ids = new Set(unmarked.map((t) => t.id));
    const ok = await confirm({
      title: `거래 ${ids.size}건을 고정비로 표시할까요?`,
      message:
        "반복 항목과 내용·분류·출금 통장이 같은 지출이에요. 보고서의 고정비에 포함되고, 웹앱에도 똑같이 반영돼요.",
      confirmLabel: "고정비로 표시",
    });
    if (!ok) return;
    void save("transactions", (rows) => rows.map((t) => (ids.has(t.id) ? { ...t, fixed: true } : t)));
  };
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const majors = (type: TransactionType) =>
    [...new Set(settings.categories.filter((c) => type === "transfer" || c.transactionType === type).map((c) => c.major))];
  const minors = (major: string) => settings.categories.filter((c) => c.major === major).map((c) => c.minor);

  const open = (item?: RecurringTemplate) => {
    if (item) {
      setDraft({
        id: item.id,
        type: item.type ?? "expense",
        name: item.name,
        category: item.category,
        minorCategory: item.minorCategory,
        accountId: item.accountId,
        toAccountId: item.toAccountId ?? accounts[0]?.id ?? "",
        amount: String(item.amount),
        day: String(item.day),
      });
      return;
    }
    const major = majors("expense")[0] ?? "";
    setDraft({
      type: "expense",
      name: "",
      category: major,
      minorCategory: minors(major)[0] ?? "",
      accountId: accounts[0]?.id ?? "",
      toAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "",
      amount: "",
      day: "1",
    });
  };

  const commit = () => {
    if (!draft || !draft.name.trim() || !draft.amount) return;
    const item: RecurringTemplate = {
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      category: draft.type === "transfer" ? "이동" : draft.category,
      minorCategory: draft.type === "transfer" ? "" : draft.minorCategory,
      accountId: draft.accountId,
      toAccountId: draft.type === "transfer" ? draft.toAccountId : undefined,
      amount: Number(draft.amount),
      day: Math.min(31, Math.max(1, Number(draft.day) || 1)),
      type: draft.type,
    };
    void save("recurring", (rows) =>
      draft.id ? rows.map((r) => (r.id === draft.id ? item : r)) : [...rows, item],
    );
    setDraft(null);
  };

  const remove = () => {
    if (!draft?.id) return;
    const id = draft.id;
    void confirm({ title: "반복 항목을 삭제할까요?", message: draft.name, confirmLabel: "삭제", destructive: true }).then(
      (ok) => {
        if (!ok) return;
        void save("recurring", (rows) => rows.filter((r) => r.id !== id));
        setDraft(null);
      },
    );
  };

  return (
    <>
      <Banner
        tone="info"
        message="반복할 지출·수입·이동을 등록해 두면 거래 기록 화면에서 이번 달 항목만 골라 한 번에 등록할 수 있어요."
      />
      <SecondaryButton icon="plus" label="반복 항목 추가" onPress={() => open()} />
      {unmarked.length ? (
        <Banner
          tone="warn"
          message={`반복 항목과 같은 기존 지출 ${unmarked.length}건이 아직 고정비로 표시되지 않았어요.`}
          action={<TextButton label="고정비로 표시" onPress={() => void markFixed()} />}
        />
      ) : null}
      {data.recurring.length ? (
        RECURRING_GROUPS.map(({ type, label }) => {
          const items = data.recurring.filter((item) => (item.type ?? "expense") === type);
          if (!items.length) return null;
          return (
            <FoldSection key={type} title={label} meta={`${items.length}개`}>
              {items.map((item, index) => {
                const from = accounts.find((a) => a.id === item.accountId)?.name ?? "";
                const to = accounts.find((a) => a.id === item.toAccountId)?.name ?? "";
                return (
                  <Row
                    key={item.id}
                    first={index === 0}
                    icon={item.type === "transfer" ? "transfer" : item.type === "income" ? "income" : "expense"}
                    iconTone={item.type === "income" ? "income" : item.type === "transfer" ? "neutral" : "expense"}
                    title={item.name}
                    meta={
                      item.type === "transfer"
                        ? `${from} → ${to}`
                        : `${item.category} · ${item.minorCategory} · ${from}`
                    }
                    trailing={`${formatNumber(item.amount)}원`}
                    trailingMeta={`매월 ${item.day}일`}
                    chevron
                    onPress={() => open(item)}
                  />
                );
              })}
            </FoldSection>
          );
        })
      ) : (
        <Section>
          <EmptyState title="반복 항목이 없어요" body="월세, 통신비, 적금 이체처럼 매달 하는 거래를 등록해 보세요." />
        </Section>
      )}
      <Sheet
        visible={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? "반복 항목 수정" : "반복 항목 추가"}
        footer={
          <PrimaryButton
            label={draft?.id ? "저장" : "추가"}
            disabled={!draft?.name.trim() || !draft?.amount}
            onPress={commit}
          />
        }
      >
        {draft && (
          <>
            <Segmented
              value={draft.type}
              accessibilityLabel="반복 유형"
              options={[
                { value: "expense", label: "지출" },
                { value: "income", label: "수입" },
                { value: "transfer", label: "이동" },
              ]}
              onChange={(type) => {
                const major = majors(type)[0] ?? "";
                setDraft({ ...draft, type, category: major, minorCategory: minors(major)[0] ?? "" });
              }}
            />
            <TextField label="내용" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
            <FieldRow>
              <MoneyField label="금액" value={draft.amount} onChange={(amount) => setDraft({ ...draft, amount })} />
              <TextField
                label="일자"
                keyboardType="number-pad"
                value={draft.day}
                suffix="일"
                style={{ flex: 0.6 }}
                onChangeText={(day) => setDraft({ ...draft, day: day.replace(/[^0-9]/g, "") })}
              />
            </FieldRow>
            {draft.type !== "transfer" && (
              <FieldRow>
                <SelectField
                  label="대분류"
                  value={draft.category}
                  options={majors(draft.type).map((m) => ({ value: m, label: m }))}
                  onChange={(category) => setDraft({ ...draft, category, minorCategory: minors(category)[0] ?? "" })}
                />
                <SelectField
                  label="소분류"
                  value={draft.minorCategory}
                  options={minors(draft.category).map((m) => ({ value: m, label: m }))}
                  onChange={(minorCategory) => setDraft({ ...draft, minorCategory })}
                />
              </FieldRow>
            )}
            <SelectField
              label={draft.type === "income" ? "입금 통장" : "출금 통장"}
              value={draft.accountId}
              options={accountOptions}
              onChange={(accountId) => setDraft({ ...draft, accountId })}
            />
            {draft.type === "transfer" && (
              <SelectField
                label="입금 통장"
                value={draft.toAccountId}
                options={accountOptions}
                onChange={(toAccountId) => setDraft({ ...draft, toAccountId })}
              />
            )}
            {draft.id ? (
              <SecondaryButton icon="trash" tone="danger" label={`${typeLabel(draft.type)} 반복 항목 삭제`} onPress={remove} />
            ) : null}
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  accountTrailing: { flexDirection: "row", alignItems: "center", gap: space.xs },
  accountActions: { flexDirection: "row", gap: space.sm },
  minor: { borderRadius: radius.control, padding: space.md, gap: space.xs },
  minorHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  iconChoice: { borderWidth: 2, borderRadius: 16, padding: 2 },
});
