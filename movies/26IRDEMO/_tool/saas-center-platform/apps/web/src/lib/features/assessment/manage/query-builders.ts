import type { GetPackageListRequest } from '$lib/hooks/actions/package.action'
import type { GetAssessmentsQueryParams as AssessmentsQueryParams } from '$lib/hooks/actions/assessment.action'
import type { ManageFilters } from './filters'
import { toAssessmentsQueryParams } from './filters'

// ============================================================
// 타입 정의
// ============================================================

export interface AssessmentsQueryInput {
  queryParams: AssessmentsQueryParams
}

export interface PackageListInput extends GetPackageListRequest {}

export interface PackageFormData {
  packageName: string
  description?: string
  selectedAssessments: string[]
}

// ============================================================
// 쿼리 입력 빌더
// ============================================================

export function buildAssessmentsQueryInput(
  filters: ManageFilters
): AssessmentsQueryInput {
  return { queryParams: toAssessmentsQueryParams(filters) }
}

export function buildAssessmentSummaryInput(centerId: string) {
  return { centerId }
}

export function buildCenterAssessmentsInput(
  centerId: string,
  filters?: ManageFilters
) {
  const input: Record<string, unknown> = { centerId }

  if (filters?.search?.trim()) {
    input.search = filters.search.trim()
  }
  if (filters?.assessmentType && filters.assessmentType !== 'all') {
    input.assessment_type = filters.assessmentType
  }
  if (filters?.active === 'active') {
    input.is_active = true
  } else if (filters?.active === 'inactive') {
    input.is_active = false
  } else if (filters?.active === 'all') {
    input.is_active = 'all'
  }

  return input
}

export function buildPackageListInput(centerId: string): PackageListInput {
  return {
    centerId,
    queryParams: {
      page: 1,
      page_size: 100
    }
  }
}
