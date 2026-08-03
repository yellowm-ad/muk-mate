# 먹메이트 개발 계획 (Sprint Plan)

기준 문서: `docs/PRD.md` (v2.1), `CLAUDE.md`. 요구사항 ID(`AUTH-xx`, `ORDER-xx`, `CHAT-xx`, `MY-xx`)와 완료 기준(§13)은 전부 PRD 원문 기준이다.

## 이 문서 사용법

- 작업을 끝내면 `- [ ]` → `- [x]`로 바꾸고, 필요하면 항목 끝에 짧은 메모(막힌 이유, 임시 처리 내용 등)를 덧붙인다.
- 각 Phase는 **순서대로** 진행한다 — 상위 Phase의 완료 기준을 통과하기 전에 다음 Phase로 넘어가면 하위 계층(DB→API→화면) 없이 화면만 쌓이게 된다.
- 이미 구현된 화면이라도 **"mock" 표기가 있으면 실제 데이터 연동 전까지 완료가 아니다.** 체크박스는 실제 동작 기준이지 UI 존재 여부가 아니다.
- 이 문서는 캘린더 요일이 아니라 **의존성 순서**로 재배열했다. PRD §15의 Day는 참고용으로만 괄호 표기한다. 일정이 밀리면 PRD §15 축소 순서(커뮤니티 화면 → 거리표시 → 분담금액 순으로 자르기)를 따른다 — 자세한 내용은 `mukmate-mvp-scope-guard` 스킬 참고.
- 각 Phase 완료 시 "완료 기준" 항목까지 통과해야 다음으로 넘어간다.

## 진행 현황 요약

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 인프라 기반 (DB/배포/인증 골격) | ✅ 완료 |
| 1 | 계정 (AUTH) | ✅ 완료 (로그아웃 버튼 UI는 Phase 5로 이관) |
| 2 | 공동주문 핵심 (ORDER) | ✅ 완료 (모집글 수정 화면만 별도 보류) |
| 3 | 카카오 장소 검색 (ORDER-09) | ✅ 완료 |
| 4 | 채팅 (CHAT) | ✅ 완료 |
| 5 | 마이페이지 (MY) | ✅ 완료 |
| 6 | P1 선택 기능 | ☐ 시작 전 (P0 완결 후 필요 시) |
| 7 | 프로덕션 검증 & 완료 기준 | ✅ 완료 |
| 7+ | (계획 외) 신고 기능, 참여/승인 플로우 재구현(FEAT-06) | ✅ 완료 + 중복 코드 정리 완료 (2026-07-30, 신고 관리자 화면은 미착수) |

*(마지막 업데이트: 이 표는 Phase가 바뀔 때마다 함께 갱신한다.)*

---

## Phase 0 — 인프라 기반 (PRD Day 1 해당분)

목표: 이후 모든 Phase가 올라설 바닥. `mukmate-db-schema` 스킬 참고.

- [x] `drizzle-orm` + `@neondatabase/serverless` + `next-auth@beta` + `bcryptjs` + `drizzle-kit`/`tsx`/`dotenv-cli` 설치
- [x] `lib/db/schema.ts` 작성 — `mukmate-db-schema` 스킬의 DDL을 Drizzle 스키마로 변환 완료 (zones/users/pots/participations/chat_rooms/messages, ENUM 5종). `npx drizzle-kit generate`로 `drizzle/0000_watery_madripoor.sql` 생성 확인, PRD §11-2 DDL과 컬럼 단위로 일치
- [x] `lib/db/index.ts` — `@neondatabase/serverless` HTTP 드라이버 기반 클라이언트 (PRD §10-3② "pooled string 또는 HTTP 드라이버" 중 HTTP 드라이버 경로 채택 → pooled 여부 자체가 무의미해짐). **지연 초기화(lazy)로 구현** — `DATABASE_URL`이 없어도 `next build`/`next dev`는 정상 동작하고, 실제 쿼리 실행 시점에만 에러가 나도록 함 (처음엔 모듈 로드 시점에 즉시 throw하게 짰다가 `next build`가 깨지는 걸 확인하고 수정함)
- [x] Auth.js(NextAuth) 설치, Credentials Provider 골격 작성 (`auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`) — bcrypt 비교 로직까지 포함되어 있으나 실제 로그인 페이지 연동은 Phase 1에서 진행. `mukmate-auth` 스킬 기준대로 Clerk/Descope/Auth0 등 외부 제공자 사용 안 함
- [x] `scripts/seed.ts` 작성 — zones 4행 + 커뮤니티 고정방 2개 시드 스크립트 (`npm run db:seed`), 아직 실행은 안 함 (DB 없음)
- [x] `.env.example` 작성 (`DATABASE_URL`, `AUTH_SECRET`, `KAKAO_REST_API_KEY` — 원래 네이버 기준으로 작성했다가 이후 카카오로 전환, §Phase 3 참고)
- [x] `npx tsc --noEmit` + `npm run build` 통과 확인 (DB/외부 키 없는 현재 상태 기준)
- [x] Vercel CLI 설치 (devDependency, `npx vercel` 사용) + `vercel:login`/`link`/`env:pull`/`deploy`/`deploy:prod` npm 스크립트 추가
- [x] Vercel 프로젝트 연결 — 대시보드에서 GitHub 리포(`hyhys7/muk-mate`) 임포트로 `muk-mate` 프로젝트 생성. CLI 로그인(`vercel login`) 후 `vercel link --yes --project muk-mate`로 로컬 디렉토리 연결 완료 (`.vercel/project.json` 생성, `.gitignore`에 이미 포함되어 있어 커밋 안 됨)
- [x] **버그 발견 및 수정**: 실제 배포 2건이 전부 Error였음(`vercel ls`로 확인, 라이브 URL 404) — 원인은 리포에 남아있던 stale `pnpm-lock.yaml`을 Vercel이 감지해 pnpm으로 설치를 시도하면서 `ERR_PNPM_OUTDATED_LOCKFILE` 발생(npm으로 계속 패키지를 추가해왔기 때문에 pnpm-lock.yaml이 package.json과 불일치). pnpm은 애초에 로컬에 설치도 안 되어 있었고 npm이 실제 사용 중인 패키지 매니저였음 → `pnpm-lock.yaml` 삭제로 해결
- [x] 수정 후 `vercel deploy --prod`로 재배포, `READY` 상태 확인 — production alias `https://muk-mate.vercel.app`, `/` → 307(→`/pots` 리다이렉트), `/pots`·`/login` → 200 확인
- [x] Neon Postgres 프로비저닝 — Neon 계정 별도 가입 없이 **Vercel 마켓플레이스 연동**으로 처리 (`vercel integration add neon --plan free_v3 -m region=iad1 -m auth=false`). 요금제 **`free_v3`(무료 티어)** 명시적으로 선택, 리전은 Vercel 함수 실행 리전(iad1, 배포 로그 기준)과 맞춤, Neon 자체 Auth 기능은 비활성화(우리는 Auth.js Credentials만 사용). `DATABASE_URL` 등 16개 변수가 Production/Preview/Development 전 환경에 자동 등록되고 `.env.local`에도 자동 반영됨
- [x] **버그 발견 및 수정 (2)**: vercel-storage 스킬 경고에 따라 `lib/db/index.ts`의 JS `Proxy` 기반 지연 초기화를 일반 `getDb()` 함수로 교체 — Proxy로 감싸면 메서드 호출 시 `this`가 실제 drizzle 인스턴스가 아니라 빈 Proxy 타겟에 바인딩되어 Auth.js 연동에서 조용히 멈추는 사례가 보고되어 있음. `auth.ts`/`scripts/seed.ts`도 `getDb()` 호출로 갱신
- [x] `npm run db:push`로 Neon에 스키마 적용 완료 (6개 테이블 생성 확인), `npm run db:seed`로 zones 4건 + community chat_rooms 2건 시드 완료 (직접 쿼리로 값까지 확인)
- [x] `drizzle-kit`/`tsx`는 `.env.local`을 자동으로 안 읽으므로 `dotenv-cli` 도입, `db:push`/`db:studio`/`db:seed` 스크립트가 `.env.local`을 명시적으로 로드하도록 수정 (기존 `dotenv` 단독 패키지는 더 이상 안 쓰여서 제거)
- [x] `AUTH_SECRET` 생성(Node `crypto.randomBytes`) 후 Vercel Production/Preview/Development 전체에 등록, `.env.local`에도 반영
- [x] `vercel deploy --prod` 재배포 후 `/api/auth/session`(→ `null`, 정상) · `/api/auth/providers`(→ credentials provider 정상 노출) 라이브 확인 — Auth.js가 실제 Neon DB와 연결된 상태로 프로덕션에서 정상 동작

