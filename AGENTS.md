# Repository Guidelines / 레포지토리 가이드라인

## Project Structure & Module Organization / 프로젝트 구조 및 모듈 구성

- Monorepo root keeps shared config; domain code lives under `apps/`. (모노레포 루트에는 공유 설정을 두고, 도메인 코드는 `apps/`에 위치합니다.)
- `apps/api/`: NestJS service with `src/`, `prisma/`, `test/`. (NestJS 서비스로 `src/`, `prisma/`, `test/` 디렉터리를 사용합니다.)
- `apps/web/`: React + Vite client; routes in `src/app/routes`, shared UI in `src/components/ui`. (React+Vite 클라이언트이며 라우트는 `src/app/routes`, 공용 UI는 `src/components/ui`에 둡니다.)
- `packages/`: Shared TS types, UI, config presets. (공유 타입·UI·설정 프리셋을 보관하는 워크스페이스입니다.)
- `infra/`: Operational assets like `docker-compose.yml`, `nginx/default.conf`. (배포 자산을 관리합니다.)
- `scripts/`: Utilities such as `node scripts/scaffold-nest-module.js <module-path>`. (자동화 스크립트를 보관하며 명령 예시는 `node scripts/scaffold-nest-module.js <module-path>`입니다.)

## Build, Test, and Development Commands / 빌드·테스트·개발 명령

- API dev server: run `npm run start:dev` in `apps/api` (port 3000). (API 개발 서버: `apps/api`에서 실행하며 3000번 포트를 사용합니다.)
- Web dev server: run `npm run dev -- --host 0.0.0.0` in `apps/web` (port 5173). (웹 개발 서버: `apps/web`에서 실행하며 5173번 포트를 사용합니다.)
- Workspace bootstrap: `npm install` at repo root once workspaces exist. (워크스페이스 초기화: 루트에서 `npm install`을 실행합니다.)
- Docker stack: `docker compose up --build` from root. (도커 스택: 루트에서 `docker compose up --build`를 실행합니다.)
- Lint check: `npm run lint` (runs ESLint across workspaces). (린트 점검: `npm run lint`로 전체 워크스페이스 ESLint를 실행합니다.)
- Format check: `npm run format:check` / auto-fix with `npm run format`. (포맷 검사: `npm run format:check`, 자동 정리는 `npm run format`을 사용합니다.)

## Coding Style & Naming Conventions / 코딩 스타일 및 네이밍 규칙

- TypeScript-first with 2-space indentation. (TypeScript를 사용하며 기본 들여쓰기는 2칸입니다.)
- NestJS layout: `*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/`, `entities/`; classes PascalCase, instances camelCase. (NestJS 모듈 구조를 따르며 클래스는 PascalCase, 인스턴스는 camelCase를 사용합니다.)
- React components PascalCase (`ProductTable.tsx`), hooks camelCase (`useProducts.ts`). (React 컴포넌트는 PascalCase, 훅은 camelCase로 작성합니다.)
- Apply repo lint/format presets (`eslint`, `prettier`) once defined in `packages/config`. (`packages/config`에 정의된 린트·포매터 설정을 커밋 전에 적용합니다.)

## Testing Guidelines / 테스트 가이드라인

- API: Jest for unit/e2e; place specs in `apps/api/test` or alongside modules as `*.spec.ts`. (API 테스트는 Jest를 사용하며 `apps/api/test` 또는 모듈 옆에 `*.spec.ts`로 배치합니다.)
- Web: Vitest + Testing Library with component co-location (`Component.test.tsx`). (웹 테스트는 Vitest와 Testing Library를 사용하고 컴포넌트 인근에 `Component.test.tsx`로 둡니다.)
- Use scenario-driven names (`should update remain when outbound recorded`) and prioritize inventory math & notification coverage. (시나리오 기반 명명 규칙을 사용하고 재고 계산 및 알림 로직 커버리지를 우선합니다.)

## Commit & Pull Request Guidelines / 커밋 및 PR 가이드라인

- Commit messages: present-tense imperative (`Add product remain calculator`); keep related changes together. (커밋 메시지는 현재 시제 명령형을 사용하고 관련 변경을 묶습니다.)
- PR checklist: summary, local test evidence (`npm test`, `docker compose up`), linked issues, UI screenshots for UX changes. (PR에는 요약, 테스트 결과, 관련 이슈, UI 변경 시 스크린샷을 포함합니다.)
- Confirm lint/tests pass and document schema/env updates in PR body. (PR 전 린트·테스트 통과를 확인하고 스키마나 환경변수 변경을 본문에 기록합니다.)

## Security & Configuration Tips / 보안 및 설정 팁

- Never commit secrets; rely on `.env.example` (root, `apps/api/.env.example`). (비밀정보는 커밋하지 말고 `.env.example`을 참고해 공유합니다.)
- Rotate Telegram tokens, keep them masked in logs/PRs. (텔레그램 토큰은 주기적으로 교체하고 로그·PR에서 마스킹합니다.)
- After schema updates run `npx prisma migrate dev`; include generated artifacts in PR. (스키마 변경 후 `npx prisma migrate dev`를 실행해 생성물과 명령을 PR에 포함합니다.)
