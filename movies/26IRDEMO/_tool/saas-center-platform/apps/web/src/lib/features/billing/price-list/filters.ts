import { PRICE_LIST_PAGE_SIZE } from './constants'

export type ServiceTypeFilter = string // 'all' | 'counseling' | 'assessment' | 'package'
export type ActiveStatusFilter = string // 'all' | 'true' | 'false'

export type ViewType = 'list' | 'grid'

export interface PriceListFilters {
  search: string
  serviceType: ServiceTypeFilter
  activeStatus: ActiveStatusFilter
  page: number
  pageSize: number
  view: ViewType
}

export const DEFAULT_FILTERS: PriceListFilters = {
  search: '',
  serviceType: 'all',
  activeStatus: 'all',
  page: 1,
  pageSize: PRICE_LIST_PAGE_SIZE,
  view: 'list'
}

const VALID_SERVICE_TYPES = ['all', 'counseling', 'assessment', 'package']
const VALID_ACTIVE_STATUSES = ['all', 'true', 'false']
const VALID_VIEWS: ViewType[] = ['list', 'grid']

export function parseFiltersFromUrl(url: URL): PriceListFilters {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const serviceType = params.get('type') ?? DEFAULT_FILTERS.serviceType
  const activeStatus = params.get('active') ?? DEFAULT_FILTERS.activeStatus
  const view = params.get('view') as ViewType

  return {
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    serviceType: VALID_SERVICE_TYPES.includes(serviceType)
      ? serviceType
      : DEFAULT_FILTERS.serviceType,
    activeStatus: VALID_ACTIVE_STATUSES.includes(activeStatus)
      ? activeStatus
      : DEFAULT_FILTERS.activeStatus,
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    view: VALID_VIEWS.includes(view) ? view : DEFAULT_FILTERS.view
  }
}

export function toSearchParams(filters: PriceListFilters) {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.serviceType !== DEFAULT_FILTERS.serviceType)
    params.set('type', filters.serviceType)
  if (filters.activeStatus !== DEFAULT_FILTERS.activeStatus)
    params.set('active', filters.activeStatus)
  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  if (filters.view !== DEFAULT_FILTERS.view)
    params.set('view', filters.view)

  return params
}
