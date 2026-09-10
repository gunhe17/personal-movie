export type TabType = 'all' | 'pending' | 'processing' | 'completed'

export type SortOrder = 'asc' | 'desc'

export type ViewType = 'list' | 'grid'

export type ClientType = 'all' | 'individual' | 'group'

export interface SelectOption<T extends string = string> {
  value: T
  title: string
}

export const DEFAULT_PAGE_SIZE = 20
export const SEARCH_DEBOUNCE_DELAY = 300

/** 1차 베타: 바로링크 컬럼/버튼의 행 데이터 비노출 (컬럼은 유지, 셀/버튼만 "-" 또는 미렌더) */
export const HIDE_SEND_LINK_AND_RESULT_FOR_BETA = false

/** 결과전송 버튼 노출 여부 (바로링크와 독립적으로 제어) */
export const HIDE_SEND_RESULT_FOR_BETA = false

/** 담당자 필터 기본 옵션 (실제 목록은 getMemberList로 페이지에서 조합) */
export const STAFF_DEFAULT_OPTION: SelectOption = { value: 'all', title: '담당자' }

/** 하위 호환: 담당자 옵션 기본값만 (history 등에서 사용, 메인 현황은 getMemberList 기반) */
export const staffOptions: SelectOption[] = [STAFF_DEFAULT_OPTION]

export const clientTypeOptions: SelectOption<ClientType>[] = [
  { value: 'all', title: '개인/단체' },
  { value: 'individual', title: '개인' },
  { value: 'group', title: '단체' }
]

export const sortOptions: SelectOption<SortOrder>[] = [
  { value: 'desc', title: '최신순' },
  { value: 'asc', title: '오래된순' }
]

