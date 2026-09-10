import { MEMBER_PAGE_SIZE } from './constants'

export type MemberSortOrder = 'asc' | 'desc'
export type MemberTabType = 'all' | 'pending'
export type MemberRoleFilter = string // 'all' | '1' | '2' | '3' (Select 호환용 string)
export type MemberEmploymentFilter = string // 'all' | 'FULLTIME' | 'CONTRACT' | 'FREELANCER'
export type MemberViewType = 'list' | 'grid'

export interface MemberFilters {
  search: string
  sort: MemberSortOrder
  page: number
  pageSize: number
  activeTab: MemberTabType
  role: MemberRoleFilter
  employmentType: MemberEmploymentFilter
  view: MemberViewType
}

export const DEFAULT_FILTERS: MemberFilters = {
  search: '',
  sort: 'desc',
  page: 1,
  pageSize: MEMBER_PAGE_SIZE,
  activeTab: 'all',
  role: 'all',
  employmentType: 'all',
  view: 'grid'
}

const VALID_SORT: MemberSortOrder[] = ['asc', 'desc']
const VALID_TABS: MemberTabType[] = ['all', 'pending']
const VALID_VIEWS: MemberViewType[] = ['list', 'grid']

export const SEARCH_DEBOUNCE_MS = 300

export function parseFiltersFromUrl(url: URL): MemberFilters {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const sort = params.get('sort') as MemberSortOrder
  const tab = params.get('tab') as MemberTabType
  const view = params.get('view') as MemberViewType

  // role: 'all' 또는 role_code 문자열 ('ADMIN', 'COUNSELOR', 'MANAGER', 'STAFF')
  const rawRole = params.get('role')
  let role: MemberRoleFilter = DEFAULT_FILTERS.role
  if (rawRole) {
    role = rawRole
  }

  const rawEmployment = params.get('employment')
  const employmentType: MemberEmploymentFilter =
    rawEmployment || DEFAULT_FILTERS.employmentType

  return {
    search: params.get('search') ?? DEFAULT_FILTERS.search,
    sort: VALID_SORT.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    activeTab: VALID_TABS.includes(tab) ? tab : DEFAULT_FILTERS.activeTab,
    role,
    employmentType,
    view: VALID_VIEWS.includes(view) ? view : DEFAULT_FILTERS.view
  }
}

export function toSearchParams(filters: MemberFilters) {
  const params = new URLSearchParams()

  if (filters.search) params.set('search', filters.search)
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort)
  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  // pageSize는 화면 높이로 계산되는 값이라 URL에 넣지 않는다(진입 시 재계산됨)
  if (filters.activeTab !== DEFAULT_FILTERS.activeTab) {
    params.set('tab', filters.activeTab)
  }
  if (filters.role !== DEFAULT_FILTERS.role)
    params.set('role', String(filters.role))
  if (filters.employmentType !== DEFAULT_FILTERS.employmentType) {
    params.set('employment', String(filters.employmentType))
  }
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)

  return params
}
