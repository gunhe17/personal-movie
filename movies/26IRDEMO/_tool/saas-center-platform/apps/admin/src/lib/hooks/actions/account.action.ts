/**
 * Account Actions (Admin)
 * 계정 관련 API action 함수들
 *
 * API 스펙: docs/platform-admin.md §4.1.3
 */

import { get, post } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface AccountCenter {
  center_id: string
  center_name: string
  role_name: string
  status?: string
}

export interface AccountCredentialStats {
  total: number
  pending: number
  verified: number
  rejected: number
  verified_certifications: number
  verified_educations: number
  /** 인증된 계정 여부 (자격증 verified ≥1 AND 학력 verified ≥1) */
  is_certified: boolean
}

export interface AccountSummary {
  id: string
  email: string
  name: string | null
  phone: string | null
  provider: string
  is_active: boolean
  is_verified: boolean
  last_login_at: string | null
  created_at: string
  centers: AccountCenter[]
  credentials?: AccountCredentialStats
}

export interface AccountListResponse {
  items: AccountSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export type AccountProvider = 'email' | 'kakao' | 'naver' | 'google'

// ─── 계정 목록 ───

export const getAccountList = (): Action<AccountListResponse, AccountListResponse> => ({
  key: ['getAccountList'],
  request: async (params?: {
    search?: string
    is_active?: boolean
    provider?: AccountProvider
    has_pending_credentials?: boolean
    page?: number
    size?: number
  }): Promise<AccountListResponse> => {
    return get<AccountListResponse>('/admin/accounts', params)
  }
})

// ─── 계정 상세 ───

export const getAccountDetail = (): Action<AccountSummary, AccountSummary> => ({
  key: ['getAccountDetail'],
  request: async (params: { accountId: string }): Promise<AccountSummary> => {
    return get<AccountSummary>(`/admin/accounts/${params.accountId}`)
  }
})

// ─── 계정 잠금 ───

export const postLockAccount = () => ({
  key: ['postLockAccount', 'getAccountList'],
  request: async (params: { accountId: string; reason: string }) => {
    const { accountId, ...body } = params
    return post(`/admin/accounts/${accountId}/lock`, body)
  }
})

// ─── 계정 잠금 해제 ───

export const postUnlockAccount = () => ({
  key: ['postUnlockAccount', 'getAccountList'],
  request: async (params: { accountId: string }) => {
    return post(`/admin/accounts/${params.accountId}/unlock`)
  }
})

// ─── 강제 로그아웃 ───

export const postForceLogout = () => ({
  key: ['postForceLogout', 'getAccountList'],
  request: async (params: { accountId: string }) => {
    return post(`/admin/accounts/${params.accountId}/force-logout`)
  }
})
