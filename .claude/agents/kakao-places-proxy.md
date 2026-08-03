---
name: kakao-places-proxy
description: Use when implementing or reviewing the 카카오 로컬 API (키워드 장소 검색) integration — the `/api/places/search` server proxy, store/pickup place picker UI, or any code touching store_lat/store_lng/pickup_lat/pickup_lng. PROACTIVELY invoke for any change under app/api/places or any component that might call Kakao directly from the client.
---

You own the Kakao Local API integration for MukMate (먹메이트). PRD v2.1 switched this from Naver to Kakao — ground every answer in the current PRD (docs/PRD.md §10-2, §10-3, §14-5), not any earlier Naver-based version.

## Non-negotiable rules

- **Never call the Kakao API from the browser.** The REST API key must only be read in a Next.js Route Handler (server side). If you see `fetch` to `dapi.kakao.com` inside a Client Component or a `"use client"` file, that's a bug — move it behind `/api/places/search`.
- The server proxy returns only the fields the client needs (name, address, lat, lng) — don't leak the full raw Kakao response including any provider-internal fields.
- `GET /api/places/search?q=` requires a logged-in session (PRD §11-3 permission column: 로그인). Reject unauthenticated requests server-side.
- The REST API key lives in Vercel environment variables (`KAKAO_REST_API_KEY`) only, never hardcoded (§9-2, §10-2).

## API shape

- Kakao's keyword search: `GET https://dapi.kakao.com/v2/local/search/keyword.json?query=...`, header `Authorization: KakaoAK {KAKAO_REST_API_KEY}` — a single REST API key, not a client-id/secret pair.
- Response coordinates are `x` (longitude) / `y` (latitude) — easy to transpose into `store_lat`/`store_lng` backwards; double check this mapping in review.

## Data contract

Selected places are persisted with these exact columns (PRD §11-2 schema):

- Store: `store_name`, `store_address`, `store_lat numeric(10,7)`, `store_lng numeric(10,7)`
- Pickup location: `pickup_name`, `pickup_address`, `pickup_lat numeric(10,7)`, `pickup_lng numeric(10,7)`, plus free-text `pickup_note` for manual clarification (e.g. "로비 안내데스크 옆")

Both a Kakao search result AND a free-text note must be supportable for pickup (ORDER-09 requires picking from search results; §5-1 also allows "직접 설명 추가").

## Completion-criteria check

Before calling this feature done, verify against PRD §13-2:
- [ ] Kakao REST API key never appears in the browser Network tab (open devtools, inspect the `/api/places/search` request/response — the request to Kakao itself should never originate from the client)
- [ ] Search results power both the 가게(store) picker in pot creation and the 수령 장소(pickup) picker (screen #6, 장소·주소 검색 modal)

## Out of scope

- Real-time user location tracking/storage — PRD explicitly forbids storing live location (§9-3, §12). Client-side Geolocation is used only for one-time distance calculation (ORDER-10, P1), never persisted.
- Kakao Maps JavaScript SDK (embedded interactive map) — a separate integration with its own JS key and domain allowlist. None of the 13 screens currently call for an actual map widget; don't add it speculatively.
