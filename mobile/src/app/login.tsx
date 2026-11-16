import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, KeyboardAware, PrimaryButton, Section, Text, TextButton, TextField } from "@/components/ui";
import { SERVER_LOCKED } from "@/lib/api";
import { googleAvailable } from "@/lib/google";
import { useSession } from "@/store/session-store";
import { useTheme } from "@/theme/theme";
import { opacity, radius, size, space } from "@/theme/tokens";

/**
 * Sign in with Google: the owner's address or one the owner invited. The ID / password form is
 * the owner's fallback behind a small link (and the only way in Expo Go, which has no Google
 * Sign-In).
 */
export default function LoginScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { serverUrl, signIn, signInWithGoogle } = useSession();
  const [server, setServer] = useState(serverUrl);
  const [showPassword, setShowPassword] = useState(!googleAvailable);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "password" | null>(null);
  const [error, setError] = useState("");

  const needsServer = !SERVER_LOCKED && !server.trim();

  const google = async () => {
    if (needsServer) return setError("서버 주소를 입력해 주세요.");
    setBusy("google");
    setError("");
    try {
      await signInWithGoogle(server);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google로 로그인하지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (needsServer || !username || !password) {
      setError(SERVER_LOCKED ? "아이디와 비밀번호를 입력해 주세요." : "서버 주소, 아이디, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    setBusy("password");
    setError("");
    try {
      await signIn(server, username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인하지 못했어요.");
    } finally {
      setBusy(null);
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
          <Text variant="subhead" color="text2" align="center">
            {googleAvailable
              ? "초대받은 Google 계정으로 로그인해요."
              : SERVER_LOCKED
                ? "웹앱 아이디로 로그인해요."
                : "NAS에 있는 가계부 서버에 연결해요."}
          </Text>
        </View>

        {SERVER_LOCKED ? null : (
          <Section padded>
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
          </Section>
        )}

        {googleAvailable ? (
          <Pressable
            onPress={() => void google()}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Google로 로그인"
            accessibilityState={{ busy: busy === "google" }}
            style={({ pressed }) => [
              styles.google,
              { backgroundColor: c.card, borderColor: c.outline },
              pressed && { opacity: opacity.pressed },
            ]}
          >
            {busy === "google" ? (
              <ActivityIndicator color={c.text2} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={c.text} />
                <Text variant="headline">Google로 로그인</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {showPassword ? (
          <>
            <Section padded>
              <View style={{ gap: space.lg }}>
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
            <PrimaryButton label="로그인" loading={busy === "password"} disabled={busy === "google"} onPress={() => void submit()} />
          </>
        ) : null}

        {error ? <Banner message={error} /> : null}

        {googleAvailable && !showPassword ? (
          <View style={{ alignItems: "center" }}>
            <TextButton label="아이디로 로그인" tone="muted" onPress={() => setShowPassword(true)} />
          </View>
        ) : null}
        <Text variant="footnote" weight="400" color="text2" align="center">
          로그인은 이 기기에 안전하게 저장돼요.
        </Text>
      </ScrollView>
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, gap: space.xl },
  brand: { alignItems: "center", gap: space.sm, marginBottom: space.lg },
  logo: { width: 88, height: 88, borderRadius: radius.popover, marginBottom: space.sm },
  google: {
    minHeight: size.primary,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
});
