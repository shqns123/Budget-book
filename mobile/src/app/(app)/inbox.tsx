import { useMemo, useState } from "react";
import { View } from "react-native";
import { InboxCard } from "@/components/inbox/InboxCard";
import { InboxEditor } from "@/components/inbox/InboxEditor";
import { NoticeSettings } from "@/components/inbox/NoticeSettings";
import { SourceChip } from "@/components/inbox/SourceChip";
import {
  Banner,
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  Section,
  SelectField,
  TextButton,
} from "@/components/ui";
import { confirm } from "@/lib/confirm";
import { accountName, newId, won, type RecurringTemplate } from "@/lib/ledger";
import {
  applyTemplate,
  draftProblem,
  similarRecord,
  toTransaction,
  type NoticeDraft,
} from "@/lib/notices/classify";
import { buildViews, sourceOptions, type InboxView } from "@/lib/notices/inbox";
import { counterpartyKey } from "@/lib/notices/parse";
import { useInbox } from "@/store/inbox-store";
import { useLedger } from "@/store/ledger-store";
import { usePrefs } from "@/store/prefs-store";
import { space } from "@/theme/tokens";

/**
 * 결제 알림 대기함: every payment notice the phone caught waits here until it is registered,
 * fixed up, or dismissed. Nothing reaches the ledger on its own.
 */
