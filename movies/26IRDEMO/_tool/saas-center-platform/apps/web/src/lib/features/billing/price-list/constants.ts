import type {
  ServiceType,
  PriceListSource
} from '$lib/hooks/actions/priceList.action'

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  counseling: '상담',
  assessment: '검사',
  package: '패키지'
} as const

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  counseling: 'bg-blue-50 text-blue-700',
  assessment: 'bg-purple-50 text-purple-700',
  package: 'bg-amber-50 text-amber-700'
} as const

// 단가 출처: manual=수동 입력, synced=시스템 자동 입력(검사 카탈로그 등)
export const SOURCE_LABELS: Record<PriceListSource, string> = {
  manual: '수동 입력',
  synced: '자동 입력'
} as const

export const SOURCE_COLORS: Record<PriceListSource, string> = {
  manual: 'bg-gray-100 text-gray-600',
  synced: 'bg-mint-50 text-mint-600'
} as const

export const SERVICE_TYPE_OPTIONS: { value: string; title: string }[] = [
  { value: 'all', title: '전체 유형' },
  { value: 'counseling', title: '상담' },
  { value: 'assessment', title: '검사' },
  { value: 'package', title: '패키지' }
]

export const ACTIVE_STATUS_OPTIONS: { value: string; title: string }[] = [
  { value: 'all', title: '전체 상태' },
  { value: 'true', title: '활성' },
  { value: 'false', title: '비활성' }
]

export const PRICE_LIST_PAGE_SIZE = 20

export const MODAL_SIZES = {
  create: { customWidth: 540 },
  edit: { customWidth: 540 },
  delete: { customWidth: 420 }
} as const
