import { Stack } from "expo-router";
import { LedgerProvider } from "@/store/ledger-store";
import { PrefsProvider } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <PrefsProvider>
      <LedgerProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="compose" options={{ presentation: "modal" }} />
          <Stack.Screen name="balance" />
          <Stack.Screen name="savings" />
          <Stack.Screen name="settings" />
        </Stack>
      </LedgerProvider>
    </PrefsProvider>
  );
}
