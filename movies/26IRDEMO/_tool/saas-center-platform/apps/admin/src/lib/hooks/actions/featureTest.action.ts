/**
 * Admin AI Lab 기능 테스트 Actions
 *
 * 백엔드 prefix: /admin/ai-lab/feature-test
 */

import { get, post } from '$services/api/instances'

const BASE = '/admin/ai-lab/feature-test'

// ── 타입 ──

export interface CreditBalance {
  plan_type: string
  credit_limit: number
  credit_used: number
  credit_remaining: number
  tokens_per_credit: number
  period_start: string
  period_end: string
  estimated_credits: Record<string, number>
}

export interface FieldNoteListItem {
  id: string
  status: string
  processing_status: string
  total_duration: number
  created_at: string
  audios?: { id: string }[]
}

export interface FieldNoteListResponse {
  items: FieldNoteListItem[]
  total: number
  page: number
  size: number
}

export interface TokenUsageItem {
  purpose: string | null
  model: string | null
  calls: number
  input_tokens: number
  output_tokens: number
}

export interface FieldNoteDetailResponse {
  id: string
  status: string
  transcribe_status: string
  refine_status: string
  summary_status: string
  note_status: string
  note_template_type: string | null
  refined_transcript: string | null
  summary: string | null
  refinement_model: string | null
  summary_model: string | null
  total_duration: number
  created_at: string
  audios: Array<{
    id: string
    transcript: string | null
    diarized_transcript: string | null
    stt_model_used: string | null
  }>
  token_usage: TokenUsageItem[]
}

export interface PipelineStepResponse {
  status: string
  message: string
}

export interface CounselingCaseItem {
  case_id?: string
  id?: string
  title?: string
  case_code?: string
  total_sessions?: number
  completed_sessions?: number
  clients?: Array<{ name: string }>
}

export interface CounselingCaseListResponse {
  items: CounselingCaseItem[]
  total: number
  page: number
  size: number
}

export interface CaseAnalysisPreview {
  session_count: number
  note_count: number
  has_previous_analysis: boolean
  message: string
}

export interface CaseAnalysisResult {
  id: string
  center_id: string
  counseling_case_id: string
  content: {
    recurring_themes?: string[]
    emerging_themes?: string[]
    emotional_trajectory?: Array<{ session: number; date: string; mood: string; change_direction?: string }>
    intervention_summary?: Record<string, { frequency: number; effectiveness: string; evidence?: string }>
    therapeutic_alliance?: { attendance_rate?: string; engagement_level?: string; evidence?: string }
    progress_summary?: string
    risk_factors?: string[]
    strengths?: string[]
    recommendations?: string
  }
  session_count: number
  model_used: string | null
  input_tokens: number
  output_tokens: number
  created_at: string
}

// ── Credit ──

export const getFeatureTestCredit = () => ({
  key: ['getFeatureTestCredit'],
  request: async (params: { centerId: string }) => {
    if (!params.centerId) return null
    return get<CreditBalance | null>(`${BASE}/${params.centerId}/credit`)
  },
})

// ── Field Notes ──

export const getFeatureTestFieldNotes = () => ({
  key: ['getFeatureTestFieldNotes'],
  request: async (params: { centerId: string; status?: string; page?: number; size?: number }) => {
    if (!params.centerId) return null
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    qs.set('page', String(params.page ?? 1))
    qs.set('size', String(params.size ?? 50))
    return get<FieldNoteListResponse>(`${BASE}/${params.centerId}/field-notes?${qs}`)
  },
})

export const getFeatureTestFieldNoteDetail = () => ({
  key: ['getFeatureTestFieldNoteDetail'],
  request: async (params: { centerId: string; fieldNoteId: string }) => {
    return get<FieldNoteDetailResponse>(
      `${BASE}/${params.centerId}/field-notes/${params.fieldNoteId}`,
    )
  },
})

export const postFeatureTestTranscribe = () => ({
  key: ['postFeatureTestTranscribe'],
  request: async (params: { centerId: string; fieldNoteId: string }) => {
    return post<PipelineStepResponse>(
      `${BASE}/${params.centerId}/field-notes/${params.fieldNoteId}/transcribe`,
    )
  },
})

export const postFeatureTestRefine = () => ({
  key: ['postFeatureTestRefine'],
  request: async (params: { centerId: string; fieldNoteId: string }) => {
    return post<PipelineStepResponse>(
      `${BASE}/${params.centerId}/field-notes/${params.fieldNoteId}/refine`,
    )
  },
})

export const postFeatureTestSummary = () => ({
  key: ['postFeatureTestSummary'],
  request: async (params: { centerId: string; fieldNoteId: string }) => {
    return post<PipelineStepResponse>(
      `${BASE}/${params.centerId}/field-notes/${params.fieldNoteId}/generate-summary`,
    )
  },
})

export const postFeatureTestNote = () => ({
  key: ['postFeatureTestNote'],
  request: async (params: { centerId: string; fieldNoteId: string; noteTemplateType?: string }) => {
    return post<PipelineStepResponse>(
      `${BASE}/${params.centerId}/field-notes/${params.fieldNoteId}/generate-counseling-note`,
      params.noteTemplateType ? { note_template_type: params.noteTemplateType } : undefined,
    )
  },
})

// ── Counseling Cases ──

export const getFeatureTestCounselingCases = () => ({
  key: ['getFeatureTestCounselingCases'],
  request: async (params: { centerId: string; page?: number; size?: number }) => {
    if (!params.centerId) return null
    const qs = new URLSearchParams()
    qs.set('page', String(params.page ?? 1))
    qs.set('size', String(params.size ?? 50))
    return get<CounselingCaseListResponse>(`${BASE}/${params.centerId}/counseling-cases?${qs}`)
  },
})

// ── Case Analysis ──

export const getFeatureTestCasePreview = () => ({
  key: ['getFeatureTestCasePreview'],
  request: async (params: { centerId: string; caseId: string }) => {
    return get<CaseAnalysisPreview>(
      `${BASE}/${params.centerId}/cases/${params.caseId}/analysis/preview`,
    )
  },
})

export const postFeatureTestCaseAnalysis = () => ({
  key: ['postFeatureTestCaseAnalysis'],
  request: async (params: { centerId: string; caseId: string }) => {
    return post<{ status: string; message: string }>(
      `${BASE}/${params.centerId}/cases/${params.caseId}/analysis`,
    )
  },
})

export const getFeatureTestCaseLatest = () => ({
  key: ['getFeatureTestCaseLatest'],
  request: async (params: { centerId: string; caseId: string }) => {
    return get<CaseAnalysisResult>(
      `${BASE}/${params.centerId}/cases/${params.caseId}/analysis/latest`,
    )
  },
})
