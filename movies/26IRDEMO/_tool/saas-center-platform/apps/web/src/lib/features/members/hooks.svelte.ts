import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
  DEFAULT_FILTERS,
  SEARCH_DEBOUNCE_MS,
  parseFiltersFromUrl,
  toSearchParams
} from './filters'
import type {
  MemberFilters,
  MemberRoleFilter,
  MemberEmploymentFilter,
  MemberSortOrder,
  MemberTabType,
  MemberViewType
} from './filters'

export function useMemberFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let sortOrder: MemberSortOrder = $state(initial.sort)
  let currentPage = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let activeTab: MemberTabType = $state(initial.activeTab)
  let role: MemberRoleFilter = $state(initial.role)
  let employmentType: MemberEmploymentFilter = $state(initial.employmentType)
  let viewType: MemberViewType = $state(initial.view)

  let mounted = $state(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let searchInitialized = false

  const buildFilters = (): MemberFilters => ({
    search: debouncedSearchQuery,
    sort: sortOrder,
    page: currentPage,
    pageSize,
    activeTab,
    role,
    employmentType,
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

  // 검색 디바운싱
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

  // 필터 변경 시 URL 반영
  $effect(() => {
    currentPage
    debouncedSearchQuery
    sortOrder
    activeTab
    role
    employmentType
    viewType

    if (!mounted) return
    updateURL()
  })

  // 필터 변경 시 페이지 초기화. 마운트 첫 실행은 건너뛴다
  // (URL로 복원한 page를 새로고침 때 1로 덮어쓰지 않도록). 플래그는 비반응형 let.
  let filterResetPrimed = false
  $effect(() => {
    sortOrder
    activeTab
    role
    employmentType
    if (!filterResetPrimed) {
      filterResetPrimed = true
      return
    }
    currentPage = 1
  })

  function reset() {
    searchQuery = DEFAULT_FILTERS.search
    debouncedSearchQuery = DEFAULT_FILTERS.search
    sortOrder = DEFAULT_FILTERS.sort
    currentPage = DEFAULT_FILTERS.page
    pageSize = DEFAULT_FILTERS.pageSize
    activeTab = DEFAULT_FILTERS.activeTab
    role = DEFAULT_FILTERS.role
    employmentType = DEFAULT_FILTERS.employmentType
    // viewType은 초기화 대상이 아니다 — 초기화는 검색·필터만 되돌린다(보기 방식은 사용자 선택 유지)
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
    set sortOrder(value: MemberSortOrder) {
      sortOrder = value
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
    get activeTab() {
      return activeTab
    },
    set activeTab(value: MemberTabType) {
      activeTab = value
    },
    get role() {
      return role
    },
    set role(value: MemberRoleFilter) {
      role = value
    },
    get employmentType() {
      return employmentType
    },
    set employmentType(value: MemberEmploymentFilter) {
      employmentType = value
    },
    get viewType() {
      return viewType
    },
    set viewType(value: MemberViewType) {
      viewType = value
    },
    buildFilters,
    reset
  }
}
