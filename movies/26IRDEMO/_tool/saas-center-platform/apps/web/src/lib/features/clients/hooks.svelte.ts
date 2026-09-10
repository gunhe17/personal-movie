import { onMount } from 'svelte'
import {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  SEARCH_DEBOUNCE_MS,
  toSearchParams,
  type ClientFilters,
  type ClientGenderFilter,
  type ClientRoleFilter,
  type ClientSort,
  type ClientStatusFilter,
  type ClientViewType
} from './filters'
import { readStoredSort, writeStoredSort } from './view-preference'
import { goto } from '$app/navigation'

export interface ClientFiltersOptions {
  /** 첫 진입(URL·저장값 없음) 시 적용할 기본 정렬. 미지정 시 DEFAULT_FILTERS.sort('desc'). */
  defaultSort?: ClientSort
  /** 정렬을 localStorage에 sticky 영속화할지. /clients 페이지에서만 true. */
  persistSort?: boolean
}

export function useClientFilters(
  initialUrl: URL,
  pathname: string,
  options: ClientFiltersOptions = {}
) {
  const { defaultSort = DEFAULT_FILTERS.sort, persistSort = false } = options
  const initial = parseFiltersFromUrl(initialUrl)

  // 정렬 우선순위: URL 명시값 > (영속화 시) localStorage 저장값 > defaultSort.
  // persistSort=false인 공유 소비처(드롭다운 등)는 저장값을 읽지 않아 오염되지 않는다.
  const sortInitial = initialUrl.searchParams.has('sort')
    ? initial.sort
    : ((persistSort ? readStoredSort() : null) ?? defaultSort)

  let searchQuery = $state(initial.search)
  let sortOrder: ClientSort = $state(sortInitial)
  let debouncedSearchQuery = $state(initial.search)
  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let guardian: ClientRoleFilter = $state(initial.guardian)
  let status: ClientStatusFilter = $state(initial.status)
  let gender: ClientGenderFilter = $state(initial.gender)
  let viewType: ClientViewType = $state(initial.view)

  let mounted = $state(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let searchInitialized = false

  const buildFilters = (): ClientFilters => ({
    search: debouncedSearchQuery,
    sort: sortOrder,
    page: currentPage,
    pageSize,
    guardian,
    status,
    gender,
    view: viewType
  })

  const updateURL = () => {
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
    currentPage
    pageSize
    debouncedSearchQuery
    sortOrder
    guardian
    status
    gender
    viewType
    if (!mounted) return
    updateURL()
  })

  // 필터 변경 시 페이지 초기화. 단 마운트 첫 실행은 건너뛴다
  // (안 그러면 새로고침 시 URL로 복원한 page를 1로 덮어씀). 플래그는 비반응형 let.
  let filterResetPrimed = false
  $effect(() => {
    sortOrder
    guardian
    status
    gender
    viewType
    if (!filterResetPrimed) {
      filterResetPrimed = true
      return
    }
    currentPage = 1
  })

  const reset = () => {
    searchQuery = DEFAULT_FILTERS.search
    debouncedSearchQuery = DEFAULT_FILTERS.search
    sortOrder = defaultSort
    currentPage = DEFAULT_FILTERS.page
    pageSize = DEFAULT_FILTERS.pageSize
    guardian = DEFAULT_FILTERS.guardian
    status = DEFAULT_FILTERS.status
    gender = DEFAULT_FILTERS.gender
    // viewType은 초기화 대상이 아니다 — 초기화는 검색·필터만 되돌린다(보기 방식은 사용자 선택 유지)
    // 정렬도 페이지 기본값으로 되돌려 영속화 (다음 진입 시 유지)
    if (persistSort) writeStoredSort(defaultSort)
  }

  return {
    get searchQuery() {
      return searchQuery
    },
    set searchQuery(value: string) {
      searchQuery = value
    },
    get sortOrder() {
      return sortOrder
    },
    set sortOrder(value: ClientSort) {
      sortOrder = value
      if (persistSort) writeStoredSort(value)
    },
    set pageSize(value: number) {
      pageSize = value
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
    get gender() {
      return gender
    },
    get guardian() {
      return guardian
    },
    set guardian(value: ClientRoleFilter) {
      guardian = value
      currentPage = 1
    },
    get status() {
      return status
    },
    set status(value: ClientStatusFilter) {
      status = value
    },
    set gender(value: ClientGenderFilter) {
      gender = value
    },
    get viewType() {
      return viewType
    },
    set viewType(value: ClientViewType) {
      viewType = value
    },
    reset,
    buildFilters
  }
}
