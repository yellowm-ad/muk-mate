# 관리자 기능 개발 로드맵

`docs/ADMIN_FEATURES.md`에서 확정한 4개 기능(권한 검증 / 신고 처리 / 회원 제재 / 모집글 직권 삭제)을 3개 스프린트로 나눠 개발한다. 각 스프린트가 끝나면 **커밋·푸시 → AI 자체 검증(빌드/타입체크/curl 재현) → 사람 확인** 순서로 진행하고, 다음 스프린트로 넘어가기 전에 확인을 받는다.

## Sprint 1 — 기반: 권한 모델 · 관리자 라우트 가드 · 제재 전체 적용

**목표**: `/admin` 접근 자체가 관리자만 되도록 만들고, 회원 정지가 채팅뿐 아니라 로그인·참여·작성 전체에 실제로 먹히게 한다. 이 스프린트가 끝나도 신고 목록 같은 실제 관리 기능은 아직 없다 — 다음 스프린트의 지반 공사.

- [x] `lib/db/schema.ts`: `user_role` enum(`USER`/`ADMIN`) 추가, `users.role` 컬럼(기본 `USER`) 추가
- [x] `drizzle-kit generate` → `db:push`로 Neon에 반영 (겸사겸사 오래 남아있던 고아 컬럼 `participations.decided_at`/`decided_by`도 이번에 실제로 제거됨 — 값은 전부 NULL이었음)
- [x] `auth.ts`: 로그인 성공 조건에 `accountStatus === 'ACTIVE'` 검사 추가, `CredentialsSignin` 서브클래스로 `ACCOUNT_SUSPENDED`/`ACCOUNT_DISABLED` 구체 에러 코드 노출, JWT/세션에 `role` 포함
- [x] `app/api/pots/route.ts`(POST), `app/api/pots/[id]/join/route.ts`(POST): `accountStatus !== 'ACTIVE'`면 403 반환 — JWT가 아니라 매 요청 DB 재조회라 이미 로그인된 세션도 즉시 차단됨
- [x] `lib/admin/auth.ts`: `getAdminOrNull()`/`requireAdmin()` — 세션 + `role === 'ADMIN'` 검사, 관리자 라우트/레이아웃 공용
- [x] `app/admin/layout.tsx`: 비로그인 → `/login`, 비관리자 → `/pots` 리다이렉트. 하단 네비 없는 별도 셸
- [x] `app/admin/page.tsx`: 임시 랜딩(다음 스프린트에서 신고함/모집글 관리 링크로 채움)
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 비로그인 `/admin` → `/login`(307), 일반 계정 → `/pots`(307), `role=ADMIN` 계정 → 200 + 실제 랜딩 콘텐츠 확인. 정지 계정은 로그인 자체가 차단(세션 `null`, 에러 코드 `ACCOUNT_SUSPENDED` 정상 노출)되고, **이미 로그인된 세션 상태에서 DB로 정지 처리해도** 참여 신청(403 `ACCOUNT_RESTRICTED`)·모집글 작성(403)이 즉시 막히는 것까지 실제 계정으로 재현 확인. 테스트 계정·데이터는 검증 후 정리함.

## Sprint 2 — 신고 처리 (신고함)

**목표**: 관리자가 신고를 실제로 보고 처리할 수 있다.

- [x] `lib/admin/data.ts`: `getReportsForAdmin()` — 서버 컴포넌트가 직접 호출(별도 REST 목록 API 없음, `PENDING`/`REVIEWING` 우선 정렬)
- [x] `PATCH /api/admin/reports/:id` — `status`, `adminNote` 변경, `reviewedAt` 기록
- [x] `PATCH /api/admin/users/:id` — `accountStatus` 변경(신고 상세 화면에서 호출). 관리자 자기 자신은 정지 불가 가드 추가
- [x] `app/admin/reports/page.tsx` — 목록 + 상태 필터 + 상세(신고 사유/메시지 스냅샷) + 상태 변경 폼 + "이 유저 정지"/"정지 해제" 버튼
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 신고자 계정 → 피신고자 신고(`POST /api/reports`) → `/admin/reports` 페이지에 실제로 노출 확인 → 관리자가 `RESOLVED` 처리 + 메모 저장 → 같은 관리자가 피신고자 계정을 `SUSPENDED`로 변경 → 피신고자 재로그인 차단(에러 코드 `ACCOUNT_SUSPENDED`) 및 이미 로그인해뒀던 세션으로도 모집글 작성 즉시 차단(403) 확인. 일반 계정으로 관리자 API 직접 호출 시 403 확인. 검증에 쓴 계정·신고 데이터는 삭제 완료.

