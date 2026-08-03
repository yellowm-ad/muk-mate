import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { users } from '@/lib/db/schema'

const LOGIN_ID_MIN = 4
const LOGIN_ID_MAX = 10

export async function GET(request: Request) {
  const loginId = new URL(request.url).searchParams.get('loginId')?.trim() ?? ''

  if (loginId.length < LOGIN_ID_MIN || loginId.length > LOGIN_ID_MAX) {
    return NextResponse.json(
      { error: `아이디는 ${LOGIN_ID_MIN}~${LOGIN_ID_MAX}자여야 합니다.` },
      { status: 400 },
    )
  }

  const [existing] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginId, loginId))
    .limit(1)

  return NextResponse.json({ available: !existing })
}
