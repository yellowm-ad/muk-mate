import { MANNER_STAGE_META } from '@/lib/constants'
import type { MannerStage } from '@/lib/types'
import { cn } from '@/lib/utils'

// 당근마켓 매너온도 컨셉을 참고한 그라데이션 게이지 — 실제 온도계처럼 낮은 점수는 차가운
// 파란 계열, 높은 점수는 따뜻한 코랄 계열로 이어지는 고정 그라데이션 트랙을 두고, 채워진
// 너비(score%)만큼만 보여준다. 색상은 §6-2 팔레트 + MannerAvatar 색상 팔레트와 맞췄다.
const GAUGE_GRADIENT =
  'linear-gradient(90deg, #8FA6B8 0%, #BEDCCB 28%, #F4D88A 52%, #F3B79A 76%, #E97865 100%)'

// 평가 3개 미만(점수 비공개)이어도 게이지가 완전히 비어 보이지 않도록 최소한의 시작점을 준다.
const NEW_MEMBER_FILL_PERCENT = 8

export function MannerGauge({
  score,
  stage,
  className,
  size = 'md',
}: {
  score: number | null
  stage: MannerStage
  className?: string
  size?: 'sm' | 'md'
}) {
  const pct = score === null ? NEW_MEMBER_FILL_PERCENT : Math.max(4, Math.min(100, Math.round(score)))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('font-extrabold text-foreground', size === 'sm' ? 'text-base' : 'text-2xl')}>
          {score !== null ? `${Math.round(score)}점` : '?'}
        </span>
        <span className="text-xs font-bold text-muted-foreground">{MANNER_STAGE_META[stage].label}</span>
      </div>
      <div className={cn('relative w-full overflow-hidden rounded-full bg-muted', size === 'sm' ? 'h-2' : 'h-3')}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: GAUGE_GRADIENT }}
        />
      </div>
      {score === null && <p className="text-[11px] text-muted-foreground">평가 3개가 모이면 점수가 공개돼요.</p>}
    </div>
  )
}
