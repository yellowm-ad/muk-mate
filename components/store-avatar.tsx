import { cn } from '@/lib/utils'

// 가게명/닉네임 첫 글자를 딴 원형 아바타. (이미지 대신 이니셜)
const PALETTE = [
  'bg-[#FFE3D0] text-[#D9560B]',
  'bg-[#FCE7C8] text-[#B4690E]',
  'bg-[#D7F0E4] text-[#1B7F52]',
  'bg-[#DCE7FB] text-[#2B5FC0]',
  'bg-[#F4DBE8] text-[#B03A78]',
  'bg-[#E4E0F7] text-[#5B46B0]',
]

function pickColor(seed: string) {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return PALETTE[sum % PALETTE.length]
}

export function StoreAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initial = name.trim().charAt(0) || '?'
  return (
    <div
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold',
        pickColor(name),
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  )
}
