import 'server-only'

import { redirect } from 'next/navigation'

import { getSessionUserOrNull } from '@/lib/server-data'
import type { User } from '@/lib/types'

/** API Route Handler 전용 — 401/403 처리는 호출부가 한다. */
export async function getAdminOrNull(): Promise<User | null> {
  const me = await getSessionUserOrNull()
  if (!me || me.role !== 'ADMIN') return null
  return me
}

/** 관리자 페이지(서버 컴포넌트)에서 쓰는 버전 — 비로그인은 로그인 화면, 비관리자는 목록 화면으로 보낸다. */
export async function requireAdmin(): Promise<User> {
  const me = await getSessionUserOrNull()
  if (!me) redirect('/login')
  if (me.role !== 'ADMIN') redirect('/pots')
  return me
}
