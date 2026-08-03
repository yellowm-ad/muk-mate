# 먹메이트 (MukMate)

전북대 덕진구 생활권 학생들을 위한 공동주문 매칭 모바일 웹 서비스. 전체 요구사항·근거는 **`docs/PRD.md` (v2.3)가 단일 소스**다 — 이 파일은 방향을 잡기 위한 요약이며, 세부 규칙은 아래 스킬 문서를 따른다.

## 지금 상태

Phase 0~7(`docs/SPRINT_PLAN.md`) 전부 완료 — DB(Neon)·인증·공동주문·카카오 장소 검색·채팅·마이페이지·프로덕션 검증까지 실제로 동작한다. 이후 Phase 7 완료 시점을 넘어선 추가 작업 2건이 더 들어갔다(`docs/SPRINT_PLAN.md`의 "Phase 7 이후" 절 참고).

- **완료**: Neon Postgres 연결(Vercel 마켓플레이스 프로비저닝, 무료 티어), Auth.js Credentials 회원가입/로그인, 공동주문 목록/상세/작성/참여/승인거절/상태전이, 화면 #7(참여 신청자 관리), 카카오 로컬 API 장소 검색, 폴링 채팅(주문 채팅 + 음식 커뮤니티), 마이페이지·정보수정·비밀번호 변경, **메시지/사용자 신고 기능**(PRD §17-3에서 "MVP 미구현"으로 정했던 항목인데 실제로 구현됨 — PRD가 아직 이 결정을 반영하지 못했었어서 문서를 갱신함), **참여 신청/승인 플로우 재구현**(FEAT-06: `/api/pots/:id/join`·`/members/:userId`·`/requests`)
- **2026-07-30 정리 완료**: 참여 신청·승인 로직이 `join`/`members`/`requests`(신규) 와 `participations`/`applications`(레거시) 두 벌로 공존하던 문제를 해결 — 레거시 API 라우트와 그걸 쓰던 죽은 코드(`lib/api.ts`의 `applyToPot`/`updateApplicationStatus`)를 삭제하고, "참여 신청자 관리" 화면(`pot-applications-view.tsx`)도 신규 `members` 경로로 옮겨 로직을 한 곳으로 통합했다. 마이그레이션 이력도 `npx drizzle-kit generate`로 `drizzle/0002_empty_martin_li.sql`을 다시 만들어 스키마 파일·실제 Neon DB·이력을 재동기화했고, 아무 코드도 안 쓰던 고아 마이그레이션(`migrations/006_join_approval.sql`, `decided_at`/`decided_by` 컬럼)은 제거하되 실제로 유용한 부분(대기 신청 목록 조회용 부분 인덱스 `idx_participations_pending`)은 `lib/db/schema.ts`에 정식으로 옮겨 적용했다.
- **2026-07-30 관리자 기능 신설(v2.3, PRD §17-4)**: `/admin` 경로에 관리자 권한 검증(`users.role`), 신고 처리(`/admin/reports` — 상태 변경·회원 정지 액션), 회원 제재(로그인·참여신청·모집글작성·채팅전송 전 경로에 실제 적용되도록 `accountStatus` 검사 확장), 모집글 직권 삭제(`/admin/pots`, 참여자/방장 조건 무시) 4개 기능을 구현·배포. 자세한 정의·로드맵·검증 기록은 `docs/ADMIN_FEATURES.md`·`docs/ADMIN_ROADMAP.md` 참고. 관리자 부여는 셀프서비스 없이 DB에서 직접 `role='ADMIN'`으로 처리.
- **남은 것**: 모집글 수정 화면(보류 중), P1 기능(Phase 6 — 거리 표시, 분담 금액)
- `lib/api.ts` — **클라이언트(브라우저) 전용** fetch() 함수만 있다. DB/인증을 직접 import하지 않는다 — 그러면 서버 전용 코드가 브라우저 번들에 끼어들어가 빌드가 깨진다.
- `lib/server-data.ts` — **서버 컴포넌트 전용** DB 조회 함수(`server-only` 패키지로 가드됨). 서버 컴포넌트(페이지)는 이 파일을, 클라이언트 컴포넌트는 `lib/api.ts`를 쓴다. 이 경계를 헷갈리면 안 된다.
- `lib/db/schema.ts` — 실제 Neon 스키마(Drizzle). PRD §11-2와 1:1 대응. 컬럼을 바꾸면 `drizzle-kit generate` → `db:push`까지 해야 반영된다.
- `lib/types.ts` — 클라이언트(mock 시절부터 있던) 도메인 타입. `lib/server-data.ts`가 DB 로우를 이 타입 모양으로 매핑해서 돌려준다.
- `lib/constants.ts` — 활동 지역(zone) 4권역이 이미 PRD §17-1의 제안대로 확정 적용됨: `GUJEONGMUN`(구정문) · `SINJEONGMUN`(신정문) · `DORM`(기숙사) · `SADAEBUGO`(사대부고 주변). 이 목록을 임의로 바꾸지 말 것 — 바꾸려면 PRD §17-1 결정을 먼저 갱신한다.
- 라우팅은 App Router 그룹으로 분리: `app/(auth)/` (로그인/회원가입/온보딩), `app/(main)/` (공동주문/채팅/마이 + 하단 내비 레이아웃), `app/admin/` (관리자 전용, `role==='ADMIN'` 아니면 `/login` 또는 `/pots`로 리다이렉트). `(main)` 전체는 로그인 세션이 없으면 `/login`으로 리다이렉트된다 — 게스트 접근 허용은 2026-07-30 한때 시도됐다가 같은 날 다시 닫혔다(v2.7, "로그인 상태 유지" 체크박스 도입과 함께).
- **"로그인 상태 유지" 체크박스(v2.7)**: NextAuth 세션 쿠키 자체는 30일 고정(콜백으로 로그인마다 다르게 줄 공식 방법이 없음)이라, 별도 가드 쿠키(`lib/auth-constants.ts`의 `mukmate_remember_guard`)로 흉내낸다 — 체크 시 30일 지속, 체크 해제 시 브라우저 세션 쿠키(종료 시 삭제)로 발급. `getCurrentUser()`/`getSessionUserOrNull()`이 NextAuth 세션 + 이 쿠키가 둘 다 있어야 로그인으로 인정한다.

