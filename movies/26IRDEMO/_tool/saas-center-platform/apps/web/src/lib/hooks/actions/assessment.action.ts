import { externalGet, get, patch } from '$lib/services/api/instances'
import { mockListAssessments } from '$lib/mocks/assessmentManageStore'
import type { Action, ApiResponse } from '$lib/types/apiResponse'

// HTTP-Only 쿠키 환경: 모든 요청은 /api/proxy를 통해 프록시됨
// instances.ts에서 baseURL이 '/api/proxy'로 설정됨

const USE_MOCK_MANAGE = false

// ============================================================
// 검사 마스터 목록 조회 (GET /api/v1/assessments)
// ============================================================

// 검사 마스터 아이템 타입
export interface AssessmentMasterItem {
  id: string
  code: string
  kor_name: string
  eng_name: string
  assessment_type: 'projective' | 'objective' | string
  duration: number
}

// 검사 마스터 목록 응답 타입
export interface ListAssessmentMasterResponse {
  items: AssessmentMasterItem[]
  total: number
  page: number
  size: number
  pages: number
}

// 검사 마스터 목록 쿼리 파라미터
export interface ListAssessmentMasterParams {
  status?: 'public' | 'private' | string | null
  page?: number
  size?: number
}

/**
 * 검사 마스터 목록 조회
 * GET /api/v1/assessments
 *
 * 전체 검사 마스터 데이터 조회 (공개 상태 필터 지원)
 */
export const listAssessmentMaster = () => ({
  key: ['listAssessmentMaster'],
  request: async (params: ListAssessmentMasterParams = {}) => {
    const queryParams = new URLSearchParams()

    if (params.status) {
      queryParams.append('status', params.status)
    }
    if (params.page !== undefined) {
      queryParams.append('page', params.page.toString())
    }
    if (params.size !== undefined) {
      queryParams.append('size', params.size.toString())
    }

    const queryString = queryParams.toString()
    const response = await externalGet<ListAssessmentMasterResponse>(
      `/v1/assessments${queryString ? `?${queryString}` : ''}`
    )
    return response
  }
})

// ============================================================
// 검사 목록 조회 (신규 API)
// ============================================================

// 검사 상태 타입
export type AssessmentStatusType = 'public' | 'private' | 'draft'

// 검사 유형 타입 (서버 기준)
export type AssessmentType =
  | 'projective'      // 투사적 검사
  | 'intelligence'    // 지능검사
  | 'objective'       // 객관적 검사
  | 'developmental'   // 발달검사
  | string

// 검사 데이터 타입
export interface Assessment {
  uid: string
  code: string
  kor_name: string
  eng_name: string
  description: string
  assessment_type: AssessmentType
  target_age_group: string
  estimated_duration_minutes: number
  is_online_available: boolean
  is_ai_supported: boolean
  has_standard_report: boolean
  supports_report_upload: boolean
  supports_self_scoring: boolean
  status: AssessmentStatusType
  created_at: string
  updated_at: string
  modified_by_account: string
}

// 검사 목록 조회 쿼리 파라미터
export interface GetAssessmentsQueryParams {
  code?: string
  assessment_type?: string
  status?: string
  page?: number
  page_size?: number
  is_online_available?: boolean
  sort?: 'created_at_asc' | 'created_at_desc'
}

// GET /api/proxy/assessments
// 검사 마스터 목록 조회 (SvelteKit 프록시 경유)
const getAssessmentsReal = () => ({
  key: ['getAssessments'],
  request: async (request: { queryParams?: GetAssessmentsQueryParams }) => {
    const q = request.queryParams || {}
    const query: Record<string, string | number | undefined> = {}
    if (q.code) query.code = q.code
    if (q.assessment_type) query.assessment_type = q.assessment_type
    if (q.status) query.status = q.status
    if (q.page) query.page = q.page
    if (q.page_size) query.page_size = q.page_size
    return get(`/assessments`, query)
  }
})

const getAssessmentsMock = () => ({
  key: ['getAssessments'],
  request: async (request: { queryParams?: GetAssessmentsQueryParams } = {}) =>
    mockListAssessments(request.queryParams ?? {})
})

export const getAssessments = () =>
  USE_MOCK_MANAGE ? getAssessmentsMock() : getAssessmentsReal()

// ============================================================
// 센터 운영 검사 목록 조회
// GET /api/v1/centers/{center_id}/center-assessments
// ============================================================

export interface CenterAssessment {
  center_id: string
  assessment_id: string
  is_active: boolean
  code: string
  kor_name: string
  eng_name: string
  assessment_type: AssessmentType
  duration: number
  status: AssessmentStatusType
  supports_online: boolean
  created_at: string
  updated_at: string
}

/**
 * 센터 운영 검사 목록 조회
 * GET /api/proxy/centers/{center_id}/center-assessments
 *
 * getCenters()와 동일한 패턴 — SvelteKit 프록시를 통해 직접 fetch
 */
