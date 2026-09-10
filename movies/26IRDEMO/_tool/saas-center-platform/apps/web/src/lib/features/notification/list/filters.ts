/**
 * 알림 목록 필터 — URL 파싱/직렬화 + API 파라미터 변환
 */

import {
  parsePaginationFromUrl,
  appendPaginationToParams,
  type PaginationFilter
} from '$lib/features/common/filters'
import {
  LIST_PAGE_SIZE,
  type CategoryFilter,
  type SortOrder
} from './constants'

/** 알림 목록 필터 모델 */
export interface NotificationListFilters extends PaginationFilter {
  category: CategoryFilter
  search: string
  sort: SortOrder
}

const VALID_CATEGORIES = new Set<string>([
  'all',
  'assessment',
  'counseling',
  'system'
])
const VALID_SORTS = new Set<string>(['desc', 'asc'])

/** URL → 필터 */
export function parseFiltersFromUrl(url: URL): NotificationListFilters {
  const pagination = parsePaginationFromUrl(url, {
    page: 1,
    pageSize: LIST_PAGE_SIZE
  })

  const rawCategory = url.searchParams.get('category') ?? 'all'
  const rawSort = url.searchParams.get('sort') ?? 'desc'

  return {
    ...pagination,
    pageSize: LIST_PAGE_SIZE,
    category: VALID_CATEGORIES.has(rawCategory)
      ? (rawCategory as CategoryFilter)
      : 'all',
    search: url.searchParams.get('search') ?? '',
    sort: VALID_SORTS.has(rawSort) ? (rawSort as SortOrder) : 'desc'
  }
}

/** 필터 → URL params (기본값은 생략) */
export function toSearchParams(
  filters: NotificationListFilters
): URLSearchParams {
  const params = new URLSearchParams()
  appendPaginationToParams(params, filters)
  if (filters.category !== 'all') params.set('category', filters.category)
  if (filters.search) params.set('search', filters.search)
  if (filters.sort !== 'desc') params.set('sort', filters.sort)
  return params
}

/** API 쿼리 입력 타입 */
export interface NotificationListQueryInput {
  center_id: string
  category?: string
  search?: string
  page?: number
  size?: number
  sort?: SortOrder
}

/** 필터 → API params */
export function toApiQueryInput(
  filters: NotificationListFilters,
  centerId: string
): NotificationListQueryInput {
  return {
    center_id: centerId,
    category: filters.category !== 'all' ? filters.category : undefined,
    search: filters.search || undefined,
    page: filters.page,
    size: filters.pageSize,
    sort: filters.sort
  }
}
