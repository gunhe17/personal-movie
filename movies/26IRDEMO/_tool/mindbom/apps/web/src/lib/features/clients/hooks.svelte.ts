import { goto } from '$app/navigation'
import { parseFiltersFromUrl, filtersToSearchParams, type ClientFilters } from './filters'

export function useClientFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let search = $state(initial.search)
  let status = $state(initial.status)
  let gender = $state(initial.gender)

  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

  function buildFilters(): ClientFilters {
    return { page: currentPage, search, status, gender }
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

  function setGender(value: string) {
    gender = value
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
    gender = 'all'
    syncUrl()
  }

  return {
    get page() { return currentPage },
    get search() { return search },
    get status() { return status },
    get gender() { return gender },
    /** 초기화 버튼 활성 조건 — 기본값에서 벗어난 필터가 하나라도 있는가. */
    get hasActiveFilter() {
      return search !== '' || status !== 'all' || gender !== 'all'
    },
    buildFilters,
    setSearch,
    setStatus,
    setGender,
    setPage,
    reset
  }
}
