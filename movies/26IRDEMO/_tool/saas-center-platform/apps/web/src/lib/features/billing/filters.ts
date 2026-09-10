/**
 * 청구 필터 — URL ↔ 필터 상태 ↔ API 파라미터 변환
 */
import {
  toNumber,
  parseSearchFromUrl,
  appendSearchToParams
} from '$lib/features/common/filters'
import { DEFAULT_PAGE_SIZE } from './constants'

export type BillingViewType = 'list' | 'grid'

export interface BillingFilters {
  page: number
  size: number
  search: string
  status: string
  date_from: string
  date_to: string
  view: BillingViewType
}

const DEFAULTS: BillingFilters = {
  page: 1,
  size: DEFAULT_PAGE_SIZE,
  search: '',
  status: 'all',
  date_from: '',
  date_to: '',
  view: 'list'
}

function parseView(value: string | null): BillingViewType {
  return value === 'grid' ? 'grid' : 'list'
}

export function parseFiltersFromUrl(url: URL): BillingFilters {
  return {
    page: toNumber(url.searchParams.get('page'), DEFAULTS.page),
    size: toNumber(url.searchParams.get('size'), DEFAULTS.size),
    search: parseSearchFromUrl(url),
    status: url.searchParams.get('status') || DEFAULTS.status,
    date_from: url.searchParams.get('date_from') ?? DEFAULTS.date_from,
    date_to: url.searchParams.get('date_to') ?? DEFAULTS.date_to,
    view: parseView(url.searchParams.get('view'))
  }
}

export function toSearchParams(filters: BillingFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page > 1) params.set('page', filters.page.toString())
  // size(pageSize)는 화면 높이로 계산되는 값이라 URL에 넣지 않는다(진입 시 재계산됨)
  appendSearchToParams(params, filters.search)
  if (filters.status && filters.status !== 'all')
    params.set('status', filters.status)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.view !== DEFAULTS.view) params.set('view', filters.view)
  return params
}

export function getDefaultFilters(): BillingFilters {
  return { ...DEFAULTS }
}

// ── Billable 필터 (Phase 2) ──

export type BillableSortOrder = 'desc' | 'asc'

export interface BillableFilters {
  page: number
  size: number
  search: string
  status: string
  view: BillingViewType
  sort: BillableSortOrder
  /** 청구 일자 범위 (YYYY-MM-DD) — 하루만 볼 땐 from=to */
  dateFrom: string | null
  dateTo: string | null
  /** 청구 대상 유형 — 'all' | 'counseling' | 'assessment' */
  targetType: string
}

const BILLABLE_DEFAULTS: BillableFilters = {
  page: 1,
  size: DEFAULT_PAGE_SIZE,
  search: '',
  status: 'all',
  view: 'list',
  sort: 'desc',
  dateFrom: null,
  dateTo: null,
  targetType: 'all'
}

function parseSort(value: string | null): BillableSortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}

export function parseBillableFiltersFromUrl(url: URL): BillableFilters {
  return {
    page: toNumber(url.searchParams.get('page'), BILLABLE_DEFAULTS.page),
    size: toNumber(url.searchParams.get('size'), BILLABLE_DEFAULTS.size),
    search: parseSearchFromUrl(url),
    status: url.searchParams.get('status') || BILLABLE_DEFAULTS.status,
    view: parseView(url.searchParams.get('view')),
    sort: parseSort(url.searchParams.get('sort')),
    dateFrom: url.searchParams.get('date_from'),
    dateTo: url.searchParams.get('date_to'),
    targetType:
      url.searchParams.get('type') || BILLABLE_DEFAULTS.targetType
  }
}

export function toBillableSearchParams(
  filters: BillableFilters
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page > 1) params.set('page', filters.page.toString())
  // size(pageSize)는 화면 높이로 계산되는 값이라 URL에 넣지 않는다(진입 시 재계산됨)
  appendSearchToParams(params, filters.search)
  if (filters.status && filters.status !== 'all')
    params.set('status', filters.status)
  if (filters.view !== BILLABLE_DEFAULTS.view) params.set('view', filters.view)
  if (filters.sort !== BILLABLE_DEFAULTS.sort) params.set('sort', filters.sort)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.targetType !== BILLABLE_DEFAULTS.targetType)
    params.set('type', filters.targetType)
  return params
}

export function getBillableDefaultFilters(): BillableFilters {
  return { ...BILLABLE_DEFAULTS }
}
