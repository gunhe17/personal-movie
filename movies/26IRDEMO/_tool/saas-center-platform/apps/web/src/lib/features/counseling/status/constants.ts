/**
 * 상담 현황 페이지 상수 및 타입 정의
 */

export type SortOrder = 'asc' | 'desc'

export type CounselingTypeFilter = 'all' | 'individual' | 'group'

export type TabType = 'all' | 'active' | 'completed'

export type ViewType = 'list' | 'grid'

// 대시보드 시그널 전용 필터 — 페이지 필터 UI에는 노출하지 않고 URL(딥링크)로만 진입한다
export type CounselingSignalFilter = '' | 'unprocessed' | 'needs_review'

// 대시보드 시그널 딥링크(?signal=) 진입 시 SignalQueueBar 축소 모드에 넘길 라벨.
// 판정 정의는 백엔드(list_counseling_cases_enriched_handler)가 SSOT — 문구만 여기서 대응.
export const COUNSELING_SIGNAL_CHIPS: Record<
  'unprocessed' | 'needs_review',
  { label: string }
> = {
  unprocessed: { label: '처리하지 않은 지난 회기가 있는 사례' },
  needs_review: { label: '연장·종결 확인이 필요한 사례' }
}

/** 케이스 상태 탭 (정책: active=진행중, completed=종결) */
export const COUNSELING_TABS = [
  { value: 'all' as const, label: '전체' },
  { value: 'active' as const, label: '진행중' },
  { value: 'completed' as const, label: '종결' }
]

export interface SelectOption<T extends string = string> {
  value: T
  title: string
}

export const SEARCH_DEBOUNCE_DELAY = 300

export const sortOptions: SelectOption<SortOrder>[] = [
  { value: 'desc', title: '최신순' },
  { value: 'asc', title: '오래된순' }
]
