import { useState } from "react";
import { View } from "react-native";
import * as Capture from "../../../modules/notification-capture";
import {
  Banner,
  CheckRow,
  Row,
  Section,
  SecondaryButton,
  SelectField,
  Sheet,
  Text,
  TextButton,
  TextField,
} from "@/components/ui";
import { confirm } from "@/lib/confirm";
import type { Account } from "@/lib/ledger";
import type { NoticeRules } from "@/lib/notices/classify";
import { useInbox } from "@/store/inbox-store";
import { usePrefs } from "@/store/prefs-store";
import { space } from "@/theme/tokens";

const KNOWN_APPS: Record<string, string> = {
  "com.kbcard.cxh.appcard": "KB Pay",
  "com.kakaobank.channel": "카카오뱅크",
  "com.samsung.android.messaging": "삼성 메시지 (문자)",
  "com.google.android.apps.messaging": "Google 메시지 (문자)",
};

const splitList = (text: string) =>
  text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

const UNLINK = "__unlink";

/**
 * 결제 알림 설정: 알림 접근, which apps are read, "내 이름" and 이체 words, and the cards /
 * accounts linked to ledger accounts. All of it stays on this phone.
 */
export function NoticeSettings({
  visible,
  onClose,
  accounts,
}: {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
}) {
  const { supported, access, openAccess, rules, setRules } = useInbox();
  return (
    <Sheet visible={visible} onClose={onClose} title="결제 알림 설정" subtitle="이 휴대폰에만 저장돼요">
      {visible ? (
        <SettingsBody
          supported={supported}
          access={access}
          openAccess={openAccess}
          rules={rules}
          setRules={setRules}
          accounts={accounts}
        />
      ) : null}
    </Sheet>
  );
}

