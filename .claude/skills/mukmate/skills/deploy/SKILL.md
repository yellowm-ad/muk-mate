---
name: deploy
description: 먹메이트 Next.js 프로젝트를 Vercel에 배포한다. 사용자가 "배포해줘", "vercel에 올려줘", "프로덕션에 배포", "첫 배포 연결"을 요청할 때 사용한다.
disable-model-invocation: true
allowed-tools: Bash(vercel *), Bash(git status), Bash(git log *), Bash(pnpm build), Bash(npm run build)
---

## 배포 전 체크 (PRD 10-3, 15장 Day1 근거)

1. `git status`로 커밋되지 않은 변경이 없는지 확인한다. 있다면 사용자에게 먼저 알린다.
2. `pnpm build`(또는 `npm run build`)로 로컬 빌드가 성공하는지 먼저 확인한다.
3. Vercel 프로젝트의 환경변수가 설정되어 있는지 확인한다 (`vercel env ls`). 최소 다음이 있어야 한다:
   - `DATABASE_URL` — **Neon pooled connection string**(PgBouncer 경유) 또는 `@neondatabase/serverless` 사용 여부 재확인. 직접 연결 문자열이면 배포 후 커넥션 고갈로 500 에러가 난다는 점을 사용자에게 경고한다.
   - `NEXTAUTH_SECRET` (또는 Auth.js에서 요구하는 시크릿)
   - `KAKAO_REST_API_KEY` — 카카오 로컬 API(장소 검색) 서버 전용 키. 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
   - `NEXT_PUBLIC_KAKAO_JS_KEY` — 카카오맵 SDK용 클라이언트 키. 이건 반대로 `NEXT_PUBLIC_` 접두사가 있어야 정상이다 (도메인 제한으로 보호됨).
   - 값이 비어 있으면 값을 직접 채팅에 입력하게 하지 말고, `vercel env add <NAME> production` 명령을 사용자가 직접 실행하도록 안내한다 (시크릿은 대화 로그에 남기지 않는다).

## 배포 실행

- 첫 배포(Day1)라면: `vercel link`로 프로젝트를 연결한 뒤 `vercel --prod`로 배포한다.
- 이후 배포는 `vercel --prod`로 진행한다.
- 배포가 끝나면 반환된 프로덕션 URL을 사용자에게 알린다.

## 배포 후 검증 (PRD 13장 완료 기준)

- 프로덕션 URL에서 로그인, 공동주문 목록 조회 등 핵심 흐름이 500 에러 없이 동작하는지 확인한다.
- 브라우저 네트워크 탭 기준으로 `KAKAO_REST_API_KEY`가 클라이언트 응답에 노출되지 않는지 확인이 필요함을 사용자에게 상기시킨다 (자동 확인이 어려우면 수동 점검을 요청한다). `NEXT_PUBLIC_KAKAO_JS_KEY`는 노출되는 게 정상이다.
- 문제가 있으면 `vercel logs <deployment-url>`로 런타임 로그를 확인한다.
