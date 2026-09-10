import { parseNumParam, parseParam } from '$lib/features/common/filters'
import { MEMBER_PAGE_SIZE } from './constants'

export interface MemberFilters {
  page: number
  search: string
  role: string
}

export function parseFiltersFromUrl(url: URL): MemberFilters {
  return {
    page: parseNumParam(url, 'page', 1),
    search: parseParam(url, 'search', ''),
    role: parseParam(url, 'role', 'all')
  }
}

export function filtersToSearchParams(filters: MemberFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.search) params.set('search', filters.search)
  if (filters.role !== 'all') params.set('role', filters.role)
  return params
}

export function filtersToApiParams(
  institutionId: string,
  filters: MemberFilters
) {
  return {
    institutionId,
    page: filters.page,
    size: MEMBER_PAGE_SIZE,
    search: filters.search || undefined,
    role: filters.role !== 'all' ? filters.role : undefined
  }
}
