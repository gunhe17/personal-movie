// 기본값(desc = 최신 순)을 맨 앞에 둔다 — 셀렉트를 열었을 때 기본 선택이 첫 항목으로 보이도록.
export const CLIENT_SORT_OPTIONS = [
  { value: 'desc', title: '최신 순' },
  { value: 'next_session', title: '회기 임박순' },
  { value: 'asc', title: '오래된 순' },
  { value: 'name', title: '이름 순' }
]

import { t } from '$lib/ontology/terms'

export const CLIENT_ROLE_OPTIONS = [
  { value: 'all', title: '전체' },
  { value: 'GUARDIAN', title: t('guardian') },
  { value: 'CHILD', title: t('child') }
]

export const CLIENT_STATUS_OPTIONS = [
  { value: 'all', title: '활동 상태' },
  { value: 'ACTIVE', title: '활동 중' },
  { value: 'INACTIVE', title: '휴면' }
]

export const CLIENT_GENDER_OPTIONS = [
  { value: 'all', title: '성별' },
  { value: 'MALE', title: '남' },
  { value: 'FEMALE', title: '여' }
]

export const CLIENT_STATUS_MAP = {
  ACTIVE: {
    bg: '#49AAEF1A',
    text: 'text-[#49AAEF]',
    content: '활동 중'
  },
  INACTIVE: {
    bg: '#7171711A',
    text: 'text-[#717171]',
    content: '휴면'
  }
}

export const PERSON_STATUS_OPTIONS = [
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성' }
]

export const PERSON_STATUS_STYLES: Record<
  string,
  { bg: string; dotColor: string; textColor: string }
> = {
  active: {
    bg: 'bg-[#22B55F1A]',
    dotColor: 'bg-[#22B55F]',
    textColor: 'text-[#22B55F]'
  },
  inactive: {
    bg: 'bg-gray-100',
    dotColor: 'bg-gray-400',
    textColor: 'text-gray-500'
  }
}

export const CLIENT_PAGE_SIZE = 20
