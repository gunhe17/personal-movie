/**
 * Admin Account Management Actions
 * 어드민 계정 관리 API action 함수들 (super_admin 전용)
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'
import type { AdminRole } from '$lib/utils/permissions'

export type { AdminRole }

// ─── 타입 ───

export interface AdminAccountSummary {
  id: string
  email: string
  name: string
  role: AdminRole
  is_active: boolean
  last_login_at: string | null
}

export interface AdminAccountDetail extends AdminAccountSummary {
  failed_login_count: number
  locked_until: string | null
  created_at: string
  updated_at: string
}

export interface AdminAccountListResponse {
  items: AdminAccountSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AdminAccountInviteBody {
  email: string
  name: string
  role: 'admin' | 'customer_service'
}

export interface UpdateAdminRoleBody {
  role: 'admin' | 'customer_service'
}

// ─── 목록 조회 ───

export const getAdminAccountList = (): Action<AdminAccountListResponse, AdminAccountListResponse> => ({
  key: ['getAdminAccountList'],
  request: async (params?: {
    search?: string
    role?: AdminRole
    is_active?: boolean
    page?: number
    size?: number
  }): Promise<AdminAccountListResponse> => {
    return get<AdminAccountListResponse>('/admin/admin-accounts', params)
  }
})

// ─── 상세 조회 ───

export const getAdminAccountDetail = (): Action<AdminAccountDetail, AdminAccountDetail> => ({
  key: ['getAdminAccountDetail'],
  request: async (params: { accountId: string }): Promise<AdminAccountDetail> => {
    return get<AdminAccountDetail>(`/admin/admin-accounts/${params.accountId}`)
  }
})

// ─── 초대 발송 ───

export const postInviteAdminAccount = () => ({
  key: ['postInviteAdminAccount', 'getAdminAccountList'],
  request: async (params: AdminAccountInviteBody) => {
    return post('/admin/admin-accounts/invite', params)
  }
})

// ─── 역할 변경 ───

export const patchAdminAccountRole = () => ({
  key: ['patchAdminAccountRole', 'getAdminAccountList', 'getAdminAccountDetail'],
  request: async (params: { accountId: string; role: 'admin' | 'customer_service' }) => {
    const { accountId, ...body } = params
    return patch(`/admin/admin-accounts/${accountId}`, body)
  }
})

// ─── 계정 잠금 ───

export const postLockAdminAccount = () => ({
  key: ['postLockAdminAccount', 'getAdminAccountList', 'getAdminAccountDetail'],
  request: async (params: { accountId: string }) => {
    return post(`/admin/admin-accounts/${params.accountId}/lock`)
  }
})

// ─── 잠금 해제 ───

export const postUnlockAdminAccount = () => ({
  key: ['postUnlockAdminAccount', 'getAdminAccountList', 'getAdminAccountDetail'],
  request: async (params: { accountId: string }) => {
    return post(`/admin/admin-accounts/${params.accountId}/unlock`)
  }
})

// ─── 계정 해임 ───

export const deleteAdminAccount = () => ({
  key: ['deleteAdminAccount', 'getAdminAccountList'],
  request: async (params: { accountId: string }) => {
    return deleteResource(`/admin/admin-accounts/${params.accountId}`)
  }
})
