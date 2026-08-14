import { cn } from '@/lib/utils'
import { MANNER_AVATAR_ACCESSORY_META, MANNER_AVATAR_COLOR_META, MANNER_STAGE_META } from '@/lib/constants'
import type { MannerAvatarAccessory, MannerAvatarColor, MannerStage } from '@/lib/types'

const STAGE_CLASS: Record<MannerStage, string> = {
  NEW: 'bg-muted text-muted-foreground',
  STARVING: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PECKISH: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  STEADY: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  FULL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  HAPPY: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
}

export function MannerBadge({
  stage,
  score,
  reviewCount,
  avatarColor,
  avatarAccessory,
  className,
  hideStageLabel,
}: {
  stage: MannerStage
  /** null이면(리뷰 3개 미만) 점수는 표시하지 않는다(§4-1) */
  score: number | null
  reviewCount?: number
  /** 사용자가 고른 아바타 색상 — 배지 배경은 여전히 매너 단계가 결정한다(§6-4), 이건 왼쪽 점으로만 표시 */
  avatarColor?: MannerAvatarColor
  avatarAccessory?: MannerAvatarAccessory
  className?: string
  /** 바로 아래 MannerGauge가 단계 이름을 이미 보여주는 화면(마이페이지·공개 프로필)에서 줄바꿈/글자 넘침을 막기 위해 중복 표기를 뺀다 */
  hideStageLabel?: boolean
}) {
  const meta = MANNER_STAGE_META[stage]
  const accessoryEmoji = avatarAccessory ? MANNER_AVATAR_ACCESSORY_META[avatarAccessory].emoji : ''
  const label = hideStageLabel
    ? score !== null
      ? `포만도 ${Math.round(score)}점`
      : ''
    : score !== null
      ? `매너 포만도 ${Math.round(score)}점 · ${meta.label}`
      : meta.label
  // §12-1: "평가 개수"는 호버 툴팁이 아니라 화면에 항상 보이는 텍스트여야 한다 — 모바일엔 호버가 없다.
  const countSuffix = typeof reviewCount === 'number' ? `${label ? ' · ' : ''}평가 ${reviewCount}개` : ''

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
        STAGE_CLASS[stage],
        className,
      )}
    >
      {avatarColor && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: MANNER_AVATAR_COLOR_META[avatarColor].hex }}
        />
      )}
      <span aria-hidden>{meta.emoji}</span>
      {label}
      {countSuffix}
      {accessoryEmoji && <span aria-hidden>{accessoryEmoji}</span>}
    </span>
  )
}
