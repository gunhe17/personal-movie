/**
 * 공통 필터 타입 및 유틸리티
 * 페이지네이션, 검색, 정렬 등 여러 feature에서 공통으로 사용
 */

// ============================================================
// 공통 타입
// ============================================================

/** 페이지네이션 기본 필터 */
export interface PaginationFilter {
  page: number
  pageSize: number
}

/** 검색 필터 */
export interface SearchFilter {
  search: string
}

/** 정렬 방향 */
export type SortDirection = 'asc' | 'desc'

/** 정렬 필터 (제네릭) */
export interface SortFilter<T extends string = string> {
  sortBy?: T
  sortDirection?: SortDirection
}

/** 기본 리스트 필터 (페이지네이션 + 검색) */
export interface BaseListFilter extends PaginationFilter, SearchFilter {}

// ============================================================
// 기본값
// ============================================================

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH = ''

export const PAGINATION_DEFAULTS: PaginationFilter = {
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE
}

// ============================================================
// URL 파싱 유틸리티
// ============================================================

/**
 * 문자열을 숫자로 변환 (실패 시 기본값 반환)
 */
export function toNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

/**
 * 문자열을 boolean으로 변환
 */
export function toBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) return fallback
  return value === 'true'
}

/**
 * URL에서 페이지네이션 파라미터 파싱
 */
export function parsePaginationFromUrl(
  url: URL,
  defaults: PaginationFilter = PAGINATION_DEFAULTS
): PaginationFilter {
  return {
    page: toNumber(url.searchParams.get('page'), defaults.page),
    pageSize: defaults.pageSize // pageSize는 보통 URL에 노출하지 않음
  }
}

/**
 * URL에서 검색어 파싱
 */
export function parseSearchFromUrl(url: URL, paramName = 'search'): string {
  return url.searchParams.get(paramName) ?? DEFAULT_SEARCH
}

// ============================================================
// URL 생성 유틸리티
// ============================================================

/**
 * 페이지네이션을 URLSearchParams에 추가
 * page가 1이면 추가하지 않음 (기본값)
 */
export function appendPaginationToParams(
  params: URLSearchParams,
  pagination: PaginationFilter
): void {
  if (pagination.page > 1) {
    params.set('page', pagination.page.toString())
  }
}

/**
 * 검색어를 URLSearchParams에 추가
 * 빈 문자열이면 추가하지 않음
 */
export function appendSearchToParams(
  params: URLSearchParams,
  search: string,
  paramName = 'search'
): void {
  const trimmed = search.trim()
  if (trimmed) {
    params.set(paramName, trimmed)
  }
}

// ============================================================
// 필터 핸들러 타입
// ============================================================

/**
 * 도메인 특화 필터를 처리하는 핸들러 인터페이스
 * 각 feature에서 구현
 */
export interface FilterHandler<TFilter, TApiParams> {
  /** URL에서 도메인 특화 필터 파싱 */
  parseFromUrl: (url: URL) => Partial<TFilter>
  /** 도메인 특화 필터를 URLSearchParams에 추가 */
  appendToParams: (params: URLSearchParams, filter: TFilter) => void
  /** 필터를 API 파라미터로 변환 */
  toApiParams: (filter: TFilter) => TApiParams
  /** 기본값 */
  defaults: Partial<TFilter>
}

/**
 * 공통 + 도메인 필터를 조합하여 처리하는 팩토리
 */
export function createFilterParser<TDomainFilter>(
  domainHandler: FilterHandler<TDomainFilter, unknown>
) {
  return {
    parseFromUrl(url: URL): BaseListFilter & TDomainFilter {
      const pagination = parsePaginationFromUrl(url)
      const search = parseSearchFromUrl(url)
      const domain = domainHandler.parseFromUrl(url)

      return {
        ...pagination,
        search,
        ...domainHandler.defaults,
        ...domain
      } as BaseListFilter & TDomainFilter
    },

    toSearchParams(filter: BaseListFilter & TDomainFilter): URLSearchParams {
      const params = new URLSearchParams()
      appendPaginationToParams(params, filter)
      appendSearchToParams(params, filter.search)
      domainHandler.appendToParams(params, filter)
      return params
    }
  }
}