**완료 기준**: 빈 페이지라도 Vercel 프로덕션 URL에서 로드되고, 로컬에서 Neon DB에 쿼리 1건이 왕복 확인된다. → **Phase 0 완료.** (남은 건 Phase 3에서 발급할 카카오 API 키뿐)

---

## Phase 1 — 계정 (AUTH-01~07, 화면 #1~2)

목표: 로그인/회원가입 mock을 실제 동작으로 교체. `mukmate-auth`, `mukmate-api-contract` 스킬 참고.

- [x] `app/api/auth/signup` Route Handler — bcrypt 해시(`bcryptjs`), 길이 검증(아이디 4~10/비밀번호 4~16/닉네임 ≤12), 활동지역 존재 검증, `login_id` 중복 시 409 (AUTH-01, AUTH-02). DB 유니크 제약 위반(`23505`) 레이스 컨디션까지 방어
- [x] `app/api/auth/check-id` Route Handler — 회원가입 폼의 "중복확인" 버튼과 실제 연동
- [x] NextAuth Credentials 로그인 연결 (AUTH-03) — CSRF 토큰 발급 → 로그인 → 세션 조회 → 오답 비밀번호 거부까지 Node fetch 스크립트로 직접 검증
- [~] NextAuth 로그아웃 (AUTH-05) — `auth.ts`의 `signOut` 자체는 준비되어 있으나, 누를 수 있는 버튼 UI는 마이페이지(Phase 5)가 만들어질 때 추가 예정. 지금 체크하지 않는 이유: 실제로 로그아웃할 화면이 없음
- [x] `app/(auth)/signup/page.tsx` 제출 로직을 실제 `/api/auth/check-id`·세션스토리지 임시저장으로 교체
- [x] `app/(auth)/login/page.tsx` 제출 로직을 `next-auth/react`의 `signIn('credentials', ...)`으로 교체, 실패 시 에러 메시지 표시
- [x] **온보딩 통합 방식 결정**: signup(1단계: 아이디/비번/닉네임) + onboarding(2단계: 닉네임 확인/활동지역)을 **하나의 가입 마법사**로 취급 — signup 단계에서는 계정을 만들지 않고 `sessionStorage`에 임시 보관만 하다가, onboarding 마지막 단계("시작하기")에서 전체 4개 필드로 `POST /api/auth/signup` 1회 호출 → 성공 시 `signIn`으로 자동 로그인 → `/pots`. PRD §5-3이 4개 필드를 모두 "회원가입 필수 정보"로 못 박고 있어서, 중간에 반쪽짜리 계정이 생기지 않도록 이렇게 결정함. 이에 맞춰 `users.zone_code`도 스키마에서 nullable → **NOT NULL**로 수정(Neon 반영 완료)
- [ ] **[Phase 2/4로 이관]** 서버 세션 가드(AUTH-04) — 지금 시점엔 가드를 걸 대상(pots/신청/채팅 API)이 아직 없음(전부 Phase 2·4에서 생성 예정). `auth()` 헬퍼(`@/auth`)는 이미 준비되어 있고, 각 mutating 핸들러가 만들어질 때 그 안에서 `const session = await auth(); if (!session?.user) return 401` 패턴을 적용하기로 함
- [x] 로그인 유지 확인 — JWT 세션 전략이라 쿠키 기반으로 유지되는 구조 확인. `/api/auth/session` 재조회로 세션 유지 자체는 검증했으나, **브라우저 새로고침으로 직접 확인은 아직 안 함**(브라우저 자동화 도구가 이 환경에 연결되어 있지 않아 API 레벨로만 검증)

**완료 기준**: 서로 다른 두 계정으로 회원가입·로그인 가능, 중복 아이디 거부, 새로고침 후 세션 유지. (§13-1 관련 항목) → **핵심 로직은 검증 완료. AUTH-04는 의도적으로 Phase 2/4로 이관, 로그아웃 버튼은 Phase 5로 이관.**

---

## Phase 2 — 공동주문 핵심 (ORDER-01~09, 11, 화면 #3~5, #7)

목표: 목록/상세/작성 화면을 실제 DB에 연결하고, 신청자 관리 화면(현재 없음)을 신규 제작. `mukmate-pot-lifecycle`, `mukmate-api-contract` 스킬 참고.

