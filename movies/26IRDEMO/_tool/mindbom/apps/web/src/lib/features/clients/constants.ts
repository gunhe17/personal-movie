import { LIST_PAGE_SIZE } from '$lib/features/common/filters'

export const CLIENT_PAGE_SIZE = LIST_PAGE_SIZE

export const CLIENT_STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' }
] as const

export const CLIENT_GENDER_OPTIONS = [
  { value: 'all', label: '전체 성별' },
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' }
] as const

export const CLIENT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  active: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    label: '활성'
  },
  inactive: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    label: '비활성'
  }
}

export const GENDER_LABELS: Record<string, string> = {
  male: '남',
  female: '여'
}

export const REFERRAL_SOURCE_OPTIONS = [
  { value: 'hospital', label: '병원' },
  { value: 'school', label: '학교' },
  { value: 'self', label: '자발적' },
  { value: 'other', label: '기타' }
] as const
