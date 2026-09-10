/**
 * Audit Log Actions (Admin)
 * 감사 로그 관련 API action 함수들
 */

import { get } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface AuditLogSummary {
  id: string
  admin_account_id: string
  admin_email: string
  action: string
  target_type: string
  target_id: string
  summary: string
  ip_address: string | null
  extra: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogListResponse {
  items: AuditLogSummary[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── 감사 로그 목록 ───

export const getAuditLogList = (): Action<
  AuditLogListResponse,
  AuditLogListResponse
> => ({
  key: ['getAuditLogList'],
  request: async (params?: {
    search?: string
    target_type?: string
    admin_id?: string
    date_from?: string
    date_to?: string
    page?: number
    size?: number
  }): Promise<AuditLogListResponse> => {
    return get<AuditLogListResponse>('/admin/audit-logs', params)
  }
})