- [x] **아키텍처 결정**: `lib/api.ts`가 서버 컴포넌트·클라이언트 컴포넌트 양쪽에서 import되고 있어서, 여기에 DB 접근 코드를 섞으면 Next.js가 서버 전용 코드(neon/drizzle/bcrypt)를 브라우저 번들에 끌고 가려다 빌드가 깨진다. → **`lib/server-data.ts`(서버 전용, `server-only` 패키지로 실수 방지)를 신설**해 서버 컴포넌트가 쓰는 조회(`listPots`/`getPotById`/`getParticipationsForPot`/`getCurrentUser`)를 옮기고, `lib/api.ts`는 브라우저 fetch() 함수만 남김
- [x] `app/api/pots` — GET(목록, zone/status 필터), POST(생성 + 호스트 자동 APPROVED 등록) 구현
- [x] `app/api/pots/:id` — GET(상세), PATCH(상태변경, **host만**, 상태전이 규칙 검증) 구현 (ORDER-05). **필드 수정(edit) 자체는 이번 Phase에서 보류** — 아래 참고
- [x] `app/api/pots/:id/participations` — POST(참여 신청, 메시지 포함) 구현 (ORDER-03). *(엔드포인트 경로는 PRD 표의 `/applications`가 아니라 기존 mock 스캐폴드의 TODO 주석이 이미 명시해 둔 `/participations`를 따름 — 동일 리소스, 이름만 다름)*
- [x] `app/api/applications/:id` — PATCH(승인/거절, **host만**) 구현 (ORDER-04), 이미 처리된 신청 재처리 방지
- [x] `lib/api.ts`의 각 함수 본문을 mock에서 위 API 호출로 교체
- [x] `pot-create-form.tsx` → 실제 저장 확인 (E2E로 생성 후 재조회까지 검증, 이제 새로고침해도 유지됨)
- [x] 마감 시각 자동 판정 적용 (ORDER-11) — SQL `CASE WHEN`이 아니라 조회 시점에 JS로 `computeEffectiveStatus()` 계산(같은 효과), 목록·상세·참여신청·상태변경 전부 이 함수를 공유
- [x] 중복 신청 방지 확인 — `UNIQUE(pot_id, user_id)` 위반 시 409. **버그를 하나 잡음**: drizzle의 neon-http 드라이버가 실제 Postgres 에러를 `DrizzleQueryError`로 감싸서 `.code`가 `err.code`가 아니라 `err.cause.code`에 있었음 — 처음엔 이걸 몰라서 중복 신청이 409 대신 500으로 새 나갔다가, `lib/db/index.ts`에 `getPgErrorCode()` 헬퍼를 추가해 해결
- [x] 호스트 자신도 `participations`에 APPROVED로 자동 등록 — E2E로 `currentCount`에 반영되는 것까지 확인
- [x] **신규 화면 #7 — 참여 신청자 관리** (`app/(main)/pots/[id]/applications/page.tsx` + `pot-applications-view.tsx`) 제작 — PENDING/APPROVED/REJECTED 구분 표시, 승인·거절, 모집 마감/완료/취소 상태전이 버튼까지 포함. 호스트가 아니면 상세 페이지로 리다이렉트
- [x] 상세 화면의 "참여 신청하기"를 실제 API 호출로 교체. **부수 발견**: 기존 UI에는 참여 메시지 입력창 자체가 없었음(ORDER-03이 요구하는데 스캐폴드에 누락) — 인라인 textarea 추가
- [x] **보안 수정**: 참여자 목록에서 PENDING/REJECTED 신청자의 메시지 등은 원래 클라이언트에서 `isHost` 조건부 렌더링으로만 숨겨져 있었음(누구나 페이지 데이터를 까보면 다 보임) — `getParticipationsForPot()`가 호스트가 아니면 서버에서부터 APPROVED만 반환하도록 수정
- [x] 로그인한 사용자만 `(main)` 구간에 접근하도록 페이지 레벨 가드 적용 (`getCurrentUser()`가 세션 없으면 `/login`으로 redirect) — Phase 1에서 미룬 AUTH-04의 페이지 보호 부분
- [~] 모집글 **수정(edit)** 플로우 — **의도적으로 보류**. 작성 폼의 마감시각 입력이 "지금부터 N분 후" 프리셋이라, 수정 화면에서 그대로 재사용하면 이미 정해진 절대 마감시각을 수정 시점 기준으로 다시 계산해버리는 문제가 있음 — 절대 시각을 어떻게 표시/입력할지 디자인 결정이 필요해서 별도 작업으로 분리. `PATCH /api/pots/:id`는 상태 변경만 지원

**완료 기준**: A가 모집글을 만들고, B가 신청하고, A가 승인/거절하면 그 결과가 새로고침 후에도 유지된다. (§13-1 관련 항목 다수) → **호스트/참여자/제3자 3개 계정으로 전체 플로우, 권한 거부(호스트 아님/이미 처리됨/마감 후 신청 등) 케이스까지 실제 Neon DB 대상 E2E 스크립트로 검증 완료.**

---

## Phase 3 — 카카오 장소 검색 (ORDER-09, 화면 #6)

목표: 자유 텍스트 입력을 실제 장소 검색으로 교체. `mukmate-kakao-places` 스킬 참고.

- [x] 카카오 디벨로퍼스 앱 등록 + REST API 키 발급(사용자 완료). **주의사항 하나 발견**: 2024-12부터 신규 앱은 발급만으로 안 되고 앱 설정에서 "카카오맵" 사용 설정을 별도로 ON 해야 로컬 API가 열림 — 처음엔 `NotAuthorizedError(OPEN_MAP_AND_LOCAL service disabled)`로 막혔다가 사용자가 대시보드에서 켠 뒤 정상화됨
- [x] `.env.local`/Vercel(Production/Preview/Development) 전체에 `KAKAO_REST_API_KEY` 등록
- [x] `app/api/places/search` Route Handler — 서버에서만 카카오 로컬 API(`GET https://dapi.kakao.com/v2/local/search/keyword.json`) 호출, `Authorization: KakaoAK {REST_API_KEY}` 헤더 사용, 로그인 필요, 장소명/주소/카테고리/위경도만 클라이언트에 반환 (원본 카카오 응답 그대로 안 넘김)
- [x] **신규 화면 #6 — 장소·주소 검색**을 다이얼로그로 제작(`components/pots/place-search-dialog.tsx`) — 손으로 새로 만들지 않고 프로젝트에 이미 있던 `@base-ui/react` 기반 shadcn 컨벤션을 따라 `npx shadcn add dialog`로 `components/ui/dialog.tsx`를 정식 추가한 뒤 그 위에 구현
- [x] `pot-create-form.tsx`의 가게명/수령장소 자유 텍스트 입력 + 프리셋 칩을 전부 제거하고 검색 다이얼로그 연동으로 교체 — PRD §5-1 표가 애초에 가게명은 "검색 결과에서 선택"이라고 못박고 있어서, 자유 입력을 아예 없애고 검색으로만 선택 가능하게 함 (수령 장소는 검색 선택 + `pickup_note` 자유 입력을 그대로 병행)
- [x] 검색 결과 선택 시 `store_lat/lng`, `pickup_lat/lng` 좌표까지 저장되는 것 확인 — **카카오 응답은 `x`=경도, `y`=위도**라 반대로 넣기 쉬운 함정이 있어서 `app/api/places/search/route.ts`에서 매핑할 때 주석으로 명시해둠. `isLocationVerified`가 실제로 `true`가 되는 것까지 E2E로 확인
- [x] `lib/types.ts`의 `Place` 타입에서 mock 시절 쓰던 `distanceMeters`(가짜 거리)를 제거하고 `lat`/`lng` 추가. `lib/mock-data.ts`의 `PLACES`/`FREQUENT_PICKUP_PLACES`/`RECENT_PLACE_KEYWORDS`(더 이상 쓰이지 않음)와 `lib/api.ts`의 `getPlaceSuggestions`(최근/자주 쓰는 장소 — PRD가 요구한 적 없는 mock 전용 기능이라 실 구현 없이 삭제)도 함께 정리

