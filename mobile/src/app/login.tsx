import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, KeyboardAware, PrimaryButton, Section, Text, TextField } from "@/components/ui";
import { SERVER_LOCKED } from "@/lib/api";
import { useSession } from "@/store/session-store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { serverUrl, signIn } = useSession();
  const [server, setServer] = useState(serverUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if ((!SERVER_LOCKED && !server.trim()) || !username || !password) {
      setError(SERVER_LOCKED ? "아이디와 비밀번호를 입력해 주세요." : "서버 주소, 아이디, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(server, username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAware style={{ backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + space.xxl * 2, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        <View style={styles.brand}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            accessibilityLabel="잔잔한 가계부"
          />
          <Text variant="title1">잔잔한 가계부</Text>
          <Text variant="subhead" color="text2">
            {SERVER_LOCKED ? "웹앱 아이디로 로그인해요." : "NAS에 있는 가계부 서버에 연결해요."}
          </Text>
        </View>
        <Section padded>
          <View style={{ gap: space.lg }}>
            {SERVER_LOCKED ? null : (
              <TextField
                label="서버 주소"
                value={server}
                onChangeText={setServer}
                placeholder="ledger.example.synology.me"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
              />
            )}
            <TextField
              label="아이디"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            <TextField
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={() => void submit()}
              returnKeyType="go"
            />
          </View>
        </Section>
        {error ? <Banner message={error} /> : null}
        <PrimaryButton label="로그인" loading={busy} onPress={() => void submit()} />
        <Text variant="footnote" weight="400" color="text2" align="center">
          웹앱과 같은 아이디로 로그인해요. 로그인은 이 기기에 안전하게 저장돼요.
        </Text>
      </ScrollView>
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, gap: space.xl },
  brand: { alignItems: "center", gap: space.sm, marginBottom: space.lg },
  logo: { width: 88, height: 88, borderRadius: radius.popover, marginBottom: space.sm },
});
