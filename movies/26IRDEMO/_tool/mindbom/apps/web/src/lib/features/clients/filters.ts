import { parseNumParam, parseParam } from '$lib/features/common/filters'
import { CLIENT_PAGE_SIZE } from './constants'

export interface ClientFilters {
  page: number
  search: string
  status: string
  gender: string
}

export function parseFiltersFromUrl(url: URL): ClientFilters {
  return {
    page: parseNumParam(url, 'page', 1),
    search: parseParam(url, 'search', ''),
    status: parseParam(url, 'status', 'all'),
    gender: parseParam(url, 'gender', 'all')
  }
}

export function filtersToSearchParams(filters: ClientFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.search) params.set('search', filters.search)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.gender !== 'all') params.set('gender', filters.gender)
  return params
}

export function filtersToApiParams(
  institutionId: string,
  filters: ClientFilters
) {
  return {
    institutionId,
    page: filters.page,
    size: CLIENT_PAGE_SIZE,
    search: filters.search || undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    gender: filters.gender !== 'all' ? filters.gender : undefined
  }
}
