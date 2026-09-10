import { goto } from '$app/navigation'
import { parseFiltersFromUrl, filtersToSearchParams, type ExamFilters } from './filters'

export function useExamFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let search = $state(initial.search)
  let status = $state(initial.status)
  let type = $state(initial.type)

  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

  function buildFilters(): ExamFilters {
    return { page: currentPage, search, status, type }
  }

  function syncUrl() {
    const params = filtersToSearchParams(buildFilters())
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }

  function setSearch(value: string) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      search = value
      currentPage = 1
      syncUrl()
    }, 300)
  }

  function setStatus(value: string) {
    status = value
    currentPage = 1
    syncUrl()
  }

  function setType(value: string) {
    type = value
    currentPage = 1
    syncUrl()
  }

  function setPage(value: number) {
    currentPage = value
    syncUrl()
  }

  function reset() {
    // 검색어를 치던 중 초기화를 누르면 대기 중인 디바운스가 300ms 뒤에 터져
    // 방금 비운 search를 다시 채운다. 타이머부터 끊어야 한다.
    clearTimeout(searchDebounceTimer)
    currentPage = 1
    search = ''
    status = 'all'
    type = 'all'
    syncUrl()
  }

  return {
    get page() { return currentPage },
    get search() { return search },
    get status() { return status },
    get type() { return type },
    /** 초기화 버튼 활성 조건 — 기본값에서 벗어난 필터가 하나라도 있는가. */
    get hasActiveFilter() {
      return search !== '' || status !== 'all' || type !== 'all'
    },
    buildFilters,
    setSearch,
    setStatus,
    setType,
    setPage,
    reset
  }
}