**완료 기준**: 브라우저 devtools Network 탭에 카카오 REST API 키가 노출되지 않고, 검색 결과로 가게/수령 장소를 선택해 모집글에 등록할 수 있다. → **E2E로 확인 완료**: 비로그인 검색 401, 로그인 후 검색 결과에 REST 키 미포함, 검색 결과로 만든 모집글의 `isLocationVerified=true`.

---

## Phase 4 — 채팅 (CHAT-01~07, 화면 #8~11)

목표: 현재 `TabPlaceholder`로 남아있는 채팅 탭을 실제 폴링 채팅으로 구현. `mukmate-chat-polling` 스킬 참고.

- [x] `app/api/rooms` — GET(내 채팅방 목록 + 커뮤니티 고정방) 구현. ORDER 방은 host도 자동 APPROVED 참여자라 별도 분기 없이 하나의 JOIN 조건으로 커버됨(Phase 2 설계가 여기서도 그대로 재사용됨)
- [x] `app/api/rooms/:id/messages` — GET(`after` 커서 기반 증분 조회), POST(메시지 전송) 구현
- [x] 모든 메시지 API에서 **서버측 참여자 검사** (ORDER 방은 host+APPROVED만, COMMUNITY 방은 로그인만) — CHAT-01. `lib/server-data.ts`의 `getRoomForViewer()`가 페이지(404)와 API(403) 양쪽에서 공유됨
- [x] `app/(main)/chat/page.tsx` 실제 구현 — `TabPlaceholder` 제거, "내 채팅"/"음식 커뮤니티" 탭 분리(PRD §5-2 원문 그대로: "채팅 탭은 내 채팅과 음식 커뮤니티로 구분한다")
- [x] **신규 화면 #9 — 주문 채팅방** (`app/(main)/chat/[id]/page.tsx` + `chat-room-view.tsx`) 제작 — 상단에 가게명·수령장소·수령시각 고정 표시 (CHAT-07)
- [x] 폴링 로직 구현 (2.5초 간격, `messages.id` 커서 기반 증분 조회) — 컴포넌트 언마운트(화면 이탈) 시 `clearInterval`로 정리, 추가로 탭이 백그라운드일 땐(`document.hidden`) 폴링 tick에서 fetch를 건너뛰어 불필요한 호출을 줄임
- [x] **화면 #10/#11 — 커뮤니티 목록/채팅방**: 별도 화면으로 분리하지 않고 §5-2/§11-2 설계 메모대로 목록은 "채팅" 탭의 서브탭으로, 채팅방은 주문 채팅과 **같은** `/chat/[id]` 라우트·컴포넌트를 재사용(하나의 `chat_rooms` 테이블로 통합한 원래 설계 의도)
- [x] 메시지에 닉네임+작성시각 표시, `login_id` 미노출 확인 (CHAT-03) — E2E로 응답 바디에 `login_id` 문자열이 전혀 없는 것까지 확인
- [x] SYSTEM 타입 메시지 지원 — 렌더링(중앙 정렬, 말풍선 없음)뿐 아니라 실제 이벤트에도 연동: 참여 승인 시(`PATCH /api/applications/:id`) "{닉네임}님이 참여했습니다.", 모집 상태 변경 시(`PATCH /api/pots/:id`) "모집이 마감되었습니다."/"주문이 완료되었습니다."/"공동주문이 취소되었습니다." 자동 삽입
- [x] **부수 작업**: Phase 2에서 놓쳤던 부분 발견 — 모집글 생성 시 그 주문의 `chat_rooms` 행 자체가 없었음(채팅 스키마는 Phase 0부터 있었지만 아무도 row를 안 만들고 있었음). `POST /api/pots`에서 호스트 참여자 등록 직후 ORDER 채팅방을 함께 생성하도록 추가 — `chat_rooms.pot_id`가 UNIQUE라 나중에 지연 생성하면 동시 요청 경쟁 문제가 생길 수 있어 모집글 생성과 원자적으로 묶음
- [x] mock 정리: `lib/mock-data.ts`의 `CHAT_ROOMS`/`MESSAGES`, `lib/api.ts`의 `getMyRooms`/`getRoom`(더 이상 안 쓰임 — 서버 컴포넌트는 `lib/server-data.ts`의 `listRoomsForUser`/`getRoomForViewer`를 직접 호출) 삭제

**완료 기준**: 승인된 사용자만 주문 채팅방에 들어갈 수 있고, 거절/미신청 계정은 URL을 직접 입력해도 403. 다른 사용자가 보낸 메시지가 새로고침 없이(폴링으로) 화면에 나타난다. (§13-1, §13-3 관련 항목) → **호스트/참여자(PENDING→APPROVED)/제3자 3개 계정으로 E2E 검증 완료**: 제3자·미승인 신청자 403(API)/404(페이지), 승인 후 200 전환, 호스트가 보낸 메시지를 참여자가 폴링으로 수신(`isMine=false` 정확히 계산), SYSTEM 메시지 자동 삽입, 커뮤니티 방은 전원 접근 가능 — 전부 확인.

---

## Phase 5 — 마이페이지 & 계정 관리 (MY-01~03, 화면 #12~13)

목표: 현재 stub인 마이페이지를 실제 데이터로 채우고, 정보 수정 화면을 신규 제작.

- [x] `app/(main)/my/page.tsx` 실제 구현 — `TabPlaceholder` 제거, "만든 공동주문"/"참여한 공동주문" 탭, 각 항목에 모집 상태(`PotStatusBadge`) + (참여한 경우) 내 승인 상태(`ApprovalBadge`) 동시 표시 (MY-02, MY-03). `getMyHostedPots`/`getMyApplications`를 `lib/server-data.ts`에 실제 DB 쿼리로 새로 작성 — mock 버전은 `CURRENT_USER_ID` 상수 기반이라 그대로 재사용할 수 없어서 처음부터 다시 짬
- [x] **신규 화면 #13 — 기본정보·비밀번호 수정** (`app/(main)/my/edit/page.tsx` + `edit-profile-view.tsx`) 제작 — 기본정보 폼과 비밀번호 폼을 독립된 섹션/제출로 분리
- [x] `app/api/me` — PATCH(닉네임/활동지역 수정) 구현 (MY-01)
- [x] `app/api/me/password` — PATCH(현재 비밀번호 확인 후 변경) 구현 (AUTH-06). 새 비밀번호로 재로그인 성공 + 옛 비밀번호로는 실패하는 것까지 확인
- [x] 로그아웃 버튼(Phase 1에서 미뤄뒀던 것) — 마이페이지에 추가, `next-auth/react`의 `signOut()`
- [x] **세션 갱신 이슈 발견 및 수정**: JWT 세션 전략은 DB를 다시 안 읽기 때문에, `/api/me`로 닉네임/활동지역을 바꿔도 세션 쿠키엔 로그인 시점 값이 그대로 남아있음(재로그인 전까지 화면에 옛날 값 노출). Auth.js v5의 `trigger:'update'` 패턴으로 해결 — `auth.ts`의 `jwt` 콜백이 `trigger==='update'`일 때 클라이언트가 넘긴 값으로 토큰을 갱신하도록 추가, 클라이언트는 저장 성공 후 `useSession().update({nickname, zoneCode})` 호출
- [x] **보안 버그 발견 및 수정**: 마이페이지/정보수정 화면에 서버 컴포넌트가 `getCurrentUser()`의 전체 `User` 객체(= `loginId` 포함)를 그대로 클라이언트 컴포넌트 prop으로 넘기고 있었음 — Next.js는 서버→클라이언트 props를 페이지의 RSC 페이로드(`<script>` 태그)에 그대로 직렬화해 브라우저로 보내므로, 화면이 실제로 쓰지도 않는 `loginId`가 HTML 소스에 그대로 노출되고 있었음. 실제로 브라우저에 도달한 HTML을 문자열 검색해서 발견함 — API 응답 바디만 확인해서는 못 잡는 종류의 leak. `{ nickname, zoneCode }`만 골라서 넘기도록 두 컴포넌트 다 수정
- [x] mock 완전 정리: `lib/mock-data.ts` 삭제(마지막까지 남아있던 `USERS`/`POTS`/`PARTICIPATIONS`/`CURRENT_USER_ID`가 전부 이 Phase에서 실제 DB 버전으로 교체되며 무용지물이 됨)

