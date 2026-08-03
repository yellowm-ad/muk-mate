---
name: mukmate-mobile-ui
description: Use when building or styling any MukMate screen/component — layout, bottom navigation, Tailwind theme, touch targets, or the 13-screen information architecture. Triggers on new pages under app/, bottom-nav work, card/list components, or shadcn component usage in this project.
---

Reference UI/IA spec for MukMate. Source of truth: `docs/PRD.md` §6, §9-1, §9-4.

## Design tone

- Primary color: **주황(orange)** + white base, card-style lists.
- Minimum **44px touch targets**.
- Mobile-first at **375–430px** width; desktop must work but is secondary (§9-4).
- Use the Vercel plugin's `shadcn` skill for component scaffolding, but apply this project's orange/white tokens on top — don't ship the default shadcn theme unstyled.

## Bottom navigation (§6-1) — fixed on every logged-in screen, exactly 3 items

```
🛍 공동주문 │ 💬 채팅 │ 👤 마이
```
Never add a 4th tab or move this nav for MVP.

## 13-screen inventory (§6-2) — the definitive screen list, don't invent extra screens

| # | Screen | Note |
|---|---|---|
| 1 | 로그인 | |
| 2 | 회원가입 | 아이디 중복 확인 포함 |
| 3 | 공동주문 목록 | 스토리형 요약 + 카드 리스트 |
| 4 | 공동주문 상세 | 참여 신청 진입점 |
| 5 | 공동주문 작성·수정 | |
| 6 | 장소·주소 검색 | Kakao API, modal 권장 |
| 7 | 참여 신청자 관리 | 모집자 전용 |
| 8 | 내 채팅 목록 | |
| 9 | 주문 채팅방 | 상단 고정 정보 영역 |
| 10 | 음식 커뮤니티 목록 | 고정 채팅방 리스트 |
| 11 | 음식 커뮤니티 채팅방 | |
| 12 | 마이페이지 | |
| 13 | 기본정보·비밀번호 수정 | |

(If the sprint runs short, §15 says cut #10/#11 first — see the `mukmate-mvp-scope-guard` skill.)

## Usability rules (§9-1)

- Any core action reachable within **2 taps** from the bottom nav.
- Recruiting status and approval status must be visually and textually distinct — don't rely on color alone.
- Empty lists, invalid input, and network failures always get explanatory copy — never ship a bare blank state or a raw error.
- The pot list's **story-style quick-scan strip + card list** (§5-1) is a specific product decision, not a decorative flourish — keep both, don't collapse to a plain list.
