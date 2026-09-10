import { DEFAULT_PAGE_SIZE, type ActiveStatusFilter, type ViewType } from './constants'

export interface CenterVoucherFilters {
  activeStatus: ActiveStatusFilter
  page: number
  pageSize: number
  view: ViewType
}

export const DEFAULT_FILTERS: CenterVoucherFilters = {
  activeStatus: 'all',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  view: 'table'
}

const VALID_ACTIVE_STATUSES: ActiveStatusFilter[] = ['all', 'true', 'false']
const VALID_VIEWS: ViewType[] = ['table', 'card']

export function parseFiltersFromUrl(url: URL): CenterVoucherFilters {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const activeStatus = params.get('active') as ActiveStatusFilter | null
  const view = params.get('view') as ViewType | null

  return {
    activeStatus:
      activeStatus && VALID_ACTIVE_STATUSES.includes(activeStatus)
        ? activeStatus
        : DEFAULT_FILTERS.activeStatus,
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    view: view && VALID_VIEWS.includes(view) ? view : DEFAULT_FILTERS.view
  }
}

export function toSearchParams(filters: CenterVoucherFilters) {
  const params = new URLSearchParams()

  if (filters.activeStatus !== DEFAULT_FILTERS.activeStatus)
    params.set('active', filters.activeStatus)
  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)

  return params
}
