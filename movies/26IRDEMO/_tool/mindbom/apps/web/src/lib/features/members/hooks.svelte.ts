import { goto } from '$app/navigation'
import { parseFiltersFromUrl, filtersToSearchParams, type MemberFilters } from './filters'

export function useMemberFilters(initialUrl: URL, pathname: string) {
  const initial = parseFiltersFromUrl(initialUrl)

  let currentPage = $state(initial.page)
  let search = $state(initial.search)
  let role = $state(initial.role)

  let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

  function buildFilters(): MemberFilters {
    return { page: currentPage, search, role }
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

  function setRole(value: string) {
    role = value
    currentPage = 1
    syncUrl()
  }

  function setPage(value: number) {
    currentPage = value
    syncUrl()
  }

  function reset() {
    currentPage = 1
    search = ''
    role = 'all'
    syncUrl()
  }

  return {
    get page() { return currentPage },
    get search() { return search },
    get role() { return role },
    buildFilters,
    setSearch,
    setRole,
    setPage,
    reset
  }
}
