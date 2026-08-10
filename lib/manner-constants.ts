// 매너 포만도(PRD §17-5) 순수 상수·계산 함수 — DB import가 전혀 없어 클라이언트 컴포넌트에서도
// 안전하게 쓸 수 있다 (MannerAvatar, 매너 평가 화면의 태그 목록 등). DB에 접근하는 로직은 lib/manner.ts.

import type { MannerRating, MannerStage } from '@/lib/types'

export const MANNER_DELTA: Record<MannerRating, number> = {
  GOOD: 1.5,
  NEUTRAL: 0,
  BAD: -3,
}

// 문서 §9-1~9-3 태그 — 평가(rating)별로 고를 수 있는 태그를 서버에서도 검증한다.
export const MANNER_TAGS_BY_RATING: Record<MannerRating, string[]> = {
  GOOD: [
    '약속 시간을 잘 지켜요',
    '답장이 빨라요',
    '정산이 정확해요',
    '친절하게 대화해요',
    '다시 함께 주문하고 싶어요',
  ],
  NEUTRAL: ['문제없이 거래를 마쳤어요'],
  BAD: [
    '연락이 잘되지 않았어요',
    '약속 시간에 늦었어요',
    '정산이 원활하지 않았어요',
    '불쾌한 말을 했어요',
    '참여 후 나타나지 않았어요',
  ],
}

export const MANNER_STAGE_LABELS: Record<MannerStage, string> = {
  NEW: '새로운 메이트',
  HUNGRY: '허기 경보',
  PECKISH: '출출한 메이트',
  FULL: '든든한 메이트',
  HAPPY: '배부른 메이트',
  DELIGHTED: '행복한 먹메이트',
}

// 문서 §5 단계 구간 — 실사용 데이터로 조정할 수 있도록 상수로 분리.
const MANNER_STAGE_THRESHOLDS: { max: number; stage: MannerStage }[] = [
  { max: 29, stage: 'HUNGRY' },
  { max: 49, stage: 'PECKISH' },
  { max: 69, stage: 'FULL' },
  { max: 84, stage: 'HAPPY' },
  { max: 100, stage: 'DELIGHTED' },
]

// 평가 3개 미만이면 점수와 무관하게 "새로운 메이트"로 표시한다 (문서 §4-1, §17-5).
export const MANNER_MIN_REVIEWS_TO_SHOW_SCORE = 3

export function getMannerStage(score: number, reviewCount: number): MannerStage {
  if (reviewCount < MANNER_MIN_REVIEWS_TO_SHOW_SCORE) return 'NEW'
  return MANNER_STAGE_THRESHOLDS.find((t) => score <= t.max)?.stage ?? 'DELIGHTED'
}

const MANNER_REVIEW_VISIBLE_AFTER_MS = 48 * 60 * 60 * 1000
export const MANNER_REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function mannerReviewVisibleAfter(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MANNER_REVIEW_VISIBLE_AFTER_MS)
}
