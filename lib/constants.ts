import type { Approval, PotStatus, Zone, ZoneCode } from '@/lib/types'

/** signup(1단계) → onboarding(2단계) 사이에 임시로 들고 다니는 가입 정보의 sessionStorage 키 */
export const SIGNUP_DRAFT_KEY = 'mukmate:signup-draft'

/** 활동 지역(권역) 고정값 */
export const ZONES: Zone[] = [
  { code: 'GUJEONGMUN', label: '구정문 권역' },
  { code: 'SINJEONGMUN', label: '신정문 권역' },
  { code: 'DORM', label: '기숙사 권역' },
  { code: 'SADAEBUGO', label: '사대부고 주변' },
]

export function zoneLabel(code: ZoneCode): string {
  return ZONES.find((z) => z.code === code)?.label ?? '전체'
}

/** 상태 배지 라벨 + 색상 토큰 매핑 */
export const POT_STATUS_META: Record<
  PotStatus,
  { label: string; token: string }
> = {
  OPEN: { label: '모집 중', token: 'status-open' },
  CLOSED: { label: '모집 마감', token: 'status-closed' },
  ORDERED: { label: '주문 완료', token: 'status-ordered' },
  CANCELED: { label: '취소', token: 'status-canceled' },
}

export const APPROVAL_META: Record<Approval, { label: string; token: string }> = {
  PENDING: { label: '승인 대기', token: 'status-closed' },
  APPROVED: { label: '승인', token: 'status-open' },
  REJECTED: { label: '거절', token: 'status-canceled' },
}

