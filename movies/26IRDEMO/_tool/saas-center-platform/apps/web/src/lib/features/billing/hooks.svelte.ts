import { afterNavigate, goto } from '$app/navigation'
import { onMount } from 'svelte'
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_DELAY } from './constants'
import {
  parseFiltersFromUrl,
  toSearchParams,
  parseBillableFiltersFromUrl,
  toBillableSearchParams,
  getBillableDefaultFilters,
  type BillingFilters,
  type BillableFilters
} from './filters'

const PAGE_SIZE_BY_VIEW = { list: 20, grid: 16 } as const

export function useBillingFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let pageSize = $state(initial.size || DEFAULT_PAGE_SIZE)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let status = $state(initial.status)
  let dateFrom = $state(initial.date_from)
  let dateTo = $state(initial.date_to)
  let viewType = $state<'list' | 'grid'>(initial.view)
  // 반응형 오버레이 모드 진입 전 viewType 보관 (복원용)
  let viewTypeBeforeOverlay: 'list' | 'grid' | null = null

  let mounted = $state(false)
  let searchInitialized = false
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  function setViewType(next: 'list' | 'grid') {
    if (viewType === next) return
    viewType = next
    const targetSize = PAGE_SIZE_BY_VIEW[next]
    if (pageSize !== targetSize) {
      pageSize = targetSize
      currentPage = 1
    }
  }

  /**
   * 반응형 오버레이 모드 변경 시 viewType 강제 전환/복원
   * - 데스크톱 → 모바일: 현재 viewType 보관 후 grid 강제
   * - 모바일 → 데스크톱: 보관해둔 viewType으로 복원
   */
  function applyResponsiveMode(isOverlayMode: boolean) {
    if (isOverlayMode && viewType === 'list') {
      viewTypeBeforeOverlay = 'list'
      setViewType('grid')
    } else if (!isOverlayMode && viewTypeBeforeOverlay) {
      const restore = viewTypeBeforeOverlay
      viewTypeBeforeOverlay = null
      setViewType(restore)
    }
  }

  function buildFilters(): BillingFilters {
    return {
      page: currentPage,
      size: pageSize,
      search: debouncedSearchQuery,
      status,
      date_from: dateFrom,
      date_to: dateTo,
      view: viewType
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
    status
    dateFrom
    dateTo
    viewType

    if (!mounted) return
    updateURL()
  })

  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    status = 'all'
    dateFrom = ''
    dateTo = ''
    currentPage = 1
  }

  function changeTab(tab: string) {
    status = tab
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
    get status() {
      return status
    },
    get dateFrom() {
      return dateFrom
    },
    get dateTo() {
      return dateTo
    },
    get viewType() {
      return viewType
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
    set status(value: string) {
      status = value
    },
    set dateFrom(value: string) {
      dateFrom = value
    },
    set dateTo(value: string) {
      dateTo = value
    },
    set viewType(value: 'list' | 'grid') {
      setViewType(value)
    },

    // methods
    buildFilters,
    resetFilters,
    changeTab,
    applyResponsiveMode
  }
}

// ── Billable (Phase 2) ──

export function useBillableFilters(initialUrl: URL, pathname: string) {
  const initial = parseBillableFiltersFromUrl(initialUrl)
  const defaults = getBillableDefaultFilters()

  let currentPage = $state(initial.page)
  let pageSize = $state(initial.size || DEFAULT_PAGE_SIZE)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let status = $state(initial.status)
  let viewType = $state<'list' | 'grid'>(initial.view)
  let sort = $state<'asc' | 'desc'>(initial.sort)
  let dateFrom = $state<string | null>(initial.dateFrom)
  let dateTo = $state<string | null>(initial.dateTo)
  let targetType = $state(initial.targetType)
  let viewTypeBeforeOverlay: 'list' | 'grid' | null = null

  let mounted = $state(false)
  let searchInitialized = false
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let selfNavigation = false

  function setViewType(next: 'list' | 'grid') {
    if (viewType === next) return
    viewType = next
  }

  function applyResponsiveMode(isOverlayMode: boolean) {
    if (isOverlayMode && viewType === 'list') {
      viewTypeBeforeOverlay = 'list'
      setViewType('grid')
    } else if (!isOverlayMode && viewTypeBeforeOverlay) {
      const restore = viewTypeBeforeOverlay
      viewTypeBeforeOverlay = null
      setViewType(restore)
    }
  }

  function buildFilters(): BillableFilters {
    return {
      page: currentPage,
      size: pageSize,
      search: debouncedSearchQuery,
      status,
      view: viewType,
      sort,
      dateFrom,
      dateTo,
      targetType
    }
  }

  function updateURL() {
    const params = toBillableSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    selfNavigation = true
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  // 마운트 유지 상태에서 같은 라우트로 재진입(사이드바 링크·딥링크)하면 컴포넌트가
  // 재생성되지 않으므로 URL을 다시 읽어 상태에 반영한다. 자기가 기록한 URL(updateURL)은
  // 상태가 원본이라 스킵. size(화면 높이 측정값)·view(로컬 UI 선호)는 URL에 없어 유지.
  afterNavigate((nav) => {
    if (selfNavigation) {
      selfNavigation = false
      return
    }
    const url = nav.to?.url
    if (!url || url.pathname !== pathname) return
    const parsed = parseBillableFiltersFromUrl(url)
    searchQuery = parsed.search
    debouncedSearchQuery = parsed.search
    status = parsed.status
    sort = parsed.sort
    dateFrom = parsed.dateFrom
    dateTo = parsed.dateTo
    targetType = parsed.targetType
    currentPage = parsed.page
  })

  onMount(() => {
    mounted = true
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  })

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

  $effect(() => {
    currentPage
    debouncedSearchQuery
    status
    viewType
    sort
    dateFrom
    dateTo
    targetType

    if (!mounted) return
    updateURL()
  })

  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    status = defaults.status
    sort = defaults.sort
    dateFrom = defaults.dateFrom
    dateTo = defaults.dateTo
    targetType = defaults.targetType
    currentPage = 1
  }

  /** 달력의 '적용'에서만 호출된다 — 날짜를 찍는 도중에는 조회하지 않는다 */
  function setDateRange(start: string | null, end: string | null) {
    dateFrom = start
    dateTo = end
    currentPage = 1
  }

  function changeTab(tab: string) {
    status = tab
    currentPage = 1
  }

  return {
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
    get status() {
      return status
    },
    get viewType() {
      return viewType
    },
    get sort() {
      return sort
    },
    get dateFrom() {
      return dateFrom
    },
    get dateTo() {
      return dateTo
    },
    get targetType() {
      return targetType
    },
    set targetType(value: string) {
      targetType = value
      currentPage = 1
    },

    set page(value: number) {
      currentPage = value
    },
    set pageSize(value: number) {
      pageSize = value
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    set status(value: string) {
      status = value
    },
    set viewType(value: 'list' | 'grid') {
      setViewType(value)
    },
    set sort(value: 'asc' | 'desc') {
      sort = value
      currentPage = 1
    },

    buildFilters,
    resetFilters,
    changeTab,
    setDateRange,
    applyResponsiveMode
  }
}
