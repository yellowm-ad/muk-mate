---
name: sprint-day
description: PRD 15장 5일 스프린트 일정 기준으로 오늘 무엇을 해야 하는지, 지금까지 뭐가 됐는지 확인한다. "오늘 뭐해야해", "Day N 진행상황" 요청 시 직접 호출한다.
argument-hint: [day-number]
disable-model-invocation: true
---

`docs/PRD.md` 15장의 Day $0 목표를 기준으로 진행 상황을 점검한다. 인자가 없으면 어느 Day인지 먼저 사용자에게 묻는다.

## 절차

1. 15장에서 해당 Day의 목표 항목을 가져온다.
2. 각 목표와 관련된 코드/설정이 실제로 존재하는지 확인한다 (예: Day1이면 Drizzle 마이그레이션 파일, Vercel 프로젝트 연결 여부, 회원가입·로그인 API 존재 여부).
3. 완료/미완료를 표로 보고하고, 일정이 밀렸다면 PRD 15장의 축소 우선순위(화면 10·11 → ORDER-10 → ORDER-12 순으로 자름)를 상기시킨다.
