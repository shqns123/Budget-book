import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DialogHost } from "@/components/ui/Dialog";
import { SessionProvider, useSession } from "@/store/session-store";
import { ThemeProvider, useTheme } from "@/theme/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <RootNavigator />
          {/* Confirm / notice popups (lib/confirm) render here, above every screen. */}
          <DialogHost />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { ready, signedIn } = useSession();
  const { c, dark } = useTheme();
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
