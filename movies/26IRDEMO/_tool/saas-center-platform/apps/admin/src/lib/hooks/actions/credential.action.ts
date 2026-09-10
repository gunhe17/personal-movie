/**
 * Credential Actions (Admin)
 *
 * 백엔드 엔드포인트 (platform_admin):
 * - GET    /admin/credentials                              검증 대기 큐
 * - GET    /admin/credentials/by-account/{account_id}      계정별 통합 조회
 * - POST   /admin/credentials/{id}/approve                 승인
 * - POST   /admin/credentials/{id}/reject                  반려 (사유 필수)
 *
 * 설계 문서: docs/center/member-credentials.md
 */

import { get, post } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type CredentialType = 'education' | 'career' | 'certification'
export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'

export interface CredentialAttachment {
  url: string
  filename: string
  content_type: string
  size: number
}

export interface CredentialVerification {
  status: VerificationStatus
  requested_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reject_reason: string | null
}

/** /admin/credentials/* 응답 (Person 정보 포함) */
export interface AdminCredential {
  id: string
  person_id: string
  credential_type: CredentialType

  title: string
  organization: string
  description: string | null

  start_date: string | null
  end_date: string | null
  is_current: boolean

  meta: Record<string, unknown> | null
  attachment: CredentialAttachment | null
  verification: CredentialVerification

  created_at: string
  updated_at: string

  // 어드민 응답에만 포함
  person_name: string | null
  person_email: string | null
}

export interface AdminCredentialListResponse {
  items: AdminCredential[]
  total: number
  page: number
  limit: number
}

// ─── 검증 대기 큐 조회 ───

export interface ListPendingCredentialsParams {
  credential_type?: CredentialType
  page?: number
  limit?: number
}

export const listPendingCredentials = (): Action<
  AdminCredentialListResponse,
  AdminCredentialListResponse
> => ({
  key: ['listPendingCredentials'],
  request: async (params?: ListPendingCredentialsParams) => {
    return get<AdminCredentialListResponse>(
      '/admin/credentials/',
      params as Record<string, string | number | boolean | null | undefined> | undefined
    )
  }
})

// ─── 특정 계정의 credentials 조회 ───

export interface ListCredentialsByAccountParams {
  accountId: string
}

export const listCredentialsByAccount = (): Action<
  AdminCredential[],
  AdminCredential[]
> => ({
  key: ['listCredentialsByAccount'],
  request: async (params: ListCredentialsByAccountParams) => {
    if (!params.accountId) return []
    return get<AdminCredential[]>(
      `/admin/credentials/by-account/${params.accountId}`
    )
  }
})

// ─── 승인 ───

export const approveCredential = () => ({
  key: [
    'approveCredential',
    'listPendingCredentials',
    'listCredentialsByAccount',
    'getAccountDetail',
    'getAccountList'
  ],
  request: async (params: { credentialId: string }) => {
    return post<AdminCredential>(
      `/admin/credentials/${params.credentialId}/approve`,
      {}
    )
  }
})

// ─── 반려 ───

export interface RejectCredentialParams {
  credentialId: string
  reason: string
}

export const rejectCredential = () => ({
  key: [
    'rejectCredential',
    'listPendingCredentials',
    'listCredentialsByAccount',
    'getAccountDetail',
    'getAccountList'
  ],
  request: async (params: RejectCredentialParams) => {
    return post<AdminCredential>(
      `/admin/credentials/${params.credentialId}/reject`,
      { reason: params.reason }
    )
  }
})
