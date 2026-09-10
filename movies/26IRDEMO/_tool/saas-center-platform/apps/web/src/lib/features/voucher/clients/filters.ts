import { VOUCHER_CLIENT_PAGE_SIZE } from './constants'

export type VoucherStatusFilter = 'all' | 'active' | 'completed'
export type VoucherSort = 'desc'
export type VoucherViewType = 'list' | 'grid'
// 대시보드 시그널 전용 필터 — 페이지 필터 UI에는 노출하지 않고 URL(딥링크)로만 진입한다
export type VoucherSignalFilter = '' | 'low' | 'expiring'

export interface VoucherClientFilters {
  /** 선택한 센터 바우처(사업) id — '' 이면 전체 바우처 뷰 */
  voucherId: string
  search: string
  status: VoucherStatusFilter
  dateFrom: string
  dateTo: string
  sort: VoucherSort
  page: number
  pageSize: number
  view: VoucherViewType
  signal: VoucherSignalFilter
}

export const DEFAULT_FILTERS: VoucherClientFilters = {
  voucherId: '',
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'desc',
  page: 1,
  pageSize: VOUCHER_CLIENT_PAGE_SIZE,
  view: 'list',
  signal: ''
}

const VALID_STATUS: VoucherStatusFilter[] = ['all', 'active', 'completed']
const VALID_VIEW: VoucherViewType[] = ['list', 'grid']
const VALID_SIGNAL: VoucherSignalFilter[] = ['low', 'expiring']

export const SEARCH_DEBOUNCE_MS = 300

export const parseFiltersFromUrl = (url: URL): VoucherClientFilters => {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const status = params.get('status') as VoucherStatusFilter
  const view = params.get('view') as VoucherViewType
  const signal = params.get('signal') as VoucherSignalFilter

  return {
    voucherId: params.get('voucher') ?? DEFAULT_FILTERS.voucherId,
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    status: VALID_STATUS.includes(status) ? status : DEFAULT_FILTERS.status,
    dateFrom: params.get('dateFrom') ?? DEFAULT_FILTERS.dateFrom,
    dateTo: params.get('dateTo') ?? DEFAULT_FILTERS.dateTo,
    sort: DEFAULT_FILTERS.sort,
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    view: VALID_VIEW.includes(view) ? view : DEFAULT_FILTERS.view,
    signal: VALID_SIGNAL.includes(signal) ? signal : DEFAULT_FILTERS.signal
  }
}

export const toSearchParams = (filters: VoucherClientFilters) => {
  const params = new URLSearchParams()

  if (filters.voucherId) params.set('voucher', filters.voucherId)
  if (filters.search) params.set('search', filters.search)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  // pageSize는 화면 높이로 계산되는 값이라 URL에 넣지 않는다(진입 시 재계산됨)
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)
  if (filters.signal) params.set('signal', filters.signal)

  return params
}
