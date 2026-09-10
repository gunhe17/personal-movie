/**
 * 상담 현황 페이지 필터 관리
 */
import {
  appendPaginationToParams,
  parsePaginationFromUrl,
  parseSearchFromUrl,
  type BaseListFilter
} from '$lib/features/common/filters'
import {
  type CounselingSignalFilter,
  type CounselingTypeFilter,
  type SortOrder,
  type TabType,
  type ViewType
} from './constants'

export interface CounselingFilters extends BaseListFilter {
  sort: SortOrder
  selectedManagerNames: string[]
  counselingType: CounselingTypeFilter
  startDate: string | null
  endDate: string | null
  status: TabType
  view: ViewType
  signal: CounselingSignalFilter
}

const DEFAULT_FILTERS: Omit<CounselingFilters, keyof BaseListFilter> = {
  sort: 'desc',
  selectedManagerNames: [],
  counselingType: 'all',
  startDate: null,
  endDate: null,
  status: 'all',
  view: 'grid',
  signal: ''
}

const VALID_COUNSELING_TYPE: CounselingTypeFilter[] = [
  'all',
  'individual',
  'group'
]

const VALID_SIGNAL: CounselingSignalFilter[] = ['unprocessed', 'needs_review']

export function parseFiltersFromUrl(url: URL): CounselingFilters {
  const pagination = parsePaginationFromUrl(url)

  const params = url.searchParams
  const selectedManagerNames = params
    .get('selectedManagerNames')
    ?.split(',') as string[]

  return {
    ...DEFAULT_FILTERS,
    ...pagination,
    search: parseSearchFromUrl(url),
    sort: (params.get('sort') as SortOrder) || DEFAULT_FILTERS.sort,
    selectedManagerNames:
      selectedManagerNames ?? DEFAULT_FILTERS.selectedManagerNames,
    counselingType: VALID_COUNSELING_TYPE.includes(
      params.get('counselingType') as CounselingTypeFilter
    )
      ? (params.get('counselingType') as CounselingTypeFilter)
      : DEFAULT_FILTERS.counselingType,
    startDate: params.get('startDate'),
    endDate: params.get('endDate'),
    status: (params.get('status') as TabType) || DEFAULT_FILTERS.status,
    view: (params.get('view') as ViewType) || DEFAULT_FILTERS.view,
    signal: VALID_SIGNAL.includes(params.get('signal') as CounselingSignalFilter)
      ? (params.get('signal') as CounselingSignalFilter)
      : DEFAULT_FILTERS.signal
  }
}

export function toSearchParams(filters: CounselingFilters): URLSearchParams {
  const params = new URLSearchParams()
  appendPaginationToParams(params, filters)

  if (filters.search) params.set('search', filters.search)
  if (filters.sort !== 'desc') params.set('sort', filters.sort)
  if (filters.selectedManagerNames.length)
    params.set('selectedManagerNames', filters.selectedManagerNames.join(','))
  if (filters.counselingType !== 'all')
    params.set('counselingType', filters.counselingType)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)
  if (filters.signal) params.set('signal', filters.signal)

  return params
}

export interface CounselingsQueryInput {
  centerId: string
  queryParams: {
    search?: string
    size?: number
    sort?: SortOrder
    page?: number
    status?: TabType
    counselingType?: string
    counselorIds?: string[]
    startDate?: string
    endDate?: string
    signal?: string
  }
}
