// @ts-check
/**
 * Local release builds only (scripts/build-apk.mjs sets LOCAL_ANDROID_BUILD=1 before
 * `expo prebuild`). Expo Go and EAS cloud builds never set it, so this plugin leaves them alone.
 *
 * 1. Signing: the release APK is signed with the keystore EAS uses (credentials.json, downloaded
 *    with `eas credentials`), so a local APK and an EAS APK install as updates of each other.
 *    The key path and passwords are read from environment variables at Gradle time and never
 *    written into the project. Without them the APK is signed with the debug key.
 * 2. Windows paths: C++ build folders go to a short root (QL_CXX_ROOT, C:\qlx). CMake nests the
 *    source path inside its object paths, and from node_modules they pass Windows' 260-character
 *    limit; the SDK's ninja can't use long paths. No system settings needed.
 * 3. Downloads: React Native's core AAR is read from ~/.m2 first (the build script fetches it
 *    with a resumable download), and jitpack.io is asked only for com.github.* artifacts.
 */
const { withAppBuildGradle, withProjectBuildGradle } = require("expo/config-plugins");

const MARK = "LOCAL_ANDROID_BUILD";

const PROJECT_GRADLE = String.raw`
// ${MARK}: plugins/withLocalAndroidBuild.js
allprojects {
  def localRn = repositories.mavenLocal { content { includeModule 'com.facebook.react', 'react-android' } }
  repositories.remove(localRn)
  repositories.addFirst(localRn)
  repositories.withType(MavenArtifactRepository).configureEach { repo ->
    if (repo.url.toString().contains('jitpack.io')) {
      repo.content { includeGroupByRegex 'com\\.github\\..*' }
    }
  }
}
def qlCxxRoot = System.getenv('QL_CXX_ROOT')
if (qlCxxRoot) {
  subprojects { p ->
    ['com.android.library', 'com.android.application'].each { id ->
      p.plugins.withId(id) {
        try {
          p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(qlCxxRoot, p.name)
        } catch (Exception e) {
          logger.lifecycle("QL_CXX_ROOT: kept the default C++ folder for " + p.name)
        }
      }
    }
  }
}
`;

const RELEASE_SIGNING = `
        release {
            if (System.getenv('RELEASE_STORE_FILE')) {
                storeFile file(System.getenv('RELEASE_STORE_FILE'))
                storePassword System.getenv('RELEASE_STORE_PASSWORD')
                keyAlias System.getenv('RELEASE_KEY_ALIAS')
                keyPassword System.getenv('RELEASE_KEY_PASSWORD')
            }
        }`;

const APP_CXX = `
// ${MARK}: the app's own C++ build (autolinked codegen) under QL_CXX_ROOT too. The root-level rule
// can't reach :app (configured too early). CMAKE_OBJECT_PATH_MAX makes CMake hash long object paths.
if (System.getenv('QL_CXX_ROOT')) {
    android.externalNativeBuild.cmake.buildStagingDirectory = new File(System.getenv('QL_CXX_ROOT'), 'app')
    android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=240')
}
`;

module.exports = function withLocalAndroidBuild(config) {
  if (process.env.LOCAL_ANDROID_BUILD !== "1") return config;

  config = withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MARK)) c.modResults.contents += PROJECT_GRADLE;
    return c;
  });

  return withAppBuildGradle(config, (c) => {
    let src = c.modResults.contents;
    if (src.includes(MARK)) return c;

    const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    if (!debugConfig.test(src)) throw new Error("withLocalAndroidBuild: signingConfigs.debug not found in app/build.gradle");
    src = src.replace(debugConfig, `$1${RELEASE_SIGNING}`);

    const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseType.test(src)) throw new Error("withLocalAndroidBuild: release signingConfig not found in app/build.gradle");
    src = src.replace(
      releaseType,
      "$1signingConfig System.getenv('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );

    c.modResults.contents = src + APP_CXX;
    return c;
  });
};
