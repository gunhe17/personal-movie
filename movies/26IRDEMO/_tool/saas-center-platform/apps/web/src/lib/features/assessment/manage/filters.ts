/**
 * 검사 관리 페이지 필터
 * 공통 필터를 확장하여 도메인 특화 필터 추가
 */

import type { GetAssessmentsQueryParams } from '$lib/hooks/actions/assessment.action'
import type { TabType } from './constants'
import {
  type BaseListFilter,
  type FilterHandler,
  parsePaginationFromUrl,
  parseSearchFromUrl,
  appendPaginationToParams,
  appendSearchToParams,
  PAGINATION_DEFAULTS
} from '$lib/features/common/filters'

// ============================================================
// 도메인 특화 타입
// ============================================================

export type EnabledFilter = 'all' | 'enabled' | 'disabled'
export type ActiveFilter = 'all' | 'active' | 'inactive'
export type SortOrder = 'oldest' | 'newest'
export type AssessmentTypeFilter = 'all' | 'perceptual' | 'developmental' | 'projective' | 'objective'

/** 도메인 특화 필터 */
interface ManageDomainFilter {
  tab: TabType
  enabled: EnabledFilter
  active: ActiveFilter
  sort: SortOrder
  assessmentType: AssessmentTypeFilter
}

/** 검사 관리 전체 필터 (공통 + 도메인) */
export interface ManageFilters extends BaseListFilter, ManageDomainFilter {}

// ============================================================
// 기본값
// ============================================================

const DOMAIN_DEFAULTS: ManageDomainFilter = {
  tab: 'single',
  enabled: 'enabled',
  active: 'all',
  sort: 'oldest',
  assessmentType: 'all'
}

// ============================================================
// 도메인 필터 핸들러
// ============================================================

const domainFilterHandler: FilterHandler<ManageDomainFilter, void> = {
  parseFromUrl(url: URL): Partial<ManageDomainFilter> {
    const p = url.searchParams
    const tabParam = p.get('tab') as TabType | null
    const enabledParam = p.get('is_active') as EnabledFilter | null
    const activeParam = p.get('active') as ActiveFilter | null
    const sortParam = p.get('sort') as SortOrder | null
    const assessmentTypeParam = p.get('assessment_type') as AssessmentTypeFilter | null

    const result: Partial<ManageDomainFilter> = {}
    if (tabParam) result.tab = tabParam
    if (enabledParam) result.enabled = enabledParam
    if (activeParam) result.active = activeParam
    if (sortParam) result.sort = sortParam
    if (assessmentTypeParam) result.assessmentType = assessmentTypeParam
    return result
  },

  appendToParams(params: URLSearchParams, filter: ManageDomainFilter): void {
    if (filter.tab !== 'single') {
      params.set('tab', filter.tab)
    }
    if (filter.enabled !== 'all') {
      params.set('is_active', filter.enabled)
    }
    if (filter.active !== 'active') {
      params.set('active', filter.active)
    }
    if (filter.sort !== 'oldest') {
      params.set('sort', filter.sort)
    }
    if (filter.assessmentType !== 'all') {
      params.set('assessment_type', filter.assessmentType)
    }
  },

  toApiParams() {
    // API 변환은 별도 함수에서 처리
  },

  defaults: DOMAIN_DEFAULTS
}

// ============================================================
// 필터 파싱/변환 함수
// ============================================================

/**
 * URL → 필터 모델
 */
export function parseFiltersFromUrl(url: URL): ManageFilters {
  const pagination = parsePaginationFromUrl(url, PAGINATION_DEFAULTS)
  const search = parseSearchFromUrl(url)
  const domain = domainFilterHandler.parseFromUrl(url)

  return {
    ...pagination,
    search,
    ...DOMAIN_DEFAULTS,
    ...domain
  }
}

/**
 * 필터 모델 → URL
 */
export function toSearchParams(filters: ManageFilters): URLSearchParams {
  const params = new URLSearchParams()
  appendPaginationToParams(params, filters)
  appendSearchToParams(params, filters.search)
  domainFilterHandler.appendToParams(params, filters)
  return params
}

/**
 * 필터 모델 → API 쿼리 파라미터
 */
export function toAssessmentsQueryParams(
  filters: ManageFilters
): GetAssessmentsQueryParams {
  const params: GetAssessmentsQueryParams & {
    is_online_available?: boolean
    sort?: string
  } = {
    page: 1,
    page_size: 1000 // 페이지네이션 없이 전체 조회
  }

  // 검색어
  if (filters.search.trim()) {
    params.code = filters.search.trim()
  }

  // 운영 상태
  if (filters.enabled === 'enabled') params.status = 'public'
  else if (filters.enabled === 'disabled') params.status = 'private'

  // 운영 상태 필터 (클라이언트 사이드 필터링용)
  // active 필터는 API가 아닌 클라이언트에서 처리

  // 검사 분류
  // Note: 'developmental' 필터는 백엔드에서 developmental + cognitive 모두 조회하도록 처리 필요
  // 또는 프론트에서 별도 처리
  if (filters.assessmentType !== 'all') {
    params.assessment_type = filters.assessmentType
  }

  // 정렬
  if (filters.sort === 'oldest') params.sort = 'created_at_asc'
  else if (filters.sort === 'newest') params.sort = 'created_at_desc'

  return params
}
