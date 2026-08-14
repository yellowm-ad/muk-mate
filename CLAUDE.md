# 먹메이트 (MukMate)

전북대 덕진구 생활권 학생들을 위한 공동주문 매칭 모바일 웹 서비스. 전체 요구사항·근거는 **`docs/PRD.md` (v2.3)가 단일 소스**다 — 이 파일은 방향을 잡기 위한 요약이며, 세부 규칙은 아래 스킬 문서를 따른다.

## 지금 상태

Phase 0~7(`docs/SPRINT_PLAN.md`) 전부 완료 — DB(Neon)·인증·공동주문·카카오 장소 검색·채팅·마이페이지·프로덕션 검증까지 실제로 동작한다. 이후 Phase 7 완료 시점을 넘어선 추가 작업 2건이 더 들어갔다(`docs/SPRINT_PLAN.md`의 "Phase 7 이후" 절 참고).

- **완료**: Neon Postgres 연결(Vercel 마켓플레이스 프로비저닝, 무료 티어), Auth.js Credentials 회원가입/로그인, 공동주문 목록/상세/작성/참여/승인거절/상태전이, 화면 #7(참여 신청자 관리), 카카오 로컬 API 장소 검색, 폴링 채팅(주문 채팅 + 음식 커뮤니티), 마이페이지·정보수정·비밀번호 변경, **메시지/사용자 신고 기능**(PRD §17-3에서 "MVP 미구현"으로 정했던 항목인데 실제로 구현됨 — PRD가 아직 이 결정을 반영하지 못했었어서 문서를 갱신함), **참여 신청/승인 플로우 재구현**(FEAT-06: `/api/pots/:id/join`·`/members/:userId`·`/requests`)
- **2026-07-30 정리 완료**: 참여 신청·승인 로직이 `join`/`members`/`requests`(신규) 와 `participations`/`applications`(레거시) 두 벌로 공존하던 문제를 해결 — 레거시 API 라우트와 그걸 쓰던 죽은 코드(`lib/api.ts`의 `applyToPot`/`updateApplicationStatus`)를 삭제하고, "참여 신청자 관리" 화면(`pot-applications-view.tsx`)도 신규 `members` 경로로 옮겨 로직을 한 곳으로 통합했다. 마이그레이션 이력도 `npx drizzle-kit generate`로 `drizzle/0002_empty_martin_li.sql`을 다시 만들어 스키마 파일·실제 Neon DB·이력을 재동기화했고, 아무 코드도 안 쓰던 고아 마이그레이션(`migrations/006_join_approval.sql`, `decided_at`/`decided_by` 컬럼)은 제거하되 실제로 유용한 부분(대기 신청 목록 조회용 부분 인덱스 `idx_participations_pending`)은 `lib/db/schema.ts`에 정식으로 옮겨 적용했다.
- **2026-07-30 관리자 기능 신설(v2.3, PRD §17-4)**: `/admin` 경로에 관리자 권한 검증(`users.role`), 신고 처리(`/admin/reports` — 상태 변경·회원 정지 액션), 회원 제재(로그인·참여신청·모집글작성·채팅전송 전 경로에 실제 적용되도록 `accountStatus` 검사 확장), 모집글 직권 삭제(`/admin/pots`, 참여자/방장 조건 무시) 4개 기능을 구현·배포. 자세한 정의·로드맵·검증 기록은 `docs/ADMIN_FEATURES.md`·`docs/ADMIN_ROADMAP.md` 참고. 관리자 부여는 셀프서비스 없이 DB에서 직접 `role='ADMIN'`으로 처리.
- **2026-08-10 매너 포만도 P0 신설(v2.8, PRD §8-5·§17-5)**: 별도 기획안("매너 포만도 및 성장형 아바타")이 스스로 "MVP 이후 고도화 기능"으로 규정한 문서인데, 그중 신뢰 지표 핵심만 P0로 잘라 구현·배포함. 완료(`ORDERED`)된 공동주문의 모집자↔승인 참여자가 서로 평가(좋았어요/보통/아쉬웠어요)하면 서버가 0~100점을 계산(`lib/server-data.ts`의 `computeMannerStage`/`applyDueMannerReviews`)해 5단계(+신규 유저) 배지로 마이페이지·신규 공개 프로필(`/users/:id`)에 노출한다. 반영 시점("상대도 제출했거나 48시간 경과")은 §10-3③ 크론 금지 원칙과 동일하게 조회 시점 lazy 판정으로 처리 — 별도 스케줄러 없음. 실사용 계정 2개로 참여→승인→ORDERED 전이→상호평가→점수반영까지 실제 Neon DB에서 재현 검증 완료.
- **2026-08-10 P1 일괄 구현(v2.9, PRD §0-9)**: 같은 세션에서 이어서 P1 잔여 항목을 마저 구현·배포함.
  - **모집글 수정**(ORDER-08): `/pots/:id/edit` 신설. 작성 폼의 "N분 후" 프리셋을 그대로 못 쓴다는 보류 사유(`docs/SPRINT_PLAN.md`)를 `datetime-local`(절대 시각) 입력으로 해소. 가게·수령장소·활동권역·모집방식은 수정 대상에서 제외, `OPEN` 상태에서만, 목표 인원은 기승인 인원 미만으로 못 줄임 — 전부 `PATCH /api/pots/:id`(status 필드 유무로 상태변경/필드수정 분기)에서 서버 재검증.
  - **거리 표시**(ORDER-10): `pickupLat`/`pickupLng`를 `Pot` 타입에 노출, `lib/geo.ts`의 haversine + `lib/hooks/use-user-coords.ts`로 클라이언트에서만 계산(§9-3, 서버는 항상 `distanceMeters: null`). 예전엔 UI는 있었지만 항상 0으로 하드코딩돼 있던 걸 실제로 채움.
  - **분담 금액**(ORDER-12, §5-4): 모집글 작성·참여 신청에 "내 주문 금액" 입력 추가, `lib/split-cost.ts`로 배달비만 10원 단위 올림 분할(나머지는 방장 부담) 계산해 상세 화면에 표 노출.
  - **매너 P1 3종**(MANNER-08~10): 아바타 색상 4종·소품 5종 커스터마이징(`PATCH /api/me/avatar`, `/my/avatar` 화면, 매너 단계 표정은 계속 고정), 긍정 태그 상위 3개 집계(`unnest()`), 관리자가 `PATCH /api/admin/users/:id`로 계정을 `ACTIVE`→`SUSPENDED`/`DISABLED` 전환할 때만 `manner_events`에 -10점 1회 기록(신고 접수 자체는 여전히 트리거 아님).
  - 실사용 계정(devuser1/2/devadm1)으로 6개 기능 전부 실제 Neon DB에서 재현 검증 완료(분담 금액 계산값·목표인원 축소 차단·OPEN 아닐 때 수정 차단·아바타 저장·관리자 제재 중복 미적용까지 확인).
