import { RESERVATION_TAB_LABELS, type ReservationTab } from './constants'

/** 예약 필터 모델 */
export interface ReservationFilters {
  activeTab: ReservationTab
  search: string
}

export const DEFAULT_RESERVATION_FILTERS: ReservationFilters = {
  activeTab: 'pending',
  search: ''
}

/** 검색어 정규화 */
export const normalizeSearchQuery = (query: string) =>
  query.trim().toLowerCase()

/** 탭 라벨 헬퍼 */
export const getTabLabel = (tab: ReservationTab) => RESERVATION_TAB_LABELS[tab]
