# 상품 재고관리 앱 — 개발 구조 · API 규격 · 실행 계획

버전: v1.0  
작성자: Steve Kim

---

## 1) 리포지토리/폴더 구조 (모노레포 권장)

```text
inventory-app/
├─ apps/
│  ├─ api/                         # NestJS (Express) 백엔드
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ common/                # 공통: filters, pipes, interceptors, guards
│  │  │  ├─ config/                # env, config modules
│  │  │  ├─ auth/                  # JWT, guards, strategies
│  │  │  ├─ users/                 # 사용자/권한
│  │  │  ├─ products/              # 제품(안전재고 포함)
│  │  │  ├─ inbounds/              # 입고
│  │  │  ├─ outbounds/             # 출고
│  │  │  ├─ returns/               # 반품
│  │  │  ├─ dashboard/             # 요약/통계
│  │  │  ├─ settings/notifications # 텔레그램/슬랙/이메일 설정
│  │  │  ├─ alerts/                # 재고부족 알림 로직 + 로그
│  │  │  ├─ uploads/               # Excel/CSV 업로드(입고/출고)
│  │  │  └─ prisma/                # schema.prisma, migrations
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ test/                     # e2e/unit
│  │  ├─ .env.example
│  │  └─ Dockerfile
│  └─ web/                         # React + TS + Vite + Tailwind
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ routes/             # 라우팅: dashboard, products, inbounds...
│     │  │  ├─ hooks/
│     │  │  ├─ store/              # Zustand
│     │  │  └─ utils/
│     │  ├─ components/
│     │  │  ├─ ui/                 # 버튼/모달/테이블/배지 등
│     │  │  ├─ icons/              # lucide-react 매핑
│     │  │  └─ charts/
│     │  ├─ styles/                # Tailwind + tokens
│     │  └─ assets/
│     ├─ public/
│     ├─ index.html
│     └─ vite.config.ts
├─ packages/
│  ├─ types/                       # 공유 타입 (ts)
│  ├─ ui/                          # 공용 UI 컴포넌트(선택)
│  └─ config/                      # ESLint, tsconfig 등 공통 설정
├─ infra/
│  ├─ docker-compose.yml           # api, web, db(postgres), nginx
│  ├─ nginx/
│  │  └─ default.conf
│  └─ k8s/                         # 선택: 배포 매니페스트
├─ scripts/                        # seed, migration, backup 등
├─ docs/                           # PRD, OpenAPI, 아키텍처 다이어그램
└─ .env.example
```

**환경변수(.env 예시)**

- API: `DATABASE_URL`, `JWT_SECRET`, `ALERT_COOLDOWN_MINUTES`, `QUIET_HOURS=22-07` (텔레그램은 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 선택 입력 또는 UI에서 등록)
- WEB: `VITE_API_BASE_URL`

---

## 2) API 규격 (OpenAPI 3.1 요약)

> 베이스 URL: `/api/v1` — 인증: `Bearer <JWT>` (내부 사용자 전용)

