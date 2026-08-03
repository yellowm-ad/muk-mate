// Auth.js(NextAuth) 설정 — Credentials(아이디/비밀번호) 전용.
// Clerk/Descope/Auth0 등 외부 ID 제공자는 이 프로젝트의 명시적 비목표.
// 자세한 규칙: .claude/skills/mukmate-auth/SKILL.md
import { eq } from 'drizzle-orm'
import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

import bcrypt from 'bcryptjs'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'

class AccountSuspendedError extends CredentialsSignin {
  code = 'ACCOUNT_SUSPENDED'
}
class AccountDisabledError extends CredentialsSignin {
  code = 'ACCOUNT_DISABLED'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        loginId: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      authorize: async (credentials) => {
        const loginId = typeof credentials?.loginId === 'string' ? credentials.loginId : undefined
        const password = typeof credentials?.password === 'string' ? credentials.password : undefined
        if (!loginId || !password) return null

        const [user] = await getDb().select().from(users).where(eq(users.loginId, loginId)).limit(1)
        if (!user) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        // v2.3: 정지/비활성 계정은 로그인 자체를 막는다 (17-4) — 채팅 전송에만 걸리던 검사를 로그인까지 확장
        if (user.accountStatus === 'SUSPENDED') throw new AccountSuspendedError()
        if (user.accountStatus === 'DISABLED') throw new AccountDisabledError()

        return {
          id: user.id,
          loginId: user.loginId,
          nickname: user.nickname,
          zoneCode: user.zoneCode,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id
        token.loginId = user.loginId
        token.nickname = user.nickname
        token.zoneCode = user.zoneCode
        token.role = user.role
      }
      // 마이페이지에서 닉네임/활동지역을 바꾼 뒤 클라이언트가 useSession().update(...)를
      // 호출하면 여기로 들어온다 — JWT 세션은 DB를 다시 안 읽으므로, 반영하려면 이 경로가
      // 반드시 필요하다 (안 하면 재로그인 전까지 화면에 옛날 값이 남는다).
      if (trigger === 'update' && session) {
        if (typeof session.nickname === 'string') token.nickname = session.nickname
        if (typeof session.zoneCode === 'string') token.zoneCode = session.zoneCode
      }
      return token
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string
      session.user.loginId = token.loginId as string
      session.user.nickname = token.nickname as string
      session.user.zoneCode = token.zoneCode as string | null
      session.user.role = token.role as string
      return session
    },
  },
})
