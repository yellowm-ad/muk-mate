import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      loginId: string
      nickname: string
      zoneCode: string | null
      role: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    loginId: string
    nickname: string
    zoneCode: string | null
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    loginId: string
    nickname: string
    zoneCode: string | null
    role: string
  }
}
