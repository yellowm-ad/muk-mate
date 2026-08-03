# 먹메이트 BACKLOG

앞으로 고치고 추가할 기능 요구사항을 대화하면서 쌓아가는 문서. `docs/PRD.md`(단일 소스)와 `docs/SPRINT_PLAN.md`(단계별 완료 이력)를 대체하지 않고, 그 사이에서 "다음에 뭘 할지" 실무 메모로 쓴다.

---

## ✅ 완료 / 검증됨

### 2026-07-30 — `/pots` 런타임 크래시 (ChevronDown 미정의)
- `components/pots/pots-view.tsx`에서 `ChevronDown`, `Check`, `Search`, `Plus`, `ShoppingBag`(lucide-react)를 import 없이 사용 → `/pots` 서버 렌더링 시 `ReferenceError`로 크래시.
- import 추가로 수정, `tsc --noEmit` / `next build` 통과 확인 후 배포.
- 프로젝트 전체 `tsc --noEmit` 스캔으로 다른 화면엔 동일 문제 없음을 확인.
- 부수 조치: 버그가 박제되어 있던 옛날 배포 고유 URL(`muk-mate-rboaam9oi-...vercel.app`)을 `vercel remove`로 정리. Vercel은 배포마다 영구 고유 URL을 부여하므로, 이후 코드를 고쳐도 이미 발급된 옛날 URL은 절대 최신화되지 않는다 — 항상 `muk-mate.vercel.app`(별칭 도메인)만 공유/사용할 것.

### 참여 신청 → 방장 알림 플로우
- 이미 구현되어 있고, 실제 프로덕션에서 curl로 회원가입 → 로그인 → 모집글 조회 → 참여 신청 → 취소까지 전체 플로우를 직접 실행해 정상 동작 확인함(2026-07-30).
- 신청 성공 시 알림이 2건 생성됨: 신청자 본인(`APPLICATION_SUBMITTED`), 방장(`APPLICATION_RECEIVED`) — `app/api/pots/[id]/join/route.ts:119-139`.
- 알림 배지는 실시간 push가 아니라 3초 간격 폴링(탭이 visible일 때만) — `components/notification-bell.tsx`.
- 참여하기 버튼(`components/pots/join-button.tsx`)은 `viewerState`(`GUEST`/`JOINABLE`/`PENDING`/`MEMBER`/`HOST`/`FULL`/`CLOSED`/`REJECTED`)에 따라 라벨·활성화 여부가 결정됨 — 본인이 방장인 글에선 "모집 마감하기"로 보이는 게 의도된 동작(참여하기가 아님).

### 참여하기 버튼이 실제로는 안 보였던 진짜 원인 (2026-07-30 후속 수정)
- 위 curl 검증은 서버가 내려주는 HTML에 버튼 마크업이 존재하는지만 확인한 거라, **실제 화면에서 다른 요소에 가려지는 문제**와 **비로그인 접근 자체가 막혀있는 문제**는 놓쳤음.
- 실제 원인 2가지를 찾아 수정함(커밋 `d3f79f2`, `275f6e4`):
  1. `(main)` 레이아웃이 비로그인 사용자를 무조건 `/login`으로 리다이렉트해서, 게스트는 모집글 상세를 아예 볼 수 없었음 → `app/(main)/pots/page.tsx`, `app/(main)/pots/[id]/page.tsx`를 `getSessionUserOrNull()` 기반으로 바꿔 게스트도 목록/상세를 보고 "로그인하고 참여하기" CTA를 보게 함.
  2. 하단 네비게이션 바(`components/bottom-nav.tsx`)가 상세 페이지 하단 고정 참여하기 버튼과 겹쳐서 시각적으로 가리고 있었음 → 경로가 정확히 `/pots`·`/chat`·`/my`일 때만 네비를 표시하도록 변경.
