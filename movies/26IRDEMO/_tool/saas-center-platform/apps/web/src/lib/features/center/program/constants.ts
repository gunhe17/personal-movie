/**
 * 프로그램 관리 상수/타입
 */

import type { ProgramType } from '$lib/hooks/actions/program.action'

export const PROGRAM_MODAL_WIDTH = 560

/** 프로그램 유형 라벨 */
export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  INDIVIDUAL: '개별',
  GROUP: '그룹'
}

/** 카드 상단 담당자 아바타 최대 표시 개수 */
export const MAX_VISIBLE_MANAGERS = 4

/** 유형 필터 옵션 ('all' = 전체) */
export type ProgramTypeFilter = 'all' | ProgramType

/** 활성 상태 필터 옵션 */
export type ProgramActiveFilter = 'all' | 'active' | 'inactive'

/** 정렬 기준 */
export type ProgramSortKey = 'name' | 'price_desc' | 'price_asc' | 'duration'

export const PROGRAM_SORT_OPTIONS: { value: ProgramSortKey; title: string }[] = [
  { value: 'name', title: '이름순' },
  { value: 'price_desc', title: '금액 높은순' },
  { value: 'price_asc', title: '금액 낮은순' },
  { value: 'duration', title: '소요시간순' }
]

export const PROGRAM_TYPE_FILTER_OPTIONS: {
  value: ProgramTypeFilter
  title: string
}[] = [
  { value: 'all', title: '전체 유형' },
  { value: 'INDIVIDUAL', title: '개별' },
  { value: 'GROUP', title: '그룹' }
]

export const PROGRAM_ACTIVE_FILTER_OPTIONS: {
  value: ProgramActiveFilter
  title: string
}[] = [
  { value: 'all', title: '전체 상태' },
  { value: 'active', title: '운영중' },
  { value: 'inactive', title: '중단' }
]
