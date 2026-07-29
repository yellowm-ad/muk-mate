---
name: naver-proxy
description: 네이버 지역 검색 API·NAVER Maps API를 호출하는 서버 프록시 라우트를 새로 만들거나 수정할 때 사용한다.
---

## 원칙 (PRD 10-2, 14-5)

- 네이버 API는 **Next.js 서버(Route Handler)에서만** 호출한다. 클라이언트 컴포넌트에서 직접 fetch하지 않는다 (REST 키 노출 방지).
- `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`은 `NEXT_PUBLIC_` 접두사 없이 서버 전용 환경변수로만 읽는다.

## 구현 패턴

1. `GET /api/places/search?q=` Route Handler에서 네이버 지역 검색 API를 호출한다.
2. 응답을 그대로 반환하지 않고 프로젝트 `Place` 타입(`lib/types.ts`)에 맞게 정규화해서 필요한 필드(`id`, `name`, `category`, `address`, 위경도)만 클라이언트에 전달한다.
3. 가게/수령 장소를 실제로 선택했을 때는 장소명·주소·위도·경도를 함께 저장할 수 있는 형태로 응답을 구성한다 (pots 저장 스키마와 맞춘다).
4. 네이버 API 오류·레이트리밋 응답을 그대로 노출하지 말고, 사용자가 원인과 재시도 방법을 알 수 있는 형태의 에러로 변환한다.
5. 거리 계산(ORDER-10)은 서버에 저장하지 않고 브라우저에서 Geolocation 좌표로 일회성 계산한다 — 이 프록시는 좌표 계산에 관여하지 않는다.
