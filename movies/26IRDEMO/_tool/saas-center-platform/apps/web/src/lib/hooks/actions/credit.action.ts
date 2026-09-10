/**
 * Credit API 액션
 *
 * AI 크레딧 잔량 조회.
 * GET /centers/{center_id}/credit
 */

import { get } from '$lib/services/api/instances'

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

export const getCreditBalance = () => ({
  key: ['getCreditBalance'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return null
    return get<CreditBalance | null>(
      `/centers/${params.centerId}/credit`
    )
  }
})

// ========== 사용량 통계 ==========

export interface UsagePurposeBreakdown {
  purpose: string | null
  purpose_label: string
  calls: number
  total_tokens: number
  credits: number
}

export interface DailyUsage {
  date: string
  tokens: number
  calls: number
  credits: number
}

export interface DailyPurposeUsage {
  date: string
  purpose: string | null
  purpose_label: string
  calls: number
  credits: number
}

export interface CreditUsageResponse {
  is_active: boolean
  plan_type: string | null
  credit_limit: number
  credit_used: number
  credit_remaining: number
  tokens_per_credit: number
  period_start: string | null
  period_end: string | null
  total_calls: number
  total_tokens: number
  active_members: number
  by_purpose: UsagePurposeBreakdown[]
  daily_usage: DailyUsage[]
  daily_by_purpose: DailyPurposeUsage[]
}

export const getCreditUsage = () => ({
  key: ['getCreditUsage'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return null
    return get<CreditUsageResponse>(
      `/centers/${params.centerId}/credit/usage`
    )
  }
})

// ========== 최근 활동 내역 ==========

export interface CreditHistoryItem {
  purpose: string | null
  purpose_label: string
  credits: number
  created_at: string
  member_id: string | null
  member_name: string | null
}

export interface CreditHistoryResponse {
  items: CreditHistoryItem[]
}

export const getCreditHistory = () => ({
  key: ['getCreditHistory'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return null
    return get<CreditHistoryResponse>(
      `/centers/${params.centerId}/credit/history`
    )
  }
})
