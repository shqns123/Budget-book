import type { ConfigContext, ExpoConfig } from "expo/config";

// Static settings live in app.json. This adds what changes per build:
//
// APP_VARIANT
//   development (default) → "잔잔한 가계부 (개발)", com.budgetbook.mobile.dev. The dev app: it loads
//                           the code from the Expo dev server (npx expo start) and shows edits live.
//                           Installs next to the real app.
//   production            → "잔잔한 가계부", com.budgetbook.mobile. Set by eas.json (preview /
//                           production) and by `npm run build:apk`.
//
// ANDROID_VERSION_CODE
//   EAS cloud builds take versionCode from EAS's remote counter (eas.json appVersionSource
//   "remote"); local builds (scripts/build-apk.mjs) pass it so the APK installs as an update over
//   the last one (Android refuses a lower versionCode).
export default ({ config }: ConfigContext): ExpoConfig => {
  const isDev = (process.env.APP_VARIANT ?? "development") === "development";
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  return {
    ...config,
    name: isDev ? `${config.name} (개발)` : config.name!,
    slug: config.slug!,
    scheme: isDev ? `${config.scheme}-dev` : config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: isDev ? `${config.ios?.bundleIdentifier}.dev` : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isDev ? `${config.android?.package}.dev` : config.android?.package,
      ...(versionCode > 0 ? { versionCode } : {}),
    },
    extra: { ...config.extra, appVariant: isDev ? "development" : "production" },
  };
};
