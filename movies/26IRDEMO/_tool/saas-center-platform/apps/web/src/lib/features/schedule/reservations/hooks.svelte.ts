/**
 * 예약 현황 페이지 훅
 */

import { RESERVATION_TABS, type ReservationTab } from './constants'
import { DEFAULT_RESERVATION_FILTERS, type ReservationFilters } from './filters'

/**
 * 필터/탭 상태 관리 훅
 */
export function useReservationFilters(initial?: Partial<ReservationFilters>) {
  const initialFilters = { ...DEFAULT_RESERVATION_FILTERS, ...initial }

  let searchQuery = $state(initialFilters.search)
  let activeTab: ReservationTab = $state(initialFilters.activeTab)

  function changeTab(tab: ReservationTab) {
    activeTab = tab
  }

  function resetFilters() {
    searchQuery = ''
    activeTab = 'pending'
  }

  function buildFilters(): ReservationFilters {
    return {
      activeTab,
      search: searchQuery
    }
  }

  return {
    get searchQuery() {
      return searchQuery
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    get activeTab() {
      return activeTab
    },
    set activeTab(value: ReservationTab) {
      activeTab = value
    },
    changeTab,
    resetFilters,
    buildFilters
  }
}

/**
 * 탭 인디케이터 훅
 * manage 페이지와 동일한 패턴 재사용
 */
export function useTabIndicator() {
  let tabsContainer: HTMLDivElement | null = $state(null)
  let tabRefs: Record<ReservationTab, HTMLButtonElement | null> = $state({
    pending: null,
    confirmed: null,
    cancelled: null
  })
  let indicatorStyle = $state({ left: 0, width: 0 })

  function updateIndicator(activeTab: ReservationTab) {
    const activeTabEl = tabRefs[activeTab]
    if (activeTabEl && tabsContainer) {
      const containerRect = tabsContainer.getBoundingClientRect()
      const tabRect = activeTabEl.getBoundingClientRect()
      indicatorStyle = {
        left: tabRect.left - containerRect.left,
        width: tabRect.width
      }
    }
  }

  return {
    get tabsContainer() {
      return tabsContainer
    },
    set tabsContainer(value: HTMLDivElement | null) {
      tabsContainer = value
    },
    get tabRefs() {
      return tabRefs
    },
    get indicatorStyle() {
      return indicatorStyle
    },
    updateIndicator,
    reservationTabs: RESERVATION_TABS
  }
}
