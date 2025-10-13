# inventory-app

재고 입·출고, 반품, 텔레그램 알림을 관리하는 모노레포 프로젝트입니다. NestJS 기반 API 서버(`apps/api`)와 React/Vite 웹 클라이언트(`apps/web`), 공통 패키지(`packages/`)로 구성되어 있습니다.

## 1. 필수 요구사항

- Node.js 20 이상
- npm 9 이상 (워크스페이스 지원)
- PostgreSQL 14 이상 (개발/테스트)

## 2. 설치 & 초기화

```bash
git clone <repo-url>
cd inventory-app
npm install
```

## 3. 폴더 구조 요약

| 경로              | 설명                                   |
| ----------------- | -------------------------------------- |
| `apps/api`        | NestJS API 서버                        |
| `apps/web`        | Vite 기반 React 클라이언트             |
| `packages/*`      | 공유 타입/설정                         |
| `infra`           | Docker, nginx 등 배포 자산             |
| `docs`            | 기획/설계 문서                         |
| `inventory-dev-plan.md` | 스프린트 체크리스트 및 진행 상황  |

## 4. 환경 변수 설정

### 루트 `.env`

`.env.example`을 복사하여 다음 항목을 채웁니다.

```ini
DATABASE_URL=postgresql://user:password@localhost:5432/inventory
JWT_SECRET=your-jwt-secret
TELEGRAM_BOT_TOKEN=optional-telegram-token
TELEGRAM_CHAT_ID=optional-chat-id
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_NAME=Admin
ADMIN_SEED_PASSWORD=ChangeMe123!
```

> **참고**: API 전용 환경 변수는 `apps/api/.env.example`을 참고해 동일하게 설정할 수 있습니다. 루트와 API 환경 변수가 동시에 정의되면 API 서비스에서 우선 사용됩니다.

### 텔레그램 알림 관련 변수

- `TELEGRAM_BOT_TOKEN`: BotFather로 발급한 봇 토큰
- `TELEGRAM_CHAT_ID`: 기본 알림 대상(단일 ID). UI에서 다중 타깃을 관리할 수 있습니다.

코드에서는 알림 설정 API를 통해 다중 챗 ID와 쿨다운/조용 시간 등을 관리합니다.

## 5. 데이터베이스 마이그레이션 & 시드

```bash
npm --workspace apps/api run prisma:migrate:deploy
npm --workspace apps/api run prisma:seed
```

- 시드 실행 시 `.env`에 정의된 관리자 계정과 기본 텔레그램 설정이 생성됩니다.
- 스키마 수정 후에는 반드시 마이그레이션과 시드를 다시 실행하세요.

## 6. 개발 서버 실행

### API (NestJS)

```bash
cd apps/api
npm run start:dev
```

- 기본 포트: `3000`
- 글로벌 프리픽스: `api/v1`

### Web (React/Vite)

```bash
cd apps/web
npm run dev -- --host 0.0.0.0
```

- 기본 포트: `5173`
- API 호출 시 `VITE_API_BASE_URL` 환경 변수를 확인하세요.

## 7. 테스트

- 기본 환경(인메모리 Prisma 스텁):

  ```bash
  npm test
  ```

  API 유닛 테스트와 e2e 시나리오(로그인 → 제품 → 알림 테스트)가 실행됩니다. 이 모드는 외부 DB 연결 없이 동작합니다.

- 실제 PostgreSQL 대상 검증:

  ```bash
  export DATABASE_URL="postgresql://user:password@localhost:5432/inventory_test"
  export E2E_USE_REAL_DB=true
  npm --workspace apps/api run prisma:migrate:deploy
  npm test
  ```

  테스트 전에 데이터베이스가 초기화되며, 관리자/뷰어 계정과 텔레그램 설정이 시드됩니다.

## 8. CI 파이프라인 참고

- `.github/workflows/ci.yml`에서 lint → format → API 테스트 순으로 실행합니다.
- `test-api` 잡은 GitHub Actions의 Postgres 서비스 컨테이너를 사용하며, `DATABASE_URL`과 `E2E_USE_REAL_DB=true`로 실제 DB 기반 테스트를 수행합니다.
- `TELEGRAM_BOT_TOKEN` 시크릿이 정의되어 있으면 해당 토큰을 사용하고, 미정의 시 `test-token`으로 대체합니다(테스트는 기본적으로 스텁 전송이므로 실제 메시지는 발송되지 않습니다).

## 9. 자주 사용하는 명령어

| 명령어                                                     | 설명                                |
| ---------------------------------------------------------- | ----------------------------------- |
| `npm run build`                                            | 워크스페이스 전체 빌드              |
| `npm --workspace apps/api run prisma:generate`            | Prisma Client 재생성                |
| `npm --workspace apps/api run prisma:migrate:deploy`      | 마이그레이션 적용                   |
| `npm --workspace apps/api run prisma:seed`                | 관리자/기본 설정 시드               |
| `npm --workspace apps/api run start:dev`                  | API 개발 서버                        |
| `npm --workspace apps/web run dev -- --host 0.0.0.0`      | 웹 개발 서버                         |

## 10. 보안 & 운영 메모

- `.env` 파일은 버전 관리에 포함하지 않습니다.
- 토큰/패스워드 등 민감 정보는 GitHub Secrets 또는 별도 비밀 관리 서비스를 사용하세요.
- 텔레그램 토큰 교체 시 PR/로그에 노출되지 않도록 주의합니다.
