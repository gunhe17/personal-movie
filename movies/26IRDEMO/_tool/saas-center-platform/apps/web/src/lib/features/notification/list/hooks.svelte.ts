/**
 * 알림 목록 필터 훅 — Svelte 5 Runes + URL 동기화
 */

import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import {
  LIST_PAGE_SIZE,
  SEARCH_DEBOUNCE_DELAY,
  type CategoryFilter,
  type SortOrder
} from './constants'
import {
  parseFiltersFromUrl,
  toSearchParams,
  type NotificationListFilters
} from './filters'

export function useNotificationListFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let category: CategoryFilter = $state(initial.category)
  // 입력값(즉시)과 조회값(디바운스)을 나눈다 — 타이핑마다 요청하지 않는다
  let searchQuery = $state(initial.search)
  let debouncedSearchQuery = $state(initial.search)
  let sort: SortOrder = $state(initial.sort)
  let mounted = $state(false)
  let searchInitialized = false
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  function buildFilters(): NotificationListFilters {
    return {
      page: currentPage,
      pageSize: LIST_PAGE_SIZE,
      category,
      search: debouncedSearchQuery,
      sort
    }
  }

  function updateURL() {
    const params = toSearchParams(buildFilters())
    const qs = params.toString()
    const newUrl = qs ? `${pathname}?${qs}` : pathname
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  onMount(() => {
    mounted = true
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

  // URL 동기화
  $effect(() => {
    // 의존성 추적
    currentPage
    category
    debouncedSearchQuery
    sort

    if (!mounted) return
    updateURL()
  })

  function changeCategory(value: CategoryFilter) {
    category = value
    currentPage = 1
  }

  function resetFilters() {
    category = 'all'
    searchQuery = ''
    debouncedSearchQuery = ''
    sort = 'desc'
    currentPage = 1
  }

  return {
    get page() {
      return currentPage
    },
    set page(v: number) {
      currentPage = v
    },
    get pageSize() {
      return LIST_PAGE_SIZE
    },
    get category() {
      return category
    },
    get searchQuery() {
      return searchQuery
    },
    set searchQuery(v: string) {
      searchQuery = v
    },
    get sort() {
      return sort
    },
    set sort(v: SortOrder) {
      sort = v
      currentPage = 1
    },
    get mounted() {
      return mounted
    },
    buildFilters,
    changeCategory,
    resetFilters
  }
}
