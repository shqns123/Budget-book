// APKs built locally with the Android Studio toolchain (no EAS build quota used).
//
//   npm run build:apk                      → dist/budget-book-v<versionCode>.apk  (release app)
//   npm run build:dev                      → dist/budget-book-dev.apk  ("잔잔한 가계부 (개발)": loads
//                                            the code from `npx expo start`, edits show live)
//   npm run build:apk -- --arch arm64      (phone | arm64 | emulator | all; default phone)
//   npm run build:apk -- --version-code 5  (default: next number after the newest APK in dist/)
//   npm run build:apk -- --clean           (regenerate android/ from scratch)
//   npm run build:aab                      → dist/budget-book-v<versionCode>.aab  (release app as an
//                                            Android App Bundle, for Google Play; every CPU type)
//
// Signing: with credentials.json + its keystore (downloaded with `npx eas-cli@latest credentials
// -p android` → Download credentials; both git-ignored), the APK is signed with the EAS key, so it
// installs as an update over an EAS-built app and the other way round. Without them it is signed
// with the debug key.
//
// Windows path limits and slow downloads are handled by plugins/withLocalAndroidBuild.js.
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWin = process.platform === "win32";
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (message) => {
  console.error(`\n${message}`);
  process.exit(1);
};

// --- CPU types to compile native (C++) code for; most of the build time goes here, once per type.
const ARCHS = {
  phone: "arm64-v8a,armeabi-v7a", // every real phone, old 32-bit ones included
  arm64: "arm64-v8a", // fastest and smallest; very old 32-bit phones can't install it
  emulator: "x86_64",
  all: "armeabi-v7a,arm64-v8a,x86,x86_64",
};
// --- Android App Bundle (Google Play) instead of an APK: Play hands each phone only its CPU's part,
// so a bundle carries every type.
const bundle = args.includes("--bundle");
const arch = flag("--arch") ?? (bundle ? "all" : "phone");
if (!ARCHS[arch]) fail(`--arch는 ${Object.keys(ARCHS).join(" | ")} 중 하나여야 해요.`);

// --- Which app: production (release APK) or development (dev app, debug build). See app.config.ts.
const variant = args.includes("--variant") ? flag("--variant") : "production";
if (variant !== "production" && variant !== "development") fail("--variant는 production | development 중 하나여야 해요.");
const isDev = variant === "development";
if (bundle && isDev) fail("--bundle은 정식 앱(production)만 만들 수 있어요.");

// --- versionCode: must be higher than the app already on the phone, or Android refuses the update.
let versionCode = Number(flag("--version-code") ?? 0);
if (!versionCode) {
  let last = 0;
  for (const f of existsSync(join(root, "dist")) ? readdirSync(join(root, "dist")) : []) {
    const m = /^budget-book-v(\d+)\.(apk|aab)$/.exec(f);
    if (m) last = Math.max(last, Number(m[1]));
  }
  versionCode = last + 1;
}

// --- Toolchain: Android Studio's own Java and the SDK it installed.
const env = { ...process.env };
if (!env.JAVA_HOME) {
  env.JAVA_HOME = isWin
    ? "C:\\Program Files\\Android\\Android Studio\\jbr"
    : "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
}
if (!env.ANDROID_HOME) {
  env.ANDROID_HOME = isWin
    ? join(env.LOCALAPPDATA ?? "", "Android", "Sdk")
    : join(homedir(), "Library", "Android", "sdk");
}
if (!existsSync(join(env.JAVA_HOME, "bin", isWin ? "java.exe" : "java"))) {
  fail(`Java를 찾지 못했어요: ${env.JAVA_HOME} (Android Studio를 설치하거나 JAVA_HOME을 지정하세요)`);
}
if (!existsSync(env.ANDROID_HOME)) fail(`Android SDK를 찾지 못했어요: ${env.ANDROID_HOME}`);

