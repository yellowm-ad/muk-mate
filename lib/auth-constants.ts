// "로그인 상태 유지"(자동로그인) 체크 여부에 따라 세션 지속 기간을 다르게 가져가기 위한 보조 쿠키.
//
// NextAuth(v5-beta) JWT 세션은 session.maxAge(기본 30일)가 NextAuth() 초기화 시점에
// 고정되는 정적 설정이라, 로그인마다 쿠키 만료 기간을 다르게 줄 수 있는 공식 API가 없다
// (콜백에서 손댈 수 있는 건 토큰 payload뿐, 쿠키의 Max-Age 자체는 아님).
//
// 그래서 NextAuth의 세션 쿠키는 그대로 30일 고정으로 두고, 로그인 시 이 별도 쿠키를
// "체크 시 30일 지속 / 체크 해제 시 세션 쿠키(브라우저 종료 시 자동 삭제)"로 따로 발급해서
// getCurrentUser()/getSessionUserOrNull()이 "NextAuth 세션 + 이 쿠키가 둘 다 있어야 로그인 인정"으로
// 판정한다. 체크 해제 후 브라우저를 닫으면 이 쿠키만 사라지므로, NextAuth 쿠키 자체는 남아있어도
// 로그아웃 상태로 취급된다.
export const REMEMBER_GUARD_COOKIE = 'mukmate_remember_guard'
export const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30일 — NextAuth session.maxAge 기본값과 동일하게 맞춤
