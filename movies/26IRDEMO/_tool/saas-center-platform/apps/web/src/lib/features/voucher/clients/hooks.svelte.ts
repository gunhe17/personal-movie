import { onMount } from 'svelte'
import { afterNavigate, goto } from '$app/navigation'
import {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  SEARCH_DEBOUNCE_MS,
  toSearchParams,
  type VoucherClientFilters,
  type VoucherSignalFilter,
  type VoucherStatusFilter,
  type VoucherViewType
} from './filters'

export function useVoucherClientFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let voucherId = $state(initial.voucherId)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let status: VoucherStatusFilter = $state(initial.status)
  let dateFrom = $state(initial.dateFrom)
  let dateTo = $state(initial.dateTo)
  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let viewType: VoucherViewType = $state(initial.view)
  let signal: VoucherSignalFilter = $state(initial.signal)

  let mounted = $state(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let searchInitialized = false
  let selfNavigation = false

  const buildFilters = (): VoucherClientFilters => ({
    voucherId,
    search: debouncedSearchQuery,
    status,
    dateFrom,
    dateTo,
    sort: 'desc',
    page: currentPage,
    pageSize,
    view: viewType,
    signal
  })

  const updateURL = () => {
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
    voucherId = parsed.voucherId
    searchQuery = parsed.search
    debouncedSearchQuery = parsed.search
    status = parsed.status
    dateFrom = parsed.dateFrom
    dateTo = parsed.dateTo
    currentPage = parsed.page
    signal = parsed.signal
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
    }, SEARCH_DEBOUNCE_MS)
  })

  $effect(() => {
    voucherId
    currentPage
    pageSize
    debouncedSearchQuery
    status
    dateFrom
    dateTo
    viewType
    signal
    if (!mounted) return
    updateURL()
  })

  // 필터 변경 시 페이지 초기화. 마운트 첫 실행은 건너뛴다
  // (URL로 복원한 page를 새로고침 때 1로 덮어쓰지 않도록). 플래그는 비반응형 let.
  let filterResetPrimed = false
  $effect(() => {
    status
    dateFrom
    dateTo
    viewType
    signal
    if (!filterResetPrimed) {
      filterResetPrimed = true
      return
    }
    currentPage = 1
  })

  const reset = () => {
    voucherId = DEFAULT_FILTERS.voucherId
    searchQuery = DEFAULT_FILTERS.search
    debouncedSearchQuery = DEFAULT_FILTERS.search
    status = DEFAULT_FILTERS.status
    dateFrom = DEFAULT_FILTERS.dateFrom
    dateTo = DEFAULT_FILTERS.dateTo
    currentPage = DEFAULT_FILTERS.page
    pageSize = DEFAULT_FILTERS.pageSize
    viewType = DEFAULT_FILTERS.view
    signal = DEFAULT_FILTERS.signal
  }

  return {
    get voucherId() {
      return voucherId
    },
    set voucherId(value: string) {
      voucherId = value
    },
    get searchQuery() {
      return searchQuery
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    get status() {
      return status
    },
    set status(value: VoucherStatusFilter) {
      status = value
    },
    get dateFrom() {
      return dateFrom
    },
    set dateFrom(value: string) {
      dateFrom = value
    },
    get dateTo() {
      return dateTo
    },
    set dateTo(value: string) {
      dateTo = value
    },
    get currentPage() {
      return currentPage
    },
    set currentPage(value: number) {
      currentPage = value
    },
    get pageSize() {
      return pageSize
    },
    set pageSize(value: number) {
      pageSize = value
    },
    get viewType() {
      return viewType
    },
    set viewType(value: VoucherViewType) {
      viewType = value
    },
    get signal() {
      return signal
    },
    set signal(value: VoucherSignalFilter) {
      signal = value
    },
    reset,
    buildFilters
  }
}