/** Mounted on each opening, so the lists read the phone's current state. */
function SettingsBody({
  supported,
  access,
  openAccess,
  rules,
  setRules,
  accounts,
}: {
  supported: boolean;
  access: boolean;
  openAccess: () => void;
  rules: NoticeRules;
  setRules: (update: (rules: NoticeRules) => NoticeRules) => void;
  accounts: Account[];
}) {
  const { linkTransfer, setLinkTransfer } = usePrefs();
  const [names, setNames] = useState(rules.myNames.join(", "));
  const [keywords, setKeywords] = useState(rules.transferKeywords.join(", "));
  const [allowed, setAllowed] = useState(() => Capture.getAllowedPackages());
  const [apps] = useState(() => {
    const seen = Capture.getSeenApps();
    const packages = [...new Set([...Capture.getDefaultPackages(), ...allowed, ...seen.map((s) => s.packageName)])];
    return packages.map((p) => ({
      packageName: p,
      label: KNOWN_APPS[p] ?? seen.find((s) => s.packageName === p)?.appName ?? p,
      seen: seen.some((s) => s.packageName === p),
    }));
  });
  const accountOptions = [
    ...accounts.filter((a) => !a.hidden).map((a) => ({ value: a.id, label: a.name })),
    { value: UNLINK, label: "연결 해제" },
  ];
  const linked = Object.entries(rules.sources);
  const remembered = Object.keys(rules.memory).length + Object.keys(rules.recurringAlias).length;

  const toggleApp = (packageName: string) => {
    const next = allowed.includes(packageName) ? allowed.filter((p) => p !== packageName) : [...allowed, packageName];
    setAllowed(next);
    Capture.setAllowedPackages(next);
  };

  return (
    <>
      {!supported ? (
        <Banner tone="warn" message="결제 알림 읽기는 Android 앱에서만 돼요." />
      ) : (
        <Section title="알림 접근">
          <Row
            first
            icon="inbox"
            iconTone={access ? "accent" : "danger"}
            title={access ? "알림 접근 허용됨" : "알림 접근이 꺼져 있어요"}
            meta={access ? "결제 알림이 오면 바로 대기함에 들어와요" : "설정에서 이 앱의 알림 접근을 켜 주세요"}
            chevron
            onPress={openAccess}
          />
        </Section>
      )}
      {supported && !access ? (
        <Text variant="footnote" weight="400" color="text2">
          Play 스토어가 아닌 APK로 설치했다면 Android가 이 설정을 막을 수 있어요. 그럴 땐 설정 → 애플리케이션 →
          잔잔한 가계부 → 오른쪽 위 ⋮ → &apos;제한된 설정 허용&apos;을 먼저 눌러 주세요.
        </Text>
      ) : null}

      <TextField
        label="내 이름"
        value={names}
        onChangeText={(text) => {
          setNames(text);
          setRules((r) => ({ ...r, myNames: splitList(text) }));
        }}
        placeholder="예: 송우진"
        autoCorrect={false}
      />
      <Text variant="footnote" weight="400" color="text2">
        출금 상대가 내 이름이면 지출이 아니라 계좌 간 이동으로 채워요. 여러 개는 쉼표로 나눠요.
      </Text>
      <TextField
        label="이체 메모 단어"
        value={keywords}
        onChangeText={(text) => {
          setKeywords(text);
          setRules((r) => ({ ...r, transferKeywords: splitList(text) }));
        }}
        autoCorrect={false}
      />
      <Text variant="footnote" weight="400" color="text2">
        출금 메모에 이 단어가 있으면 계좌 간 이동으로 채워요 (예: KB카드대금, 생활비이체).
      </Text>
      <SelectField
        label="월급통장"
        value={linkTransfer.to}
        options={[{ value: "", label: "고르지 않음" }, ...accountOptions.filter((o) => o.value !== UNLINK)]}
        onChange={(to) => setLinkTransfer({ ...linkTransfer, to })}
      />
      <Text variant="footnote" weight="400" color="text2">
        &apos;xx카드 대금이체&apos; 출금은 알림이 온 통장에서 이 월급통장으로 옮기는 이동으로 채워요. 거래 입력의
        &apos;자금 이동 같이 기록&apos;과 같은 월급통장이에요.
      </Text>

      {supported ? (
        <Section title="읽을 앱">
          <View style={{ gap: space.sm, padding: space.sm }}>
            {apps.map((app) => (
              <CheckRow
                key={app.packageName}
                label={app.label}
                meta={app.seen && !allowed.includes(app.packageName) ? "결제 알림이 온 적 있는 앱" : app.packageName}
                checked={allowed.includes(app.packageName)}
                onToggle={() => toggleApp(app.packageName)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Text variant="footnote" weight="400" color="text2">
        새 카드·계좌는 카드사·은행 이름이 같은 통장으로 채워요. 카드 알림은 카드 통장끼리, 은행 알림은 은행
        통장끼리만 비교하고, 후보가 딱 하나일 때만 채워요. 통장 메모에 번호를 적어 두면 정확히 맞춰요: 카드와
        카카오뱅크는 끝 4자리(예: 2222), 다른 은행은 계좌번호 전체(예: 9003-3071-1234-6).
      </Text>
      <Text variant="footnote" weight="400" color="text2">
        처음 등록할 때 연결이 확정돼요. 그 뒤에 한 거래만 다른 통장으로 등록해도 연결은 그대로고, 바꾸려면 아래
        목록에서 바꿔요.
      </Text>
      <Section title="연결된 카드·계좌">
        {linked.length ? (
          <View style={{ gap: space.md, padding: space.lg }}>
            {linked.map(([key, accountId]) => (
              <SelectField
                key={key}
                label={key.replace("|", " ")}
                value={accountId}
                options={accountOptions}
                onChange={(value) =>
                  setRules((r) => {
                    const sources = { ...r.sources };
                    if (value === UNLINK) delete sources[key];
                    else sources[key] = value;
                    return { ...r, sources };
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View style={{ padding: space.lg }}>
            <Text variant="footnote" weight="400" color="text2">
              아직 연결된 카드·계좌가 없어요.
            </Text>
          </View>
        )}
      </Section>

      {remembered ? (
        <View style={{ alignItems: "flex-start" }}>
          <TextButton
            label={`기억한 상대방 ${remembered}개 지우기`}
            tone="danger"
            onPress={async () => {
              const ok = await confirm({
                title: "기억한 상대방을 지울까요?",
                message: "다음 알림부터 분류와 반복 항목 연결을 다시 물어봐요.",
                confirmLabel: "지우기",
                destructive: true,
              });
              if (ok) setRules((r) => ({ ...r, memory: {}, recurringAlias: {} }));
            }}
          />
        </View>
      ) : null}
      {supported && !access ? <SecondaryButton icon="settings" label="알림 접근 설정 열기" onPress={openAccess} /> : null}
    </>
  );
}
