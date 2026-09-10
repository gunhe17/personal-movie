import { parseNumParam, parseParam } from '$lib/features/common/filters'
import { EXAM_PAGE_SIZE } from './constants'

export interface ExamFilters {
  page: number
  search: string
  status: string
  type: string
}

export function parseFiltersFromUrl(url: URL): ExamFilters {
  return {
    page: parseNumParam(url, 'page', 1),
    search: parseParam(url, 'search', ''),
    status: parseParam(url, 'status', 'all'),
    type: parseParam(url, 'type', 'all')
  }
}

export function filtersToSearchParams(filters: ExamFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page > 1) params.set('page', String(filters.page))
  if (filters.search) params.set('search', filters.search)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.type !== 'all') params.set('type', filters.type)
  return params
}

export function filtersToApiParams(
  institutionId: string,
  filters: ExamFilters
) {
  const status = filters.status !== 'all' ? filters.status : undefined
  return {
    institutionId,
    page: filters.page,
    size: EXAM_PAGE_SIZE,
    search: filters.search || undefined,
    status,
    exam_type: filters.type !== 'all' ? filters.type : undefined
  }
}