export const getCenterAssessments = (): Action<CenterAssessment[], CenterAssessment[]> => ({
  key: ['getCenterAssessments'],
  request: async (params: {
    centerId: string
    search?: string
    assessment_type?: string
    is_active?: boolean
  }): Promise<CenterAssessment[]> => {
    if (!params.centerId) return []
    const query: Record<string, string | boolean | undefined> = {}
    if (params.search) query.search = params.search
    if (params.assessment_type) query.assessment_type = params.assessment_type
    if (params.is_active !== undefined) query.is_active = params.is_active
    return get<CenterAssessment[]>(
      `/centers/${params.centerId}/center-assessments`,
      query
    )
  }
})

// ============================================================
// 센터 검사 활성화/비활성화 토글
// PATCH /api/v1/centers/{center_id}/center-assessments/{assessment_id}
// ============================================================

export interface UpdateCenterAssessmentParams {
  centerId: string
  assessmentId: string
  isActive: boolean
}

/**
 * 센터 검사 활성화/비활성화 전환
 * PATCH /centers/{center_id}/center-assessments/{assessment_id}
 * body: { is_active: boolean }
 */
export const updateCenterAssessment = () => ({
  key: ['updateCenterAssessment', 'getCenterAssessments'],
  request: async (params: UpdateCenterAssessmentParams): Promise<CenterAssessment> => {
    const res = await patch<CenterAssessment>(
      `/centers/${params.centerId}/center-assessments/${params.assessmentId}`,
      { is_active: params.isActive }
    )
    return (res as { data?: CenterAssessment }).data ?? (res as unknown as CenterAssessment)
  }
})

// ============================================================
// 검사 상세 조회 (GET /assessments/{assessment_id})
// ============================================================

// 검사 상세 응답 타입 (어드민 '검사 특성'과 동일 원천)
export interface AssessmentDetail {
  id: string
  code: string
  version: string
  kor_name: string
  eng_name: string
  assessment_type: AssessmentType
  description: string | null
  duration: number | null
  age: string | null
  status: AssessmentStatusType
  workflow_type: string
  external_url: string | null
  definition: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * 검사 상세 조회
 * GET /assessments/{assessment_id}
 *
 * 센터 공통 마스터 데이터라 center_id를 받지 않는다.
 */
export const getAssessmentDetail = (): Action<AssessmentDetail, AssessmentDetail> => ({
  key: ['getAssessmentDetail'],
  request: async (params: { assessmentId: string }): Promise<AssessmentDetail> => {
    if (!params.assessmentId) return {} as AssessmentDetail
    return get<AssessmentDetail>(`/assessments/${params.assessmentId}`)
  }
})

// 검사 활성화 상태 일괄 업데이트 요청 파라미터
export interface BulkUpdateActivationStatusParams {
  centerId: string
  payload: Array<{
    assessment_uid: string
    is_active: boolean
  }>
}

// 검사 활성화 상태 일괄 업데이트 응답 타입
export interface BulkUpdateActivationStatusResponse {
  succeeded: Array<{
    center_uid: string
    assessment_uid: string
    is_active: boolean
    modified_at: string
    modified_by_account: string
    modified_by_person: string
  }>
  failed: Array<{
    assessment_uid: string
    reason: string
    error_code: string
  }>
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}

// PATCH /api/proxy/centers/{center_id}/center-assessments/batch
// 액션이 매핑 경계 — 백엔드는 갱신된 CenterAssessment 목록을 반환하고,
// 기존 BulkUpdateActivationStatusResponse(succeeded/failed/summary)로 변환한다.
// 백엔드는 set_active upsert라 부분 실패가 없다(failed=[]).
type BulkUpdatedRow = {
  center_id: string
  assessment_id: string
  is_active: boolean
  updated_at: string
}

export const bulkUpdateActivationStatus = (): Action<
  BulkUpdateActivationStatusResponse
> => ({
  key: ['getAssessments', 'getCenterAssessments', 'assessments-summary'],
  request: async (
    params: BulkUpdateActivationStatusParams
  ): Promise<ApiResponse<BulkUpdateActivationStatusResponse>> => {
    const { centerId, payload } = params

    const res = await patch<BulkUpdatedRow[]>(
      `/centers/${centerId}/center-assessments/batch`,
      {
        items: payload.map((p) => ({
          assessment_id: p.assessment_uid,
          is_active: p.is_active
        }))
      }
    )
    const list = (res as { data?: BulkUpdatedRow[] }).data ?? (res as unknown as BulkUpdatedRow[])

    return {
      success: true,
      data: {
        succeeded: list.map((r) => ({
          center_uid: r.center_id,
          assessment_uid: r.assessment_id,
          is_active: r.is_active,
          modified_at: r.updated_at,
          modified_by_account: '',
          modified_by_person: ''
        })),
        failed: [],
        summary: {
          total: payload.length,
          succeeded: list.length,
          failed: 0
        }
      }
    }
  }
})
