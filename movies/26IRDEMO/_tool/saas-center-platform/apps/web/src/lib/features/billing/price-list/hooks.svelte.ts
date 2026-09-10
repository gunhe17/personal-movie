import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import { PRICE_LIST_PAGE_SIZE } from './constants'
import {
  parseFiltersFromUrl,
  toSearchParams,
  DEFAULT_FILTERS,
  type PriceListFilters
} from './filters'

const SEARCH_DEBOUNCE_MS = 300

export function usePriceListFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize || PRICE_LIST_PAGE_SIZE)
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let serviceType = $state(initial.serviceType)
  let activeStatus = $state(initial.activeStatus)
  let viewType = $state<'list' | 'grid'>(initial.view)

  let mounted = $state(false)
  let searchInitialized = $state(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  function buildFilters(): PriceListFilters {
    return {
      page: currentPage,
      pageSize,
      search: debouncedSearchQuery,
      serviceType,
      activeStatus,
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
    }, SEARCH_DEBOUNCE_MS)
  })

  // 필터 변경 시 URL 업데이트
  $effect(() => {
    currentPage
    debouncedSearchQuery
    serviceType
    activeStatus
    viewType

    if (!mounted) return
    updateURL()
  })

  function resetFilters() {
    searchQuery = ''
    debouncedSearchQuery = ''
    serviceType = DEFAULT_FILTERS.serviceType
    activeStatus = DEFAULT_FILTERS.activeStatus
    currentPage = 1
  }

  return {
    get page() { return currentPage },
    get pageSize() { return pageSize },
    get searchQuery() { return searchQuery },
    get debouncedSearchQuery() { return debouncedSearchQuery },
    get serviceType() { return serviceType },
    get activeStatus() { return activeStatus },
    get viewType() { return viewType },

    set page(value: number) { currentPage = value },
    set searchQuery(value: string) { searchQuery = value },
    set serviceType(value: string) { serviceType = value; currentPage = 1 },
    set activeStatus(value: string) { activeStatus = value; currentPage = 1 },
    set viewType(value: 'list' | 'grid') { viewType = value },

    buildFilters,
    resetFilters
  }
}
