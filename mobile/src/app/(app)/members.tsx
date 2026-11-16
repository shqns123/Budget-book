import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  Banner,
  EmptyState,
  IconButton,
  LoadingView,
  Row,
  Screen,
  SecondaryButton,
  Section,
  Text,
  TextField,
} from "@/components/ui";
import { apiJson } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { space } from "@/theme/tokens";

type Member = { email: string; addedAt: string };
type Members = { me: { email: string | null; role: "owner" | "member" }; owner: string | null; members: Member[] };

/**
 * Who shares this ledger. Everyone listed signs in with that Google account and sees and edits
 * the same ledger; only the owner invites and removes members.
 */
export default function MembersScreen() {
  const [data, setData] = useState<Members | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      apiJson<Members>("/api/members").then(
        (value) => {
          setData(value);
          setError("");
        },
        (e: unknown) => setError(e instanceof Error ? e.message : "멤버를 불러오지 못했어요."),
      ),
    [],
  );

  useEffect(() => {
    let alive = true;
    apiJson<Members>("/api/members").then(
      (value) => alive && setData(value),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : "멤버를 불러오지 못했어요."),
    );
    return () => {
      alive = false;
    };
  }, []);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "초대하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address: string) => {
    const ok = await confirm({
      title: "멤버를 내보낼까요?",
      message: `${address}\n다음 요청부터 이 가계부를 볼 수 없어요.`,
      confirmLabel: "내보내기",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/members?email=${encodeURIComponent(address)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내지 못했어요.");
    }
  };

  const isOwner = data?.me.role === "owner";
  return (
    <Screen title="멤버" back inTabs={false} refreshable={false}>
      <Text variant="footnote" weight="400" color="text2">
        초대한 Google 계정으로 로그인하면 같은 가계부를 보고 편집할 수 있어요. 초대와 내보내기는 소유자만 할 수 있어요.
      </Text>
      {error ? <Banner message={error} /> : null}
      {!data ? (
        error ? null : <LoadingView />
      ) : (
        <>
          <Section title="이 가계부를 쓰는 사람">
            {data.owner ? (
              <Row first icon="members" iconTone="accent" title={data.owner} meta="소유자" />
            ) : null}
            {data.members.map((member, index) => (
              <Row
                key={member.email}
                first={!data.owner && index === 0}
                icon="mail"
                title={member.email}
                meta={`${new Date(member.addedAt).toLocaleDateString("ko-KR")} 초대`}
                trailing={
                  isOwner ? (
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`${member.email} 내보내기`}
                      onPress={() => void remove(member.email)}
                    />
                  ) : undefined
                }
              />
            ))}
            {!data.owner && !data.members.length ? <EmptyState title="아직 초대한 멤버가 없어요" /> : null}
          </Section>
          {isOwner ? (
            <Section title="초대하기" padded>
              <View style={{ gap: space.md }}>
                <TextField
                  label="Gmail 주소"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@gmail.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={() => void invite()}
                />
                <SecondaryButton
                  tone="accent"
                  icon="plus"
                  label={busy ? "초대하는 중" : "초대"}
                  disabled={busy || !email.trim()}
                  onPress={() => void invite()}
                />
              </View>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
