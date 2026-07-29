# 먹메이트 (MukMate)

전북대 덕진구 생활권 학생들을 위한 공동주문 매칭 모바일 웹 서비스. 최소주문금액·배달비 부담을 가까운 학생끼리 나눌 수 있게 모집·참여·채팅을 연결한다. **전체 요구사항의 단일 소스는 `docs/PRD.md`(v2.1)다.** 기능 작업 전 관련 장을 먼저 확인한다.

## 개발 계획 (`docs/DEV_PLAN.md`)

실제 개발은 **의존성 순서로 정리된 `docs/DEV_PLAN.md` 체크리스트를 따른다** (PRD 15장 Day 구분은 캘린더 기준, DEV_PLAN은 "무엇이 무엇보다 먼저 되어야 하는가" 기준 — 함께 참고).

- **작업을 완료하면 그 자리에서 즉시 `docs/DEV_PLAN.md`의 해당 `- [ ]`를 `- [x]`로 갱신한다.** 다음 작업으로 넘어가기 전에 반드시 반영한다.
- 상태 판단이 애매하거나 여러 항목을 한 번에 점검하고 싶으면 `/dev-plan` 스킬을 호출한다 — 코드 상태를 스캔해 체크박스를 갱신하고 막힌 항목을 보고한다.
- Phase 순서(0 프로젝트 기반 → 1 DB 스키마 → 2 인증 → 3 공동주문 코어 → 4 참여 승인 → 5 채팅 → 6 마이페이지 → 7 P1 선택 → 8 프로덕션 검증)를 건너뛰지 않는다. 뒤 Phase가 앞 Phase 없이 동작하면 권한 검사 등이 누락될 위험이 크다.

## 기술 스택 (PRD 10장)

- **웹 프레임워크**: Next.js 16 (App Router), React 19, TypeScript
- **DB**: Neon DB (PostgreSQL), Vercel Marketplace 연동으로 생성 — `DATABASE_URL`은 pooled, Vercel이 자동 관리
- **ORM**: Drizzle ORM (구현 완료)
- **배포**: Vercel
- **장소/지도**: 네이버 지역 검색 API · NAVER Maps API (서버 프록시 경유 필수)
- **인증**: Auth.js(NextAuth) Credentials + bcrypt
- **스타일**: Tailwind CSS v4 + shadcn/ui (주황/화이트 톤)
- **채팅 갱신**: WebSocket 미사용, 폴링(2~3초 간격) 방식만 사용
- **패키지 매니저**: pnpm (설정은 `pnpm-workspace.yaml` — `overrides`, `allowBuilds` 참고. `package.json`의 `pnpm` 필드는 최신 pnpm에서 더 이상 읽지 않아 제거됨)

## 프로젝트 구조

```
app/
  (auth)/login, signup, onboarding   — 비로그인 진입 화면
  (main)/pots, pots/[id], chat, my   — 로그인 후 하단 내비게이션 화면
components/
  ui/            — shadcn 프리미티브
  pots/          — 공동주문 목록/상세 카드
  bottom-nav.tsx, app-header.tsx, status-badge.tsx, mobile-frame.tsx 등 공통 UI
lib/
  types.ts       — 도메인 타입 (Pot, Participation, ChatRoom, Message, Place, User 등)
  api.ts         — 데이터 접근 레이어. 컴포넌트는 이 함수만 호출하고 mock-data를 직접 import하지 않는다
  mock-data.ts   — 현재 lib/api.ts가 반환하는 목데이터 (실제 DB 연동 시 대체 대상)
  format.ts, constants.ts, utils.ts
docs/PRD.md      — 요구사항 원문 (v2.1)
```

**데이터 연동 원칙**: `lib/api.ts`의 각 함수는 `TODO: replace with real API call` 주석과 함께 목데이터를 반환 중이다. 실제 연동 시 **함수 시그니처는 유지한 채 내부 구현만 실제 `fetch`로 교체**한다 — 컴포넌트 쪽 코드는 건드릴 필요가 없어야 한다.

## 데이터 모델 요약 (PRD 11장 — 전체 SQL은 PRD 참고)