## 기술 스택 (PRD §10-1, 확정)

Next.js (App Router) · Neon DB(PostgreSQL, HTTP 드라이버) · Vercel 배포 · Drizzle ORM · Auth.js(NextAuth) Credentials + bcrypt · 카카오 로컬 API (서버 프록시 경유) · Tailwind CSS · shadcn/ui.

## 절대 어기면 안 되는 제약 3가지 (PRD §10-3)

1. **채팅은 폴링만.** Vercel 서버리스에는 WebSocket/SSE 상시 연결이 맞지 않는다. 2-3초 간격 폴링, `messages.id`(bigserial) 커서 증분 조회.
2. **DB 커넥션은 반드시 pooled.** 직접 연결 문자열은 로컬에선 되다가 배포 후 커넥션 고갈로 500 에러가 난다.
3. **마감 시각 자동 처리는 크론 없이, 조회 시점 판정으로.** 별도 스케줄러를 만들지 않는다.

그리고 항상: 카카오 API는 서버(Route Handler)에서만 호출 — 클라이언트가 직접 부르면 REST API 키가 노출된다. 로그인은 Auth.js Credentials + bcrypt만 사용 — Clerk/Descope/Auth0/OAuth/SMS 인증은 이 프로젝트의 명시적 비목표다.

## 의사결정 우선순위 (PRD §18) — 애매하면 이 순서로 판단

1. 공동주문을 만들고 참여자를 모을 수 있는가?
2. 모집자가 참여자를 관리하고, 승인된 사람끼리 대화할 수 있는가?
3. 사용자가 자신의 주문 상태를 다시 확인할 수 있는가?
4. 모바일 웹에서 과정이 단순하고 빠른가?
5. 위 네 가지와 직접 관련 없는 기능은 미룬다 — 특히 결제/송금, 실시간 위치, AI 추천/매칭, 네이티브 앱, 평점/포인트, 학교 인증은 명시적 비목표(PRD §12)다.

## 개발 시 참고할 스킬/에이전트

`.claude/skills/`에 PRD 근거를 담은 참조 스킬 8개, `.claude/agents/`에 위임용 서브에이전트 4개가 이미 설정되어 있다 (DB 스키마, API 계약, 인증, 카카오 장소 검색 연동, 공동주문 상태전이, 채팅 폴링, 모바일 UI, 스코프 가드). 관련 작업을 할 때 해당 스킬이 자동으로 컨텍스트에 잡히며, 더 깊은 리뷰가 필요하면 동일 주제의 에이전트에 위임할 수 있다. 세부 규칙을 다시 찾아 헤매지 말고 이 스킬들을 먼저 확인할 것.

Vercel 공식 플러그인(`vercel-plugin`, 프로젝트 `.claude/settings.json`에 등록됨)도 Next.js/배포/env/shadcn 관련 범용 스킬을 제공한다. 단, 그 플러그인의 `auth` 스킬(Clerk 등 외부 인증 제공자)은 이 프로젝트에는 적용하지 않는다 — `mukmate-auth` 스킬을 따른다.

## 완료 기준

기능 하나를 "완료"로 보기 전에 PRD §13-1/13-2 체크리스트(서로 다른 두 계정으로 전체 플로우가 Vercel 프로덕션 URL에서 새로고침·재배포 후에도 동작하는지)를 기준으로 확인한다. 자세한 체크리스트는 `mukmate-mvp-scope-guard` 스킬 참고.