// --- Signing with the EAS keystore, when downloaded (release app only; the dev app is a separate
// app and uses the debug key).
const credentialsFile = join(root, "credentials.json");
let signedWith = isDev ? "디버그 키 (개발용 앱)" : "디버그 키 (credentials.json 없음)";
if (!isDev && existsSync(credentialsFile)) {
  const keystore = JSON.parse(readFileSync(credentialsFile, "utf8")).android?.keystore;
  if (!keystore?.keystorePath) fail("credentials.json에 android.keystore가 없어요. eas credentials로 다시 받아 주세요.");
  const storeFile = resolve(root, keystore.keystorePath);
  if (!existsSync(storeFile)) fail(`키스토어 파일이 없어요: ${storeFile}`);
  env.RELEASE_STORE_FILE = storeFile;
  env.RELEASE_STORE_PASSWORD = keystore.keystorePassword;
  env.RELEASE_KEY_ALIAS = keystore.keyAlias;
  env.RELEASE_KEY_PASSWORD = keystore.keyPassword;
  signedWith = "EAS 키 (credentials.json)";
}

// --- Same settings as the EAS profile (eas.json env: "preview" for the release app, "development"
// for the dev app), e.g. the built-in server address. Variables already set in the shell win.
const profile = isDev ? "development" : "preview";
const easEnv = JSON.parse(readFileSync(join(root, "eas.json"), "utf8")).build?.[profile]?.env ?? {};
for (const [key, value] of Object.entries(easEnv)) env[key] ??= String(value);
env.APP_VARIANT = variant;
const apiUrl = env.EXPO_PUBLIC_API_URL ?? "";
if (!isDev && apiUrl && !/^https:\/\/[^/]+/.test(apiUrl)) {
  fail(`EXPO_PUBLIC_API_URL은 https 주소여야 해요 (릴리스 앱은 http를 막아요): ${apiUrl}`);
}

env.LOCAL_ANDROID_BUILD = "1";
if (!isDev) {
  env.ANDROID_VERSION_CODE = String(versionCode);
  env.NODE_ENV = "production";
}

// --- C++ build folders under a short root (see the plugin). Stale ones from another checkout go.
if (isWin) {
  env.QL_CXX_ROOT = env.QL_CXX_ROOT ?? "C:\\qlx";
  mkdirSync(env.QL_CXX_ROOT, { recursive: true });
  const mark = join(env.QL_CXX_ROOT, ".source");
  if (!existsSync(mark) || readFileSync(mark, "utf8").trim() !== root) {
    for (const d of readdirSync(env.QL_CXX_ROOT)) {
      if (d !== ".source") rmSync(join(env.QL_CXX_ROOT, d), { recursive: true, force: true });
    }
    writeFileSync(mark, root);
  }
}