| 테이블 | 핵심 컬럼 |
|---|---|
| `zones` | `code`(PK), `label`, `sort_order` — 활동 지역 코드 테이블 |
| `users` | `login_id`(UNIQUE), `password_hash`, `nickname`, `zone_code` |
| `pots` | `host_id`, `zone_code`, `store_*`(name/address/lat/lng), `order_summary`, `target_type`(HEADCOUNT\|AMOUNT), `target_value`, `delivery_fee`, `deadline_at`, `pickup_at`, `pickup_*`, `status`(OPEN→CLOSED→ORDERED, 또는 CANCELED) |
| `participations` | `pot_id`, `user_id`, `apply_message`, `menu_amount`, `approval_status`(PENDING\|APPROVED\|REJECTED), `(pot_id, user_id)` UNIQUE |
| `chat_rooms` | `type`(ORDER\|COMMUNITY), `pot_id`(ORDER일 때만) |
| `messages` | `id` bigserial(폴링 커서), `room_id`, `sender_id`(SYSTEM이면 NULL), `type`, `content`, `created_at` |

금액은 전부 `integer`(원), 시간은 전부 `timestamptz`. 계좌 등 금융정보 컬럼은 두지 않는다.

## API 엔드포인트 맵 (PRD 11-3)

| 경로 | 권한 |
|---|---|
| `POST /api/auth/signup`, `GET /api/auth/check-id`, `POST/그 외 /api/auth/login`\|`logout` | 공개 |
| `PATCH /api/me`, `PATCH /api/me/password` | 본인만 |
| `GET /api/pots`, `GET /api/pots/:id` | 공개 |
| `POST /api/pots` | 로그인 |
| `PATCH /api/pots/:id` | **모집자만** |
| `POST /api/pots/:id/applications` | 로그인 |
| `PATCH /api/applications/:id` | **모집자만** |
| `GET /api/places/search?q=` | 로그인 (네이버 API 서버 프록시) |
| `GET /api/rooms`, `GET/POST /api/rooms/:id/messages` | **참여자만**(ORDER) / 로그인 사용자(COMMUNITY) |

세부 권한 판단 로직은 `permission-matrix` 스킬 참고.

## 화면 · 내비게이션 (PRD 6장, 13개 화면)

하단 내비게이션 3탭 `공동주문 · 채팅 · 마이`을 로그인 후 모든 화면에서 동일 위치에 유지. 상세 화면 목록·디자인 톤(주황/화이트, 375~430px, 터치 타깃 44px+)은 `screen-tone` 스킬 참고.

## 절대 원칙

- DB 읽기/쓰기는 서버(Route Handler / Server Action)에서만 수행한다. 클라이언트에서 직접 DB·네이버 API를 호출하지 않는다.
- 비밀번호는 bcrypt 해시로만 저장한다. 계좌번호 등 금융정보는 어떤 테이블에도 저장하지 않는다.
- 권한 검사(모집자 전용, 승인된 참여자 전용)는 매 API 요청마다 서버에서 수행한다. UI에서 버튼을 숨기는 것으로 대체하지 않는다 — URL 직접 입력 접근도 막아야 한다.
- DB 연결 문자열, 네이버 API Client Secret은 코드에 하드코딩하지 않고 Vercel 환경변수(`NEXT_PUBLIC_` 접두사 없이)로만 관리한다.
- 시간은 `timestamptz`로 저장하고 KST 기준으로 표시한다.
- 채팅은 WebSocket 대신 폴링만 쓰고, 마감 시각 판정은 크론 없이 조회 시점에 계산한다 (PRD 10-3).
- 결제·송금·실시간 위치 추적·학교 인증·비밀번호 재설정 등은 만들지 않는다 (PRD 12장 "하지 않을 것" 전체 목록 참고).

## 개발 명령어

```
pnpm dev      # 개발 서버
pnpm build    # 프로덕션 빌드 (next.config.mjs에서 타입 에러는 무시하도록 설정되어 있어 런타임 오류를 별도로 확인해야 함)
pnpm lint
```

## 서브에이전트 (`.claude/agents/`)