- **확인 필요**: 2번 수정으로 `/notifications`, `/my/edit`, `/pots/new`, `/chat/[id]` 등 세부 페이지에서도 하단 네비가 사라지는 부수효과가 생김 — 의도된 것인지 점검 필요.
- **문서 갱신 완료(2026-07-30)**: `CLAUDE.md`의 "`(main)` 전체는 로그인 세션이 없으면 `/login`으로 리다이렉트된다"는 서술을 `/pots`·`/pots/[id]` 게스트 접근 허용 반영해 갱신함.
- **2026-07-31 재차단**: 위 게스트 접근(1번 항목)은 다음날 요청에 따라 다시 닫혔다 — `(main)` 전체가 다시 로그인 필수로 돌아감. 대신 "로그인 상태 유지" 체크박스를 신설해 체크 여부로 세션 지속 기간을 다르게 가져가도록 함. 상세: PRD §0-7, §8-1 AUTH-10/AUTH-11, `docs/SPRINT_PLAN.md`.

---

## ✅ 완료 / 검증됨 (계속)

### 2026-07-30 — 모집글 삭제 · 공유링크 참여 · 검색, 3건 구현 완료
1. **모집글 삭제** — `DELETE /api/pots/[id]` 신규 추가. 방장만 가능, 참여자(대기중 포함)가 1건이라도 있으면 409(`HAS_PARTICIPANTS`)로 차단. 방장 전용 삭제 버튼은 `pot-detail-view.tsx`에서 `participations.length === 0`일 때만 노출.
   - **버그 발견 및 수정**: 모집글 생성 시 방장 본인이 자동으로 `APPROVED` 참여자로 등록되는 설계(`app/api/pots/route.ts:118-122`, 인원수/채팅권한 로직 단순화 목적) 때문에, 처음 구현한 삭제 가드가 방장 자기 자신의 행까지 세어서 **항상 409를 반환**하는 버그가 있었음 → API에서 `ne(participations.userId, me.id)`로 방장 본인 행을 제외하도록 수정(커밋 `b77be03`). UI 쪽(`getParticipationsForPot`)은 원래부터 방장을 제외하고 내려주고 있어서 문제없었음.
   - 프로덕션에서 실제 계정으로 (a) 타 계정 삭제 시도(401), (b) 참여자 있는 글 삭제 시도(409), (c) 참여자 없는 글 삭제(200 + 재조회 404)까지 curl로 검증 완료.
2. **공유하기 버튼** — `navigator.share()` 우선 시도, 미지원 브라우저는 `navigator.clipboard.writeText()` + 아이콘 일시 변경(체크 표시 2초)으로 폴백.
   - **부수 버그 발견 및 수정**: `app/(auth)/login/page.tsx`가 로그인 성공 후 항상 `/pots`로만 이동하고 `next` 쿼리 파라미터를 읽지 않아서, 공유링크로 들어온 게스트가 로그인해도 원래 모집글로 못 돌아오는 문제가 있었음 → `useSearchParams()`로 `next` 값을 읽어 내부 경로(`/`로 시작, `//`는 제외해 오픈 리다이렉트 방지)면 그쪽으로 이동하도록 수정. `useSearchParams()`는 정적 프리렌더링과 충돌해서 `LoginForm`을 `<Suspense>`로 감쌈.
3. **돋보기(검색)** — `pots-view.tsx` 헤더 검색 버튼 클릭 시 입력창 토글, 현재 선택된 권역(zone) 내에서 `storeName`/`orderSummary` 텍스트 매칭으로 클라이언트 사이드 필터링(백엔드 변경 없음, 이미 zone 필터링된 배열 위에 추가). 검색 결과 0건일 때 전용 빈 상태 문구 추가.
- 커밋: `8f152af`(3건 구현), `b77be03`(삭제 가드 버그 수정). 배포 완료, 프로덕션에서 삭제 플로우 재검증 완료.
- 검증용 테스트 계정(`dbgtest1`, `dbgtest2`)이 DB에 남아있음 — 실제 서비스에 영향 없어 그대로 둠.

---

## 🧹 잡음 (사소한 정리 대상, 우선순위 낮음)
- `components/notification-bell.tsx:4` — `import useRouter from 'next/navigation'`가 어디서도 안 쓰이는 죽은 import. 당장 에러는 아니지만 정리 대상.
