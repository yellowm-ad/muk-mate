---
name: db-migrate
description: Neon(PostgreSQL) 스키마를 변경하고 Drizzle 마이그레이션을 생성·적용할 때 사용한다. 테이블/컬럼/인덱스 추가·수정, 마이그레이션 파일 생성 요청 시 사용한다.
---

## 절차

1. Drizzle 스키마 파일을 `docs/PRD.md` 11-2절 SQL과 대조하며 수정한다.
2. `npx drizzle-kit generate`로 마이그레이션 파일을 생성한다.
3. 생성된 SQL을 검토한다 — 특히 다음을 확인한다:
   - 금액 컬럼이 `integer`인지 (float 금지, 분담 계산 오차 방지)
   - 시간 컬럼이 `timestamptz`인지 (KST 표시는 클라이언트/서버 변환으로 처리)
   - `messages.id`가 `bigserial`인지 (폴링 커서 용도)
   - 계좌번호 등 금융정보 컬럼이 추가되지 않았는지
4. 로컬/개발용 Neon 브랜치에 먼저 `npx drizzle-kit push` 또는 `migrate`로 적용해 검증한다.
5. **프로덕션 DB에 적용하기 전에는 반드시 사용자에게 확인을 받는다** — 되돌리기 어려운 작업이다.
6. 연결 문자열은 반드시 Neon **pooled connection string**(PgBouncer 경유) 또는 `@neondatabase/serverless`를 사용한다 (직접 연결 문자열은 배포 후 커넥션 고갈로 500 에러를 유발한다).