- **2026-08-14 친구 기능 신설**: PRD에는 아직 반영 안 된 신규 기능(비목표 충돌 없음). 마이페이지에 "친구 관리" 화면(친구 목록/친구 신청 탭), 모집방 호스트의 친구 초대(알림만 발송 — 정상 참여신청/승인 절차는 그대로 유지, 자동 참여 아님), 채팅 1:1 DM(`chat_rooms.type='DM'`, `dmUserAId`/`dmUserBId` 정규화 유니크 인덱스로 중복 방지)을 구현. 범위는 의도적으로 좁혀서 **같은 공동주문에 함께 참여(APPROVED)했던 사람끼리만 친구 신청 가능** — 낯선 사람과의 오픈 DM은 금지. 친구 삭제(unfriend)는 메시지 전송 제한 없이 DM 방 상단에 "친구로 등록되지 않은 사용자입니다." 배너만 표시하고, 차단(block)은 차단당한 쪽의 메시지 전송만 막는다(`POST /api/rooms/:id/messages`가 403 `{code:'BLOCKED'}` 반환) — 차단 시 기존 친구 관계는 자동 해제된다. 테스트 계정 3개로 신청→수락→초대→DM 송수신→삭제→차단까지 실제 Neon DB에서 재현 검증 완료.
- **2026-08-14 전북대 이메일 인증 회원가입 신설**: PRD §12/AUTH-07은 "학교/이메일 인증"을 결제·네이티브 앱과 같은 급의 명시적 비목표로 못박아 두었는데, 사용자가 이번 결정으로 **의도적으로 override**했다 — `.claude/skills/mukmate-auth`, `mukmate-mvp-scope-guard`에도 예외 사실을 남겨뒀다. 신규 가입자만 `@jbnu.ac.kr` 이메일로 6자리 인증번호를 받아(`/api/auth/jbnu-email/request`·`/verify`, `email_verifications` 테이블, `lib/email.ts`) 인증을 마쳐야 온보딩을 완료할 수 있다(`app/(auth)/onboarding/page.tsx` 2단계). 서버는 클라이언트가 보낸 "인증됨" 플래그를 신뢰하지 않고 `POST /api/auth/signup`에서 `email_verifications`를 직접 재조회해 30분 이내 검증 여부를 확인한 뒤 `users.jbnu_email`/`jbnu_email_verified_at`에 반영한다. **기존 계정은 전혀 건드리지 않음**(두 컬럼 다 NULL로 유지, `users_jbnu_email_key` 유니크 인덱스는 NULL 다수 허용). 노출 범위: 관리자 화면(`/admin/users`)에서만 원문 노출, 본인은 `/my/edit`에서 자신의 연동 이메일만 읽기 전용 확인 가능(`getMyJbnuEmailStatus` — 공용 `User` 타입/세션 JWT에는 절대 안 실어 다른 화면·다른 사용자로 새어나가는 경로를 차단), 그 외 사용자에게는 어떤 API 응답으로도 노출 안 함.
  - **발송 수단은 Gmail SMTP**(`nodemailer`, `GMAIL_USER`/`GMAIL_APP_PASSWORD`): 처음엔 Vercel Marketplace로 Resend를 연동했지만, 소유 도메인이 없어 도메인 인증을 못 했고 Resend 샌드박스(`onboarding@resend.dev`)는 계정 소유자 본인 이메일로만 배달되는 제약 때문에 실제 학생 수신자에게 발송이 불가능했다 — 도메인 구매 없이 임의 수신자에게 보낼 수 있는 Gmail SMTP로 같은 날 교체했다(`lib/email.ts`). Resend Vercel 연동은 안 쓰게 되면서 완전히 제거했음(리소스·연동·관련 스킬 문서까지 정리). Gmail 개인 계정의 일일 발송 한도(약 500통)가 있으니 대규모 트래픽 전엔 재검토 필요. 발신 계정이 개발자 개인 Gmail이라 받는 사람이 발신자를 열어보면 실제 주소가 보임(표시 이름만 "먹메이트") — 완전히 감추려면 전용 Gmail 계정을 새로 만들거나 도메인을 사야 하는데, 현재는 보류 상태.
  - 기존 `participations.decided_at`/`decided_by` 고아 컬럼(2026-07-30 정리 때 스키마 파일에서는 지웠지만 실제 Neon DB에는 남아있던 것으로 이번에 `db:push` 중 드러남)은 이번 작업 범위 밖이라 **그대로 남겨둠** — 별도로 처리 필요.
