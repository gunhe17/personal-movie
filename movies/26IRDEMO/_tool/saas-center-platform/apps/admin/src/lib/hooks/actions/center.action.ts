/**
 * Center Actions (Admin)
 * 센터 관련 API action 함수들
 *
 * API 스펙: docs/platform-admin.md §4.1.2
 */

import { get, post, patch } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface CenterSummary {
  id: string
  name: string
  code: string
  representative_name: string | null
  phone: string | null
  is_active: boolean
  member_count: number
  plan: string
  created_at: string
}

export interface CenterListResponse {
  items: CenterSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CenterMember {
  id: string
  account_id: string
  name: string
  email: string
  role_name: string
  status: string
}

export interface AddressInfo {
  zip_code: string | null
  address: string | null
  detail: string | null
}

export interface CenterDetailResponse {
  id: string
  name: string
  code: string
  phone: string | null
  address: AddressInfo | null
  business_registration_number: string | null
  representative_name: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  members: CenterMember[]
}

export interface CenterClient {
  id: string
  code: string
  masked_name: string
  status: string
  gender: string | null
  created_at: string
}

export interface CenterClientStats {
  total: number
  active: number
  inactive: number
}

export interface CenterClientListResponse {
  items: CenterClient[]
  stats: CenterClientStats
  total: number
  page: number
  size: number
  pages: number
}

export type CenterStatusFilter = 'active' | 'suspended' | 'all'
export type CenterSortBy = 'created_at' | 'name' | 'member_count'

// ─── 센터 목록 ───

export const getCenterList = (): Action<CenterListResponse, CenterListResponse> => ({
  key: ['getCenterList'],
  request: async (params?: {
    status?: CenterStatusFilter
    search?: string
    sort_by?: CenterSortBy
    page?: number
    size?: number
  }): Promise<CenterListResponse> => {
    return get<CenterListResponse>('/admin/centers', params)
  }
})

// ─── 센터 상세 ───

export const getCenterDetail = (): Action<CenterDetailResponse, CenterDetailResponse> => ({
  key: ['getCenterDetail'],
  request: async (params: { centerId: string }): Promise<CenterDetailResponse> => {
    return get<CenterDetailResponse>(`/admin/centers/${params.centerId}`)
  }
})

// ─── 센터 내담자 목록 (마스킹) ───

export const getCenterClients = (): Action<CenterClientListResponse, CenterClientListResponse> => ({
  key: ['getCenterClients'],
  request: async (params: { centerId: string; status?: string; page?: number; size?: number }): Promise<CenterClientListResponse> => {
    const { centerId, ...query } = params
    return get<CenterClientListResponse>(`/admin/centers/${centerId}/clients`, query)
  }
})

// ─── 센터 구독/크레딧 탭 ───

export interface PurposeUsage {
  purpose: string
  label: string
  calls: number
  total_credits: number
}

export interface CenterAiUsageSummary {
  total_calls: number
  total_credits: number
  by_purpose: PurposeUsage[]
  period_start: string | null
  period_end: string | null
}

export interface PlanLimits {
  credit_limit: number
  features: string[]
}

export interface SubscriptionInfo {
  id: string
  center_id: string
  plan: string
  status: string
  current_period_start: string
  current_period_end: string
  trial_end: string | null
  is_quota_exceeded: boolean
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
  from_status?: string | null
  to_status?: string | null
  actor_type: string
  reason: string
  changed_at: string
}

export interface CenterSubscriptionTabResponse {
  subscription: SubscriptionInfo | null
  credit: CreditSummary | null
  history: SubscriptionHistoryItem[]
  ai_usage: CenterAiUsageSummary | null
}

export const getCenterSubscriptionTab = (): Action<CenterSubscriptionTabResponse, CenterSubscriptionTabResponse> => ({
  key: ['getCenterSubscriptionTab'],
  request: async (params: { centerId: string }): Promise<CenterSubscriptionTabResponse> => {
    return get<CenterSubscriptionTabResponse>(`/admin/centers/${params.centerId}/subscription-tab`)
  }
})

// ─── 센터 정지 ───

export const postSuspendCenter = () => ({
  key: ['postSuspendCenter', 'getCenterList', 'getCenterDetail'],
  request: async (params: {
    centerId: string
    reason: string
    suspended_until?: string
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/centers/${centerId}/suspend`, body)
  }
})

// ─── 센터 활성화 ───

export const postActivateCenter = () => ({
  key: ['postActivateCenter', 'getCenterList', 'getCenterDetail'],
  request: async (params: { centerId: string }) => {
    return post(`/admin/centers/${params.centerId}/activate`)
  }
})

// ─── 센터 경고 ───

export const postWarnCenter = () => ({
  key: ['postWarnCenter', 'getCenterList', 'getCenterDetail'],
  request: async (params: {
    centerId: string
    reason: string
    notify?: boolean
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/centers/${centerId}/warn`, body)
  }
})

// ─── 센터 해지 ───

export const postTerminateCenter = () => ({
  key: ['postTerminateCenter', 'getCenterList', 'getCenterDetail', 'getTerminatedCenterList'],
  request: async (params: {
    centerId: string
    reason: string
    notify_center?: boolean
  }) => {
    const { centerId, ...body } = params
    return post(`/admin/centers/${centerId}/terminate`, body)
  }
})

// ─── 센터 해지 철회 ───

export const postRestoreCenter = () => ({
  key: ['postRestoreCenter', 'getCenterList', 'getCenterDetail', 'getTerminatedCenterList'],
  request: async (params: { centerId: string }) => {
    return post(`/admin/centers/${params.centerId}/restore`)
  }
})

// ─── 해지 센터 목록 ───

export interface TerminatedCenterSummary {
  id: string
  name: string
  code: string
  representative_name: string | null
  business_registration_number: string | null
  deleted_at: string
  retention_expires_at: string
  retention_remaining_days: number
  is_expired: boolean
  has_pending_export: boolean
  export_count: number
}

export interface TerminatedCenterListResponse {
  items: TerminatedCenterSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export type TerminatedStatusFilter = 'retention' | 'expired' | 'all'

export const getTerminatedCenterList = (): Action<TerminatedCenterListResponse, TerminatedCenterListResponse> => ({
  key: ['getTerminatedCenterList'],
  request: async (params?: {
    status?: TerminatedStatusFilter
    search?: string
    expiring_soon?: boolean
    page?: number
    size?: number
  }): Promise<TerminatedCenterListResponse> => {
    return get<TerminatedCenterListResponse>('/admin/centers/terminated', params)
  }
})

// ─── 센터 정보 수정 ───

export const patchCenter = () => ({
  key: ['patchCenter', 'getCenterList', 'getCenterDetail'],
  request: async (params: { centerId: string; [key: string]: any }) => {
    const { centerId, ...body } = params
    return patch(`/admin/centers/${centerId}`, body)
  }
})