```yaml
openapi: 3.1.0
info:
  title: Inventory App API
  version: 1.0.0
servers:
  - url: /api/v1
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  parameters:
    PageParam:
      name: page
      in: query
      schema: { type: integer, minimum: 1, default: 1 }
    SizeParam:
      name: size
      in: query
      schema: { type: integer, minimum: 1, maximum: 200, default: 20 }
  schemas:
    ApiError:
      type: object
      properties:
        code: { type: string }
        message: { type: string }
        details: { type: object, nullable: true }
    Page:
      type: object
      properties:
        page: { type: integer }
        size: { type: integer }
        total: { type: integer }
    Role:
      type: string
      enum: [admin, operator, viewer]
    Permission:
      type: object
      properties:
        resource:
          { type: string, enum: [dashboard, products, inbounds, outbounds, returns, settings] }
        read: { type: boolean }
        write: { type: boolean }
    User:
      type: object
      properties:
        id: { type: string }
        email: { type: string, format: email }
        name: { type: string }
        role: { $ref: '#/components/schemas/Role' }
        permissions:
          type: array
          items: { $ref: '#/components/schemas/Permission' }
    Product:
      type: object
      required: [code, name]
      properties:
        id: { type: string }
        code: { type: string }
        name: { type: string }
        description: { type: string, nullable: true }
        safetyStock: { type: integer, default: 0, minimum: 0 }
        totalIn: { type: integer, default: 0 }
        totalOut: { type: integer, default: 0 }
        totalReturn: { type: integer, default: 0 }
        remain: { type: integer, default: 0 }
        status: { type: string, enum: [normal, warn, low] }
    Inbound:
      type: object
      required: [productId, quantity, dateIn]
      properties:
        id: { type: string }
        productId: { type: string }
        quantity: { type: integer, minimum: 1 }
        dateIn: { type: string, format: date }
        note: { type: string, nullable: true }
    Outbound:
      type: object
      required: [productId, quantity, dateOut]
      properties:
        id: { type: string }
        productId: { type: string }
        quantity: { type: integer, minimum: 1 }
        dateOut: { type: string, format: date }
        note: { type: string, nullable: true }
    Return:
      type: object
      required: [productId, quantity, dateReturn, reason]
      properties:
        id: { type: string }
        productId: { type: string }
        quantity: { type: integer, minimum: 1 }
        dateReturn: { type: string, format: date }
        reason: { type: string }
        status: { type: string, enum: [pending, completed], default: pending }
    DashboardSummary:
      type: object
      properties:
        totals:
          type: object
          properties:
            totalProducts: { type: integer }
            totalIn: { type: integer }
            totalOut: { type: integer }
            totalReturn: { type: integer }
        lowStock:
          type: array
          items: { $ref: '#/components/schemas/Product' }
    TelegramSettings:
      type: object
      properties:
        enabled: { type: boolean }
        botToken: { type: string, writeOnly: true }
        chatIds:
          type: array
          items: { type: string }
        cooldownMinutes: { type: integer, default: 60 }
        quietHours: { type: string, example: '22-07' }
security:
  - bearerAuth: []
paths:
  /auth/login:
    post:
      summary: 로그인
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email: { type: string, format: email }
                password: { type: string, minLength: 6 }
      responses:
        '200':
          description: JWT 토큰
          content:
            application/json:
              schema:
                type: object
                properties:
                  accessToken: { type: string }
        '401':
          {
            description: 인증 실패,
            content: { application/json: { schema: { $ref: '#/components/schemas/ApiError' } } },
          }

  /users:
    get:
      summary: 사용자 목록
      parameters:
        [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/SizeParam' },
        ]
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/User' } }
                  page: { $ref: '#/components/schemas/Page' }
    post:
      summary: 사용자 생성(내부)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, name, role]
              properties:
                email: { type: string, format: email }
                name: { type: string }
                role: { $ref: '#/components/schemas/Role' }
                permissions:
                  type: array
                  items: { $ref: '#/components/schemas/Permission' }
      responses: { '201': { description: created } }

  /products:
    get:
      summary: 제품 목록 (검색/필터)
      parameters:
        - { name: q, in: query, schema: { type: string } }
        - { $ref: '#/components/parameters/PageParam' }
        - { $ref: '#/components/parameters/SizeParam' }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Product' } }
                  page: { $ref: '#/components/schemas/Page' }
    post:
      summary: 제품 생성
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [code, name]
              properties:
                code: { type: string }
                name: { type: string }
                description: { type: string }
                safetyStock: { type: integer, minimum: 0, default: 0 }
      responses: { '201': { description: created } }

  /products/{id}:
    get:
      {
        summary: 제품 상세,
        responses:
          {
            '200':
              {
                content: { application/json: { schema: { $ref: '#/components/schemas/Product' } } },
              },
          },
      }
    patch:
      summary: 제품 수정(안전재고 포함)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                description: { type: string }
                safetyStock: { type: integer, minimum: 0 }
    delete: { summary: 제품 삭제, responses: { '204': { description: deleted } } }

  /inbounds:
    get:
      summary: 입고 목록
      parameters:
        [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/SizeParam' },
          { name: productId, in: query, schema: { type: string } },
        ]
      responses: { '200': { description: ok } }
    post:
      summary: 입고 등록
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Inbound' }
      responses: { '201': { description: created } }

  /outbounds:
    get: { summary: 출고 목록, responses: { '200': { description: ok } } }
    post:
      summary: 출고 등록
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Outbound' }
      responses: { '201': { description: created } }

  /returns:
    get: { summary: 반품 목록, responses: { '200': { description: ok } } }
    post:
      summary: 반품 등록
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/Return' }
      responses: { '201': { description: created } }
    patch:
      summary: 반품 처리 상태 변경
      parameters: [{ name: id, in: query, required: true, schema: { type: string } }]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                status: { type: string, enum: [pending, completed] }
      responses: { '200': { description: updated } }

  /dashboard/summary:
    get:
      summary: 대시보드 요약
      responses:
        '200':
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DashboardSummary' }

  /settings/notifications/telegram:
    get:
      {
        summary: 텔레그램 설정 조회,
        responses:
          {
            '200':
              {
                content:
                  {
                    application/json: { schema: { $ref: '#/components/schemas/TelegramSettings' } },
                  },
              },
          },
      }
    put:
      summary: 텔레그램 설정 저장
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/TelegramSettings' }
      responses: { '200': { description: ok } }

  /alerts:
    get:
      summary: 재고부족 알림 로그
      parameters:
        [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/SizeParam' },
        ]
      responses: { '200': { description: ok } }
  /alerts/test:
    post:
      summary: 테스트 알림 발송(관리자만)
      responses: { '200': { description: sent } }

  /uploads/inbounds:
    post:
      summary: 입고 Excel/CSV 업로드
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses: { '202': { description: accepted (비동기 처리) } }

  /uploads/outbounds:
    post:
      summary: 출고 Excel/CSV 업로드
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file: { type: string, format: binary }
      responses: { '202': { description: accepted } }
```

