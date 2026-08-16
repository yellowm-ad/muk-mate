// 설치 가능(홈 화면에 추가) 자격만 채우는 최소 서비스워커 — 아무것도 캐싱하지 않는다.
// 이 앱은 로그인 세션·모집글 마감시각 조회 시점 판정·채팅 폴링처럼 항상 최신 데이터가
// 필요한 화면뿐이라, API·HTML을 캐시하면 오히려 오래된 화면을 보여주는 버그가 된다.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
