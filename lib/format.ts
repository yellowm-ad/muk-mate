// 시간·금액·거리 표기 유틸 (모두 한국 시간 기준, 상대 표기)

const KR_DAY = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

/** "오늘 19:30" / "내일 12:00" / "6/14(토) 18:00" 형태의 절대 시각 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000)

  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `내일 ${time}`
  if (diffDays === -1) return `어제 ${time}`
  return `${d.getMonth() + 1}/${d.getDate()}(${KR_DAY[d.getDay()]}) ${time}`
}

/** "23분 후 마감" / "2시간 후 마감" / "마감됨" 형태의 상대 표기 */
export function formatDeadline(iso: string): { text: string; urgent: boolean; expired: boolean } {
  const target = new Date(iso).getTime()
  const diffMs = target - Date.now()

  if (diffMs <= 0) return { text: '마감됨', urgent: false, expired: true }

  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return { text: `${mins}분 후 마감`, urgent: mins <= 30, expired: false }

  const hours = Math.floor(mins / 60)
  if (hours < 24) return { text: `${hours}시간 후 마감`, urgent: false, expired: false }

  const days = Math.floor(hours / 24)
  return { text: `${days}일 후 마감`, urgent: false, expired: false }
}

/** 채팅 목록/말풍선용 상대 시각: "방금", "12분 전", "오후 7:30", "어제" */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)

  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)

  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const time = `${ampm} ${h12}:${pad(d.getMinutes())}`

  if (diffDays === 0) return time
  if (diffDays === 1) return '어제'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 말풍선 옆 짧은 시각: "오후 7:30" */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${pad(d.getMinutes())}`
}

/** 날짜 구분선용: "2026년 6월 14일 토요일" */
export function formatDateDivider(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${KR_DAY[d.getDay()]}요일`
}

/** 같은 날짜인지 (날짜 구분선 판단용) */
export function isSameDay(a: string, b: string): boolean {
  const x = new Date(a)
  const y = new Date(b)
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  )
}

/** 12000 -> "12,000원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 320 -> "320m", 1200 -> "1.2km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}
