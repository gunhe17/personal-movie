/**
 * Assessment Set Actions
 * 검사 세트 관련 API action 함수들
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 */

import { get, post, patch, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============================================================
// 타입 정의
// ============================================================

export interface AssessmentSummary {
  id: string
  code: string
  kor_name: string
  eng_name: string
  assessment_type: string
  duration: number
  supports_online?: boolean
}

export interface CenterMemberSummary {
  member_id: string
  name: string
  snapshot_at: string
}

export interface AssessmentSetItem {
  id: string
  name: string
  description: string
  assessments: AssessmentSummary[]
  created_at: string
}

export interface AssessmentSetDetail {
  id: string
  center_id: string
  name: string
  description: string
  assessment_summary: AssessmentSummary[]
  center_member_summary: CenterMemberSummary[]
  created_at: string
  updated_at: string
}

export interface CreateAssessmentSetParams {
  centerId: string
  name: string
  description?: string
  assessment_ids: string[]
  center_member_ids?: string[]
}

export interface UpdateAssessmentSetParams {
  centerId: string
  setId: string
  name: string
  description?: string
  assessment_ids: string[]
  center_member_ids?: string[]
}

export interface DeleteAssessmentSetParams {
  centerId: string
  setId: string
}

export interface AssessmentSetListResponse {
  items: AssessmentSetItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface GetAssessmentSetListParams {
  centerId: string
  page?: number
  size?: number
}

// ============================================================
// 검사 세트 목록 조회
// GET /api/proxy/centers/{center_id}/assessment-sets
// ============================================================

export const getAssessmentSetList = (): Action<AssessmentSetListResponse, AssessmentSetListResponse> => ({
  key: ['getAssessmentSetList'],
  request: async (params: GetAssessmentSetListParams): Promise<AssessmentSetListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 0, size: 0, pages: 0 }
    }
    const query: Record<string, number | undefined> = {}
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size
    return get<AssessmentSetListResponse>(
      `/centers/${params.centerId}/assessment-sets`,
      query
    )
  }
})

// ============================================================
// 검사 세트 생성
// POST /api/proxy/centers/{center_id}/assessment-sets
// ============================================================

export const createAssessmentSet = () => ({
  key: ['createAssessmentSet', 'getAssessmentSetList'],
  request: async (params: CreateAssessmentSetParams): Promise<AssessmentSetDetail> => {
    const res = await post<AssessmentSetDetail>(
      `/centers/${params.centerId}/assessment-sets`,
      {
        name: params.name,
        description: params.description || '',
        assessment_ids: params.assessment_ids,
        center_member_ids: params.center_member_ids || []
      }
    )
    return (res as { data?: AssessmentSetDetail }).data ?? (res as unknown as AssessmentSetDetail)
  }
})

// ============================================================
// 검사 세트 수정
// PATCH /api/proxy/centers/{center_id}/assessment-sets/{set_id}
// ============================================================

export const updateAssessmentSet = () => ({
  key: ['updateAssessmentSet', 'getAssessmentSetList'],
  request: async (params: UpdateAssessmentSetParams): Promise<AssessmentSetDetail> => {
    const res = await patch<AssessmentSetDetail>(
      `/centers/${params.centerId}/assessment-sets/${params.setId}`,
      {
        name: params.name,
        description: params.description || '',
        assessment_ids: params.assessment_ids,
        center_member_ids: params.center_member_ids || []
      }
    )
    return (res as { data?: AssessmentSetDetail }).data ?? (res as unknown as AssessmentSetDetail)
  }
})

// ============================================================
// 검사 세트 삭제
// DELETE /api/proxy/centers/{center_id}/assessment-sets/{set_id}
// ============================================================

export const deleteAssessmentSet = () => ({
  key: ['deleteAssessmentSet', 'getAssessmentSetList'],
  request: async (params: DeleteAssessmentSetParams): Promise<void> => {
    await deleteResource(
      `/centers/${params.centerId}/assessment-sets/${params.setId}`
    )
  }
})
