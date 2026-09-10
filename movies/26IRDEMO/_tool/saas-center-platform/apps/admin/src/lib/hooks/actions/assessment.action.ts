/**
 * Assessment Actions (Admin)
 * 검사 마스터 데이터 관련 API action 함수들
 *
 * API 스펙: docs/platform-admin.md §4.1.4
 */

import { get, post, patch } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface AssessmentSummary {
  id: string
  code: string
  kor_name: string
  eng_name: string | null
  type: string
  duration: number | null
  age: string | null
  status: AssessmentStatus
  created_at: string
  deleted_at: string | null
}

export type AssessmentStatus = 'public' | 'private' | 'draft'

export interface AssessmentListResponse {
  items: AssessmentSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface QuestionOption {
  value: number
  label: string
}

export interface QuestionItem {
  number: number
  text?: string
  options?: QuestionOption[]
  // SCT (sentence_completion)
  stem_before?: string
  stem_after?: string | null
}

export type DefinitionType = 'choice' | 'sentence_completion'

export interface AssessmentDefinition {
  type?: DefinitionType
  questions?: QuestionItem[]
  common_options?: QuestionOption[]
}

export interface AssessmentDetailResponse {
  id: string
  code: string
  version: string
  kor_name: string
  eng_name: string
  type: string
  description: string | null
  duration: number | null
  age: string | null
  status: AssessmentStatus
  workflow_type: string
  external_url: string | null
  supports_online: boolean
  definition: AssessmentDefinition
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AssessmentCreateParams {
  code: string
  kor_name: string
  eng_name?: string
  type: string
  description?: string
  duration?: number
  age?: string
  status: AssessmentStatus
  version?: string
  workflow_type?: string
  external_url?: string
  supports_online?: boolean
}

// ─── 검사 목록 ───

export const getAssessmentList = (): Action<AssessmentListResponse, AssessmentListResponse> => ({
  key: ['getAssessmentList'],
  request: async (params?: {
    search?: string
    type?: string
    status?: AssessmentStatus
    page?: number
    size?: number
  }): Promise<AssessmentListResponse> => {
    return get<AssessmentListResponse>('/admin/assessments', params)
  }
})

// ─── 검사 상세 ───

export const getAssessmentDetail = (): Action<AssessmentDetailResponse, AssessmentDetailResponse> => ({
  key: ['getAssessmentDetail'],
  request: async (params: { assessmentId: string }): Promise<AssessmentDetailResponse> => {
    return get<AssessmentDetailResponse>(`/admin/assessments/${params.assessmentId}`)
  }
})

// ─── 검사 등록 ───

export const postCreateAssessment = () => ({
  key: ['postCreateAssessment', 'getAssessmentList'],
  request: async (params: AssessmentCreateParams) => {
    return post('/admin/assessments', params)
  }
})

// ─── 검사 수정 ───

export const patchAssessment = () => ({
  key: ['patchAssessment', 'getAssessmentList', 'getAssessmentDetail'],
  request: async (params: { assessmentId: string; [key: string]: any }) => {
    const { assessmentId, ...body } = params
    return patch(`/admin/assessments/${assessmentId}`, body)
  }
})

