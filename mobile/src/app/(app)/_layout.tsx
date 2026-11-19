import { Stack } from "expo-router";
import { InboxProvider } from "@/store/inbox-store";
import { LedgerProvider } from "@/store/ledger-store";
import { PrefsProvider } from "@/store/prefs-store";
import { useTheme } from "@/theme/theme";

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <PrefsProvider>
      <LedgerProvider>
        <InboxProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="inbox" />
            <Stack.Screen name="savings" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="members" />
          </Stack>
        </InboxProvider>
      </LedgerProvider>
    </PrefsProvider>
  );
}
