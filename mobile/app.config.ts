import type { ConfigContext, ExpoConfig } from "expo/config";

// Static settings live in app.json. This only adds what changes per build:
// - versionCode: EAS cloud builds take it from EAS's remote counter (eas.json appVersionSource
//   "remote"); local builds (scripts/build-apk.mjs) pass ANDROID_VERSION_CODE so the APK installs
//   as an update over the last one (Android refuses a lower versionCode).
export default ({ config }: ConfigContext): ExpoConfig => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  return {
    ...config,
    android: {
      ...config.android,
      ...(versionCode > 0 ? { versionCode } : {}),
    },
  } as ExpoConfig;
};
