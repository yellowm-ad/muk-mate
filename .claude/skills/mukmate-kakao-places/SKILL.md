---
name: mukmate-kakao-places
description: Use when implementing or touching the 카카오 로컬 API (키워드 장소 검색) integration — the /api/places/search proxy, store/pickup place picker, or any store_lat/store_lng/pickup_lat/pickup_lng field. Triggers on Kakao API calls, place-search UI, or place-picker modal work.
---

Reference for MukMate's Kakao Local API integration (PRD v2.1 switched from Naver to Kakao — see `docs/PRD.md` §0-1 for the history). Source of truth: `docs/PRD.md` §10-2, §10-3, §14-5, §11-2/§11-3.

## Non-negotiable

- **Never call the Kakao API from the browser.** The REST API key is read only inside a Route Handler. If a `"use client"` file or a browser-side `fetch` targets `dapi.kakao.com` directly, that's a bug to fix, not a valid shortcut.
- `GET /api/places/search?q=` requires a logged-in session — reject unauthenticated calls server-side.
- The proxy returns only what the UI needs (name/address/lat/lng) — don't forward the full raw Kakao payload.
- The REST API key lives in Vercel environment variables (`KAKAO_REST_API_KEY`) only, never hardcoded.

## Calling the API

- Endpoint: `GET https://dapi.kakao.com/v2/local/search/keyword.json?query=...`
- Auth header: `Authorization: KakaoAK {KAKAO_REST_API_KEY}` — **one key**, not a client-id/secret pair (that's a Naver-ism, doesn't apply here).
- Response fields of interest per result: `place_name` (name), `address_name` / `road_address_name` (address), `x` (**longitude**), `y` (**latitude**) — Kakao's x/y order is the opposite of what "lat, lng" naming suggests; double-check this mapping when writing `store_lat`/`store_lng`, it's an easy off-by-swap bug.

## Data persisted (exact columns, §11-2)

- Store: `store_name`, `store_address`, `store_lat numeric(10,7)`, `store_lng numeric(10,7)`
- Pickup: `pickup_name`, `pickup_address`, `pickup_lat numeric(10,7)`, `pickup_lng numeric(10,7)`, plus free-text `pickup_note`

Pickup location supports both a Kakao search pick **and** a manual note added on top (§5-1: "검색 결과 선택 + 직접 설명 추가") — the picker UI needs both, not either/or.

## Completion check (§13-2)

Before calling this done: open browser devtools Network tab and confirm the Kakao REST API key never appears in any request the browser makes — the only network call the browser sees should be to `/api/places/search` on your own origin.

## Out of scope

No live/background location tracking or storage (§9-3, §12). Browser Geolocation is used only for a one-time distance calculation (ORDER-10, P1) — never persisted to the DB.

Kakao Maps JavaScript SDK (for an actual embedded map widget, as opposed to a search-results list) is a separate integration with its own key (JS key) and domain allowlist — not needed unless a future screen explicitly requires a visual map, which none of the current 13 screens do (#6 장소·주소 검색 is a search-results modal, not a map view).
