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
- 전체 통장/복수 통장 선택 및 카테고리·예산·최근 거래 범위 동기화
- 카드·대출 사용은 지출, 결제·상환은 계좌 간 이동으로 처리하는 거래 기록 흐름
- 통장·카드·대출·분류를 관리하는 가계부 설정 화면
- NAS의 `data/ledger.db`에 저장되는 공용 거래·예산·반복 항목·저축 계획·설정

처음 실행 시 스프레드시트에서 가져온 예시 거래가 기본값으로 표시되며, 이후 변경 내용은 NAS의 SQLite 파일에 저장됩니다.

## 스프레드시트 원본 데이터 이관

`data/ledger.db`를 백업하면 가계부 전체를 백업할 수 있습니다. 초기 상태로 되돌리려면 컨테이너를 멈춘 뒤 이 파일을 삭제하고 다시 시작하세요.
