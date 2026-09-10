/**
 * 상담 현황 페이지 필터 훅
 */
import { afterNavigate, goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
  SEARCH_DEBOUNCE_DELAY,
  type CounselingSignalFilter,
  type CounselingTypeFilter,
  type SortOrder,
  type TabType,
  type ViewType
} from './constants'
import {
  parseFiltersFromUrl,
  toSearchParams,
  type CounselingFilters
} from './filters'

export function useCounselingFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)
  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let sortOrder: SortOrder = $state(initial.sort)
  let selectedManagerNames: string[] = $state(initial.selectedManagerNames)
  let counselingType: CounselingTypeFilter = $state(initial.counselingType)
  let startDate: string | null = $state(initial.startDate)
  let endDate: string | null = $state(initial.endDate)
  let activeTab: TabType = $state(initial.status)
  let viewType: ViewType = $state(initial.view)
  let signal: CounselingSignalFilter = $state(initial.signal)

  let mounted = $state(false)
  let searchInitialized = false
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let selfNavigation = false

  function buildFilters(): CounselingFilters {
    return {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      sort: sortOrder,
      selectedManagerNames,
      counselingType,
      startDate,
      endDate,
      status: activeTab,
      view: viewType,
      signal
    }
  }

  function updateURL() {
    const params = toSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    selfNavigation = true
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  // 마운트 유지 상태에서 같은 라우트로 재진입(사이드바 링크·딥링크)하면 컴포넌트가
  // 재생성되지 않으므로 URL을 다시 읽어 상태에 반영한다. 자기가 기록한 URL(updateURL)은
  // 상태가 원본이라 스킵. pageSize(화면 높이 측정값)·view(로컬 UI 선호)는 URL에 없어 유지.
  afterNavigate((nav) => {
    if (selfNavigation) {
      selfNavigation = false
      return
    }
    const url = nav.to?.url
    if (!url || url.pathname !== pathname) return
    const parsed = parseFiltersFromUrl(url)
    searchQuery = parsed.search
    debouncedSearchQuery = parsed.search
    sortOrder = parsed.sort
    selectedManagerNames = parsed.selectedManagerNames
    counselingType = parsed.counselingType
    startDate = parsed.startDate
    endDate = parsed.endDate
    activeTab = parsed.status
    signal = parsed.signal
    currentPage = parsed.page
  })

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
    selectedManagerNames
    counselingType
    startDate
    endDate
    activeTab
    viewType
    signal

    if (!mounted) return
    updateURL()
  })

  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    sortOrder = 'desc'
    selectedManagerNames = []
    counselingType = 'all'
    startDate = null
    endDate = null
    activeTab = 'all'
    viewType = 'list'
    signal = ''
    currentPage = 1
  }

  function changeTab(tab: TabType) {
    activeTab = tab
    currentPage = 1
  }

  /** 접수일 기간 필터 — DateRangeFilter가 '적용'을 눌렀을 때만 호출한다 */
  function setDateRange(from: string | null, to: string | null) {
    startDate = from
    endDate = to
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
    get selectedManagerNames() {
      return selectedManagerNames
    },
    get counselingType() {
      return counselingType
    },
    get startDate() {
      return startDate
    },
    get endDate() {
      return endDate
    },
    get activeTab() {
      return activeTab
    },
    get viewType() {
      return viewType
    },
    get signal() {
      return signal
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
    set selectedManagerNames(value: string[]) {
      selectedManagerNames = [...value]
    },
    set counselingType(value: CounselingTypeFilter) {
      counselingType = value
    },
    set startDate(value: string | null) {
      startDate = value
    },
    set endDate(value: string | null) {
      endDate = value
    },
    set activeTab(value: TabType) {
      activeTab = value
    },
    set viewType(value: ViewType) {
      viewType = value
    },
    set signal(value: CounselingSignalFilter) {
      signal = value
      currentPage = 1
    },

    // methods
    buildFilters,
    resetFilters,
    changeTab,
    setDateRange
  }
}
