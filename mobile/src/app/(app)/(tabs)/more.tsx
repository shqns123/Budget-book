import { router } from "expo-router";
import { Row, Screen, Section, Text } from "@/components/ui";
import { useInbox } from "@/store/inbox-store";
import { useSession } from "@/store/session-store";
import { confirm } from "@/lib/confirm";

export default function MoreScreen() {
  const { serverUrl, signOut } = useSession();
  const inbox = useInbox();
  const inboxMeta = !inbox.supported
    ? "Android 앱에서 카드 승인·출금 알림을 모아요"
    : `${inbox.items.length}건 대기 · ${inbox.access ? "알림 접근 켜짐" : "알림 접근 꺼짐"}`;
  return (
    <Screen title="전체">
      <Section title="가계부">
        <Row first icon="inbox" title="결제 알림 대기함" meta={inboxMeta} chevron onPress={() => router.push("/inbox")} />
        <Row icon="piggy" title="저축 내역" meta="저축 계획과 기록" chevron onPress={() => router.push("/savings")} />
        <Row icon="settings" title="가계부 설정" meta="통장 · 분류 · 월 예산 · 반복 지출" chevron onPress={() => router.push("/settings")} />
        <Row icon="members" title="멤버" meta="가계부를 함께 쓰는 사람 · 초대" chevron onPress={() => router.push("/members")} />
      </Section>
      <Section title="연결">
        <Row first icon="server" title="서버" meta={serverUrl.replace(/^https?:\/\//, "")} />
        <Row
          icon="logout"
          iconTone="danger"
          title="로그아웃"
          destructive
          onPress={async () => {
            const ok = await confirm({
              title: "로그아웃할까요?",
              message: "다시 쓰려면 Google 계정으로 다시 로그인해야 해요.",
              confirmLabel: "로그아웃",
              destructive: true,
            });
            if (ok) void signOut();
          }}
        />
      </Section>
      <Text variant="footnote" weight="400" color="text2" align="center">
        잔잔한 가계부 · 웹앱과 같은 데이터를 함께 써요
      </Text>
    </Screen>
  );
}
