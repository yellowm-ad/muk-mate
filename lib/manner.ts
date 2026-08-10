// 매너 포만도(PRD §17-5) — DB에 접근하는 조회 시점 반영 로직.
// 순수 상수·계산 함수(태그 목록, 단계 라벨, getMannerStage 등)는 lib/manner-constants.ts에 있다 —
// 이 파일은 getDb()를 import하므로 클라이언트 컴포넌트에서 가져오면 안 된다(server-only 가드는
// 없지만 lib/notifications.ts와 동일하게 API 라우트/server-data.ts에서만 호출한다).

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { getDb } from '@/lib/db'
import { mannerEvents, mannerProfiles, mannerReviews } from '@/lib/db/schema'
import { MANNER_DELTA } from '@/lib/manner-constants'
import type { MannerRating } from '@/lib/types'

export * from '@/lib/manner-constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = any

/**
 * 크론 없이 조회 시점에 반영 여부를 판정한다 (CLAUDE.md 절대 제약 3번과 동일 패턴,
 * server-data.ts의 computeEffectiveStatus가 pot 마감을 다루는 방식과 대응).
 *
 * userId가 받은 평가(mannerReviews.revieweeId = userId) 중 아직 반영되지 않은 것 가운데
 * (a) 같은 주문에서 반대 방향 평가도 이미 존재하거나 (b) visibleAfter(최초 평가 후 48시간)가
 * 지난 것만 골라 manner_profiles에 델타를 합산하고 manner_events에 기록한다.
 *
 * 매너 관련 조회(getMannerProfile 등) 진입점에서 항상 먼저 호출해 최신 상태를 보장한다.
 * neon-http 드라이버는 인터랙티브 트랜잭션을 지원하지 않아(이 프로젝트 전반의 다른 다단계
 * 쓰기와 동일하게) 트랜잭션 없이 순차 실행한다 — 동시 요청 시 극히 드물게 이중 반영될 수
 * 있으나 MVP 트래픽 규모에서는 감수한다.
 */
export async function applyDueMannerReviews(userId: string): Promise<void> {
  const db: DbOrTx = getDb()

  const pending = await db
    .select({
      id: mannerReviews.id,
      potId: mannerReviews.potId,
      reviewerId: mannerReviews.reviewerId,
      rating: mannerReviews.rating,
      visibleAfter: mannerReviews.visibleAfter,
    })
    .from(mannerReviews)
    .where(and(eq(mannerReviews.revieweeId, userId), isNull(mannerReviews.appliedAt)))

  if (pending.length === 0) return

  const now = new Date()
  const due: typeof pending = []

  for (const review of pending) {
    if (review.visibleAfter.getTime() <= now.getTime()) {
      due.push(review)
      continue
    }
    const [counterpart] = await db
      .select({ id: mannerReviews.id })
      .from(mannerReviews)
      .where(
        and(
          eq(mannerReviews.potId, review.potId),
          eq(mannerReviews.reviewerId, userId),
          eq(mannerReviews.revieweeId, review.reviewerId),
        ),
      )
      .limit(1)
    if (counterpart) due.push(review)
  }

  if (due.length === 0) return

  const [profile] = await db.select().from(mannerProfiles).where(eq(mannerProfiles.userId, userId)).limit(1)
  const currentScore = profile ? Number(profile.score) : 50
  const totalDelta = due.reduce((sum: number, r: (typeof due)[number]) => sum + MANNER_DELTA[r.rating as MannerRating], 0)
  const nextScore = Math.min(100, Math.max(0, currentScore + totalDelta))
  const positiveDelta = due.filter((r: (typeof due)[number]) => r.rating === 'GOOD').length
  const negativeDelta = due.filter((r: (typeof due)[number]) => r.rating === 'BAD').length

  if (profile) {
    await db
      .update(mannerProfiles)
      .set({
        score: nextScore.toFixed(2),
        reviewCount: profile.reviewCount + due.length,
        positiveCount: profile.positiveCount + positiveDelta,
        negativeCount: profile.negativeCount + negativeDelta,
        updatedAt: now,
      })
      .where(eq(mannerProfiles.userId, userId))
  } else {
    await db.insert(mannerProfiles).values({
      userId,
      score: nextScore.toFixed(2),
      reviewCount: due.length,
      positiveCount: positiveDelta,
      negativeCount: negativeDelta,
      updatedAt: now,
    })
  }

  await db.insert(mannerEvents).values(
    due.map((r: (typeof due)[number]) => ({
      userId,
      reviewId: r.id,
      reasonCode: `REVIEW_${r.rating}`,
      delta: MANNER_DELTA[r.rating as MannerRating].toFixed(2),
    })),
  )

  await db
    .update(mannerReviews)
    .set({ appliedAt: now })
    .where(
      inArray(
        mannerReviews.id,
        due.map((r: (typeof due)[number]) => r.id),
      ),
    )
}
