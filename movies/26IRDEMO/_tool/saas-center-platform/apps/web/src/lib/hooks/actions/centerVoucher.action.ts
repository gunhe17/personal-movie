/**
 * CenterVoucher Actions
 * 센터 취급 바우처 + 카탈로그 (센터 시점) API
 */

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

// ─── 타입 ───

export interface CatalogSummary {
  id: string
  name: string
  program_name: string
  program_organization: string
  program_year: number
  /** 정부 고시 지원금 구조화 정보 (dict, 참고용). 표시는 support_amount_text 사용 */
  support_amount?: Record<string, unknown> | null
  /** 지원금 표시용 한 줄 요약 (백엔드 파생) */
  support_amount_text?: string | null
  /** 사업 이용 가능 기간 (내담자 바우처 유효기간 기본값) */
  usage_start_date?: string | null
  usage_end_date?: string | null
  /** 이 사업에 연결된 서식 템플릿 id — 이름은 서식 목록에서 해소 */
  form_template_ids?: string[]
}

export interface VoucherCatalogItem {
  id: string
  name: string
  program_name: string
  program_organization: string
  program_year: number
  usage_start_date: string | null
  usage_end_date: string | null
  support_amount: Record<string, unknown> | null
  support_amount_text: string | null
  is_taken: boolean
  is_expired: boolean
}

export interface VoucherCatalogListResponse {
  items: VoucherCatalogItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CenterVoucherResponse {
  id: string
  center_id: string
  catalog_id: string
  unit_price: number | null
  default_total_sessions: number | null
  is_active: boolean
  memo: string | null
  created_by: string
  created_at: string
  updated_at: string
  catalog: CatalogSummary | null
}

export interface CenterVoucherListResponse {
  items: CenterVoucherResponse[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CreateCenterVoucherPayload {
  catalog_id: string
  unit_price?: number | null
  default_total_sessions?: number | null
  is_active?: boolean
  memo?: string | null
}

export interface UpdateCenterVoucherPayload {
  unit_price?: number | null
  default_total_sessions?: number | null
  is_active?: boolean | null
  memo?: string | null
}

// ─── Actions ───

export const getCenterVoucherList = () => ({
  key: ['getCenterVoucherList'],
  request: async (params: {
    centerId: string | null | undefined
    is_active?: boolean
    page?: number
    size?: number
  }): Promise<CenterVoucherListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 50, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<CenterVoucherListResponse>(
      `/centers/${centerId}/center-vouchers`,
      query
    )
  }
})

export const getCenterVoucherDetail = () => ({
  key: ['getCenterVoucherDetail'],
  request: async (params: {
    centerId: string | null | undefined
    centerVoucherId: string
  }): Promise<CenterVoucherResponse> => {
    if (!params.centerId) {
      return {} as CenterVoucherResponse
    }
    return get<CenterVoucherResponse>(
      `/centers/${params.centerId}/center-vouchers/${params.centerVoucherId}`
    )
  }
})

export const postCenterVoucher = () => ({
  key: ['postCenterVoucher'],
  request: async (params: {
    centerId: string
    payload: CreateCenterVoucherPayload
  }) => {
    return post<CenterVoucherResponse>(
      `/centers/${params.centerId}/center-vouchers`,
      params.payload
    )
  }
})

export const patchCenterVoucher = () => ({
  key: ['patchCenterVoucher'],
  request: async (params: {
    centerId: string
    centerVoucherId: string
    payload: UpdateCenterVoucherPayload
  }) => {
    return patch<CenterVoucherResponse>(
      `/centers/${params.centerId}/center-vouchers/${params.centerVoucherId}`,
      params.payload
    )
  }
})

export const deleteCenterVoucher = () => ({
  key: ['deleteCenterVoucher'],
  request: async (params: { centerId: string; centerVoucherId: string }) => {
    return deleteResource<{ detail: string }>(
      `/centers/${params.centerId}/center-vouchers/${params.centerVoucherId}`
    )
  }
})

// ─── 카탈로그 연결 자료 (PDF 등) ───

export interface CenterVoucherDocumentItem {
  /** 1행 = 1 global_document. 파일 스트림 경로 파라미터로 사용 */
  global_document_id: string
  name: string
  /** 확장자/타입 (pdf·hwpx 등) */
  file_type: string
  page_range: string | null
  note: string | null
  /** 다운로드 가능한 원본 파일 보유 여부 */
  has_file: boolean
}

export interface CenterVoucherDocumentsResponse {
  items: CenterVoucherDocumentItem[]
}

export interface CenterVoucherClientItem {
  client_voucher_id: string
  client_id: string
  client_name: string
  // 내담자 최소 단위(아바타 + 이름 + 생년월일|성별) 표기용 — 응답에 없으면 이름만 그려진다
  birth_date?: string | null
  gender?: string | null
  profile_image_url?: string | null
  remaining_sessions: number
  total_sessions: number
  remaining_amount: number | null
  total_amount: number | null
  valid_from: string | null
  valid_until: string | null
}

export interface CenterVoucherClientsResponse {
  items: CenterVoucherClientItem[]
  total: number
}

export const getCenterVoucherClients = () => ({
  key: ['getCenterVoucherClients'],
  request: async (params: {
    centerId: string | null | undefined
    centerVoucherId: string | null | undefined
  }): Promise<CenterVoucherClientsResponse> => {
    if (!params.centerId || !params.centerVoucherId) {
      return { items: [], total: 0 }
    }
    return get<CenterVoucherClientsResponse>(
      `/centers/${params.centerId}/center-vouchers/${params.centerVoucherId}/clients`
    )
  }
})

export const getCenterVoucherDocuments = () => ({
  key: ['getCenterVoucherDocuments'],
  request: async (params: {
    centerId: string | null | undefined
    centerVoucherId: string | null | undefined
  }): Promise<CenterVoucherDocumentsResponse> => {
    if (!params.centerId || !params.centerVoucherId) {
      return { items: [] }
    }
    return get<CenterVoucherDocumentsResponse>(
      `/centers/${params.centerId}/center-vouchers/${params.centerVoucherId}/documents`
    )
  }
})

// ─── 통계 (대시보드) ───

export interface CenterVoucherStatsPerItem {
  center_voucher_id: string
  active_client_count: number
}

export interface CenterVoucherStatsResponse {
  active_count: number
  total_count: number
  active_client_voucher_count: number
  expiring_within_days_count: number
  expiring_window_days: number
  per_voucher: CenterVoucherStatsPerItem[]
}

export const getCenterVoucherStats = () => ({
  key: ['getCenterVoucherStats'],
  request: async (params: {
    centerId: string | null | undefined
    expiring_window_days?: number
  }): Promise<CenterVoucherStatsResponse> => {
    if (!params.centerId) {
      return {
        active_count: 0,
        total_count: 0,
        active_client_voucher_count: 0,
        expiring_within_days_count: 0,
        expiring_window_days: params.expiring_window_days ?? 60,
        per_voucher: []
      }
    }
    const { centerId, ...query } = params
    return get<CenterVoucherStatsResponse>(
      `/centers/${centerId}/center-vouchers/stats`,
      query
    )
  }
})

// ─── 카탈로그 (센터 시점) ───

export const getVoucherCatalogList = () => ({
  key: ['getVoucherCatalogList'],
  request: async (params: {
    centerId: string | null | undefined
    q?: string
    year?: number
    organization?: string
    page?: number
    size?: number
  }): Promise<VoucherCatalogListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 50, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<VoucherCatalogListResponse>(
      `/centers/${centerId}/voucher-catalog`,
      query
    )
  }
})
