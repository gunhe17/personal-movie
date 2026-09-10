/**
 * PriceList Actions
 * 단가표 관련 API action 함수들
 */

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

// ─── 타입 ───

export type ServiceType = 'counseling' | 'assessment' | 'package'

export type PriceListSource = 'manual' | 'synced'

export interface PriceListResponse {
  id: string
  center_id: string
  service_type: ServiceType
  service_name: string
  reference_id: string | null
  unit_price: number
  is_active: boolean
  notes: string | null
  source: PriceListSource
  created_by: string
  created_at: string
  updated_at: string
}

export interface PriceListListResponse {
  items: PriceListResponse[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CreatePriceListPayload {
  service_type: ServiceType
  service_name: string
  reference_id?: string | null
  unit_price: number
  is_active?: boolean
  notes?: string | null
  source?: PriceListSource
}

export interface UpdatePriceListPayload {
  service_type?: ServiceType | null
  service_name?: string | null
  reference_id?: string | null
  unit_price?: number | null
  is_active?: boolean | null
  notes?: string | null
}

// ─── Actions ───

export const getPriceListList = () => ({
  key: ['getPriceListList'],
  request: async (params: {
    centerId: string | null | undefined
    service_type?: string
    is_active?: boolean
    search?: string
    page?: number
    size?: number
  }): Promise<PriceListListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 50, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<PriceListListResponse>(
      `/centers/${centerId}/price-lists`,
      query
    )
  }
})

export const getPriceListDetail = () => ({
  key: ['getPriceListDetail'],
  request: async (params: {
    centerId: string | null | undefined
    priceListId: string
  }): Promise<PriceListResponse> => {
    if (!params.centerId) {
      return {} as PriceListResponse
    }
    return get<PriceListResponse>(
      `/centers/${params.centerId}/price-lists/${params.priceListId}`
    )
  }
})

export const getPriceListsByReferences = () => ({
  key: ['getPriceListsByReferences'],
  request: async (params: {
    centerId: string
    referenceIds: string[]
  }): Promise<PriceListResponse[]> => {
    if (!params.centerId || params.referenceIds.length === 0) return []
    const query = params.referenceIds.map((id) => `reference_ids=${id}`).join('&')
    return get<PriceListResponse[]>(
      `/centers/${params.centerId}/price-lists/by-references?${query}`
    )
  }
})

export const postPriceList = () => ({
  key: ['postPriceList'],
  request: async (params: {
    centerId: string
    payload: CreatePriceListPayload
  }) => {
    return post<PriceListResponse>(
      `/centers/${params.centerId}/price-lists`,
      params.payload
    )
  }
})

export const patchPriceList = () => ({
  key: ['patchPriceList'],
  request: async (params: {
    centerId: string
    priceListId: string
    payload: UpdatePriceListPayload
  }) => {
    return patch<PriceListResponse>(
      `/centers/${params.centerId}/price-lists/${params.priceListId}`,
      params.payload
    )
  }
})

export const deletePriceList = () => ({
  key: ['deletePriceList'],
  request: async (params: {
    centerId: string
    priceListId: string
  }) => {
    return deleteResource<{ detail: string }>(
      `/centers/${params.centerId}/price-lists/${params.priceListId}`
    )
  }
})
