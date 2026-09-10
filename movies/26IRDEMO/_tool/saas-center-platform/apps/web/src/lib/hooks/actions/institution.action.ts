/**
 * Institution Actions
 * 기관 관련 API action 함수들
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 */

import { get, post } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

export interface InstitutionListItem {
  id: string
  name: string
}

export interface InstitutionListResponse {
  items: InstitutionListItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface GetInstitutionListParams {
  keyword?: string
  page?: number
  size?: number
}

export interface InstitutionCreatePayload {
  name: string
  phone?: string
  address?: {
    address?: string
  }
}

export interface InstitutionResponse {
  id: string
  name: string
  phone: string | null
  address: {
    zip_code: string | null
    address: string | null
    detail: string | null
  } | null
  created_at: string
  updated_at: string
}

export const getInstitutionList = (): Action<InstitutionListResponse, InstitutionListResponse> => ({
  key: ['getInstitutionList'],
  request: async (
    params: GetInstitutionListParams = {}
  ): Promise<InstitutionListResponse> => {
    const query: Record<string, string | number> = {}
    if (params.keyword) query.keyword = params.keyword
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size

    return get<InstitutionListResponse>('/institutions/', query)
  }
})

export const postCreateInstitution = () => ({
  key: ['postCreateInstitution', 'getInstitutionList'],
  request: async (payload: InstitutionCreatePayload): Promise<InstitutionResponse> => {
    const res = await post<InstitutionResponse>('/institutions/', payload)
    return (res as { data?: InstitutionResponse }).data ?? (res as unknown as InstitutionResponse)
  }
})