---

## 3) DB 개요 (Prisma/SQL 기준)

- `users(id, email, name, role, password_hash, created_at, disabled)`
- `permissions(id, user_id, resource, read, write)`
- `products(id, code UNIQUE, name, description, safety_stock, total_in, total_out, total_return, remain, status)`
- `inbounds(id, product_id, quantity, date_in, note)`
- `outbounds(id, product_id, quantity, date_out, note)`
- `returns(id, product_id, quantity, date_return, reason, status)`
- `alerts(id, product_id, level, message, sent_at, channel, dedup_key)`
- `notification_settings(id, telegram_enabled, telegram_cooldown_min, telegram_quiet_hours, created_by)`
- `telegram_targets(id, chat_id, label, enabled)`
- `upload_jobs(id, type IN('inbound','outbound'), status, created_by, created_at, finished_at)`
- `upload_job_items(id, job_id, row_no, payload_json, status, error_msg)`

인덱스: `products(code)`, `inbounds(product_id, date_in)`, `outbounds(product_id, date_out)`, `alerts(product_id, sent_at DESC)`

---

## 4) 실행 계획 (3주 스프린트)

### 스프린트 1 — 백엔드 핵심 도메인 (CRUD + 상태계산 + JWT)

- [x] Prisma 스키마/마이그레이션, 시드 데이터
- [x] Auth(Login)/Users/Permissions API
- [x] Products/Inbounds/Outbounds/Returns CRUD + remain/status 계산
- [x] Dashboard Summary API
- [x] 텔레그램 설정 API(저장/조회), 테스트 발송 API
- [x] 알림 서비스(쿨다운/심야 억제/재시도) 스켈레톤
- [x] 유닛 테스트(도메인 로직), e2e 로그인/제품

### 스프린트 2 — 프런트엔드 & 알림/업로드 (운영 가능 목표)

- [x] React 레이아웃(사이드바·상단바), 테이블/카드/모달
- [x] 제품/입고/출고/반품 화면 + 모바일 풀스크린 모달
- [x] 대시보드(부족품목 배너 + 차트)
- [x] 텔레그램 설정 UI + 테스트 발송
- [x] Excel/CSV 업로드(비동기 Job) + 결과 리포트 UI
- [x] 알림 발송 워커(쿨다운·심야·로그)

### 스프린트 3 — 하드닝 & 배포

- [x] 권한 세분화(리소스별 읽기/쓰기) UI/가드 적용
- [x] 감사/오류 로깅, 헬스체크, 레이트 리밋
- [x] 도커/리버스 프록시/nginx 설정, .env 체계화
- [x] 운영 체크리스트(백업, 모니터링, 장애 대응)
- [x] 문서화(README, .env.example, OpenAPI Export)

**Definition of Done**

- OpenAPI 문서화 & e2e 테스트 그린
- 모바일 브레이크포인트(≤360px) UI 검증
- 텔레그램 실발송 테스트 통과 + 알림 로그 확인
- 업로드 템플릿 성공/실패 리포트 확인

**리스크/완화**

- 업로드 대용량: 비동기 Job + 스트리밍 파싱(csv-parse)
- 텔레그램 토큰 보안: .env + Secrets Manager, 로그 마스킹
- 권한 가드: e2e 시나리오 테스트로 검증
