/**
 * Subscription Actions (Admin)
 * 구독 관련 API action 함수들
 */

import { get, post, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface AdminSubscriptionSummary {
  id: string
  center_id: string
  center_name: string
  plan: string
  status: string
  credit_used: number
  credit_limit: number
  current_period_start: string
  current_period_end: string
  is_quota_exceeded: boolean
  reserved_plan: string | null
  reserved_at: string | null
}

export interface AdminSubscriptionListResponse {
  items: AdminSubscriptionSummary[]
  total: number
  page: number
  size: number
}

export interface PlanLimits {
  credit_limit: number
  features: string[]
}

export interface SubscriptionResponse {
  id: string
  center_id: string
  plan: string
  status: string
  current_period_start: string
  current_period_end: string
  trial_end: string | null
  is_quota_exceeded: boolean
  reserved_plan: string | null
  reserved_at: string | null
  limits: PlanLimits
}

export interface CreditSummary {
  credit_limit: number
  credit_used: number
  credit_remaining: number
  period_start: string
  period_end: string
}

export interface SubscriptionHistoryItem {
  from_plan: string | null
  to_plan: string
  actor_type: string
  reason: string
  from_status: string | null
  to_status: string | null
  changed_at: string
}

export interface AdminSubscriptionDetailResponse {
  center_name: string
  subscription: SubscriptionResponse
  credit: CreditSummary | null
  history: SubscriptionHistoryItem[]
}

export interface SubscriptionStatsResponse {
  by_plan: Record<string, number>
  quota_exceeded_count: number
  total: number
  scheduled_downgrade_count: number
  churn_rate: number
  churned_count: number
}

export interface CenterUsageRank {
  center_id: string
  center_name: string
  plan: string
  credit_used: number
  credit_limit: number
  usage_pct: number
}

export interface FeatureUsageStat {
  purpose: string
  label: string
  total_calls: number
  total_credits: number
}

export interface SubscriptionUsageOverviewResponse {
  by_plan: Record<string, number>
  quota_exceeded_count: number
  total_centers: number
  top_credit_users: CenterUsageRank[]
  feature_usage: FeatureUsageStat[]
}

export type SubscriptionPlanFilter = 'free' | 'starter' | 'pro' | 'all'
/** 현재 운영 상태 필터. 결제 연동 시 expired, cancelled, pending_payment, payment_failed 추가 */
export type SubscriptionStatusFilter = 'trial' | 'active' | 'pending' | 'all'

// ─── 구독 분석 대시보드 ───

export const getSubscriptionUsageOverview = (): Action<SubscriptionUsageOverviewResponse, SubscriptionUsageOverviewResponse> => ({
  key: ['getSubscriptionUsageOverview'],
  request: async (params?: Record<string, string | number | boolean | null | undefined>): Promise<SubscriptionUsageOverviewResponse> => {
    return get<SubscriptionUsageOverviewResponse>('/admin/subscriptions/usage-overview', params)
  }
})

// ─── 구독 목록 ───

export const getSubscriptionList = (): Action<AdminSubscriptionListResponse, AdminSubscriptionListResponse> => ({
  key: ['getSubscriptionList'],
  request: async (params?: {
    plan?: string
    status?: string
    search?: string
    has_scheduled_downgrade?: boolean
    page?: number
    size?: number
  }): Promise<AdminSubscriptionListResponse> => {
    return get<AdminSubscriptionListResponse>('/admin/subscriptions', params)
  }
})

// ─── 구독 상세 ───

export const getSubscriptionDetail = (): Action<AdminSubscriptionDetailResponse, AdminSubscriptionDetailResponse> => ({
  key: ['getSubscriptionDetail'],
  request: async (params: { centerId: string }): Promise<AdminSubscriptionDetailResponse> => {
    return get<AdminSubscriptionDetailResponse>(`/admin/subscriptions/${params.centerId}`)
  }
})

// ─── 구독 통계 ───

export const getSubscriptionStats = (): Action<SubscriptionStatsResponse, SubscriptionStatsResponse> => ({
  key: ['getSubscriptionStats'],
  request: async (): Promise<SubscriptionStatsResponse> => {
    return get<SubscriptionStatsResponse>('/admin/subscriptions/stats')
  }
})

// ─── 플랜 변경 ───

export const postChangePlan = () => ({
  key: ['postChangePlan', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: {
    centerId: string
    plan: string
    reason?: string
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/change-plan`, body)
  }
})

// ─── 체험 부여 ───

export const postGrantTrial = () => ({
  key: ['postGrantTrial', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats', 'getCenterSubscriptionTab'],
  request: async (params: {
    centerId: string
    reason?: string
    duration_days?: number | null
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/grant-trial`, body)
  }
})

// ─── 상태 전이 ───

export const postTransitionStatus = () => ({
  key: ['postTransitionStatus', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: {
    centerId: string
    status: string
    reason: string
    force?: boolean
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/transition-status`, body)
  }
})

// ─── 크레딧 조정 ───

export const postAdjustCredit = () => ({
  key: ['postAdjustCredit', 'getSubscriptionList', 'getSubscriptionDetail'],
  request: async (params: {
    centerId: string
    adjust_type: 'add' | 'reset'
    amount?: number
    reason?: string
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/adjust-credit`, body)
  }
})

// ─── 다운그레이드 예약 관리 ───

export const postAdminScheduleDowngrade = () => ({
  key: ['postAdminScheduleDowngrade', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: {
    centerId: string
    plan: string
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/reserve-downgrade`, body)
  }
})

export const deleteAdminScheduledDowngrade = () => ({
  key: ['deleteAdminScheduledDowngrade', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: { centerId: string }) => {
    return deleteResource(`/admin/subscriptions/${params.centerId}/scheduled-downgrade`)
  }
})

export const postAdminForceApplyDowngrade = () => ({
  key: ['postAdminForceApplyDowngrade', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: { centerId: string }) => {
    return post(`/admin/subscriptions/${params.centerId}/force-apply-downgrade`)
  }
})

// ─── 결제 관리 ───

export interface PaymentListResponse {
  items: SubscriptionPaymentSummary[]
  total: number
  page: number
  size: number
}

export interface SubscriptionPaymentSummary {
  id: string
  plan: string
  amount: number
  status: string
  method: string | null
  paid_at: string | null
  created_at: string
  failed_reason: string | null
}

export interface FailedPaymentSummary {
  id: string
  center_id: string
  center_name: string
  plan: string
  amount: number
  failed_reason: string | null
  created_at: string
}

export interface FailedPaymentListResponse {
  items: FailedPaymentSummary[]
  total: number
  page: number
  size: number
}

export interface PaymentStatsResponse {
  failed_count: number
  mrr: number
  total_confirmed_this_month: number
  revenue_by_plan: Record<string, number>
}

// ── MRR 추이 ──

export interface MrrTrendItem {
  year: number
  month: number
  mrr: number
  confirmed_count: number
}

export interface MrrTrendResponse {
  items: MrrTrendItem[]
}

export const getAdminPaymentHistory = (): Action<PaymentListResponse, PaymentListResponse> => ({
  key: ['getAdminPaymentHistory'],
  request: async (params: {
    centerId: string
    page?: number
    size?: number
  }): Promise<PaymentListResponse> => {
    const { centerId, ...query } = params
    return get<PaymentListResponse>(`/admin/subscriptions/${centerId}/payments`, query)
  }
})

export const getPaymentFailures = (): Action<FailedPaymentListResponse, FailedPaymentListResponse> => ({
  key: ['getPaymentFailures'],
  request: async (params?: {
    page?: number
    size?: number
  }): Promise<FailedPaymentListResponse> => {
    return get<FailedPaymentListResponse>('/admin/subscriptions/payment-failures', params)
  }
})

export const getPaymentStats = (): Action<PaymentStatsResponse, PaymentStatsResponse> => ({
  key: ['getPaymentStats'],
  request: async (params?: {
    year?: number
    month?: number
  }): Promise<PaymentStatsResponse> => {
    return get<PaymentStatsResponse>('/admin/subscriptions/payment-stats', params)
  }
})

export const postCancelPayment = () => ({
  key: ['postCancelPayment', 'getAdminPaymentHistory', 'getSubscriptionDetail', 'getPaymentStats'],
  request: async (params: {
    centerId: string
    payment_id: string
    reason: string
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/cancel-payment`, body)
  }
})

// ─── 플랜 변경 요청 승인/거절 ───

export const postApprovePlanChange = () => ({
  key: ['postApprovePlanChange', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: { centerId: string }) => {
    return post(`/admin/subscriptions/${params.centerId}/approve`)
  }
})

export const postRejectPlanChange = () => ({
  key: ['postRejectPlanChange', 'getSubscriptionList', 'getSubscriptionDetail', 'getSubscriptionStats'],
  request: async (params: { centerId: string; reason?: string }) => {
    const { centerId, ...body } = params
    return post(`/admin/subscriptions/${centerId}/reject`, body)
  }
})

export const getMrrTrend = (): Action<MrrTrendResponse, MrrTrendResponse> => ({
  key: ['getMrrTrend'],
  request: async (params?: {
    months?: number
  }): Promise<MrrTrendResponse> => {
    return get<MrrTrendResponse>('/admin/subscriptions/mrr-trend', params)
  }
})