작업 영역에 맞는 전문 에이전트가 구성되어 있고, 각자 관련 프로젝트 스킬을 프리로드한다.

- `db-schema` — Neon/Drizzle 스키마·마이그레이션·커넥션 풀링 (`db-migrate`, `permission-matrix`)
- `api-backend` — Route Handler/Server Action, Auth.js 인증, 서버 권한 검사 (`auth-setup`, `permission-matrix`)
- `naver-places` — 네이버 지역 검색·Maps API 서버 프록시, 거리 계산 (`naver-proxy`, `permission-matrix`)
- `chat-polling` — 주문 채팅·커뮤니티 채팅 폴링 로직 (`chat-polling-pattern`, `permission-matrix`)
- `mobile-ui` — Tailwind/shadcn 기반 13개 화면 UI 구현 (`screen-tone`)
- `vercel-deploy` — Vercel 배포, 환경변수, 빌드/런타임 트러블슈팅 (`mukmate` 플러그인의 `/mukmate:deploy`·`/mukmate:vercel-env`·`/mukmate:vercel-check` + 공식 `vercel` 플러그인 활용)

## 진단용 스킬

- `/dev-plan` — `docs/DEV_PLAN.md` 체크리스트를 코드 상태와 동기화 (완료 항목 체크, 의존성 위반 경고)
- `/mvp-checklist` — PRD 13장 완료 기준을 코드/DB 실제 상태와 대조해 점검
- `/sprint-day [N]` — PRD 15장 Day N 목표 대비 진행 상황 점검, 일정 초과 시 축소 우선순위 안내
- `/mukmate:deploy`, `/mukmate:vercel-env`, `/mukmate:vercel-check` — 먹메이트 전용 배포/환경변수/상태 점검 (`mukmate@skills-dir` 플러그인, `.claude/skills/mukmate/`)

## Vercel 플러그인 (2종 — 이름 충돌 없이 공존)

- **`vercel@claude-plugins-official`** (user scope, 이미 설치됨) — 범용 Vercel/Next.js 전문 지식. `/vercel:deploy`, `/vercel:env`, `/vercel:status`, `/vercel:bootstrap`, `/vercel:nextjs`, `/vercel:shadcn`, `/vercel:vercel-storage`(Neon/Upstash 마켓플레이스 연동 포함) 등 다수. 일반적인 Vercel 작업은 이쪽을 우선 활용한다.
- **`mukmate@skills-dir`** (project scope, `.claude/skills/mukmate/`) — 먹메이트 PRD 기준 체크리스트가 들어간 프로젝트 전용 배포 스킬. 두 플러그인 모두 이름이 `vercel`이면 나중 등록된 쪽이 로드되지 않으므로, 이 플러그인은 이름을 `mukmate`로 지정해 충돌을 피했다.

## 현재 상태

- 프론트엔드: 화면 스캐폴딩(로그인/회원가입/온보딩, 공동주문 목록·상세, 채팅·마이 placeholder)까지 되어 있고 `lib/api.ts`가 `mock-data.ts`를 반환하는 프로토타입 단계.
- DB: **Neon 프로젝트 생성 완료(Vercel Marketplace 연동), 마이그레이션 적용 + zones/커뮤니티 채팅방 시드까지 완료.** `DATABASE_URL`은 Vercel이 자동 관리하며 로컬은 `vercel env pull`로 동기화한다 (직접 편집하지 않음).
- 인증/네이버 API 프록시/채팅 폴링 API: 아직 구현 전 (DEV_PLAN Phase 2~5) — 단, 필요한 환경변수(`NAVER_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET`)는 이미 등록되어 있어 코드 작성만 남았다.
- git: 저장소 초기화 완료, GitHub(`https://github.com/yellowm-ad/muk-mate`)에 push 완료.
- Vercel: CLI 로그인, `vercel link`(`muk-mate`, GitHub 자동 연동), 전체 환경변수(DB/네이버/NextAuth) 등록, **첫 프로덕션 배포까지 완료** — https://muk-mate-mu.vercel.app (아직 mock 데이터 프론트엔드).

다음 착수 지점: Phase 2(인증) — Auth.js Credentials + bcrypt 구현.
