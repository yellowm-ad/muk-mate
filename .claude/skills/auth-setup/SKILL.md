---
name: auth-setup
description: Auth.js(NextAuth) Credentials 로그인, bcrypt 비밀번호 해시, 회원가입/로그인/비밀번호 변경 로직을 구현할 때 사용한다.
---

## 범위 (PRD 5-3, 8-1 AUTH-01~07)

- Credentials Provider만 사용한다. OAuth/소셜 로그인, 휴대전화·이메일 인증은 구현하지 않는다.
- 회원가입 필수값: 아이디 / 비밀번호 / 닉네임 / 활동 지역(zone_code). 아이디 중복 시 가입을 거부한다.
- 비밀번호는 `bcrypt.hash`로 저장하고 `bcrypt.compare`로 검증한다. 평문 저장·비교·로깅을 금지한다.
- 로그인 유지(세션)와 로그아웃을 지원한다.
- 비밀번호 변경은 **현재 비밀번호 확인 후에만** 허용한다.
- 비밀번호 찾기·자동 재설정 기능은 만들지 않는다 (외부 인증 수단이 없기 때문 — PRD 12장).

## 구현 체크

1. `users` 테이블: `login_id`(UNIQUE), `password_hash`, `nickname`, `zone_code`.
2. 아이디 중복 확인은 `GET /api/auth/check-id?loginId=`로 회원가입 폼에서 실시간으로도 쓸 수 있게 별도 제공한다.
3. NextAuth `session` 콜백에 `user.id`, `nickname`, `zoneCode`를 포함시켜 이후 권한 검사(permission-matrix 스킬)에 재사용한다.
4. 클라이언트에는 `login_id`(아이디)를 절대 내려보내지 않는다 — 항상 `nickname`만 노출한다.