export default function InboxScreen() {
  const { data, accounts, categories, save } = useLedger();
  const inbox = useInbox();
  const { rules, setRules, filter, setFilter } = inbox;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const salaryAccountId = usePrefs().linkTransfer.to;

  const views = useMemo(
    () =>
      buildViews(
        inbox.items,
        { accounts, categories, recurring: data.recurring, transactions: data.transactions, rules, salaryAccountId },
        (id) => accountName(accounts, id),
      ),
    [inbox.items, accounts, categories, data.recurring, data.transactions, rules, salaryAccountId],
  );
  const sources = useMemo(() => sourceOptions(views), [views]);
  const activeFilter = sources.some((s) => s.key === filter) ? filter : "";
  const visible = activeFilter ? views.filter((v) => v.sourceKey === activeFilter) : views;
  const editing = views.find((v) => v.item.id === editingId) ?? null;
  const unlinkedKey = activeFilter.startsWith("source:") ? activeFilter.slice("source:".length) : "";

  const removeView = (view: InboxView) => inbox.remove([view.item.id, ...(view.paired ? [view.paired.id] : [])]);

  /** What registering this record teaches for the next notices of the same card and 상대방. */
  const learn = (view: InboxView, draft: NoticeDraft) => {
    const parsed = view.item.parsed;
    if (!parsed) return;
    const key = counterpartyKey(parsed.counterparty);
    const own = parsed.direction === "in" && draft.type === "transfer" ? draft.toAccountId : draft.accountId;
    setRules((r) => {
      // A card / account is linked on its first 등록 and stays so: picking another 통장 for one
      // record changes only that record. The link itself is changed in 결제 알림 설정.
      const sources = { ...r.sources };
      const link = (sourceKey: string, accountId: string) => {
        const current = sources[sourceKey];
        if (accountId && !(current && accounts.some((a) => a.id === current))) sources[sourceKey] = accountId;
      };
      link(parsed.source.key, own);
      const paired = view.paired?.parsed;
      // A merged 카드 대금 notice keeps its own link (the 월급통장 it is paid from when alone).
      if (paired && !paired.bill && draft.type === "transfer") link(paired.source.key, draft.toAccountId);
      if (parsed.direction === "cancel") return { ...r, sources };
      if (draft.recurringId) {
        return { ...r, sources, recurringAlias: { ...r.recurringAlias, [key]: draft.recurringId } };
      }
      const { [key]: _alias, ...recurringAlias } = r.recurringAlias;
      return {
        ...r,
        sources,
        recurringAlias,
        memory: {
          ...r.memory,
          [key]: {
            type: draft.type,
            name: draft.name.trim(),
            category: draft.category,
            minorCategory: draft.minorCategory,
            toAccountId: draft.type === "transfer" ? draft.toAccountId : "",
          },
        },
      };
    });
  };

  const register = async (view: InboxView) => {
    const { draft } = view;
    const problem = draftProblem(draft, accounts);
    if (problem) {
      setEditError(problem);
      setEditingId(view.item.id);
      return;
    }
    const similar = similarRecord(draft, data.transactions);
    if (similar) {
      const ok = await confirm({
        title: "비슷한 거래가 이미 있어요",
        message: `${similar.name} ${won(similar.amount)} (${similar.date})\n같은 날·같은 통장·같은 금액이에요. 그래도 등록할까요?`,
        confirmLabel: "등록",
      });
      if (!ok) return;
    }
    const record = toTransaction(draft, newId());
    if (await save("transactions", (rows) => [record, ...rows])) {
      learn(view, draft);
      removeView(view);
      setEditingId(null);
      setEditError("");
    }
  };

  const dismiss = (view: InboxView) => {
    removeView(view);
    if (editingId === view.item.id) setEditingId(null);
  };

  const syncRegistered = async (view: InboxView) => {
    const id = view.classification.registeredId;
    if (!id) return;
    const date = view.draft.date.replaceAll("-", ".");
    const ok = await save("transactions", (rows) =>
      rows.map((t) =>
        t.id === id || t.linkedTo === id
          ? { ...t, amount: t.amount < 0 ? -view.draft.amount : view.draft.amount, date }
          : t,
      ),
    );
    if (ok) removeView(view);
  };

  const deleteCancelled = async (view: InboxView) => {
    const id = view.classification.cancelOf;
    const original = data.transactions.find((t) => t.id === id);
    if (!original) return;
    const ok = await confirm({
      title: "원래 결제를 삭제할까요?",
      message: `${original.name} ${won(original.amount)} (${original.date})\n승인이 취소된 결제예요.`,
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!ok) return;
    if (await save("transactions", (rows) => rows.filter((t) => t.id !== original.id && t.linkedTo !== original.id))) {
      learn(view, view.draft);
      removeView(view);
    }
  };

  const applySuggestion = (view: InboxView) => {
    const template = view.classification.suggestion;
    if (!template) return;
    const applied = applyTemplate(template, view.draft);
    inbox.edit(view.item.id, { ...applied, amount: view.draft.amount, date: view.draft.date });
  };

  const addRecurring = async (view: InboxView) => {
    const { draft } = view;
    const problem = draftProblem(draft, accounts);
    if (problem) return setEditError(problem);
    const template: RecurringTemplate = {
      id: newId(),
      name: draft.name.trim(),
      category: draft.type === "transfer" ? "" : draft.category,
      minorCategory: draft.type === "transfer" ? "" : draft.minorCategory,
      accountId: draft.accountId,
      amount: draft.amount,
      day: Number(draft.date.slice(8, 10)) || 1,
      type: draft.type,
      ...(draft.type === "transfer" ? { toAccountId: draft.toAccountId } : {}),
    };
    if (await save("recurring", (rows) => [...rows, template])) {
      setEditError("");
      inbox.edit(view.item.id, { recurringId: template.id, fixed: draft.type === "expense" });
    }
  };

  const linkSource = (accountId: string) => {
    if (!unlinkedKey) return;
    setRules((r) => ({ ...r, sources: { ...r.sources, [unlinkedKey]: accountId } }));
    setFilter(`account:${accountId}`);
  };

  return (
    <Screen
      back
      inTabs={false}
      title="결제 알림 대기함"
      above={
        <ChipRow>
          <SourceChip options={sources} total={views.length} value={activeFilter} onChange={setFilter} />
          <Chip icon="settings" accessibilityLabel="결제 알림 설정" onPress={() => setSettingsOpen(true)} />
        </ChipRow>
      }
    >
      {!inbox.supported ? (
        <Banner tone="warn" message="결제 알림 읽기는 Android 앱에서만 돼요. 대기함은 비어 있어요." />
      ) : !inbox.access ? (
        <Banner
          tone="warn"
          message="알림 접근이 꺼져 있어서 결제 알림을 받을 수 없어요."
          action={<TextButton label="켜기" onPress={() => setSettingsOpen(true)} />}
        />
      ) : null}

      {unlinkedKey ? (
        <Section title="이 카드·계좌를 가계부 통장과 연결">
          <View style={{ padding: space.lg }}>
            <SelectField
              accessibilityLabel="연결할 통장"
              value=""
              placeholder="통장 고르기"
              options={accounts.filter((a) => !a.hidden).map((a) => ({ value: a.id, label: a.name }))}
              onChange={linkSource}
            />
          </View>
        </Section>
      ) : null}

      {visible.length ? (
        <View style={{ gap: space.md }}>
          {visible.map((view) => (
            <InboxCard
              key={view.item.id}
              view={view}
              accounts={accounts}
              registered={
                view.classification.registeredId
                  ? data.transactions.find((t) => t.id === view.classification.registeredId)
                  : undefined
              }
              actions={{
                onEdit: () => {
                  setEditError("");
                  setEditingId(view.item.id);
                },
                onDismiss: () => dismiss(view),
                onRegister: () => void register(view),
                onConfirm: () => {
                  learn(view, view.draft);
                  removeView(view);
                },
                onSyncRegistered: () => void syncRegistered(view),
                onDeleteCancelled: () => void deleteCancelled(view),
                onApplySuggestion: () => applySuggestion(view),
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="기다리는 결제 알림이 없어요"
          body={
            inbox.access
              ? "카드 승인이나 출금 알림이 오면 여기에 모여요. 확인하고 등록하면 거래 내역에 들어가요."
              : "알림 접근을 켜면 카드 승인과 출금 알림이 여기에 모여요."
          }
        />
      )}

      <InboxEditor
        view={editing}
        accounts={accounts}
        categories={categories}
        recurring={data.recurring}
        error={editError}
        onChange={(patch) => {
          setEditError("");
          if (editing) inbox.edit(editing.item.id, patch);
        }}
        onReset={() => editing && inbox.resetEdits(editing.item.id)}
        onRegister={() => editing && void register(editing)}
        onAddRecurring={() => editing && void addRecurring(editing)}
        onRetry={() => editing && inbox.retry(editing.item.id)}
        onClose={() => {
          setEditingId(null);
          setEditError("");
        }}
      />
      <NoticeSettings visible={settingsOpen} onClose={() => setSettingsOpen(false)} accounts={accounts} />
    </Screen>
  );
}
