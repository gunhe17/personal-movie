/**
 * Assessment Package Actions
 * 검사 패키지 관련 API action 함수들
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 *
 * 이 action은 매핑 경계(mapping boundary)다. 백엔드 응답(AssessmentPackageSummary 등)을
 * 다운스트림 소비자가 기대하는 PackageType 형태로 변환하여 소비자 코드를 보존한다.
 */

import { get, post, patch, deleteResource } from '$lib/services/api/instances'
import type { Action, PaginationRes } from '$lib/types/apiResponse'

// 패키지 내 검사 항목 (소비자가 읽는 최소 필드만)
export interface PackageAssessment {
  uid: string
  code: string
  kor_name: string
  eng_name: string
  assessment_type: string
  is_online_available: boolean
  duration: number | null
}

// 패키지 타입
export interface PackageType {
  uid: string
  center_uid: string
  name: string
  description: string | null
  assessments: PackageAssessment[]
  package_price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  modified_by_account: string | null
  modified_by_person: string | null
}

// 패키지 목록 조회 요청 타입
export interface GetPackageListRequest {
  centerId: string
  queryParams: {
    page?: number
    page_size?: number
    name?: string
    sort?: 'created_at_asc' | 'created_at_desc'
    include_deleted?: boolean
  }
}

// 패키지 생성 요청 타입
export interface CreatePackagePayload {
  name: string
  description?: string
  assessment_uids: string[] // 최소 2개 이상
  package_price?: number
}

export interface CreatePackageRequest {
  centerId: string
  currentAccount?: string
  currentPerson?: string
  payload: CreatePackagePayload
}

export interface CreatePackageResponse {
  data: {
    uid: string
  }
}

// 패키지 수정 요청 타입
export interface UpdatePackagePayload {
  name?: string
  description?: string
  assessment_uids?: string[] // 수정 시 최소 2개 유지
  package_price?: number
}

export interface UpdatePackageRequest {
  centerId: string
  packageId: string
  currentAccount?: string
  currentPerson?: string
  payload: UpdatePackagePayload
}

export interface UpdatePackageResponse {
  data: {
    uid: string
  }
}

// 패키지 삭제 요청 타입
export interface DeletePackageRequest {
  centerId: string
  packageId: string
  currentAccount?: string
  currentPerson?: string
  force?: boolean // 진행 중인 세션이 있어도 강제 삭제 (default: false)
}

// ============================================================
// 백엔드 응답 타입 (매핑 경계 내부용)
// ============================================================

interface BackendAssessmentSummary {
  id: string
  code: string
  kor_name: string
  eng_name: string
  assessment_type: string
  duration: number | null
}

interface BackendPackageSummary {
  id: string
  name: string
  description: string | null
  assessments: BackendAssessmentSummary[]
  package_price: number | null
  is_active: boolean
  created_at: string
}

interface BackendPackageResponse {
  id: string
  center_id: string
  name: string
  description: string | null
  assessment_summary: BackendAssessmentSummary[]
  package_price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// 백엔드 summary → PackageType 변환
const toPackageType = (s: BackendPackageSummary): PackageType => ({
  uid: s.id,
  center_uid: '', // summary에 center_id 없음 (소비자는 빈값 허용)
  name: s.name,
  description: s.description,
  package_price: s.package_price ?? null,
  is_active: s.is_active,
  created_at: s.created_at,
  updated_at: s.created_at, // summary에 updated_at 없음
  modified_by_account: null,
  modified_by_person: null,
  // NOTE: is_online_available는 백엔드 AssessmentSummary에 없어 false 기본 (set 측 mapSummaryToVM와 동일)
  assessments: s.assessments.map((a) => ({
    uid: a.id,
    code: a.code,
    kor_name: a.kor_name,
    eng_name: a.eng_name,
    assessment_type: a.assessment_type,
    is_online_available: false,
    duration: a.duration ?? null
  }))
})

// GET /api/proxy/centers/{center_id}/assessment-packages
// 센터별 패키지 목록 조회
export const getPackageListByCenterId = (): Action<
  PaginationRes<PackageType>,
  PaginationRes<PackageType>
> => ({
  key: ['getPackages'],
  request: async (
    request: GetPackageListRequest
  ): Promise<PaginationRes<PackageType>> => {
    if (!request.centerId) {
      return {
        data: [],
        pagination: { page: 0, page_size: 0, total: 0, total_pages: 0 }
      }
    }

    const { page, page_size, name } = request.queryParams
    // NOTE: sort / include_deleted는 백엔드 미지원 → drop (추후 서버 필터)
    const query: Record<string, number | string | undefined> = {}
    if (page !== undefined) query.page = page
    if (page_size !== undefined) query.size = page_size
    if (name) query.search = name

    const res = await get<{
      items: BackendPackageSummary[]
      total: number
      page: number
      size: number
      pages: number
    }>(`/centers/${request.centerId}/assessment-packages`, query)

    return {
      data: res.items.map(toPackageType),
      pagination: {
        page: res.page,
        page_size: res.size,
        total: res.total,
        total_pages: res.pages
      }
    }
  }
})

// POST /api/proxy/centers/{center_id}/assessment-packages
// 패키지 생성
export const createPackage = (): Action<
  CreatePackageResponse,
  CreatePackageResponse
> => ({
  key: ['createPackage', 'getPackages'],
  request: async (
    request: CreatePackageRequest
  ): Promise<CreatePackageResponse> => {
    const { centerId, payload } = request
    const res = await post<BackendPackageResponse>(
      `/centers/${centerId}/assessment-packages`,
      {
        name: payload.name,
        description: payload.description ?? '',
        assessment_ids: payload.assessment_uids,
        package_price: payload.package_price ?? null
      }
    )
    const created =
      (res as { data?: BackendPackageResponse }).data ??
      (res as unknown as BackendPackageResponse)
    return { data: { uid: created.id } }
  }
})

// PATCH /api/proxy/centers/{center_id}/assessment-packages/{package_id}
// 패키지 수정 (부분 수정)
export const updatePackage = (): Action<
  UpdatePackageResponse,
  UpdatePackageResponse
> => ({
  key: ['updatePackage', 'getPackages'],
  request: async (
    request: UpdatePackageRequest
  ): Promise<UpdatePackageResponse> => {
    const { centerId, packageId, payload } = request

    const body: Record<string, unknown> = {}
    if (payload.name !== undefined) body.name = payload.name
    if (payload.description !== undefined) body.description = payload.description
    if (payload.assessment_uids !== undefined)
      body.assessment_ids = payload.assessment_uids
    if (payload.package_price !== undefined)
      body.package_price = payload.package_price

    const res = await patch<BackendPackageResponse>(
      `/centers/${centerId}/assessment-packages/${packageId}`,
      body
    )
    const updated =
      (res as { data?: BackendPackageResponse }).data ??
      (res as unknown as BackendPackageResponse)
    return { data: { uid: updated.id } }
  }
})

// DELETE /api/proxy/centers/{center_id}/assessment-packages/{package_id}
// 패키지 삭제
export const deletePackage = (): Action<{ data: { uid: string } }, void> => ({
  key: ['deletePackage', 'getPackages'],
  request: async (request: DeletePackageRequest): Promise<void> => {
    const { centerId, packageId } = request
    await deleteResource(
      `/centers/${centerId}/assessment-packages/${packageId}`
    )
  }
})