**완료 기준**: 두 계정 모두 마이페이지에서 자신이 만들거나 참여한 주문의 상태를 확인할 수 있고, 닉네임/활동지역/비밀번호를 수정할 수 있다. → **E2E로 확인 완료**: 호스트/참여자 각자의 마이페이지에 올바른 목록이 뜨는 것, 프로필 수정, 비밀번호 변경(틀린 현재 비번 거부 → 올바른 값으로 변경 → 새 비번으로만 로그인 가능), `loginId`가 페이지 소스 어디에도 없는 것까지 확인.

---

## Phase 6 — P1 선택 기능 (일정 여유 있을 때만)

우선순위 낮음 — Phase 0~5가 전부 끝나고 시간이 남을 때만 진행. `mukmate-pot-lifecycle` 스킬의 계산식 참고.

- [ ] ORDER-10 — 위치 권한 허용 시 수령 장소까지 거리 표시, 가까운 순 정렬 (Geolocation은 일회성 계산만, 저장 금지)
- [ ] ORDER-12 — 참여자별 예상 분담 금액 표시 (배달비만 인원수 분할, 10원 단위 절상, 음식값은 1/N 하지 않음 — §5-4 계산식)

---

## Phase 7 — 프로덕션 검증 (PRD §13, §13-3)

- [x] 서로 다른 기기·브라우저 2대에서 동시 접속 테스트 및 세션/폴링 동작 검증
- [x] **로컬이 아닌 Vercel 프로덕션 URL**에서 §13-1 필수 시나리오 전체 재확인 (`npm run build` 및 TypeScript `tsc --noEmit` 검증, E2E API 스크립트 검증 완료)
- [x] §13-2 품질 기준 전체 확인 (환경변수 정상 연결, 카카오 API 키 미노출, 서버 프록시 적용, 모바일 레이아웃, 권한 가드 적용 완료)
- [x] 한 사용자가 메시지를 보내면 다른 사용자 화면에 새로고침 없이 나타나는지 폴링 증분 조회 시스템 검증 완료

**완료 기준**: PRD §13 전체 체크 완료 = MVP 최종 완료. → **Phase 7 완료.**

---

## Phase 7 이후 — 추가 구현 (Phase 표에는 없던 작업)

Phase 7 "완료" 커밋(`0e89673`~`9f38fa4` 이전 이력) 이후에도 커밋이 2건 더 들어갔다. 둘 다 사전에 Phase 계획에 없던 별도 기획 문서(`MukMate_Chat_Spec.md`, `MukMate_MyPage_Spec.md` — 저장소에는 커밋되어 있지 않은 외부 기획안)를 근거로 진행됐다. 이 문서는 실제 코드 상태를 기준으로 사후 기록한다.

### 신고 기능 (커밋 `4a08a75`)

- [x] `reports` 테이블 + `report_reason`/`report_status` ENUM, `users.account_status` ENUM 추가 (`lib/db/schema.ts`)
- [x] `POST /api/reports` — 메시지/사용자 신고 접수. 자기 자신 신고 방지, 같은 메시지 중복 신고 방지(`UNIQUE(reporter_id, message_id)`), 신고 시점 메시지 내용 스냅샷 저장(나중에 원본이 삭제/수정돼도 신고 근거가 남도록)
- [x] `components/chat/report-modal.tsx` — 채팅방에서 메시지/사용자 신고 UI, `chat-room-view.tsx`에 연동
- [~] **관리자 처리 화면은 없음** — 신고는 `PENDING` 상태로 DB에 쌓이기만 하고, 이를 검토·처리(`REVIEWING`/`RESOLVED`/`DISMISSED`)할 화면이나 API는 아직 없음

> **PRD와의 정합성 주의**: PRD §17-3은 "MVP에서는 신고 기능을 만들지 않고 운영 규칙·문의 창구만 안내한다"고 정했었다. 위 구현은 이 결정을 넘어선 것이므로, PRD §17-3/§8-3을 이 구현에 맞춰 갱신했다(v2.2). 관리자 처리 화면이 없는 채로 신고가 쌓이기만 하는 상태가 실사용에 괜찮은지는 재검토가 필요하다.

### 참여 신청/승인 플로우 재구현 — FEAT-06 (커밋 `89b02f0`)

- [x] `POST/DELETE /api/pots/:id/join` — 참여 신청 / 신청 취소·나가기. 정원 초과 검사, 대기 인원이 정원의 3배를 넘으면 신규 신청 차단(스팸 방지), 거절된 신청 재신청 차단
- [x] `GET /api/pots/:id/requests` — 방장 전용 대기 중 신청 목록
- [x] `PATCH /api/pots/:id/members/:userId` — 방장의 승인/거절 (참여 id가 아니라 `potId + userId`로 대상 지정)
- [x] `lib/pots/viewer-state.ts` — 현재 로그인 사용자가 이 모집글에 대해 어떤 상태인지(`HOST`/`MEMBER`/`PENDING`/`REJECTED`/`JOINABLE`/`FULL`/`CLOSED`/`GUEST`)를 판정하는 `ViewerState`(`types/pot-member.ts`) 도입, 상세 화면 CTA 버튼이 이 상태를 기준으로 분기
- [x] `components/pots/join-button.tsx`/`join-confirm-sheet.tsx`/`request-list.tsx` — 상세 화면(`pot-detail-view.tsx`)에 참여 신청 버튼 + 확인 시트 + (방장이면) 인라인 신청자 목록을 새로 추가, 기존 UI를 이 컴포넌트들로 교체
- [x] `migrations/006_join_approval.sql` — `participations.approval_status`/`decided_at`/`decided_by` 컬럼 추가(`IF NOT EXISTS`) + PENDING 전용 부분 인덱스. **주의**: `approval_status`는 Phase 0부터 이미 `approval` ENUM 컬럼으로 존재했다 — 이 마이그레이션은 같은 이름의 컬럼을 다른 타입(VARCHAR)으로 다시 추가하려 시도하는 모양새라 `IF NOT EXISTS`가 없었다면 충돌났을 것. 실제 Neon DB에 이 마이그레이션이 적용됐는지, 적용됐다면 `decided_at`/`decided_by`를 실제로 채우는 코드가 있는지(현재 API 코드에는 없음) 확인이 필요하다

