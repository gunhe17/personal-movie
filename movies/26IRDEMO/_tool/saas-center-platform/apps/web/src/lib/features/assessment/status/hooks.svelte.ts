import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_DELAY,
  type ClientType,
  type SortOrder,
  type TabType,
  type ViewType
} from './constants'
import {
  parseFiltersFromUrl,
  toSearchParams,
  type StatusFilters
} from './filters'

export function useStatusFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize || DEFAULT_PAGE_SIZE)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let sortOrder: SortOrder = $state(initial.sort)
  let activeTab: TabType = $state(initial.tab)
  let counselorIds: string[] = $state(initial.counselorIds)
  let clientType: ClientType = $state(initial.clientType)
  let viewType: ViewType = $state(initial.view)
  let dateFrom: string | null = $state(initial.dateFrom)
  let dateTo: string | null = $state(initial.dateTo)

  let mounted = $state(false)
  let searchInitialized = false
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  function buildFilters(): StatusFilters {
    return {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      sort: sortOrder,
      tab: activeTab,
      counselorIds,
      clientType,
      view: viewType,
      dateFrom,
      dateTo
    }
  }

  function updateURL() {
    const params = toSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  onMount(() => {
    mounted = true
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  })

  // 검색어 디바운싱
  $effect(() => {
    const q = searchQuery
    if (!searchInitialized) {
      searchInitialized = true
      return
    }
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedSearchQuery = q
      currentPage = 1
    }, SEARCH_DEBOUNCE_DELAY)
  })

  // 필터 변경 시 URL 업데이트
  $effect(() => {
    currentPage
    debouncedSearchQuery
    sortOrder
    activeTab
    counselorIds
    clientType
    viewType
    dateFrom
    dateTo

    if (!mounted) return
    updateURL()
  })

  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    sortOrder = 'desc'
    activeTab = 'all'
    counselorIds = []
    clientType = 'all'
    // viewType은 초기화 대상이 아니다 — 초기화는 검색·필터만 되돌린다(보기 방식은 사용자 선택 유지)
    dateFrom = null
    dateTo = null
    currentPage = 1
  }

  function changeTab(tab: TabType) {
    activeTab = tab
    currentPage = 1
  }

  /** 접수일 범위 — 인풋 하나에서 시작·종료를 함께 갱신 */
  function setDateRange(from: string | null, to: string | null) {
    dateFrom = from
    dateTo = to
    currentPage = 1
  }

  return {
    // getters
    get page() {
      return currentPage
    },
    get pageSize() {
      return pageSize
    },
    get searchQuery() {
      return searchQuery
    },
    get debouncedSearchQuery() {
      return debouncedSearchQuery
    },
    get sortOrder() {
      return sortOrder
    },
    get activeTab() {
      return activeTab
    },
    get counselorIds() {
      return counselorIds
    },
    get clientType() {
      return clientType
    },
    get viewType() {
      return viewType
    },
    get dateFrom() {
      return dateFrom
    },
    get dateTo() {
      return dateTo
    },
    get mounted() {
      return mounted
    },

    // setters
    set page(value: number) {
      currentPage = value
    },
    set pageSize(value: number) {
      pageSize = value
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    set sortOrder(value: SortOrder) {
      sortOrder = value
    },
    set activeTab(value: TabType) {
      activeTab = value
    },
    set counselorIds(value: string[]) {
      counselorIds = value
    },
    set clientType(value: ClientType) {
      clientType = value
    },
    set viewType(value: ViewType) {
      viewType = value
    },
    set dateFrom(value: string | null) {
      dateFrom = value
    },
    set dateTo(value: string | null) {
      dateTo = value
    },

    // methods
    buildFilters,
    resetFilters,
    changeTab,
    setDateRange
  }
}
