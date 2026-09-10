import { goto } from '$app/navigation'
import type { NoticeCategory } from '$lib/hooks/actions/notice.action'
import { centerId as centerIdStore } from '$lib/stores/center.store'
import { get } from 'svelte/store'
import { NOTICE_PAGE_SIZE } from './constants'

type DateRange = '' | 'week' | 'month' | '3months'

function getDateFrom(range: DateRange): string | undefined {
  if (!range) return undefined
  const now = new Date()
  if (range === 'week') now.setDate(now.getDate() - 7)
  else if (range === 'month') now.setMonth(now.getMonth() - 1)
  else if (range === '3months') now.setMonth(now.getMonth() - 3)
  return now.toISOString().split('T')[0]
}

export function useNoticeFilters(url: URL) {
  let search = $state(url.searchParams.get('search') ?? '')
  let currentPage = $state(Number(url.searchParams.get('page') ?? '1'))
  let searchInput = $state(search)
  let category = $state<NoticeCategory | ''>((url.searchParams.get('category') as NoticeCategory) ?? '')
  let dateRange = $state<DateRange>((url.searchParams.get('date') as DateRange) ?? '')
  let debounceTimer: ReturnType<typeof setTimeout>

  function syncUrl() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (dateRange) params.set('date', dateRange)
    if (currentPage > 1) params.set('page', String(currentPage))
    const qs = params.toString()
    goto(`?${qs}`, { replaceState: true, keepFocus: true })
  }

  function onSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    searchInput = value
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      search = value
      currentPage = 1
      syncUrl()
    }, 400)
  }

  function setCategory(value: NoticeCategory | '') {
    category = value
    currentPage = 1
    syncUrl()
  }

  function setDateRange(value: DateRange) {
    dateRange = value
    currentPage = 1
    syncUrl()
  }

  function setPage(page: number) {
    currentPage = page
    syncUrl()
  }

  function resetFilters() {
    search = ''
    searchInput = ''
    category = ''
    dateRange = ''
    currentPage = 1
    clearTimeout(debounceTimer)
    syncUrl()
  }

  function toQueryParams() {
    return {
      search: search || undefined,
      category: category || undefined,
      date_from: getDateFrom(dateRange),
      page: currentPage,
      size: NOTICE_PAGE_SIZE,
      center_id: get(centerIdStore) ?? undefined
    }
  }

  return {
    get search() { return search },
    get searchInput() { return searchInput },
    get currentPage() { return currentPage },
    set currentPage(v: number) { currentPage = v },
    get category() { return category },
    get dateRange() { return dateRange },
    onSearchInput,
    setCategory,
    setDateRange,
    setPage,
    resetFilters,
    toQueryParams
  }
}
