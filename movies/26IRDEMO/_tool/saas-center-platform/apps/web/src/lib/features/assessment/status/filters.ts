import {
  appendPaginationToParams,
  parsePaginationFromUrl,
  parseSearchFromUrl,
  type BaseListFilter
} from '$lib/features/common/filters'
import {
  DEFAULT_PAGE_SIZE,
  type ClientType,
  type SortOrder,
  type TabType,
  type ViewType
} from './constants'

export interface StatusFilters extends BaseListFilter {
  sort: SortOrder
  tab: TabType
  counselorIds: string[]
  clientType: ClientType
  view: ViewType
  /** 접수일 범위 (YYYY-MM-DD) — 하루만 볼 땐 from=to */
  dateFrom: string | null
  dateTo: string | null
}

const DEFAULT_FILTERS: Omit<StatusFilters, keyof BaseListFilter> = {
  sort: 'desc',
  tab: 'all',
  counselorIds: [],
  clientType: 'all',
  view: 'grid',
  dateFrom: null,
  dateTo: null
}

export function parseFiltersFromUrl(url: URL): StatusFilters {
  const pagination = parsePaginationFromUrl(url, {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE
  })

  const params = url.searchParams

  return {
    ...DEFAULT_FILTERS,
    ...pagination,
    search: parseSearchFromUrl(url),
    sort: (params.get('sort') as SortOrder) || DEFAULT_FILTERS.sort,
    tab: (params.get('tab') as TabType) || DEFAULT_FILTERS.tab,
    counselorIds:
      params.get('counselorIds')?.split(',').filter(Boolean) ??
      DEFAULT_FILTERS.counselorIds,
    clientType:
      (params.get('clientType') as ClientType) || DEFAULT_FILTERS.clientType,
    view: (params.get('view') as ViewType) || DEFAULT_FILTERS.view,
    // 옛 단일 날짜(date) 링크 호환 — from/to 모두에 채운다
    dateFrom: params.get('dateFrom') || params.get('date'),
    dateTo: params.get('dateTo') || params.get('date')
  }
}

export function toSearchParams(filters: StatusFilters): URLSearchParams {
  const params = new URLSearchParams()
  appendPaginationToParams(params, filters)

  if (filters.search) params.set('search', filters.search)
  if (filters.sort !== 'desc') params.set('sort', filters.sort)
  if (filters.tab !== 'all') params.set('tab', filters.tab)
  if (filters.counselorIds.length)
    params.set('counselorIds', filters.counselorIds.join(','))
  if (filters.clientType !== 'all') params.set('clientType', filters.clientType)
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)

  return params
}

export interface CasesQueryInput {
  centerId: string
  queryParams: {
    search?: string
    size?: number
    sort?: SortOrder
    page?: number
    status?: TabType
    counselor_id?: string
    case_type?: string
    date_from?: string
    date_to?: string
  }
}

export interface StatusCountsInput {
  centerId: string
}

export function toCasesQueryParams(filters: StatusFilters, centerId: string): CasesQueryInput {
  return {
    centerId,
    queryParams: {
      search: filters.search || undefined,
      size: filters.pageSize,
      sort: filters.sort,
      page: filters.page,
      // 탭이 'all'이면 생략(전체), 아니면 서버에 status 전달 (pending|processing|completed|cancelled)
      status: filters.tab === 'all' ? undefined : filters.tab,
      counselor_id: filters.counselorIds.length
        ? filters.counselorIds.join(',')
        : undefined,
      case_type: filters.clientType !== 'all' ? filters.clientType : undefined,
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || filters.dateFrom || undefined,
    }
  }
}

export function toStatusCountsInput(centerId: string): StatusCountsInput {
  return {
    centerId
  }
}
