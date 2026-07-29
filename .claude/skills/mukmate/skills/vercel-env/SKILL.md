---
name: vercel-env
description: Vercel 프로젝트의 환경변수(Neon DB 연결 문자열, 카카오 API 키, 인증 시크릿) 목록을 확인하거나 설정 방법을 안내할 때 사용한다. "환경변수 확인", "env 세팅", "카카오 API 키 등록" 요청 시 사용한다.
allowed-tools: Bash(vercel env ls), Bash(vercel env ls *)
---

## 원칙 (PRD 9-2, 10-2)

- DB 연결 문자열과 카카오 API 인증 정보는 **소스 코드에 절대 작성하지 않는다.** Vercel 환경변수로만 관리한다.
- 클라이언트에 노출되어도 되는 값만 `NEXT_PUBLIC_` 접두사를 쓴다. `KAKAO_REST_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`은 절대 이 접두사를 붙이지 않는다. `NEXT_PUBLIC_KAKAO_JS_KEY`(카카오맵 SDK용)는 반대로 접두사가 있어야 정상이다 — 카카오 콘솔의 도메인 제한으로 보호되는 별개 성격의 키다.
- **실제 시크릿 값은 이 대화(채팅)에 입력받지 않는다.** 값 설정이 필요하면 사용자에게 아래 명령을 본인 터미널에서 직접 실행하도록 안내한다:
  ```
  vercel env add DATABASE_URL production
  vercel env add KAKAO_REST_API_KEY production
  vercel env add NEXT_PUBLIC_KAKAO_JS_KEY production
  vercel env add NEXTAUTH_SECRET production
  ```

## 이 스킬이 하는 일

1. `vercel env ls`로 현재 설정된 환경변수 **이름 목록**만 확인한다 (값은 출력되지 않음).
2. PRD 10-1·10-2 기준 필요한 변수가 빠져 있는지 점검한다:
   - `DATABASE_URL` (Neon pooled connection string)
   - `NEXTAUTH_SECRET`
   - `KAKAO_REST_API_KEY` / `NEXT_PUBLIC_KAKAO_JS_KEY`
3. Development/Preview/Production 환경별로 값이 따로 설정되어 있는지 확인하고, 누락된 환경이 있으면 알려준다.
4. `.env.local`이 `.gitignore`에 포함되어 있는지 함께 확인한다.
