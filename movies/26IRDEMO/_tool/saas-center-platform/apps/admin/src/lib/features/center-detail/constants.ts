// ─── 내담자 상태 ───

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: '활성',
  inactive: '비활성',
  archived: '보관'
}

export const CLIENT_STATUS_OPTIONS = [
  { value: '', title: '전체' },
  { value: 'active', title: '활성' },
  { value: 'inactive', title: '비활성' },
  { value: 'archived', title: '보관' }
]

export const CLIENT_STATUS_BADGE_CLASSES: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  archived: 'bg-amber-50 text-amber-700'
}

// ─── 페이지네이션 ───

export const CLIENT_PAGE_SIZE = 10
export const MEMBER_PAGE_SIZE = 5
