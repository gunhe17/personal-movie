export const RESERVATION_CONFIRM_OPTIONS = [
  { label: '직접 예약 승인', value: 'confirm' },
  { label: '자동 예약 확정', value: 'directly' }
] as const

export const DEPOSIT_TYPE_OPTIONS = [
  { label: '고정 금액', value: 'static' },
  { label: '전체 금액 중 %', value: 'percentile' }
] as const

export const DEPOSIT_EXPIRE_OPTIONS = [
  { label: '1일', value: '1day' },
  { label: '2일', value: '2day' },
  { label: '1시간', value: '1hour' },
  { label: '2시간', value: '2hour' }
] as const
