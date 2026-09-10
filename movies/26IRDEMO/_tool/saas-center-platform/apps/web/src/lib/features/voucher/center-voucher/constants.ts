/**
 * CenterVoucher 상수
 */

// ─── 활성 여부 필터 옵션 ───
export const ACTIVE_STATUS_OPTIONS = [
  { value: 'all', title: '전체 상태' },
  { value: 'true', title: '활성' },
  { value: 'false', title: '비활성' }
] as const

export type ActiveStatusFilter = 'all' | 'true' | 'false'

// ─── 활성 라벨/색상 ───
export const ACTIVE_LABEL = {
  true: '활성',
  false: '비활성'
} as const

export const ACTIVE_COLOR = {
  true: 'green',
  false: 'gray'
} as const

// ─── 모달 사이즈 ───
export const MODAL_SIZES = {
  create: { size: 'lg' as const },
  edit: { size: 'lg' as const },
  delete: { customWidth: 420 }
} as const

// ─── 페이지 크기 디폴트 ───
export const DEFAULT_PAGE_SIZE = 50

// ─── 뷰 타입 ───
export type ViewType = 'table' | 'card'
