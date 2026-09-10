/**
 * Subscription API 액션
 *
 * 센터 구독/플랜 조회 + 결제 플로우.
 */

import { get, post } from '$lib/services/api/instances'

// ── 타입 정의 ──

export interface PlanLimits {
  credit_limit: number
  features: string[]
}

export interface PlanMeta {
  tagline: string
  audience: string
  is_recommended: boolean
  base_features: string[]
  additions: string[]
  base_plan: string | null
  badge_bg: string
  badge_text: string
  feature_labels: Record<string, string>
  feature_descriptions: Record<string, string>
}

export interface PlanInfo {
  plan: string
  label: string
  price_monthly: number
  limits: PlanLimits
  meta: PlanMeta
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

export interface InitiateUpgradeResponse {
  order_id: string
  amount: number
  plan: string
  plan_label: string
}

export interface PaymentSummary {
  id: string
  plan: string
  amount: number
  status: string
  method: string | null
  paid_at: string | null
  created_at: string
}

export interface TossClientKeyResponse {
  client_key: string
}

// ── 조회 액션 ──

export const getSubscription = () => ({
  key: ['getSubscription'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return null
    return get<SubscriptionResponse | null>(
      `/centers/${params.centerId}/subscription`
    )
  }
})

export const getPlans = () => ({
  key: ['getPlans'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return []
    return get<PlanInfo[]>(
      `/centers/${params.centerId}/subscription/plans`
    )
  }
})

export const getPaymentHistory = () => ({
  key: ['getPaymentHistory'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return []
    return get<PaymentSummary[]>(
      `/centers/${params.centerId}/subscription/payments`
    )
  }
})

export const getTossClientKey = () => ({
  key: ['getTossClientKey'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return null
    return get<TossClientKeyResponse>(
      `/centers/${params.centerId}/subscription/toss-client-key`
    )
  }
})

// ── 결제/플랜 변경 액션 ──

export const initiateUpgrade = () => ({
  key: ['initiateUpgrade'],
  request: async (params: { centerId: string; plan: string }) => {
    const res = await post<InitiateUpgradeResponse>(
      `/centers/${params.centerId}/subscription/upgrade/initiate`,
      { plan: params.plan }
    )
    return res.data
  }
})

export const confirmUpgrade = () => ({
  key: ['confirmUpgrade'],
  request: async (params: {
    centerId: string
    paymentKey: string
    orderId: string
    amount: number
  }) => {
    const res = await post<SubscriptionResponse>(
      `/centers/${params.centerId}/subscription/upgrade/confirm`,
      {
        paymentKey: params.paymentKey,
        orderId: params.orderId,
        amount: params.amount,
      }
    )
    return res.data
  }
})

export const reserveDowngrade = () => ({
  key: ['reserveDowngrade'],
  request: async (params: { centerId: string; plan: string }) => {
    const res = await post<SubscriptionResponse>(
      `/centers/${params.centerId}/subscription/downgrade/reserve`,
      { plan: params.plan }
    )
    return res.data
  }
})

export const requestPlanChange = () => ({
  key: ['requestPlanChange'],
  request: async (params: { centerId: string; plan: string }) => {
    const res = await post<SubscriptionResponse>(
      `/centers/${params.centerId}/subscription/request-plan-change`,
      { plan: params.plan }
    )
    return res.data
  }
})

export const cancelDowngrade = () => ({
  key: ['cancelDowngrade'],
  request: async (params: { centerId: string }) => {
    const res = await post<SubscriptionResponse>(
      `/centers/${params.centerId}/subscription/downgrade/cancel`
    )
    return res.data
  }
})
