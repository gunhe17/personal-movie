/**
 * Inquiry Actions (Admin)
 * 1:1 문의 관련 API action 함수들
 */

import { get, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type InquiryType = 'general' | 'technical' | 'feature_request' | 'other'
export type InquiryStatus = 'pending' | 'in_progress' | 'resolved'

export interface InquirySummary {
  id: string
  center_id: string | null
  center_name: string | null
  inquiry_type: InquiryType
  status: InquiryStatus
  subject: string
  sender_name: string
  sender_email: string
  answered_by_name: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

export interface InquiryDetailResponse {
  id: string
  center_id: string | null
  center_name: string | null
  inquiry_type: InquiryType
  status: InquiryStatus
  subject: string
  content: string
  sender_name: string
  sender_email: string
  answered_by: string | null
  answered_by_name: string | null
  answer: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

export interface InquiryListResponse {
  items: InquirySummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface InquiryAnswerParams {
  inquiryId: string
  answer: string
}

export interface InquiryStatusParams {
  inquiryId: string
  status: InquiryStatus
}

// ─── 문의 목록 ───

export const getInquiryList = (): Action<
  InquiryListResponse,
  InquiryListResponse
> => ({
  key: ['getInquiryList'],
  request: async (params?: {
    inquiry_type?: InquiryType
    status?: InquiryStatus
    search?: string
    page?: number
    size?: number
  }): Promise<InquiryListResponse> => {
    return get<InquiryListResponse>('/admin/inquiries', params)
  }
})

// ─── 문의 상세 ───

export const getInquiryDetail = (): Action<
  InquiryDetailResponse,
  InquiryDetailResponse
> => ({
  key: ['getInquiryDetail'],
  request: async (params: {
    inquiryId: string
  }): Promise<InquiryDetailResponse> => {
    return get<InquiryDetailResponse>(`/admin/inquiries/${params.inquiryId}`)
  }
})

// ─── 답변 등록/수정 ───

export const patchInquiryAnswer = () => ({
  key: ['patchInquiryAnswer', 'getInquiryList', 'getInquiryDetail'],
  request: async (params: InquiryAnswerParams) => {
    const { inquiryId, ...body } = params
    return patch(`/admin/inquiries/${inquiryId}/answer`, body)
  }
})

// ─── 상태 변경 ───

export const patchInquiryStatus = () => ({
  key: ['patchInquiryStatus', 'getInquiryList', 'getInquiryDetail'],
  request: async (params: InquiryStatusParams) => {
    const { inquiryId, ...body } = params
    return patch(`/admin/inquiries/${inquiryId}/status`, body)
  }
})

// ─── 문의 삭제 ───

export const deleteInquiry = () => ({
  key: ['deleteInquiry', 'getInquiryList'],
  request: async (params: { inquiryId: string }) => {
    return deleteResource(`/admin/inquiries/${params.inquiryId}`)
  }
})
