# 작업 체크리스트 / Task Checklist

## 인프라 & 개발환경 / Infrastructure & Environment

- [x] 레포지토리 기본 폴더 구조 생성 (apps/api, apps/web, packages, infra 등)
- [x] Docker Compose 및 Nginx 프록시 설정 추가 (`infra/docker-compose.yml`, `infra/nginx/default.conf`)
- [x] NestJS 모듈 스캐폴딩 스크립트 작성 (`scripts/scaffold-nest-module.js`)
- [x] 워크스페이스 `package.json` 구성 및 의존성 설치
- [x] Prisma 초기 마이그레이션 생성 및 시드 스크립트 작성
- [x] ESLint/Prettier 등 공통 설정(`packages/config`) 정의

## 백엔드 / Backend (NestJS)

- [x] 진입 파일 기본 골격 생성 (`apps/api/src/main.ts`, `app.module.ts`)
- [x] Auth/Users/Permissions 모듈 스캐폴딩 및 주요 로직 구현
- [x] Products/Inbounds/Outbounds/Returns 모듈 CRUD 구현
- [x] Dashboard 요약 및 Alerts/Notifications 서비스 구현
- [x] 업로드(Excel/CSV) 처리 및 워커 구성
- [ ] 유닛/통합 테스트(Jest) 작성 및 `npm run test` 정비

## 프런트엔드 / Frontend (React/Vite)

- [x] 기본 진입 구조 작성 (`apps/web/src/main.tsx`, `index.html`, `vite.config.ts`)
- [x] 전역 레이아웃(사이드바/헤더) 및 라우팅 구성
- [x] 제품·입고·출고·반품 화면 UI/스토어 구현
- [x] 대시보드 차트 및 부족품목 배너 구현
- [x] 업로드 흐름 및 결과 리포트 UI 구현
- [ ] Vitest + Testing Library 설정 및 주요 화면 테스트 작성

## 문서 & 운영 / Documentation & Ops

- [x] PRD 요약 문서 작성 (`docs/prd-summary.md`)
- [x] 개발 과업 목록 정리 (`docs/development-tasks.md`)
- [x] 기여자 가이드라인(영문/국문 병기) 작성 (`AGENTS.md`)
- [x] 린트/포맷 검사 명령 문서화 및 적용
- [x] GitHub Actions CI (lint/format) 구성
- [x] OpenAPI 명세 최신화 및 `docs/` 내 배포 (`docs/openapi.yaml`)
- [x] 배포 가이드 문서화 (`docs/deployment.md`)
- [ ] README 및 환경 변수 가이드 정비
- [ ] 운영 체크리스트(백업, 모니터링, 장애 대응) 작성
