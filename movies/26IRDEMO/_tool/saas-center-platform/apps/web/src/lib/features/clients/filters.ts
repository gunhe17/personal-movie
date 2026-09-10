import { CLIENT_PAGE_SIZE } from './constants'

export type ClientRoleFilter = 'all' | 'GUARDIAN' | 'CHILD'
export type ClientStatusFilter = 'all' | 'ACTIVE' | 'INACTIVE'
export type ClientGenderFilter = 'all' | 'MALE' | 'FEMALE'
export type ClientGuardianFilter = 'all' | 'GUARDIAN' | 'CHILD'
export type ClientViewType = 'list' | 'grid'
// desc=최신 등록순(기본), asc=오래된 순, name=이름순, next_session=회기 임박순
export type ClientSort = 'next_session' | 'desc' | 'asc' | 'name'

export interface ClientFilters {
  search: string
  sort: ClientSort
  page: number
  pageSize: number
  guardian: ClientGuardianFilter
  status: ClientStatusFilter
  gender: ClientGenderFilter
  view: ClientViewType
}

// 기본 정렬 = 최신 등록순(created_at DESC). /clients 페이지와 공유 소비처(셀렉터/드롭다운) 모두 동일.
export const DEFAULT_FILTERS: ClientFilters = {
  search: '',
  sort: 'desc',
  page: 1,
  pageSize: CLIENT_PAGE_SIZE,
  guardian: 'all',
  status: 'all',
  gender: 'all',
  view: 'grid'
}

const VALID_GUARDIAN: ClientGuardianFilter[] = ['all', 'GUARDIAN', 'CHILD']
const VALID_STATUS: ClientStatusFilter[] = ['all', 'ACTIVE', 'INACTIVE']
const VALID_GENDER: ClientGenderFilter[] = ['all', 'MALE', 'FEMALE']
export const VALID_SORT: ClientSort[] = ['next_session', 'desc', 'asc', 'name']
export const VALID_VIEW: ClientViewType[] = ['list', 'grid']

export const SEARCH_DEBOUNCE_MS = 300

export const parseFiltersFromUrl = (url: URL): ClientFilters => {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const sort = params.get('sort') as ClientSort
  const guardian = params.get('guardian') as ClientGuardianFilter
  const status = params.get('status') as ClientStatusFilter
  const gender = params.get('gender') as ClientGenderFilter
  const view = params.get('view') as ClientViewType

  return {
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    sort: VALID_SORT.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    guardian: VALID_GUARDIAN.includes(guardian)
      ? guardian
      : DEFAULT_FILTERS.guardian,
    status: VALID_STATUS.includes(status) ? status : DEFAULT_FILTERS.status,
    gender: VALID_GENDER.includes(gender) ? gender : DEFAULT_FILTERS.gender,
    view: VALID_VIEW.includes(view) ? view : DEFAULT_FILTERS.view
  }
}

export const toSearchParams = (filters: ClientFilters) => {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort)
  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  // pageSize는 화면 높이로 계산되는 값이라 URL에 넣지 않는다(진입 시 재계산됨)

  if (filters.guardian !== 'all') params.set('guardian', filters.guardian)

  if (filters.status !== 'all') params.set('status', filters.status)

  if (filters.gender !== 'all') params.set('gender', filters.gender)

  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)

  return params
}
