# 잔잔한 가계부

Next.js와 shadcn 스타일 컴포넌트 구조로 만든 개인 가계부 웹앱입니다. `DESIGN.md`의 warm paper 톤과 Steep의 차분한 분석 카드 느낌을 반영했습니다.

## 기술 구성

- Next.js 15 / React 19 / TypeScript
- shadcn 호환 컴포넌트 구성과 CSS 디자인 토큰
- PostgreSQL 16 + Drizzle ORM
- Docker Compose

## Docker로 실행

Docker Desktop이 실행 중인 환경에서 다음 명령을 실행합니다.

```bash
docker compose up --build
```

웹앱은 `http://localhost:8000`에서 열립니다. PostgreSQL은 처음 시작될 때 `drizzle/0000_happy_taskmaster.sql` 마이그레이션을 적용합니다.

## 현재 구현 범위

- 여러 통장을 선택해 해당 통장 거래만 합산하는 대시보드
- 전체 통장/복수 통장 선택 및 카테고리·예산·최근 거래 범위 동기화
- 카드·대출 사용은 지출, 결제·상환은 계좌 간 이동으로 처리하는 거래 기록 흐름
- 통장·카드·대출·분류를 관리하는 가계부 설정 화면
- 통장, 거래, 예산을 위한 PostgreSQL 스키마

현재 화면은 설계 검증용 예시 거래를 표시합니다. 다음 단계에서 실제 DB 조회·저장 API와 Google Sheets 가져오기를 연결합니다.
## 스프레드시트 원본 데이터 이관

`drizzle/0003_import_source_ledger.sql`에는 가계부 스프레드시트에서 이관한 계좌 17개, 카테고리 53개, 거래 1,155건이 들어 있습니다. 새 Docker 데이터베이스를 만들면 자동으로 적용됩니다.

이미 만들어진 Docker 데이터베이스를 원본 데이터로 다시 채우려면, DB가 실행 중인 상태에서 아래 명령을 한 번 실행합니다. 이 명령은 기존 웹앱 데이터를 비우고 원본 스프레드시트 데이터만 등록합니다.

```bash
docker compose run --rm household-ledger npm run db:seed
```
