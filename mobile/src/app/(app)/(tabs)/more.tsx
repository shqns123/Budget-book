import { router } from "expo-router";
import { Row, Screen, Section, Text } from "@/components/ui";
import { useSession } from "@/store/session-store";
import { confirm } from "@/lib/confirm";

export default function MoreScreen() {
  const { serverUrl, signOut } = useSession();
  return (
    <Screen title="전체">
      <Section title="가계부">
        <Row first icon="piggy" title="저축 내역" meta="저축 계획과 기록" chevron onPress={() => router.push("/savings")} />
        <Row icon="settings" title="가계부 설정" meta="통장 · 분류 · 월 예산 · 반복 지출" chevron onPress={() => router.push("/settings")} />
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
              message: "다시 쓰려면 서버 주소와 아이디로 로그인해야 해요.",
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
