# 먹메이트 개발 계획 (실행 스크립트)

이 문서는 `docs/PRD.md`(요구사항)와 `CLAUDE.md`(원칙·구조)를 기준으로, **실제로 어떤 순서로 만들어야 막히지 않는지**를 정리한 실행 체크리스트다. PRD 15장의 Day 구분은 일정(캘린더) 기준이고, 이 문서는 **의존성(무엇이 무엇보다 먼저 되어야 하는가) 기준**이다. 두 문서는 서로 다른 축이며 함께 참고한다.

## 사용법

- 작업을 완료하면 즉시 해당 줄의 `- [ ]`를 `- [x]`로 바꾼다. 코드를 작성/수정한 세션이 그 자리에서 직접 문서를 갱신한다.
- 스스로 상태를 판단하기 애매하면 `/dev-plan` 스킬을 호출한다 — 코드 상태를 스캔해서 체크박스를 갱신하고 막힌 항목을 보고해준다.
- 각 항목에는 담당 에이전트/스킬을 `(→ agent)` 형식으로 표기했다. 해당 영역 작업은 그 에이전트에 위임하는 것을 우선 고려한다.
- Phase는 순서대로 진행하는 것이 원칙이다. 앞 Phase의 항목이 끝나지 않았는데 뒤 Phase로 넘어가면 `/dev-plan`이 의존성 위반으로 경고한다.
- 요구사항 ID(`AUTH-xx`, `ORDER-xx`, `CHAT-xx`, `MY-xx`)는 `docs/PRD.md` 8장 기준. 전체 완료 기준 검증은 `/mvp-checklist`, 일정 대비 진행률은 `/sprint-day`를 사용한다.

---

## Phase 0 — 프로젝트 기반 (선행 조건)