- **2026-08-14 아이디 찾기·비밀번호 찾기·아이디 변경 신설**: PRD §12가 "no password-reset/auto-recovery"로 명시한 비목표를 위 전북대 이메일 인증 도입에 이어 **다시 한번 의도적으로 override**함(당시엔 "복구 채널로는 안 쓴다"고 못박아 뒀던 걸 뒤집은 것). `lib/email-verification.ts`(신규, `requestVerificationCode`/`checkVerificationCode`/`getValidVerification`/`markVerificationConsumed`)로 코드 발급·검증·소모 로직을 공용화하고, `email_verifications.purpose`(`SIGNUP`/`FIND_ID`/`RESET_PASSWORD`/`CHANGE_LOGIN_ID`)로 목적별 코드가 서로 재사용되지 않게 막았다. `/find-id`(이메일 인증만으로 아이디 확인), `/find-password`(아이디+이메일 인증 둘 다 일치해야 비밀번호 재설정), `/my/edit`의 아이디 변경(현재 비밀번호+이메일 인증 둘 다 필요, 성공 시 강제 로그아웃 후 재로그인 유도 — nickname/zoneCode처럼 세션을 몰래 갱신하지 않음) 세 가지 다 `users.jbnu_email`이 있는 계정에서만 동작하고, **레거시 계정은 여전히 복구 불가**(PRD §14 risk #6가 그 계정들에는 그대로 유효).
- **남은 것**: 매너 포만도 P2(커스텀 SVG 캐릭터, 채팅/참여자목록 배지 노출, 평가 요청 알림) — 전부 원 기획안·PRD §17-5에서 의도적으로 미룬 항목. 친구 기능도 PRD 본문에는 아직 문서화 안 됨(이 CLAUDE.md 요약이 현재로선 유일한 근거). `participations.decided_at`/`decided_by` 고아 컬럼 정리도 남음.
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
