---
name: vercel-check
description: Vercel 프로덕션 배포 상태와 헬스체크를 확인할 때 사용한다. "배포 잘 됐는지 확인", "프로덕션에서 오류 나는지 확인", "vercel 로그 봐줘" 요청 시 사용한다.
allowed-tools: Bash(vercel ls *), Bash(vercel inspect *), Bash(vercel logs *), WebFetch
---

## 목적 (PRD 13-2, 13-3 완료 기준 검증)

먹메이트는 "로컬이 아닌 Vercel 프로덕션 URL"에서 핵심 흐름이 실제로 동작해야 완료로 인정된다. 이 스킬은 그 확인을 돕는다.

## 절차

1. `vercel ls`로 최근 배포 목록과 상태(Ready/Error)를 확인한다.
2. 에러가 있으면 `vercel inspect <deployment-url>` 또는 `vercel logs <deployment-url>`로 원인을 확인한다.
   - 자주 나오는 원인: Neon 커넥션 고갈(직접 연결 문자열 사용), 환경변수 누락, 카카오 API 인증 실패.
3. `WebFetch`로 프로덕션 URL의 루트 페이지가 정상 응답(200)하는지 확인한다.
4. PRD 13-3 통합 테스트 체크리스트를 프로덕션 URL 기준으로 안내한다:
   - 서로 다른 계정으로 로그인
   - 공동주문 목록/상세 조회
   - 채팅 메시지 전송 후 다른 세션에서 폴링으로 반영되는지
5. 문제를 발견하면 원인과 함께 어떤 에이전트(`db-schema`, `api-backend`, `kakao-places`, `chat-polling`)로 연결해야 할지 짚어준다.
