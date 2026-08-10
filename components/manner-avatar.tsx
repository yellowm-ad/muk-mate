import { cn } from '@/lib/utils'
import type { MannerStage } from '@/lib/types'

// 매너 포만도(PRD §17-5) 단계별 아바타 — 폴리싱된 캐릭터 일러스트가 아니라 코드로 생성한
// SVG 플레이스홀더다. 문서 §16 권장대로 viewBox를 고정하고 얼굴/표정/그릇을 레이어로 분리해
// 두었으니, 나중에 디자이너가 실제 일러스트로 교체할 때 이 레이어 구조를 그대로 따라가면 된다.
// 색상은 문서 §6-2 팔레트(대표 코랄 #E97865 등) 고정 1종 — 색상·소품 커스터마이징은 P1로 미뤘다.

const FACE_COLOR: Record<MannerStage, string> = {
  NEW: '#BEDCCB', // 파스텔 민트 — 새싹처럼 신선한 느낌
  HUNGRY: '#B9BFC7', // 푸른 회색 계열
  PECKISH: '#D8CFC0',
  FULL: '#F4D88A', // 버터 옐로
  HAPPY: '#F3B79A',
  DELIGHTED: '#E97865', // 대표 코랄
}

const BOWL_FILL: Record<MannerStage, number> = {
  NEW: 0.15,
  HUNGRY: 0,
  PECKISH: 0.3,
  FULL: 0.6,
  HAPPY: 0.85,
  DELIGHTED: 1,
}

function Face({ stage }: { stage: MannerStage }) {
  switch (stage) {
    case 'HUNGRY':
      // 힘없는 눈, 처진 자세
      return (
        <g>
          <path d="M35 46 Q38 50 41 46" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M59 46 Q62 50 65 46" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M40 64 Q50 58 60 64" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'PECKISH':
      // 살짝 시무룩
      return (
        <g>
          <circle cx="38" cy="47" r="3" fill="#202937" />
          <circle cx="62" cy="47" r="3" fill="#202937" />
          <path d="M41 63 Q50 59 59 63" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'FULL':
      // 편안한 표정
      return (
        <g>
          <circle cx="38" cy="46" r="3.2" fill="#202937" />
          <circle cx="62" cy="46" r="3.2" fill="#202937" />
          <path d="M40 60 Q50 66 60 60" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'HAPPY':
      // 발그레한 볼, 행복한 표정
      return (
        <g>
          <path d="M33 45 Q38 40 43 45" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M57 45 Q62 40 67 45" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M37 58 Q50 70 63 58" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="32" cy="55" r="5" fill="#F49C8C" opacity="0.7" />
          <circle cx="68" cy="55" r="5" fill="#F49C8C" opacity="0.7" />
        </g>
      )
    case 'DELIGHTED':
      // 통통한 볼, 배를 두드리는 자세 + 반짝임
      return (
        <g>
          <path d="M32 44 Q38 38 44 44" stroke="#202937" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M56 44 Q62 38 68 44" stroke="#202937" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <path d="M35 57 Q50 72 65 57" stroke="#202937" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          <circle cx="30" cy="54" r="6" fill="#F49C8C" opacity="0.8" />
          <circle cx="70" cy="54" r="6" fill="#F49C8C" opacity="0.8" />
          <path d="M12 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#F4D88A" />
          <path d="M84 60 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill="#F4D88A" />
        </g>
      )
    case 'NEW':
    default:
      // 중립 표정
      return (
        <g>
          <circle cx="38" cy="46" r="3" fill="#202937" />
          <circle cx="62" cy="46" r="3" fill="#202937" />
          <line x1="42" y1="61" x2="58" y2="61" stroke="#202937" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )
  }
}

function Bowl({ stage, fill }: { stage: MannerStage; fill: number }) {
  const fillWidth = 34 * fill
  return (
    <g>
      <path d="M33 82 Q50 92 67 82 L64 86 Q50 94 36 86 Z" fill="#FFFFFF" stroke="#202937" strokeWidth="1.5" />
      {fill > 0 && (
        <rect x={50 - fillWidth / 2} y="79" width={fillWidth} height="4" rx="2" fill="#F4D88A" />
      )}
      {stage === 'NEW' && <path d="M48 76 Q50 70 52 76" stroke="#3F9A5C" strokeWidth="2" strokeLinecap="round" fill="none" />}
    </g>
  )
}

export function MannerAvatar({
  stage,
  size = 44,
  className,
}: {
  stage: MannerStage
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`매너 아바타 (${stage})`}
    >
      <circle cx="50" cy="48" r="38" fill={FACE_COLOR[stage]} />
      <Face stage={stage} />
      <Bowl stage={stage} fill={BOWL_FILL[stage]} />
    </svg>
  )
}