## Sprint 3 — 모집글 직권 삭제

**목표**: 신고 없이도 운영자가 부적절한 모집글을 즉시 내릴 수 있다.

- [x] `app/admin/pots/page.tsx`: 기존 `listPots()`(`lib/server-data.ts`, 필터 없이 호출하면 이미 zone 무관 전체 목록)를 재사용 — 별도 REST 목록 API 없음, 검색은 클라이언트 필터
- [x] `DELETE /api/admin/pots/:id` — 참여자·방장 조건 무시하고 즉시 삭제(cascade로 참여/채팅방/알림도 함께 정리됨, 스키마상 이미 `onDelete: cascade`)
- [x] `app/admin/pots/page.tsx` — 목록 + 검색 + 삭제 확인 다이얼로그
- [x] `app/admin/page.tsx` — Sprint 1에서 이미 신고함/모집글 관리 랜딩으로 만들어둠, 두 라우트가 실제로 생겨서 링크가 정상 연결됨
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 참여자가 있는 모집글을 만들어 (a) 일반 `DELETE /api/pots/:id`는 여전히 409로 차단(회귀 없음), (b) 일반 계정이 `DELETE /api/admin/pots/:id` 직접 호출 시 403, (c) 관리자 계정은 참여자가 있어도 200으로 즉시 삭제 확인. 삭제 후 DB에서 해당 `participations`/`chat_rooms` 행이 실제로 0건임을 재확인(cascade 정상 동작).

## 최종 확인 (전체 스프린트 완료 후)

- [x] 일반 계정으로 `/admin`, `/api/admin/*` 접근 시 전부 차단되는지 재확인 (Sprint 1~3에서 매번 회귀 확인함)
- [x] 신고 접수 → 관리자 처리 → 회원 정지 → 정지 계정의 로그인/참여/작성/채팅 전부 차단, 전체 플로우를 실제 계정으로 처음부터 끝까지 재현 (Sprint 2 검증 + 이번 Sprint 3에서 채팅 전송 차단까지 추가 재확인)
- [x] 모집글 직권 삭제가 참여자 유무와 무관하게 동작하는지, 일반 삭제는 여전히 참여자 0명 조건을 지키는지 회귀 확인
- [x] `docs/PRD.md` §17-4 "구현 상태"를 "설계 확정"에서 "구현됨"으로 갱신
- [x] 프로덕션 배포 후 Vercel 런타임 로그에서 관리자 라우트 관련 에러 없는지 확인 (검증 과정에서 발생한 401/403/404/409는 전부 의도된 정상 응답이며 5xx/미처리 예외 없음)
- [x] **사람 확인 완료 (2026-07-30)**: `/admin/pots`에서 검색·삭제 버튼 직접 확인함.

관리자 기능 4개(권한 검증 / 신고 처리 / 회원 제재 전체 적용 / 모집글 직권 삭제) 전부 구현·배포·AI+사람 검증까지 완료.

## Sprint 4 (추가) — 회원 관리 독립 화면

Sprint 2까지는 `PATCH /api/admin/users/:id`가 범용으로 만들어져 있었는데도, 이걸 호출하는 독립 페이지가 없어서 **신고가 접수된 회원만** 정지할 수 있었다. 신고 없이 특정 회원을 찾아 정지하려면 화면이 따로 필요하다는 지적으로 추가함.

- [x] `lib/admin/data.ts`: `getUsersForAdmin()` — 전체 회원 목록(가입순), 별도 REST 목록 API 없음(기존 관례 유지)
- [x] `app/admin/users/page.tsx` + `components/admin/admin-users-view.tsx` — 아이디/닉네임 검색, 계정 상태 필터, 정지/정상화 버튼(본인 계정은 액션 숨김)
- [x] **검증 완료 (2026-07-30, 프로덕션)**: 개발용 관리자 계정(`devadm1`)으로 `/admin/users` 접속해 실제 회원 목록 확인 → `devuser2`를 신고 없이 직접 정지 → 로그인 차단(`ACCOUNT_SUSPENDED`) 확인 → 다시 `ACTIVE`로 정상화.

## 명시적으로 다음 로드맵에서 다루지 않는 것

`docs/ADMIN_FEATURES.md`의 "제외 범위" 그대로 유지 — 마스터데이터(zone) CRUD, 공지사항, 신고와 무관한 별도 감사 로그. 필요해지면 이 로드맵에 새 스프린트로 추가한다.
