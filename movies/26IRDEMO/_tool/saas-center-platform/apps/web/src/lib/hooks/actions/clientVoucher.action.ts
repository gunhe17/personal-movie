/**
 * ClientVoucher Actions
 * 내담자 바우처 (CenterVoucher 카탈로그 인스턴스) API
 */

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

import type { CatalogSummary } from './centerVoucher.action'

// ─── 타입 ───

export interface CenterVoucherSummary {
  id: string
  catalog_id: string
  unit_price: number | null
}

export interface ClientVoucherResponse {
  id: string
  center_id: string
  client_id: string
  center_voucher_id: string
  total_sessions: number
  remaining_sessions: number
  total_amount: number | null
  remaining_amount: number | null
  valid_from: string | null
  valid_until: string | null
  created_by: string
  created_at: string
  updated_at: string
  center_voucher: CenterVoucherSummary | null
  catalog: CatalogSummary | null
}

export interface ClientVoucherListResponse {
  items: ClientVoucherResponse[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CreateClientVoucherPayload {
  client_id: string
  center_voucher_id: string
  total_sessions: number
  remaining_sessions?: number | null
  total_amount?: number | null
  remaining_amount?: number | null
  valid_from?: string | null
  valid_until?: string | null
}

export interface UpdateClientVoucherPayload {
  total_sessions?: number | null
  remaining_sessions?: number | null
  total_amount?: number | null
  remaining_amount?: number | null
  valid_from?: string | null
  valid_until?: string | null
}

// ─── Actions ───

export const getClientVoucherList = () => ({
  key: ['getClientVoucherList'],
  request: async (params: {
    centerId: string | null | undefined
    client_id?: string
    page?: number
    size?: number
  }): Promise<ClientVoucherListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 50, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<ClientVoucherListResponse>(
      `/centers/${centerId}/client-vouchers`,
      query
    )
  }
})

export const getClientVoucherDetail = () => ({
  key: ['getClientVoucherDetail'],
  request: async (params: {
    centerId: string | null | undefined
    clientVoucherId: string
  }): Promise<ClientVoucherResponse> => {
    if (!params.centerId) {
      return {} as ClientVoucherResponse
    }
    return get<ClientVoucherResponse>(
      `/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}`
    )
  }
})

export const postClientVoucher = () => ({
  key: ['postClientVoucher'],
  request: async (params: {
    centerId: string
    payload: CreateClientVoucherPayload
  }) => {
    return post<ClientVoucherResponse>(
      `/centers/${params.centerId}/client-vouchers`,
      params.payload
    )
  }
})

export const patchClientVoucher = () => ({
  key: ['patchClientVoucher'],
  request: async (params: {
    centerId: string
    clientVoucherId: string
    payload: UpdateClientVoucherPayload
  }) => {
    return patch<ClientVoucherResponse>(
      `/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}`,
      params.payload
    )
  }
})

export const deleteClientVoucher = () => ({
  key: ['deleteClientVoucher'],
  request: async (params: { centerId: string; clientVoucherId: string }) => {
    return deleteResource<{ detail: string }>(
      `/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}`
    )
  }
})

// ─── 바우처 탭: 내담자 단위 목록 ───

export interface VoucherClientVoucherBrief {
  client_voucher_id: string
  program_name: string
  remaining_sessions: number
  total_sessions: number
  valid_until: string | null
}

export interface VoucherClientItem {
  client_id: string
  name: string
  birth_date: string | null
  gender: string | null
  profile_image_url: string | null
  status: 'active' | 'completed'
  vouchers: VoucherClientVoucherBrief[]
}

export interface VoucherClientListResponse2 {
  items: VoucherClientItem[]
  total: number
  page: number
  size: number
  pages: number
}

export const getVoucherClientList = () => ({
  key: ['getVoucherClientList'],
  request: async (params: {
    centerId: string | null | undefined
    status?: string
    search?: string
    date_from?: string
    date_to?: string
    sort?: string
    signal?: string
    page?: number
    size?: number
  }): Promise<VoucherClientListResponse2> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 20, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<VoucherClientListResponse2>(
      `/centers/${centerId}/voucher-clients`,
      query
    )
  }
})

// ─── 사용 증빙 (v3) ───

export interface VoucherUsageItem {
  billable_item_id: string
  billable_id: string
  billable_date: string
  description: string
  quantity: number
  amount: number
  subsidy_amount: number
  related_case_id: string | null
  related_session_id: string | null
  created_at: string
}

export interface VoucherUsageResponse {
  client_voucher_id: string
  items: VoucherUsageItem[]
  total_sessions_used: number
  total_amount_used: number
  total_subsidy_used: number
}

export interface VoucherMonthlyUsageItem {
  year_month: string
  sessions: number
  amount: number
  subsidy_amount: number
  item_count: number
}

export interface VoucherMonthlyUsageResponse {
  client_voucher_id: string
  items: VoucherMonthlyUsageItem[]
}

export const getVoucherUsage = () => ({
  key: ['getVoucherUsage'],
  request: async (params: {
    centerId: string | null | undefined
    clientVoucherId: string
  }): Promise<VoucherUsageResponse> => {
    if (!params.centerId || !params.clientVoucherId) {
      return {
        client_voucher_id: params.clientVoucherId ?? '',
        items: [],
        total_sessions_used: 0,
        total_amount_used: 0,
        total_subsidy_used: 0
      }
    }
    return get<VoucherUsageResponse>(
      `/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}/usage`
    )
  }
})

export const getVoucherUsageMonthly = () => ({
  key: ['getVoucherUsageMonthly'],
  request: async (params: {
    centerId: string | null | undefined
    clientVoucherId: string
  }): Promise<VoucherMonthlyUsageResponse> => {
    if (!params.centerId || !params.clientVoucherId) {
      return {
        client_voucher_id: params.clientVoucherId ?? '',
        items: []
      }
    }
    return get<VoucherMonthlyUsageResponse>(
      `/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}/usage/monthly`
    )
  }
})
