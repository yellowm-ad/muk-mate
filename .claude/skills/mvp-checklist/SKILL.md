---
name: mvp-checklist
description: PRD 13장 완료 기준 체크리스트를 현재 코드/DB 상태 기준으로 점검한다. "완료 기준 확인해줘", "MVP 다 됐는지 체크" 요청 시 직접 호출한다.
disable-model-invocation: true
---

`docs/PRD.md` 13장(13-1 필수 사용자 시나리오, 13-2 품질 기준, 13-3 통합 테스트)의 각 항목을 코드베이스 실제 상태와 대조해 점검한다.

## 절차

1. `docs/PRD.md` 13장을 읽어 체크리스트 전체를 가져온다.
2. 각 항목에 대해 관련 코드(인증, pots API, participations API, 채팅 API, 마이페이지)가 실제로 존재하고 동작 가능한 상태인지 코드를 근거로 판단한다. `lib/api.ts`에 `TODO: replace with real API call` 주석이 남아있으면 해당 기능은 미완료로 판정한다.
3. 각 항목을 `완료 / 진행중 / 미착수`로 분류하고, 미완료 항목은 어떤 에이전트(`db-schema`, `api-backend`, `kakao-places`, `chat-polling`, `mobile-ui`, `vercel-deploy`)가 담당해야 하는지 짚어준다.
4. 표 형태로 결과를 보고한다.