// --- React Native's core AAR (~170MB) stalls mid-download on some networks and Gradle can't
// resume. Fetch it into ~/.m2 with a resumable download; the plugin makes Gradle read it from there.
function fetchReactNativeAar() {
  const rn = JSON.parse(readFileSync(join(root, "node_modules", "react-native", "package.json"), "utf8")).version;
  const dir = join(homedir(), ".m2", "repository", "com", "facebook", "react", "react-android", rn);
  const path = `com/facebook/react/react-android/${rn}`;
  const central = `https://repo.maven.apache.org/maven2/${path}`;
  // Google's Maven Central mirrors serve the AAR far faster on some networks; Maven Central last.
  // The checksum always comes from Maven Central itself.
  const mirrors = [
    `https://maven-central-asia.storage-download.googleapis.com/maven2/${path}`,
    `https://maven-central.storage-download.googleapis.com/maven2/${path}`,
    central,
  ];
  const aar = `react-android-${rn}-${isDev ? "debug" : "release"}.aar`;
  const curl = (...a) => spawnSync(isWin ? "curl.exe" : "curl", a, { stdio: "inherit" }).status === 0;
  mkdirSync(dir, { recursive: true });
  for (const f of [`react-android-${rn}.pom`, `react-android-${rn}.module`, `${aar}.sha1`]) {
    if (!existsSync(join(dir, f)) && !curl("-sSfL", "--retry", "5", "-o", join(dir, f), `${central}/${f}`)) return false;
  }
  const want = readFileSync(join(dir, `${aar}.sha1`), "utf8").trim().slice(0, 40);
  const sha1 = () =>
    existsSync(join(dir, aar)) ? createHash("sha1").update(readFileSync(join(dir, aar))).digest("hex") : "";
  if (sha1() === want) return true;
  console.log(`Fetching ${aar} (resumable)…`);
  for (const base of mirrors) {
    for (let i = 0; i < 10; i++) {
      if (curl("-sSfL", "-C", "-", "--speed-time", "20", "--speed-limit", "50000", "--connect-timeout", "20", "-o", join(dir, aar), `${base}/${aar}`)) break;
    }
    if (sha1() === want) return true;
  }
  rmSync(join(dir, aar), { force: true });
  return false;
}
try {
  if (!fetchReactNativeAar()) console.warn("React Native AAR를 미리 받지 못했어요. Gradle이 직접 받습니다.");
} catch (error) {
  console.warn(`React Native AAR 준비를 건너뜀: ${error.message}`);
}

console.log(
  [
    isDev ? "앱: 잔잔한 가계부 (개발) — 개발 서버에서 코드를 받아요" : `versionCode ${versionCode}`,
    `CPU: ${ARCHS[arch]}`,
    `서명: ${signedWith}`,
    isDev
      ? "서버: .env.local 값이 로그인 화면에 미리 채워져요"
      : `서버: ${apiUrl || "(없음: .env.local 값이 있으면 그것, 없으면 로그인 화면에서 입력)"}`,
    `JAVA_HOME=${env.JAVA_HOME}`,
    `ANDROID_HOME=${env.ANDROID_HOME}`,
  ].join("\n"),
);

const run = (cmd, cwd) => execSync(cmd, { cwd, env, stdio: "inherit" });
// android/ is generated from app.json (+ plugins). Update it in place; --clean starts over
// (needed after adding or removing native packages or plugins).
// Switching between the release app and the dev app changes the package, so that starts over too.
const variantMark = join(root, "android", ".app-variant");
const clean =
  args.includes("--clean") ||
  !existsSync(join(root, "android")) ||
  !existsSync(variantMark) ||
  readFileSync(variantMark, "utf8").trim() !== variant;
run(`npx expo prebuild --platform android --no-install${clean ? " --clean" : ""}`, root);
writeFileSync(variantMark, variant);

const gradleArgs = [
  isDev ? "assembleDebug" : bundle ? "bundleRelease" : "assembleRelease",
  "--console=plain",
  "-Dorg.gradle.internal.http.socketTimeout=120000",
  "-Dorg.gradle.internal.http.connectionTimeout=60000",
  `-PreactNativeArchitectures=${ARCHS[arch]}`,
];
const androidDir = join(root, "android");
// Full path: cmd may not search the current folder (NoDefaultCurrentDirectoryInExePath).
if (isWin) execFileSync("cmd.exe", ["/d", "/c", join(androidDir, "gradlew.bat"), ...gradleArgs], { cwd: androidDir, env, stdio: "inherit" });
else execFileSync("./gradlew", gradleArgs, { cwd: androidDir, env, stdio: "inherit" });

const buildType = isDev ? "debug" : "release";
const built = bundle
  ? join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab")
  : join(androidDir, "app", "build", "outputs", "apk", buildType, `app-${buildType}.apk`);
mkdirSync(join(root, "dist"), { recursive: true });
const target = join(
  root,
  "dist",
  isDev ? "budget-book-dev.apk" : `budget-book-v${versionCode}.${bundle ? "aab" : "apk"}`,
);
copyFileSync(built, target);
console.log(`\n${bundle ? "AAB" : "APK"}: ${target}`);
