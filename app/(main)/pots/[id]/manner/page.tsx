import { notFound } from 'next/navigation'

import { PotMannerReviewView } from '@/components/pots/pot-manner-review-view'
import { getCurrentUser, getMannerReviewTargets, getPotById } from '@/lib/server-data'

/** 매너 평가 화면 (§12-3) — pot이 ORDERED이고 호스트/승인된 참여자일 때만 접근 가능 */
export default async function PotMannerReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()

  const pot = await getPotById(id, me.id)
  if (!pot) {
    notFound()
  }

  const targets = await getMannerReviewTargets(id, me.id)

  return <PotMannerReviewView potId={id} storeName={pot.storeName} initialTargets={targets} />
}
