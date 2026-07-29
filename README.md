# 먹메이트 (MukMate)

전북대 덕진구 생활권 학생들을 위한 공동주문 매칭 모바일 웹 서비스.

- 요구사항: [`docs/PRD.md`](docs/PRD.md)
- 개발 계획(실행 체크리스트): [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md)
- 프로젝트 규칙/구조: [`CLAUDE.md`](CLAUDE.md)

## 기술 스택

Next.js (App Router) · Neon DB (PostgreSQL) · Drizzle ORM · Vercel · Auth.js · 네이버 지역 검색 API · NAVER Maps API

## 시작하기

```bash
pnpm install
pnpm dev
```

환경변수는 `.env.example`을 참고해 `.env.local`을 채운다.
