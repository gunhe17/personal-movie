/**
 * Center Assessment Actions (Admin)
 * 센터별 검사 할당/관리 API action 함수들
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface CenterAssessmentItem {
  center_id: string
  assessment_id: string
  is_active: boolean
  code: string
  kor_name: string
  eng_name: string
  type: string
  duration: number | null
  status: string
  created_at: string
  updated_at: string
}

export interface UnassignedAssessment {
  id: string
  code: string
  kor_name: string
  eng_name: string
  type: string
  duration: number | null
  age: string | null
  status: string
  created_at: string
  deleted_at: string | null
}

// ─── 조회 ───

export const getCenterAssessments = (): Action<CenterAssessmentItem[], CenterAssessmentItem[]> => ({
  key: ['getCenterAssessments'],
  request: async (params: {
    centerId: string
    search?: string
    is_active?: boolean | null
  }): Promise<CenterAssessmentItem[]> => {
    const { centerId, ...query } = params
    return get<CenterAssessmentItem[]>(`/admin/centers/${centerId}/center-assessments`, query)
  }
})

export const getUnassignedAssessments = (): Action<UnassignedAssessment[], UnassignedAssessment[]> => ({
  key: ['getUnassignedAssessments'],
  request: async (params: {
    centerId: string
    search?: string
  }): Promise<UnassignedAssessment[]> => {
    const { centerId, ...query } = params
    return get<UnassignedAssessment[]>(`/admin/centers/${centerId}/center-assessments/unassigned`, query)
  }
})

// ─── 할당 ───

export const postAssignAssessment = () => ({
  key: ['postAssignAssessment', 'getCenterAssessments', 'getUnassignedAssessments'],
  request: async (params: { centerId: string; assessment_id: string }) => {
    const { centerId, ...body } = params
    return post(`/admin/centers/${centerId}/center-assessments`, body)
  }
})

// ─── 토글 ───

export const patchCenterAssessment = () => ({
  key: ['patchCenterAssessment', 'getCenterAssessments'],
  request: async (params: { centerId: string; assessmentId: string; is_active: boolean }) => {
    const { centerId, assessmentId, ...body } = params
    return patch(`/admin/centers/${centerId}/center-assessments/${assessmentId}`, body)
  }
})

// ─── 할당 해제 ───

export const deleteCenterAssessment = () => ({
  key: ['deleteCenterAssessment', 'getCenterAssessments', 'getUnassignedAssessments'],
  request: async (params: { centerId: string; assessmentId: string }) => {
    return deleteResource(`/admin/centers/${params.centerId}/center-assessments/${params.assessmentId}`)
  }
})
