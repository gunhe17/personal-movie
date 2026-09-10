// ─── 필터 옵션 ───

export const STATUS_OPTIONS = [
  { value: 'all', title: '전체' },
  { value: 'retention', title: '보관 중' },
  { value: 'expired', title: '만료 (삭제 대상)' }
]

// ─── 잔여일 뱃지 스타일 ───

export const REMAINING_DAYS_THRESHOLD = {
  EXPIRING_SOON: 7,
  EXPIRED: 0
} as const

export function getRemainingDaysBadge(remainingDays: number, isExpired: boolean) {
  if (isExpired) {
    return { label: '만료', bg: 'bg-red-50', text: 'text-red-600' }
  }
  if (remainingDays <= REMAINING_DAYS_THRESHOLD.EXPIRING_SOON) {
    return { label: `${remainingDays}일`, bg: 'bg-red-50', text: 'text-red-600' }
  }
  return { label: `${remainingDays}일`, bg: 'bg-gray-100', text: 'text-gray-600' }
}

// ─── 내보내기 상태 ───

export const EXPORT_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  processing: '처리 중',
  completed: '완료',
  failed: '실패'
}

// ─── URL 필터 기본값 ───

export const DEFAULT_FILTERS = {
  search: '',
  status: 'all',
  expiring_soon: false,
  page: 1
}

export const PAGE_SIZE = 10
