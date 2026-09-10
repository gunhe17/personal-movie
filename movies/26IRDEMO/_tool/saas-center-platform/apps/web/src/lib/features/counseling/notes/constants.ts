import type { MyNotesStatusFilter } from '$lib/hooks/actions/counseling.action'

export const NOTES_PAGE_SIZE = 20

export const NOTES_TABS: { value: MyNotesStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'written', label: '작성완료' },
  { value: 'missing', label: '미작성' }
]

export const NOTES_EMPTY_MESSAGES: Record<MyNotesStatusFilter, string> = {
  all: '작성된 일지가 없어요',
  written: '작성완료된 일지가 없어요',
  missing: '미작성 일지가 없어요'
}

// 프로그램 유형(개별/그룹) 필터 — 기본값 'all'(전체 유형)은 쿼리에 실리지 않는다
export const NOTES_PROGRAM_TYPE_OPTIONS = [
  { value: 'all', title: '전체 유형' },
  { value: 'INDIVIDUAL', title: '개별' },
  { value: 'GROUP', title: '그룹' }
]
