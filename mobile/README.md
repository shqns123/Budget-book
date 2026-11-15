# 잔잔한 가계부 — 네이티브 앱

웹앱과 같은 NAS 서버(SQLite)를 쓰는 Android/iOS 앱입니다. Expo SDK 58 · React Native 0.88 · Expo Router.

- **디자인**: 공용 모바일 디자인 시스템의 구조(회색 캔버스, 흰 섹션 카드, 플로팅 탭 바, 시트, 모서리 규칙 14/20/28)를 따르고, 대표 색은 웹앱의 잉크 `#17191c`(주요 버튼) · 피치 `#fbe1d1` / 시에나 `#5d2a1a`(선택 · 강조)입니다. 모든 값은 `src/theme/tokens.ts`에 있으며 화면에서는 `useTheme().c`로만 씁니다. 다크 모드를 지원합니다.
- **화면**: 개요 · 거래 내역(검색/필터/정렬, 추가·수정·삭제, 사진에서 거래 불러오기, 반복 항목 일괄 등록) · 보고서(월간/연간) · 잔고 · 저축 내역 · 가계부 설정(계좌, 분류, 월 예산, 반복 지출)

## 서버 준비 (한 번)

앱은 쿠키 대신 `Authorization: Bearer` 토큰으로 로그인합니다. 이 저장소의 `middleware.ts`와 `app/api/auth/login/route.ts`에 그 처리가 들어 있으니, NAS에서 컨테이너를 다시 빌드하세요.

```bash
docker compose up -d --build
```

### 서버 주소 넣어 두기

| 어디서 | 넣는 곳 | 로그인 화면 |
|---|---|---|
| 개발 (Expo Go) | `mobile/.env.local`의 `EXPO_PUBLIC_API_URL` (`.env.example` 복사) | 서버 주소 칸이 미리 채워짐 (바꿀 수 있음) |
| APK · EAS 빌드 | `eas.json`의 `build.preview.env`, `build.production.env`의 `EXPO_PUBLIC_API_URL` | 서버 주소 칸 없음, 아이디·비밀번호만 |

- `.env.local`을 바꾼 뒤에는 `npx expo start --clear`로 다시 시작해야 반영됩니다.
- 개발에서는 한 번 로그인한 주소가 기기에 저장돼 그 값이 우선합니다. 빌드된 앱은 항상 넣어 둔 주소를 씁니다.
- 주소는 https여야 합니다(릴리스 앱은 http를 막습니다). 로컬 APK 빌드 스크립트가 `eas.json`의 preview env를 그대로 씁니다.

## 개발 실행 (Expo Go)

이 앱은 Expo Go에 들어 있는 모듈만 써서, 네이티브 빌드 없이 Expo Go로 바로 테스트할 수 있습니다.

```bash
npm install
npx expo start
```

- **폰**: Play 스토어에서 Expo Go를 설치하고, PC와 같은 Wi-Fi에서 터미널의 QR 코드를 Expo Go로 찍습니다. 연결이 안 되면 Windows 방화벽에서 Node.js의 개인 네트워크 접근을 허용하거나 `npx expo start --tunnel`을 쓰세요.
- **에뮬레이터**: 에뮬레이터를 켠 뒤 `npx expo start --android`. SDK에 맞는 Expo Go가 자동으로 설치됩니다(USB 디버깅으로 연결한 폰도 마찬가지).
- 코드를 저장하면 앱에 바로 반영됩니다. 앱 이름·아이콘·스플래시는 Expo Go에서는 Expo Go 것으로 보이고, APK에서만 적용됩니다.
- 로컬 웹 서버로 테스트하려면 로그인 화면 서버 주소에 `http://<PC IP>:3000`처럼 `http://`까지 적으면 됩니다(주소만 적으면 `https://`가 붙습니다).

> PowerShell에서 `npx`/`npm`이 "스크립트를 실행할 수 없으므로…" 오류를 내면 `npx.cmd`, `npm.cmd`로 실행하세요(실행 정책 때문이며, Git Bash·cmd에서는 그대로 됩니다).

## 서명 키 준비 (한 번, 빌드 횟수 안 씀)

로컬 APK와 EAS APK가 같은 키로 서명돼야 서로 업데이트로 설치됩니다. 키는 EAS에서 만들어 내려받습니다.

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

```bash
npx eas-cli@latest credentials -p android
```

- `init`: Expo 계정에 프로젝트를 만들고 `projectId`를 넣습니다. "dynamic config에 쓸 수 없다"고 나오면, 출력된 ID를 `app.json`의 `expo.extra.eas.projectId`에 직접 넣으세요(`app.config.ts`가 `app.json`을 그대로 이어받습니다).
- `credentials`: 프로필(preview)을 고른 뒤 Keystore → Set up a new keystore로 키를 만들고, 다시 credentials.json → Download credentials from EAS로 `credentials.json`과 `credentials/android/keystore.jks`를 내려받습니다.
- 두 파일은 git에서 제외돼 있습니다. 잃어버리면 EAS에서 다시 내려받으면 됩니다.

## APK 만들기 (로컬, Android Studio 툴체인)

```bash
npm run build:apk
```

- 결과물: `dist/quiet-ledger-v<versionCode>.apk` → 폰으로 옮겨 설치(출처를 알 수 없는 앱 허용 필요).
- `credentials.json`이 있으면 EAS 키로, 없으면 디버그 키로 서명합니다(시작할 때 어느 쪽인지 출력).
- versionCode는 `dist/`의 마지막 APK 번호 +1로 정해집니다. 직접 정하려면 `npm run build:apk -- --version-code 7`.
- CPU 종류: 기본 `phone`(실제 폰 전부). `-- --arch arm64`(최신 폰만, 가장 빠름), `-- --arch emulator`, `-- --arch all`.
- 네이티브 패키지나 플러그인을 추가·삭제했다면 `-- --clean`으로 `android/`를 새로 만드세요.
- Android Studio에 들어 있는 JDK(`jbr`)와 `%LOCALAPPDATA%\Android\Sdk`를 자동으로 씁니다. 시스템 설정은 바꿀 필요가 없습니다. 긴 경로 문제는 `plugins/withLocalAndroidBuild.js`가 C++ 빌드 폴더를 `C:\qlx`로 옮겨서 피합니다.
- `android/` 폴더는 `app.json`과 플러그인에서 만들어지므로 직접 고치지 않습니다.

## EAS 빌드 (12월 이후)

```bash
npx eas-cli@latest build --platform android --profile preview
```

- 위에서 만든 키를 그대로 쓰므로, 로컬 APK 위에 업데이트로 설치됩니다.
- versionCode는 EAS가 따로 셉니다. 로컬 APK를 만든 뒤 처음 EAS로 빌드할 때는 마지막 로컬 번호보다 크게 맞춰 주세요.

  ```bash
  npx eas-cli@latest build:version:set -p android
  ```

- iOS는 Apple Developer 계정이 생기면 `--platform ios`로 빌드합니다.

## 버전 올리기

화면에 보이는 버전은 `app.json`의 `expo.version`을 올립니다. versionCode(설치 순서 번호)는 로컬 빌드 스크립트와 EAS가 알아서 올립니다.

## 확인

```bash
npm run typecheck
npx eslint src
npx expo-doctor
```
