import type { ReactNode } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { size, space } from "@/theme/tokens";
import { useLedger } from "@/store/ledger-store";
import { IconButton, TextButton } from "./Button";
import { Banner } from "./Controls";
import { KeyboardAware } from "./Keyboard";
import { Text } from "./Text";

/** Space the floating tab bar takes at the bottom of a tab screen. */
export const TAB_BAR_CLEARANCE = size.tabbar + space.xl + space.lg;

/** A screen: canvas, header, scrolling body. Content scrolls under the tab bar. */
export function Screen({
  title,
  right,
  above,
  children,
  inTabs = true,
  refreshable = true,
  back,
}: {
  title?: string;
  right?: ReactNode;
  /** Pinned controls under the title (month, account filter). */
  above?: ReactNode;
  children: ReactNode;
  inTabs?: boolean;
  refreshable?: boolean;
  /** Pushed screens get a back button before the title. */
  back?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh, refreshing, status, loadError, saveError, clearSaveError } = useLedger();
  return (
    <KeyboardAware style={[styles.root, { backgroundColor: c.bg }]}>
      {(title || right || above) && (
        <View style={{ paddingTop: insets.top + space.sm, backgroundColor: c.bg }}>
          {(title || right) && <ScreenHeader title={title} right={right} back={back} />}
          {above ? <View style={styles.above}>{above}</View> : null}
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.body,
          { paddingBottom: (inTabs ? TAB_BAR_CLEARANCE : space.xxl) + insets.bottom },
        ]}
        refreshControl={
          refreshable ? (
            <RefreshControl
              refreshing={refreshing && status === "ready"}
              onRefresh={() => void refresh()}
              tintColor={c.text2}
              colors={[c.primary]}
              progressBackgroundColor={c.card}
            />
          ) : undefined
        }
      >
        {saveError ? (
          <Banner message={saveError} action={<TextButton label="닫기" tone="danger" onPress={clearSaveError} />} />
        ) : null}
        {status === "loading" ? (
          <LoadingView />
        ) : status === "error" ? (
          <Banner
            message={loadError}
            action={<TextButton label="다시 시도" tone="danger" onPress={() => void refresh()} />}
          />
        ) : (
          children
        )}
      </ScrollView>
    </KeyboardAware>
  );
}

export function ScreenHeader({
  title,
  right,
  back,
}: {
  title?: string;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <View style={[styles.header, back && { paddingLeft: space.xs }]}>
      {back ? <IconButton icon="chevronLeft" label="뒤로" onPress={() => router.back()} /> : null}
      <Text variant="title2" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function LoadingView() {
  const { c } = useTheme();
  return (
    <View style={styles.loading} accessibilityLabel="불러오는 중">
      <ActivityIndicator color={c.text2} />
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text variant="headline" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="subhead" color="text2" align="center">
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.rowX,
    paddingRight: space.md,
    gap: space.sm,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: space.xs },
  above: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.xl },
  loading: { padding: space.xxl, alignItems: "center" },
  empty: { paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm },
});
