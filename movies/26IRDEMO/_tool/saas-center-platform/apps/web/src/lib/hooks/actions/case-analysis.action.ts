/**
 * Case Analysis API 액션
 *
 * 상담 케이스 경과 분석 (AI).
 */

import { get, post } from '$lib/services/api/instances'

// ── 미리보기 ──

export interface CaseAnalysisPreview {
  session_count: number
  note_count: number
  has_previous_analysis: boolean
  message: string
}

export const getCaseAnalysisPreview = () => ({
  key: ['getCaseAnalysisPreview'],
  request: async (params: {
    centerId: string | null | undefined
    caseId: string
  }) => {
    if (!params.centerId) return null
    return get<CaseAnalysisPreview>(
      `/centers/${params.centerId}/counseling/cases/${params.caseId}/analysis/preview`
    )
  }
})

// ── 분석 실행 ──

export interface CaseAnalysisTriggerResponse {
  status: string
  message: string
}

export const postCaseAnalysis = () => ({
  key: ['postCaseAnalysis'],
  request: async (params: {
    centerId: string
    caseId: string
    /** 최근 N개 완료 회기만 분석. 미지정이면 전체 */
    sessionTake?: number | null
  }) => {
    return post<CaseAnalysisTriggerResponse>(
      `/centers/${params.centerId}/counseling/cases/${params.caseId}/analysis/`,
      { session_take: params.sessionTake ?? null }
    )
  }
})

// ── 최신 분석 조회 ──

/**
 * `mixed`는 **그룹 전용** — 성원마다 방향이 갈릴 때다.
 * 예전엔 갈림을 `flat`에 담게 했는데, 상담사는 `flat`(→ 유지)을 "안 변했다"로 읽지
 * "사람마다 다르다"로 읽지 않는다. 뜻이 다른 두 상태를 한 값에 담으면 조용한 오독이 된다.
 */
export type AnalysisTrend = 'up' | 'flat' | 'down' | 'mixed'

export interface CaseAnalysisPhase {
  label?: string | null
  from?: number | null
  to?: number | null
  focus?: string | null
  mood?: string | null
  trend?: AnalysisTrend | null
  turning?: string | null
}

export interface CaseAnalysisSessionRow {
  session: number
  /** 서버가 채우는 구조화 사실 — LLM 산출물이 아니다 */
  date?: string | null
  attendance?: 'attended' | 'absent' | 'no_show' | null
  /** 그룹 표시용 — 그 회기에 참석한 인원 / 배정 인원 */
  attended_count?: number | null
  participant_count?: number | null
  note_source?: 'manual' | 'ai' | 'none' | null
  topic?: string | null
  mood?: string | null
  intervention?: string | null
  change?: AnalysisTrend | null
  homework?: 'done' | 'partial' | 'none' | null
  turning?: string | null
}

export interface CaseAnalysisTheme {
  name: string
  sessions?: number[]
  note?: string | null
}

export interface CaseAnalysisIntervention {
  name: string
  count?: number
  sessions?: number[]
  response?: string | null
  effect?: string | null
  evidence?: string | null
}

export interface CaseAnalysisFactor {
  text: string
  sessions?: number[]
}

export interface CaseAnalysisCoverage {
  completed_sessions?: number
  analyzed_sessions?: number
  note_count?: number
  manual_notes?: number
  ai_notes?: number
  mood_notes?: number
  intervention_notes?: number
  attendance_rate?: number | null
  /** 예산을 넘어 일부만 넣은 일지 수 — 화면이 "무엇이 들어갔나"를 정확히 말하기 위한 값 */
  truncated_notes?: number
  per_session_chars?: number | null
  /**
   * 이 분석이 **그룹으로 처리했는지** — 서버가 실행 시점 명단 인원수로 판정한 값이다.
   * 화면의 `case_type`(프로그램 유형)과 갈릴 수 있다: 그룹 프로그램에 한 명만 남은
   * 케이스는 개인으로 분석되고, 개인 프로그램에 두 명이 붙은 케이스는 그룹으로 분석된다.
   * **값의 단위를 설명하는 라벨은 이쪽을 따라야 한다** — 데이터가 그렇게 만들어졌으므로.
   */
  is_group?: boolean
  /** 분석 시점의 명단 인원 (지금 명단과 다를 수 있다) */
  client_count?: number
}

export interface CaseAnalysisContent {
  // 신규 포맷
  headline?: string | null
  current_state?: string | null
  mood_trend?: AnalysisTrend | null
  phases?: CaseAnalysisPhase[]
  session_track?: CaseAnalysisSessionRow[]
  themes?: {
    recurring?: CaseAnalysisTheme[]
    emerging?: CaseAnalysisTheme[]
    resolved?: CaseAnalysisTheme[]
  }
  interventions?: CaseAnalysisIntervention[]
  alliance?: { engagement?: string | null; evidence?: string | null } | null
  risks?: CaseAnalysisFactor[]
  strengths?: CaseAnalysisFactor[]
  direction?: {
    goals?: string[]
    approaches?: string[]
    closing?: string | null
    supervision?: string[]
  } | null
  coverage?: CaseAnalysisCoverage | null

  // 옛 포맷 (2026-08 이전 저장분 — 읽기 호환)
  recurring_themes?: string[]
  emerging_themes?: string[]
  emotional_trajectory?: Array<{
    session: number
    date?: string
    mood?: string
    change_direction?: string
  }>
  intervention_summary?: Record<
    string,
    { frequency?: number; effectiveness?: string; evidence?: string }
  >
  therapeutic_alliance?: {
    attendance_rate?: string
    engagement_level?: string
    evidence?: string
  } | null
  progress_summary?: string | null
  risk_factors?: string[]
  recommendations?: string | null
}

export interface CaseAnalysisResult {
  id: string
  center_id: string
  counseling_case_id: string
  content: CaseAnalysisContent
  session_count: number
  /** processing이면 아직 실행 중 — 화면이 진행 상태를 그린다 */
  status: 'processing' | 'completed' | 'failed'
  error_message: string | null
  model_used: string | null
  triggered_by: string
  input_tokens: number
  output_tokens: number
  created_at: string
  updated_at: string
}

export const getCaseAnalysisLatest = () => ({
  key: ['getCaseAnalysisLatest'],
  request: async (params: {
    centerId: string | null | undefined
    caseId: string
  }) => {
    if (!params.centerId) return null
    try {
      return await get<CaseAnalysisResult>(
        `/centers/${params.centerId}/counseling/cases/${params.caseId}/analysis/latest`
      )
    } catch (e: any) {
      // 404 = 아직 분석 없음 → null
      if (e?.response?.status === 404) return null
      throw e
    }
  }
})
