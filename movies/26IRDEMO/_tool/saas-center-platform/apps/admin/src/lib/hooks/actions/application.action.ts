/**
 * Center Application Actions (Admin)
 * 센터 신청 관련 API action 함수들
 *
 * API 스펙: docs/platform-admin.md §4.1.1
 */

import { get, post } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface ApplicationSummary {
  id: string
  center_name: string
  applicant_name: string
  applicant_email: string
  business_registration_number: string | null
  status: ApplicationStatus
  created_at: string
  reviewed_at: string | null
  reviewed_reason: string | null
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface ApplicationDetail extends ApplicationSummary {
  phone: string | null
  address: Record<string, string> | null
  description: string | null
  representative_name: string | null
  center_id: string | null
  reviewed_by: string | null
  updated_at: string
}

export interface ApplicationListResponse {
  items: ApplicationSummary[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── 신청 목록 ───

export const getApplicationList = (): Action<ApplicationListResponse, ApplicationListResponse> => ({
  key: ['getApplicationList'],
  request: async (params?: {
    status?: ApplicationStatus
    search?: string
    page?: number
    size?: number
  }): Promise<ApplicationListResponse> => {
    return get<ApplicationListResponse>('/admin/center-applications', params)
  }
})

// ─── 신청 상세 ───

export const getApplicationDetail = (): Action<ApplicationDetail, ApplicationDetail> => ({
  key: ['getApplicationDetail'],
  request: async (params: { applicationId: string }): Promise<ApplicationDetail> => {
    return get<ApplicationDetail>(`/admin/center-applications/${params.applicationId}`)
  }
})

// ─── 승인 ───

export const postApproveApplication = () => ({
  key: ['postApproveApplication', 'getApplicationList'],
  request: async (params: { applicationId: string; admin_memo?: string }) => {
    const { applicationId, ...body } = params
    return post(`/admin/center-applications/${applicationId}/approve`, body)
  }
})

// ─── 거절 ───

export const postRejectApplication = () => ({
  key: ['postRejectApplication', 'getApplicationList'],
  request: async (params: {
    applicationId: string
    reason: string
    admin_memo?: string
  }) => {
    const { applicationId, ...body } = params
    return post(`/admin/center-applications/${applicationId}/reject`, body)
  }
})