**정리 완료 (2026-07-30)**: Phase 2에서 만든 `POST /api/pots/:id/participations` + `PATCH /api/applications/:id`, 그리고 이걸 쓰던 `pot-applications-view.tsx`(화면 #7)를 `join`/`members`/`requests` API 하나로 통합했다.

- [x] `pot-applications-view.tsx`가 `updateApplicationStatus`(레거시) 대신 `decideMemberApplication`(`PATCH /api/pots/:id/members/:userId`)을 쓰도록 교체
- [x] 레거시 라우트 `app/api/pots/[id]/participations/route.ts`, `app/api/applications/[id]/route.ts` 삭제
- [x] `lib/api.ts`의 죽은 코드 `applyToPot`/`updateApplicationStatus` 제거
- [x] 고아 마이그레이션 `migrations/006_join_approval.sql` 삭제, 유효했던 부분(대기 신청 조회용 부분 인덱스)만 `lib/db/schema.ts`에 정식 반영 후 `drizzle-kit generate` + `db:push`로 재적용 — `drizzle/0002_empty_martin_li.sql`로 마이그레이션 이력도 실제 DB 상태와 재동기화됨
- [x] 신고(`reports`) 처리 관리자 화면·API 완료 — 아래 "관리자 기능(v2.3~v2.4)" 절 참고 (PRD §17-4)

---

## Phase 7 이후 — 2026-07-30 세션 작업 (버그 수정 → 모집글 기능 3종 → 관리자 기능)

### 1. `/pots` 런타임 크래시 수정 + 배포 정리

- [x] `components/pots/pots-view.tsx`에서 `ChevronDown`/`Check`/`Search`/`Plus`/`ShoppingBag`(lucide-react) import 누락으로 `/pots` 서버 렌더링이 `ReferenceError`로 크래시하던 버그 수정
- [x] 프로젝트 전체 `tsc --noEmit` 스캔으로 동일 문제 없음을 확인 (JSX 미정의 식별자는 타입체크가 항상 잡아낸다는 것 확인)
- [x] 버그가 박제되어 있던 옛날 배포 고유 URL(`muk-mate-rboaam9oi-...vercel.app`)을 `vercel remove`로 정리 — Vercel은 배포마다 영구 고유 URL을 부여하므로 이후 코드를 고쳐도 이미 발급된 옛날 URL은 절대 최신화되지 않는다는 점 확인, `muk-mate.vercel.app`(별칭 도메인)만 공유하도록 정리
- 상세 기록: `docs/BACKLOG.md` "완료/검증됨" 절

### 2. 참여하기 버튼이 실제로 안 보이던 문제 (다른 세션에서 수정, 이번 세션에서 검증)

- [x] `(main)` 레이아웃이 비로그인 사용자를 무조건 `/login`으로 리다이렉트해 게스트가 모집글 상세를 아예 못 보던 문제 → `app/(main)/pots/page.tsx`, `app/(main)/pots/[id]/page.tsx`를 `getSessionUserOrNull()` 기반으로 변경, 게스트도 목록/상세를 보고 "로그인하고 참여하기" CTA를 보게 함
- [x] 하단 네비게이션 바가 상세 페이지 하단 고정 참여하기 버튼을 시각적으로 가리던 문제 → `components/bottom-nav.tsx`가 `/pots`·`/chat`·`/my` 정확히 일치하는 경로에서만 표시되도록 변경
- [x] 참여 신청 → 방장 알림 플로우(`APPLICATION_SUBMITTED`/`APPLICATION_RECEIVED`)가 실제로 동작하는지 curl로 회원가입→로그인→신청→취소까지 프로덕션에서 전체 재현 검증
- 상세 기록: `docs/BACKLOG.md`

### 3. 모집글 삭제 · 공유 · 검색 3개 기능 신설

- [x] `DELETE /api/pots/:id` — 방장 전용, 참여자(대기중 포함, 방장 본인의 자동 APPROVED 행은 제외)가 0명일 때만 삭제 가능
  - 구현 중 발견한 버그: 모집글 생성 시 방장 본인이 자동으로 `APPROVED` 참여자로 등록되는 기존 설계(`POST /api/pots`) 때문에 첫 구현에서는 방장이 자기 글을 영원히 못 지우는 버그가 있었음 → 삭제 가드에서 방장 본인 행을 제외하도록 수정
- [x] 공유 버튼 — `navigator.share()` 우선, 미지원 브라우저는 클립보드 복사로 폴백
  - 구현 중 발견한 버그: 로그인 페이지가 `next` 쿼리 파라미터를 무시해서, 공유링크로 들어온 게스트가 로그인해도 원래 모집글로 못 돌아오던 문제 → `useSearchParams()`로 읽어 내부 경로면 그쪽으로 리다이렉트하도록 수정(정적 프리렌더링과 충돌해 `<Suspense>`로 래핑)
- [x] 돋보기(검색) 버튼 — 현재 선택된 권역(zone) 내에서 가게명·메뉴 텍스트로 클라이언트 사이드 필터링 (백엔드 변경 없음)
- 상세 기록: `docs/BACKLOG.md`, PRD §8-2 ORDER-13/14/15

### 4. 관리자 기능 신설 (Sprint 1~3)

MVP 배포를 위한 최소 관리자 기능을 별도 문서로 먼저 정의하고(`docs/ADMIN_FEATURES.md`), PRD v2.3(§17-4)에 반영한 뒤, `docs/ADMIN_ROADMAP.md`의 3개 스프린트로 나눠 구현·배포·검증했다.

- [x] **Sprint 1 — 기반**: `users.role`(`USER`/`ADMIN`) 컬럼, `/admin` 서버 가드(비로그인→`/login`, 비관리자→`/pots`), 회원 정지(`account_status`)가 채팅 전송뿐 아니라 로그인·참여신청·모집글작성 전 경로에 실제로 적용되도록 확장. 부수 발견: `Error`를 던지면 Auth.js가 "Configuration"으로 마스킹해버려 커스텀 에러 코드가 안 보이던 문제 → `CredentialsSignin` 서브클래스로 해결. 겸사겸사 오래 방치돼 있던 고아 컬럼(`participations.decided_at`/`decided_by`, 전부 NULL)도 이번에 실제로 제거
- [x] **Sprint 2 — 신고 처리**: `/admin/reports` 신고함(상태 필터·상세·상태 변경·정지 액션), `PATCH /api/admin/reports/:id`, `PATCH /api/admin/users/:id`(자기 자신 정지 방지 가드 포함)
- [x] **Sprint 3 — 모집글 직권 삭제**: `/admin/pots`(검색+삭제), `DELETE /api/admin/pots/:id` — 참여자·방장 조건 무시하고 즉시 삭제, cascade로 참여/채팅방/알림도 정리됨
- [x] 전체 플로우를 실제 계정으로 프로덕션에서 재현 검증(신고 접수→관리자 처리→회원 정지→로그인/참여/작성/채팅 전부 차단 확인 포함) 후 사람 확인까지 완료
- 상세 기록: `docs/ADMIN_FEATURES.md`(정의·제외 범위), `docs/ADMIN_ROADMAP.md`(스프린트별 체크리스트·검증 기록), PRD §17-4

### 5. 관리자 기능 Sprint 4 — 회원 관리 독립 화면

`PATCH /api/admin/users/:id`가 이미 범용으로 있었는데도, 신고가 접수된 회원만 정지할 수 있던 공백을 메웠다. `/admin/users`(검색+상태 필터+정지/정상화)를 추가. 상세 기록: `docs/ADMIN_ROADMAP.md` Sprint 4.

### 6. 관리자 화면 디자인 다듬기

관리자 화면이 텍스트 링크·구분선 리스트뿐이라 밋밋했던 걸, 앱에 이미 있던 디자인 시스템(Card, StoreAvatar, EmptyState, lucide 아이콘)을 재사용해 다듬었다 — 새 디자인 시스템은 만들지 않음. 대시보드에 통계 카드(대기중 신고/정지 회원/모집중 주문/전체 회원 수) 추가.

### 7. 채팅 읽음 표시(CHAT-09, v2.5)

카카오톡처럼 채팅 상대가 메시지를 읽었는지 확인하고 싶다는 요청으로 신설. 참여자 개념이 없는 커뮤니티 채팅방은 제외하고 주문 채팅방에만 적용.

- [x] `room_reads` 테이블 추가 — 참여자별 "마지막으로 읽은 메시지 id"만 저장
- [x] `markRoomRead()` — 방을 조회(GET)하거나 메시지를 보낼 때(POST) 호출자의 읽음 커서를 현재 방의 최신 메시지까지 끌어올림
- [x] `GET /api/rooms/:id/messages` 응답을 `Message[]` → `{ messages, reads }`로 변경 — ORDER 방이면 참여자 전원의 읽음 커서 스냅샷 포함(커뮤니티 방은 빈 배열)
- [x] 폴링이 증분 조회(`after=lastId`)라 예전 메시지의 배지가 안 갱신되는 문제를 피하기 위해, 서버가 메시지별 안읽음 수를 미리 계산해 내려주지 않고 매 폴링마다 읽음 커서 스냅샷만 내려줌 — 클라이언트(`chat-room-view.tsx`)가 화면에 있는 메시지 전부에 대해 매번 다시 계산(카카오톡 그룹채팅 방식: 메시지 발신자를 제외한 참여자 중 안읽은 인원수)
- [x] 새 메시지가 없어도 매 폴링마다 `reads`는 갱신하도록 폴링 루프 수정 — 상대방이 읽기만 하고 메시지를 안 보내도 내 화면의 배지가 사라져야 하기 때문
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 실제 계정 2개(방장/참여자)로 주문 채팅방 생성 → 방장이 메시지 전송 → 참여자가 안 읽은 상태에서 `reads` 스냅샷에 `lastReadMessageId:0` 확인(배지 1 기대) → 참여자가 방을 조회 → 방장 쪽 재조회 시 참여자의 읽음 커서가 즉시 최신 메시지 id로 갱신되는 것 확인(배지 0으로 전환) → 커뮤니티 방은 `reads`가 항상 빈 배열임을 확인. 상세 기록: PRD §0-5, §8-3 CHAT-09.

### 8. 채팅 목록 안읽음 수(CHAT-10) — 하드코딩된 0을 실제 값으로

채팅 목록 화면(`chat-list-view.tsx`)은 처음부터 방별 안읽음 배지 UI와 안읽음 우선 정렬을 갖추고 있었지만, `listRoomsForUser()`가 `unreadCount: 0`을 항상 반환하는 미구현 스텁이었다(주석: "읽음 여부를 추적하는 컬럼이 없어 항상 0"). 바로 앞서 만든 `room_reads`를 그대로 재사용해 채웠다.

- [x] `getUnreadCountsForRooms()` — `messages LEFT JOIN room_reads`(이 유저 기준) 한 번의 그룹 쿼리로 방마다 `count(*) filter (where 메시지id > 내 커서)` 계산. 참여자 집합이 필요 없는 개인 커서라 커뮤니티 방에도 그대로 적용됨(CHAT-09의 메시지별 배지와 달리 ORDER 한정이 아님)
- [x] `markRoomRead()` 호출을 ORDER 전용 조건에서 방 종류 무관으로 확장 — 커뮤니티 방을 봐도 이제 읽음 커서가 갱신됨
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 실제 계정으로 참여 알림 1건+메시지 2건이 쌓인 주문 채팅방에서 안읽은 참여자의 목록 배지가 정확히 "3"으로 표시 → 방 열람 후 "0"으로 전환 확인. 커뮤니티 방 두 개도 각각 한 번도 안 읽은 방은 전체 메시지 수, 읽은 방은 0으로 독립적으로 정확히 계산됨을 확인.
- 상세 기록: PRD §0-5, §8-3 CHAT-10

### 9. 채팅방 진입 시 스크롤 위치 복원(CHAT-11)

"채팅방을 들어가면 항상 맨 위(가장 오래된 메시지)부터 보인다, 새로 온 메시지는 아래에 있는데 거기서 시작하면 좋겠다"는 요청으로 신설.

- [x] `getMyReadCursor()` — `markRoomRead()`가 커서를 현재 시점으로 올리기 **전에** 이전 커서 값을 먼저 캡처하는 함수 추가. 순서가 중요함(먼저 안 잡아두면 이미 갱신된 값만 남아 복원할 지점을 잃음)
- [x] `app/(main)/chat/[id]/page.tsx`가 `getMyReadCursor()` → `markRoomRead()` 순서로 호출하도록 수정, 이전 커서를 `initialReadCursor` prop으로 클라이언트에 전달
- [x] `chat-room-view.tsx`: 메시지마다 DOM ref를 저장해두고, `useLayoutEffect`(페인트 전에 실행)로 마운트 시 1회 "커서 다음 첫 메시지"로 스크롤 — 다 읽었거나 첫 방문(커서 행 자체가 없음)이면 맨 아래로. 기존에 `useEffect`(페인트 후 실행)로 맨 아래 스크롤을 하던 게 "맨 위가 잠깐 보였다 아래로 튀는" 깜빡임의 원인이었음 — 새 메시지 폴링 시 자동 스크롤 로직은 이 최초 복원이 끝난 뒤에만 동작하도록 플래그로 분리
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 실제 계정으로 메시지 6개(참여알림+5개)까지 읽은 뒤 방장이 2개 더 전송 → 참여자가 채팅방 페이지에 진입했을 때 서버가 내려준 `initialReadCursor`가 새 메시지 이전 마지막 메시지 id와 정확히 일치함을 확인 → 같은 참여자가 재방문 시 커서가 최신 메시지 id로 갱신된 것도 확인.
- 상세 기록: PRD §0-5, §8-3 CHAT-11

### 10. 회원 탈퇴(AUTH-09)

완전 삭제는 하지 않기로 결정 — 이 유저가 호스트인 모집글, 보낸 메시지, 신고 기록 등이 FK로 얽혀 있어 하드 삭제하면 다른 사용자가 보던 채팅·참여 이력이 깨진다(테스트 계정 정리할 때도 같은 문제로 막혔던 적 있음). 대신 이미 있는 계정 제재 인프라(`account_status=DISABLED`, 로그인·참여·작성·채팅 전 경로 차단은 v2.3에서 이미 구현됨)를 재사용하는 소프트 탈퇴로 구현.

- [x] `lib/server-data.ts`: `cancelPotAndNotify()` — 기존 `PATCH /api/pots/:id`의 CANCELED 분기(상태 변경 + 시스템 메시지 + 참여자 알림)를 공용 함수로 추출, 방장 직접 취소와 탈퇴 자동 취소가 같은 코드를 쓰도록 리팩터링
- [x] `withdrawUser()` — 호스트로 있는 OPEN/CLOSED 모집글을 전부 `cancelPotAndNotify()`로 취소한 뒤, `account_status='DISABLED'` + 닉네임을 "탈퇴한 사용자"로 익명화
- [x] `DELETE /api/me` — 비밀번호 변경(`PATCH /api/me/password`)과 동일한 패턴으로 현재 비밀번호 확인 후 처리
- [x] `edit-profile-view.tsx`에 파괴적 액션 스타일의 탈퇴 카드 추가 — 결과를 명시한 `confirm()` 대화상자, 성공 시 `signOut()` 후 `/login`으로 이동
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 실제 계정으로 참여자 있는 모집중인 글을 호스트한 상태에서 탈퇴 실행 → 잘못된 비밀번호는 403으로 거부, 올바른 비밀번호는 성공 → 모집글이 CANCELED로 전환되고 호스트 닉네임이 "탈퇴한 사용자"로 표시됨 확인 → 참여자에게 `POT_CANCELED` 알림과 채팅방 시스템 메시지가 정상 생성됨 확인 → 탈퇴한 계정 재로그인 시 `ACCOUNT_DISABLED`로 차단 확인. 리팩터링한 방장 직접 취소(PATCH) 경로도 회귀 없이 정상 동작함을 별도로 확인.
- 상세 기록: PRD §0-6, §8-1 AUTH-09

### 11. 픽업 장소 지도 미리보기 (당근마켓 스타일)

카카오 지도 JS SDK는 장소 검색(REST API)과 별개 키가 필요하고, 브라우저에 노출되는 게 정상이라 카카오 디벨로퍼스에서 도메인을 직접 등록해야 동작한다.

- [x] `NEXT_PUBLIC_KAKAO_JS_KEY` 환경변수 추가(Production/Preview/Development), `.env.local`에도 반영
- [x] `lib/kakao-maps-loader.ts` — SDK 스크립트를 한 번만 로드하는 싱글턴 로더(`autoload=false` + `kakao.maps.load()` 콜백 패턴)
- [x] `components/pots/kakao-map-preview.tsx` — 픽업 장소 선택 시 그 아래 지도 렌더링, 다른 곳으로 바꾸면 마커도 다시 이동
- [x] `pot-create-form.tsx`의 "수령 장소" 입력 밑에 지도 삽입
- **디버깅 기록**: 처음엔 카카오 디벨로퍼스에 도메인 미등록으로 401(`domain mismatched`) 발생 → **플랫폼 키 > JavaScript 키(Default JS Key) 클릭 > "JavaScript SDK 도메인"**에 `https://muk-mate.vercel.app` 등록으로 해결(주의: "일반" 탭의 "앱 대표 도메인"이나 "+ JavaScript 키 추가"는 다른 항목이라 혼동하기 쉬움). 등록 후에도 사용자 PC 한 대에서만 재현되던 문제는 브라우저 확장 프로그램이 아니라 **크롬의 사이트별 데이터(`chrome://settings/content/all`)에 도메인 등록 전 실패했던 흔적이 남아있던 것**이었고, 해당 사이트 데이터 삭제로 해결됨(다른 팀원 PC·시크릿 모드에서는 처음부터 정상 동작해 원인 특정에 도움이 됨).
- 시각적 보조 기능이라 별도 PRD 요구사항 번호는 부여하지 않음(ORDER-14 공유 기능처럼 기존 픽업 장소 지정 흐름의 UX 개선으로 취급)

### 12. 게스트 접근 재차단 + "로그인 상태 유지" 체크박스

같은 날 도입했던 게스트 접근(1번 항목 참고)을 다음날 요청으로 다시 닫고, 대신 "로그인 상태 유지" 체크 여부로 세션 지속 기간을 다르게 가져가는 기능을 신설했다.

- [x] `app/(main)/pots/page.tsx`, `app/(main)/pots/[id]/page.tsx`를 `getSessionUserOrNull()` → `getCurrentUser()`로 되돌려 게스트 접근 재차단 — 루트(`/`)도 다시 무조건 `/login`부터
- [x] NextAuth JWT 세션 쿠키의 `maxAge`가 `NextAuth()` 초기화 시점에 고정되는 정적 설정이라 로그인마다 다르게 줄 공식 API가 없다는 걸 `@auth/core` 소스(`lib/actions/callback/index.js`, `lib/actions/session.js`)로 직접 확인 — 콜백에서 손댈 수 있는 건 토큰 payload뿐, 쿠키 자체의 Max-Age는 아님
- [x] 대신 별도 가드 쿠키(`lib/auth-constants.ts`: `mukmate_remember_guard`) 도입 — 체크 시 `Max-Age=2592000`(30일), 체크 해제 시 Max-Age 자체를 생략해 브라우저 세션 쿠키(종료 시 자동 삭제)로 발급
- [x] `getCurrentUser()`/`getSessionUserOrNull()`이 NextAuth 세션 + 이 가드 쿠키가 둘 다 있어야 로그인으로 인정하도록 수정 — 서버 컴포넌트에서 판정하므로 로그인 화면이 잠깐 보였다 넘어가는 깜빡임 없음
- [x] `POST/DELETE /api/auth/session-guard` — 로그인·가입직후자동로그인(`remember:true` 고정)·로그아웃 2곳에서 각각 호출
- [x] **검증 완료 (2026-07-31, 프로덕션)**: 게스트로 `/pots` 접근 시 `/login` 리다이렉트 재확인 → `remember=true`/`false` 각각 로그인 후 가드 쿠키 발급 응답 헤더에서 `Max-Age=2592000` 있음/없음 정확히 갈리는 것 확인 → `remember=false`로 로그인한 뒤 가드 쿠키만 강제로 제거(브라우저 종료 시뮬레이션)하고 재요청 시, NextAuth 세션 쿠키 자체는 아직 유효한데도 `/login`으로 즉시 차단되는 것까지 확인.
- 상세 기록: PRD §0-7, §8-1 AUTH-10/AUTH-11

---
