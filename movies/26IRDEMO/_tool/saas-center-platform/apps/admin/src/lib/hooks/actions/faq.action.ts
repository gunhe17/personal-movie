/**
 * FAQ Actions (Admin)
 * FAQ 관련 API action 함수들
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type FAQCategory = 'getting_started' | 'general' | 'technical' | 'feature'

export interface FAQSummary {
  id: string
  category: FAQCategory
  question: string
  is_published: boolean
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface FAQDetailResponse {
  id: string
  category: FAQCategory
  question: string
  answer: string
  is_published: boolean
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface FAQListResponse {
  items: FAQSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface FAQCreateParams {
  category: FAQCategory
  question: string
  answer: string
  is_published?: boolean
}

export interface FAQUpdateParams {
  faqId: string
  category?: FAQCategory
  question?: string
  answer?: string
  is_published?: boolean
}

export interface FAQReorderParams {
  category: FAQCategory
  faq_ids: string[]
}

// ─── FAQ 목록 ───

export const getFAQList = (): Action<FAQListResponse, FAQListResponse> => ({
  key: ['getFAQList'],
  request: async (params?: {
    category?: FAQCategory
    is_published?: boolean
    search?: string
    page?: number
    size?: number
  }): Promise<FAQListResponse> => {
    return get<FAQListResponse>('/admin/faqs', params)
  }
})

// ─── FAQ 상세 ───

export const getFAQDetail = (): Action<FAQDetailResponse, FAQDetailResponse> => ({
  key: ['getFAQDetail'],
  request: async (params: { faqId: string }): Promise<FAQDetailResponse> => {
    return get<FAQDetailResponse>(`/admin/faqs/${params.faqId}`)
  }
})

// ─── FAQ 등록 ───

export const postCreateFAQ = () => ({
  key: ['postCreateFAQ', 'getFAQList'],
  request: async (params: FAQCreateParams) => {
    return post('/admin/faqs', params)
  }
})

// ─── FAQ 수정 ───

export const patchFAQ = () => ({
  key: ['patchFAQ', 'getFAQList', 'getFAQDetail'],
  request: async (params: FAQUpdateParams) => {
    const { faqId, ...body } = params
    return patch(`/admin/faqs/${faqId}`, body)
  }
})

// ─── FAQ 순서 변경 ───

export const postFAQReorder = () => ({
  key: ['postFAQReorder', 'getFAQList'],
  request: async (params: FAQReorderParams) => {
    return post('/admin/faqs/reorder', params)
  }
})

// ─── FAQ 삭제 ───

export const deleteFAQ = () => ({
  key: ['deleteFAQ', 'getFAQList'],
  request: async (params: { faqId: string }) => {
    return deleteResource(`/admin/faqs/${params.faqId}`)
  }
})
