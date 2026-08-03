// 카카오맵 JavaScript SDK — 공식 타입 패키지가 없어 최소한으로만 선언한다.
export {}

declare global {
  interface Window {
    kakao: any
  }
}
