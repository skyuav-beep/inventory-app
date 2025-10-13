# 배포 가이드 / Deployment Guide

## 개요

- 목적: 인벤토리 서비스(API, Web, Nginx, PostgreSQL)를 Docker 기반으로 배포하는 절차를 정리합니다.
- 범위: 개발·스테이징 환경 기준. 프로덕션 배포 시에는 보안 설정과 관측 도구를 추가해야 합니다.

## 사전 준비

- `.env` 파일 작성
  - `.env.example`을 복사하여 루트 `.env` 생성 후 필수 값을 채웁니다.
  - 필수 환경 변수
    - `DATABASE_URL` : PostgreSQL 접속 정보 (`postgres://user:pass@host:port/db`)
    - `JWT_SECRET` : JWT 서명 키
    - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` : 텔레그램 알림 설정 (선택)
    - `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` 등 시드 계정 정보
- Docker 및 Docker Compose 설치
- (선택) `npm install` 실행 후 Prisma 마이그레이션 및 시드 스크립트 준비

## 로컬/스테이징 배포 (`docker compose`)

```bash
cd infra
docker compose up --build
```

- 생성되는 서비스
  - `inventory-db` : PostgreSQL 15 (`localhost:5443`)
  - `inventory-api` : NestJS API (`http://localhost:3000` / Nginx 경유 시 `/api`)
  - `inventory-web` : Vite 개발 서버 (`http://localhost:5173`)
  - `inventory-nginx` : 리버스 프록시 (`http://localhost:8080`)
- 컨테이너 환경 변수는 `infra/docker-compose.yml`에 정의되어 있으며 필요 시 `.env` 값을 참조하도록 수정합니다.
- API 컨테이너는 dev 모드(`npm run start:dev`)로 실행되므로 hot-reload가 활성화됩니다.

### 데이터베이스 마이그레이션 및 시드

```bash
# 컨테이너 내부에서 실행 (api 컨테이너)
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

- 시드 스크립트가 마련되지 않았다면, 관리자 계정을 수동으로 생성해야 합니다.

### Nginx 프록시 구성

- `infra/nginx/default.conf`는 `/api` 경로를 API 컨테이너로, 그 외 경로를 웹 앱으로 전달합니다.
- 필요 시 TLS 설정을 추가하고, 정적 자산을 빌드하여 `/usr/share/nginx/html`로 제공하도록 수정합니다.

## 프로덕션 고려 사항

- 이미지를 미리 빌드하여 레지스트리에 푸시합니다.
  - API: `docker build -f apps/api/Dockerfile -t your-registry/inventory-api:TAG .`
  - Web: Vite 정적 빌드 후 Nginx 등으로 서빙 (`npm --workspace apps/web run build`)
- 인프라 환경에 맞춘 설정
  - 데이터베이스: 관리형 RDS 또는 HA 구성
  - 비밀 관리: `.env` 대신 Secret Manager/Kubernetes Secret 사용
  - 로깅/모니터링: CloudWatch, Prometheus 등 연동
  - 백업 및 장애 대응 시나리오 정의
- 네트워크 보안
  - 최소 포트만 오픈하고 TLS 인증서를 적용합니다.
  - 텔레그램 토큰 등 민감정보는 로그에 출력되지 않도록 주의합니다.

## 배포 후 점검 체크리스트

- [ ] API `/health` 혹은 기본 엔드포인트 응답 확인
- [ ] 관리자 로그인 및 주요 기능(제품 CRUD, 입출고 등록) 수동 테스트
- [ ] OpenAPI 명세(`docs/openapi.yaml`) 최신 여부 확인 및 공유
- [ ] 텔레그램 테스트 알림(`POST /alerts/test`) 발송 확인
- [ ] DB 백업 스케줄 및 모니터링 알림 설정 검증

