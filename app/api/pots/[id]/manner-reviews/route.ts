import { NextResponse } from 'next/server'

import { MANNER_TAGS_BY_RATING } from '@/lib/manner'
import { getSessionUserOrNull, submitMannerReview } from '@/lib/server-data'
import type { MannerRating } from '@/lib/types'

const VALID_RATINGS = Object.keys(MANNER_TAGS_BY_RATING) as MannerRating[]

const ERROR_STATUS: Record<Exclude<Awaited<ReturnType<typeof submitMannerReview>>, { ok: true }>['code'], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  DUPLICATE: 409,
  INVALID_TAGS: 400,
}

/**
 * 매너평가 제출 (§17-5). 클라이언트는 rating과 tags만 보낸다 — 점수 변화량(delta)은
 * 서버(lib/manner.ts의 MANNER_DELTA)가 결정하며, 클라이언트가 직접 전달할 수 없다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const revieweeId = typeof body?.revieweeId === 'string' ? body.revieweeId : ''
  const rating = body?.rating as MannerRating | undefined
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : []

  if (!revieweeId || !rating || !VALID_RATINGS.includes(rating)) {
    return NextResponse.json({ error: '올바르지 않은 요청입니다.' }, { status: 400 })
  }

  const result = await submitMannerReview(id, me.id, revieweeId, rating, tags)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: ERROR_STATUS[result.code] })
  }

  return NextResponse.json({ ok: true })
}
