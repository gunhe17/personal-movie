import { get, post } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

export interface SupportInquiryParams {
  inquiry_type?: string
  subject: string
  content: string
  sender_name: string
  sender_email: string
  center_id?: string | null
  center_name?: string | null
}

export interface SupportInquiryResponse {
  success: boolean
  message: string
}

export const postSupportInquiry = (): Action<SupportInquiryResponse> => ({
  key: ['postSupportInquiry'],
  request: async (params: SupportInquiryParams) => {
    const response = await post<SupportInquiryResponse>('/support/inquiry', params)
    return response as any
  }
})

export interface PublicFAQItem {
  id: string
  category: string
  question: string
  answer: string
  is_published: boolean
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface PublicFAQListResponse {
  items: PublicFAQItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface MyInquiryItem {
  id: string
  inquiry_type: string
  status: string
  subject: string
  content: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

export interface MyInquiryListResponse {
  items: MyInquiryItem[]
  total: number
  page: number
  size: number
  pages: number
}

export const getMyInquiryList = (): Action<MyInquiryListResponse> => ({
  key: ['getMyInquiryList'],
  request: async (params?: { center_id?: string | null; page?: number; size?: number }) => {
    const response = await get<MyInquiryListResponse>('/support/inquiries', params)
    return response as any
  }
})

export const getPublicFAQList = (): Action<PublicFAQListResponse> => ({
  key: ['getPublicFAQList'],
  request: async (params?: { category?: string; search?: string; page?: number; size?: number }) => {
    const response = await get<PublicFAQListResponse>('/support/faqs', params)
    return response as any
  }
})