- [x] git 저장소 초기화 및 첫 커밋 (`git init`, `.gitignore`에 `.env.local` 포함 확인)
- [x] GitHub 원격 저장소 연결 및 push (`https://github.com/yellowm-ad/muk-mate`)
- [x] Vercel CLI 설치·로그인, `vercel link`로 프로젝트 연결 완료 (프로젝트 `muk-mate`, GitHub 저장소 자동 연동됨)
- [x] Neon 프로젝트 생성, **pooled connection string** 확보 (PRD 10-3②) — Vercel Marketplace 연동(`vercel integration add neon`)으로 생성, `DATABASE_URL`이 pooled(`-pooler` 호스트)로 자동 등록됨. `DATABASE_URL_UNPOOLED`도 별도 제공되나 앱에서는 사용하지 않음
- [x] ~~네이버 개발자센터/NCP 애플리케이션 등록~~ — **(v2.2) 카카오로 전환되어 폐기.** 네이버 지역 검색 API 키는 발급받아 등록했었으나 제거함 (아래 항목으로 대체)
- [ ] [카카오 개발자 콘솔](https://developers.kakao.com/console/app)에서 애플리케이션 등록 — **REST API 키**(로컬 장소 검색용, 서버 전용), **JavaScript 키**(카카오맵 SDK용, 클라이언트 노출 가능하나 플랫폼 설정에 도메인 등록 필요) 발급
- [x] 환경변수 설정: `NEXTAUTH_SECRET`(자동 생성) — 로컬 `.env.local` + Vercel Production/Preview/Development 전부 등록 완료 (`DATABASE_URL`은 Neon 연동으로 이미 등록됨)
- [ ] 환경변수 설정: `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_KAKAO_JS_KEY` — 카카오 키 발급 후 로컬 `.env.local` + Vercel 3개 환경에 등록 (→ `/mukmate:vercel-env`)
- [x] Vercel 첫 프로덕션 배포 완료 — https://muk-mate-mu.vercel.app (200 OK 확인, 아직 mock 데이터 프론트엔드)

## Phase 1 — 데이터베이스 스키마 (→ `db-schema` 에이전트, `db-migrate` 스킬)

- [x] Drizzle 설정 (`drizzle.config.ts`, pooled 드라이버 연결 — `@neondatabase/serverless` + `drizzle-orm/neon-http`)
- [x] PRD 11-2 기준 스키마 작성: `zones`, `users`, `pots`, `participations`, `chat_rooms`, `messages` (enum 5종 포함) — `lib/db/schema.ts`
- [x] 인덱스: `idx_pots_zone_status`, `idx_participations_user`, `idx_messages_room`
- [x] 마이그레이션 파일 생성 (`drizzle-kit generate` 완료, `lib/db/migrations/0000_lush_giant_girl.sql`, PRD 11-2와 대조 검증 완료)
- [x] **개발 DB에 마이그레이션 적용** — `drizzle-kit migrate`로 실제 Neon 개발 DB에 적용 완료 (`drizzle-kit push`는 이 환경에서 TTY 확인 프롬프트 때문에 비대화형 실행이 안 되어 `migrate`로 대체)
- [x] `zones` 시드 데이터 삽입 — `pnpm db:seed` 실행 완료, DB 조회로 4개 권역 확인
- [x] `chat_rooms`에 커뮤니티 고정방 2개 시드 — 실행 완료, DB 조회로 확인

## Phase 2 — 인증 (→ `api-backend` 에이전트, `auth-setup` 스킬)

- [ ] Auth.js Credentials Provider 설정
- [ ] `POST /api/auth/signup` — bcrypt 해시, 아이디 중복 거부 (AUTH-01, AUTH-02)
- [ ] `GET /api/auth/check-id` — 실시간 중복 확인
- [ ] 로그인/로그아웃 플로우 + 세션 유지 (AUTH-03, AUTH-05)
- [ ] `PATCH /api/me` — 닉네임·활동 지역 수정
- [ ] `PATCH /api/me/password` — 현재 비밀번호 확인 후 변경 (AUTH-06)
- [ ] `app/(auth)/login`, `signup`, `onboarding` 화면을 실제 API로 연결 (mock 제거)
- [ ] 비로그인 사용자 차단 미들웨어/가드 적용 (AUTH-04)

## Phase 3 — 공동주문 코어 (→ `api-backend` + `kakao-places` + `db-schema` 에이전트)

- [ ] `GET /api/pots` (zone/status 필터), `POST /api/pots` (작성) — ORDER-01, ORDER-02
- [ ] `GET /api/pots/:id` (상세)
- [ ] `PATCH /api/pots/:id` — **모집자만** 수정/상태 변경 (ORDER-05, ORDER-08, → `permission-matrix` 스킬)
- [ ] 마감 시각 조회 시점 판정 로직 적용 (PRD 10-3③ `CASE WHEN` 쿼리, ORDER-11)
- [ ] `GET /api/places/search` 카카오 로컬 API 프록시 구현 (→ `kakao-proxy` 스킬, ORDER-09) — `KAKAO_REST_API_KEY` 발급 선행 필요 (Phase 0)
- [ ] 장소·주소 검색 모달(화면 6)을 프록시에 연결, 지도 표시 시 카카오맵 SDK를 `NEXT_PUBLIC_KAKAO_JS_KEY`로 클라이언트 로드
- [ ] `app/(main)/pots`, `pots/[id]` 화면을 mock에서 실제 API로 교체 (`lib/api.ts` 내부만 교체, 시그니처 유지)

## Phase 4 — 참여 신청/승인 (→ `api-backend` 에이전트)

- [ ] `POST /api/pots/:id/applications` — 참여 메시지 포함 신청 (ORDER-03)
- [ ] `PATCH /api/applications/:id` — 모집자 승인/거절 (ORDER-04)
- [ ] 모집 마감 시 신규 신청 차단 (ORDER-06)
- [ ] 모집자 본인을 `participations`에 `APPROVED`로 자동 생성하는 로직
- [ ] 참여 신청자 관리 화면(화면 7) 구현

## Phase 5 — 채팅 (→ `chat-polling` 에이전트)

- [ ] `GET /api/rooms` — 내 채팅방 + 커뮤니티 고정방 (CHAT-05)
- [ ] `GET /api/rooms/:id/messages?after=` — 증분 조회, 권한 검사 선행 (CHAT-01, CHAT-02, → `permission-matrix`)
- [ ] `POST /api/rooms/:id/messages` — 메시지 전송 (CHAT-02, CHAT-03)
- [ ] `useChatPolling` 클라이언트 훅 — 2~3초 간격, 언마운트/탭 전환 시 인터벌 정리 (CHAT-06)
- [ ] 참여 승인 시 주문 채팅방이 즉시 노출되는 로직 연결
- [ ] 주문 채팅방 상단 고정 정보(가게명·수령 장소·수령 시각) 표시 (CHAT-07)
- [ ] `app/(main)/chat` 내 채팅 목록/주문 채팅방/커뮤니티 채팅방 화면을 mock에서 교체 (CHAT-04)

## Phase 6 — 마이페이지 (→ `api-backend` + `mobile-ui` 에이전트)

- [ ] 내가 만든 공동주문 / 참여한 공동주문 목록 API 연결, 상태 구분 표시 (MY-02, MY-03)
- [ ] 기본정보·비밀번호 수정 화면(화면 13) 연결 (MY-01)

## Phase 7 — P1 선택 기능 (P0 전부 완료 후에만 착수, PRD 15장 축소 우선순위 1순위 보존 대상)

- [ ] ORDER-10 — 위치 권한 허용 시 거리 표시 (브라우저 Geolocation, 클라이언트 일회성 계산, 서버 저장 금지)
- [ ] ORDER-12 — 참여자별 분담 금액 표시 (PRD 5-4 계산 규칙: 배달비만 인원 분할, 10원 단위 절상)

## Phase 8 — 프로덕션 검증 (→ `vercel-deploy` 에이전트)

- [ ] Vercel 프로덕션 배포 (→ `/mukmate:deploy`)
- [ ] `/mvp-checklist`로 PRD 13-1/13-2 항목 전수 점검
- [ ] 서로 다른 계정·기기 2대로 PRD 13-3 통합 테스트 (동시 접속, 실시간 갱신 체감 확인)
- [ ] 카카오 **REST API 키**가 브라우저 네트워크 탭에 노출되지 않는지 확인 (→ `/mukmate:vercel-check`) — `NEXT_PUBLIC_KAKAO_JS_KEY`는 노출되는 게 정상이므로 대상 아님

---

## 진행이 막혔을 때 (PRD 15장 일정 리스크)

일정이 밀리면 다음 순서로 잘라낸다: **화면 10·11(커뮤니티 채팅) → ORDER-10(거리 표시) → ORDER-12(분담 금액)**. Phase 0~6(P0 핵심 3기능)의 완결성이 화면 수·P1 기능보다 항상 우선한다.
