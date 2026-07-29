---
name: kakao-proxy
description: 카카오 로컬 API·카카오맵 API를 호출하는 서버 프록시 라우트를 새로 만들거나 수정할 때 사용한다.
---

## 원칙 (PRD 10-2, 0-3)

- 장소 **검색**(카카오 로컬 API)은 **Next.js 서버(Route Handler)에서만** `KAKAO_REST_API_KEY`로 호출한다. 클라이언트 컴포넌트에서 직접 fetch하지 않는다 (REST 키 노출 방지).
- `KAKAO_REST_API_KEY`는 `NEXT_PUBLIC_` 접두사 없이 서버 전용 환경변수로만 읽는다.
- 지도 **표시**(카카오맵 JavaScript SDK)는 예외적으로 클라이언트에서 `NEXT_PUBLIC_KAKAO_JS_KEY`로 직접 로드한다 — 이 키는 카카오 콘솔에 등록한 도메인으로만 동작하도록 제한되어 있어 노출되어도 안전하다. REST 키와 JS 키를 혼동하지 않는다.

## 구현 패턴

1. `GET /api/places/search?q=` Route Handler에서 카카오 로컬 API(키워드 장소 검색)를 호출한다.
2. 응답을 그대로 반환하지 않고 프로젝트 `Place` 타입(`lib/types.ts`)에 맞게 정규화해서 필요한 필드(`id`, `name`, `category`, `address`, 위경도)만 클라이언트에 전달한다.
3. 가게/수령 장소를 실제로 선택했을 때는 장소명·주소·위도·경도를 함께 저장할 수 있는 형태로 응답을 구성한다 (pots 저장 스키마와 맞춘다).
4. 카카오 API 오류·쿼터 초과 응답을 그대로 노출하지 말고, 사용자가 원인과 재시도 방법을 알 수 있는 형태의 에러로 변환한다.
5. 거리 계산(ORDER-10)은 서버에 저장하지 않고 브라우저에서 Geolocation 좌표로 일회성 계산한다 — 이 프록시는 좌표 계산에 관여하지 않는다.
6. 지도를 실제로 화면에 그려야 하면(카카오맵 SDK), 클라이언트 컴포넌트에서 `NEXT_PUBLIC_KAKAO_JS_KEY`로 SDK 스크립트를 로드한다. 이건 서버 프록시 대상이 아니다.
