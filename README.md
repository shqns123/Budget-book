# 잔잔한 가계부

Next.js와 shadcn 스타일 컴포넌트 구조로 만든 개인 가계부 웹앱입니다. `DESIGN.md`의 warm paper 톤과 Steep의 차분한 분석 카드 느낌을 반영했습니다.

## 기술 구성

- Next.js 15 / React 19 / TypeScript
- shadcn 호환 컴포넌트 구성과 CSS 디자인 토큰
- SQLite 파일 데이터베이스 (`data/ledger.db`)
- Docker Compose

## Docker로 실행

Docker Desktop이 실행 중인 환경에서 다음 명령을 실행합니다.

```bash
docker compose up --build
```

웹앱은 `http://localhost:3002`에서 열립니다. 첫 실행 시 `data/ledger.db`가 생성되고, 가계부 데이터는 이 파일에 저장됩니다.

## 현재 구현 범위

- 여러 통장을 선택해 해당 통장 거래만 합산하는 대시보드
- 전체 통장/복수 통장 선택 및 카테고리·예산·거래 내역 범위 동기화
- 카드·대출 사용은 지출, 결제·상환은 계좌 간 이동으로 처리하는 거래 기록 흐름
- 통장·카드·대출·분류를 관리하는 가계부 설정 화면
- NAS의 `data/ledger.db`에 저장되는 공용 거래·예산·반복 항목·저축 계획·설정
- 은행 앱 화면이나 영수증 사진에서 여러 거래를 추출하고 검토 후 일괄 등록

## Google 로그인과 멤버

로그인은 Google 계정으로 해요. 소유자(`OWNER_EMAIL`)와 소유자가 **설정 → 멤버**(앱: 전체 → 멤버)에서 초대한 Gmail만 들어올 수 있고, 모두 같은 가계부를 보고 편집해요. 초대와 내보내기는 소유자만 할 수 있고, 내보낸 멤버는 다음 요청부터 막혀요. 기존 아이디·비밀번호 로그인은 로그인 화면의 "아이디로 로그인" 링크로 남아 있어요(소유자로 로그인).

Google Cloud Console(캘린더 앱과 같은 프로젝트를 써도 돼요) → API 및 서비스 → 사용자 인증 정보에서 OAuth 클라이언트 ID를 만들어요.

| 종류 | 설정 | 쓰는 곳 |
|---|---|---|
| 웹 애플리케이션 | 승인된 JavaScript 원본: `https://<가계부 주소>` | 서버 `.env`의 `GOOGLE_CLIENT_ID`, 앱의 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Android | 패키지 `com.budgetbook.mobile`, SHA-1: 릴리스 키(EAS 키스토어) | 정식 앱 |
| Android | 패키지 `com.budgetbook.mobile.dev`, SHA-1: 디버그 키 | 개발용 앱 |

SHA-1은 `keytool -list -v -keystore <키스토어>`로 확인해요(디버그 키: `mobile/android/app/debug.keystore`, 비밀번호 `android`). Android 클라이언트 ID는 어디에도 넣지 않아요. Google이 패키지와 서명으로 앱을 알아봐요.

## 사진으로 거래 불러오기

OpenRouter에서 API 키를 만든 뒤 `.env`에 다음 값을 추가합니다.

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-5.4-mini
```

필요하면 OpenRouter 사용 내역에 표시할 서비스 주소도 설정할 수 있습니다.

```dotenv
OPENROUTER_SITE_URL=https://가계부주소
```

거래 내역의 추가 창에서 `사진에서 거래 불러오기`를 누르면 한 번에 최대 5장의 사진을 선택할 수 있습니다. `OPENROUTER_MODEL`에 지정한 모델이 날짜, 내용, 금액, 유형, 계좌와 분류를 제안합니다. 모델값을 생략하면 `openai/gpt-5.4-mini`가 사용됩니다. 분석 결과는 저장 전에 수정하거나 제외할 수 있습니다. API 키는 서버에서만 사용되며 브라우저로 전달되지 않습니다.

## 결제 알림 대기함 (Android 앱)

Android 앱은 알림 접근을 허용하면 카드 승인·출금·입금 알림을 읽어 `전체 → 결제 알림 대기함`(거래 내역 탭의 대기함 칩)에 모읍니다. 알림은 기기에만 저장되고, 대기함에서 확인·수정해 `등록`한 것만 가계부에 들어갑니다.

- KB Pay·카카오뱅크 알림과 흔한 카드 문자 형식은 앱의 규칙으로 읽습니다. 규칙으로 못 읽은 알림만 `/api/transactions/analyze-notice`가 OpenRouter로 읽습니다. 모델은 `OPENROUTER_NOTICE_MODEL`이 있으면 그것, 없으면 `OPENROUTER_MODEL`을 씁니다(예: Claude Haiku).
- 출금 상대가 설정의 "내 이름"이거나 메모에 이체 단어·가계부 통장 이름이 있으면 계좌 간 이동으로 채웁니다. 반복 항목과 연결되면 고정비로 채우고, 이번 달에 이미 등록된 반복 항목은 "이미 등록됨"으로 보여 줍니다(반복 항목 일괄 등록도 이미 등록된 항목은 뺍니다).
- 한 번 등록한 카드·계좌와 상대방은 기억해서 다음 알림부터 자동으로 채웁니다.
- Play 스토어가 아닌 APK로 설치한 경우 Android 13 이상은 앱 정보 → ⋮ → `제한된 설정 허용`을 먼저 눌러야 알림 접근을 켤 수 있습니다.

처음 실행 시 스프레드시트에서 가져온 예시 거래가 기본값으로 표시되며, 이후 변경 내용은 NAS의 SQLite 파일에 저장됩니다.

## 스프레드시트 원본 데이터 이관

`data/ledger.db`를 백업하면 가계부 전체를 백업할 수 있습니다. 초기 상태로 되돌리려면 컨테이너를 멈춘 뒤 이 파일을 삭제하고 다시 시작하세요.
