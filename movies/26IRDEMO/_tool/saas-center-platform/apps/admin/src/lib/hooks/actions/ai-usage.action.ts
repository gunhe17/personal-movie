/**
 * AI Usage Actions (Admin)
 * AI 사용량 관련 API action 함수들
 */

import { get, put } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입: /summary ───

export interface AiUsageSummary {
  total_tokens: number
  total_cost: number
  total_calls: number
  active_models: number
  total_audio_minutes: number
  prev_total_tokens: number
  prev_total_cost: number
  prev_total_calls: number
  prev_audio_minutes: number
  token_change_pct: number | null
  cost_change_pct: number | null
  call_change_pct: number | null
  audio_change_pct: number | null
}

// ─── 타입: /by-feature ───

export interface FeatureUsageItem {
  purpose: string
  feature: string
  model: string | null
  provider: string
  status: string
  monthly_tokens: number
  total_tokens: number
  monthly_cost: number
  call_count: number
  avg_latency_ms: number | null
  monthly_audio_minutes: number
  total_audio_minutes: number
  monthly_credits: number
  total_credits: number
}

export interface FeatureUsageResponse {
  items: FeatureUsageItem[]
}

// ─── 타입: /monthly ───

export interface MonthlyUsageItem {
  month: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost: number
  call_count: number
  audio_minutes: number
}

export interface MonthlyUsageResponse {
  items: MonthlyUsageItem[]
}

// ─── 타입: /rate-config ───

export interface CreditRateConfigResponse {
  tokens_per_credit: number
  effective_from: string
  changed_by: string | null
  reason: string | null
}

// ─── 타입: /by-center ───

export interface CenterUsageItem {
  center_id: string
  center_name: string
  total_tokens: number
  estimated_cost: number
  call_count: number
  audio_minutes: number
  // 전체 센터 평균 건당 비용 (배수 계산용) — 백엔드 연동 후 활성화
  global_avg_cost_per_call?: number
}

export interface CenterUsageListResponse {
  items: CenterUsageItem[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── Actions ───

export const getAiUsageSummary = (): Action<AiUsageSummary, AiUsageSummary> => ({
  key: ['getAiUsageSummary'],
  request: async (params?: { month?: string }): Promise<AiUsageSummary> => {
    return get<AiUsageSummary>('/admin/ai-usage/summary', params)
  }
})

export const getAiUsageByFeature = (): Action<FeatureUsageResponse, FeatureUsageResponse> => ({
  key: ['getAiUsageByFeature'],
  request: async (params?: { date_from?: string; date_to?: string; center_id?: string }): Promise<FeatureUsageResponse> => {
    return get<FeatureUsageResponse>('/admin/ai-usage/by-feature', params)
  }
})

export const getCreditRateConfig = (): Action<CreditRateConfigResponse | null, CreditRateConfigResponse | null> => ({
  key: ['getCreditRateConfig'],
  request: async (): Promise<CreditRateConfigResponse | null> => {
    return get<CreditRateConfigResponse | null>('/admin/ai-usage/rate-config')
  }
})

export const putCreditRateConfig = () => ({
  key: ['putCreditRateConfig', 'getCreditRateConfig'],
  request: async (params: {
    tokens_per_credit: number
    reason?: string
  }) => {
    return put('/admin/ai-usage/rate-config', params)
  }
})

export const getAiUsageMonthly = (): Action<MonthlyUsageResponse, MonthlyUsageResponse> => ({
  key: ['getAiUsageMonthly'],
  request: async (params?: { months?: number }): Promise<MonthlyUsageResponse> => {
    return get<MonthlyUsageResponse>('/admin/ai-usage/monthly', params)
  }
})

export const getAiUsageByCenter = (): Action<CenterUsageListResponse, CenterUsageListResponse> => ({
  key: ['getAiUsageByCenter'],
  request: async (params?: {
    size?: number
    date_from?: string
    date_to?: string
    // 기능별 교차 필터 — 백엔드 연동 후 활성화
    feature_purpose?: string
  }): Promise<CenterUsageListResponse> => {
    return get<CenterUsageListResponse>('/admin/ai-usage/by-center', params)
  }
})
