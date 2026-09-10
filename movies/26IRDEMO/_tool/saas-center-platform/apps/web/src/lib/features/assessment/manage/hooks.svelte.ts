/**
 * 검사 관리 페이지 커스텀 훅
 * Svelte 5 runes 기반 상태 관리
 */

import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
  parseFiltersFromUrl,
  toSearchParams,
  type EnabledFilter,
  type ActiveFilter,
  type SortOrder,
  type AssessmentTypeFilter,
  type ManageFilters
} from './filters'
import {
  type TabType,
  SEARCH_DEBOUNCE_DELAY,
  DEFAULT_PAGE_SIZE
} from './constants'

/**
 * 필터 상태 관리 훅
 * - URL 파싱으로 초기값 설정
 * - 디바운스된 검색어 관리
 * - URL 동기화
 */
export function useManageFilters(initialUrl: URL, pathname: string) {
  // URL에서 초기 상태 파싱
  const initialFilters = parseFiltersFromUrl(initialUrl)
  const initialEnabled: EnabledFilter =
    initialFilters.enabled === 'all'
      ? 'enabled'
      : (initialFilters.enabled ?? 'enabled')
  const initialActive: ActiveFilter = initialFilters.active ?? 'all'
  const initialSort: SortOrder = initialFilters.sort ?? 'oldest'
  const initialAssessmentType: AssessmentTypeFilter =
    initialFilters.assessmentType ?? 'all'

  // 상태 정의
  let currentPage = $state(initialFilters.page)
  let size = $state(DEFAULT_PAGE_SIZE)
  let searchQuery = $state(initialFilters.search)
  let debouncedSearchQuery = $state(initialFilters.search)
  let enabledFilter: EnabledFilter = $state(initialEnabled)
  let activeFilter: ActiveFilter = $state(initialActive)
  let sortOrder: SortOrder = $state(initialSort)
  let assessmentTypeFilter: AssessmentTypeFilter = $state(initialAssessmentType)
  const initialTab: TabType = initialFilters.tab ?? 'single'
  let activeTab: TabType = $state(initialTab)

  // 마운트 상태
  let mounted = $state(false)
  let searchInitialized = $state(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  // 현재 상태 → 필터 모델
  function buildFilters(): ManageFilters {
    return {
      page: currentPage,
      pageSize: size,
      search: debouncedSearchQuery,
      tab: activeTab,
      enabled: enabledFilter,
      active: activeFilter,
      sort: sortOrder,
      assessmentType: assessmentTypeFilter
    }
  }

  // URL 업데이트 함수
  function updateURL() {
    const params = toSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  // 마운트 시 플래그 설정
  onMount(() => {
    mounted = true
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  })

  // 검색어 디바운싱
  $effect(() => {
    const query = searchQuery

    if (!searchInitialized) {
      searchInitialized = true
      return
    }

    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    searchTimeout = setTimeout(() => {
      debouncedSearchQuery = query
      currentPage = 1
    }, SEARCH_DEBOUNCE_DELAY)

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  })

  // 필터 상태 변경 시 URL 업데이트
  $effect(() => {
    // 의존성 추적
    currentPage
    debouncedSearchQuery
    activeTab
    enabledFilter
    activeFilter
    assessmentTypeFilter

    if (!mounted) return
    updateURL()
  })

  // 필터 리셋
  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    activeTab = 'single'
    activeFilter = 'all'
    enabledFilter = 'enabled'
    sortOrder = 'oldest'
    assessmentTypeFilter = 'all'
    currentPage = 1
  }

  // 탭 변경 (단일 검사 / 세트 검사 전환)
  function changeTab(tab: TabType) {
    activeTab = tab
    currentPage = 1
  }

  return {
    // 상태 (getter)
    get currentPage() {
      return currentPage
    },
    get size() {
      return size
    },
    get searchQuery() {
      return searchQuery
    },
    get debouncedSearchQuery() {
      return debouncedSearchQuery
    },
    get enabledFilter() {
      return enabledFilter
    },
    get activeFilter() {
      return activeFilter
    },
    get sortOrder() {
      return sortOrder
    },
    get assessmentTypeFilter() {
      return assessmentTypeFilter
    },
    get activeTab() {
      return activeTab
    },
    get mounted() {
      return mounted
    },

    // 상태 (setter)
    set currentPage(value: number) {
      currentPage = value
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    set activeFilter(value: ActiveFilter) {
      activeFilter = value
    },
    set sortOrder(value: SortOrder) {
      sortOrder = value
    },
    set assessmentTypeFilter(value: AssessmentTypeFilter) {
      assessmentTypeFilter = value
    },

    // 메서드
    buildFilters,
    resetFilters,
    changeTab
  }
}

// 타입 re-export
export type { TabType } from './constants'
export type {
  EnabledFilter,
  ActiveFilter,
  SortOrder,
  AssessmentTypeFilter,
  ManageFilters
} from './filters'
