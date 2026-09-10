import { TYPE_OPTIONS } from '$lib/features/assessment/constants'

// ─── 필터 옵션 ───

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', title: '전체 상태' },
  { value: 'true', title: '활성' },
  { value: 'false', title: '비활성' }
]

export const TYPE_FILTER_OPTIONS = [
  { value: 'all', title: '전체 유형' },
  ...TYPE_OPTIONS
]

// ─── 유형별 뱃지 색상 (web 카드 폴더 색상 계열에 맞춤) ───

export const TYPE_BADGE_CLASSES: Record<string, string> = {
  objective: 'bg-blue-50 text-blue-700',
  projective: 'bg-violet-50 text-violet-700',
  intelligence: 'bg-teal-50 text-teal-700',
  developmental: 'bg-emerald-50 text-emerald-700'
}

export const DEFAULT_BADGE_CLASS = 'bg-gray-100 text-gray-600'
