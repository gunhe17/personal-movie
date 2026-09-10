/**
 * Billable Actions
 * 청구서 관련 API action 함수들
 */

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

// ─── 타입 ───

export type BillableStatus = 'draft' | 'issued' | 'paid' | 'overdue'
export type BillableItemType = 'service' | 'product' | 'package'

export interface BillableItemResponse {
  id: string
  billable_id: string
  item_type: BillableItemType
  item_id: string | null
  related_type: string | null
  related_case_id: string | null
  related_case_code: string | null
  related_session_id: string | null
  client_voucher_id: string | null
  voucher_name: string | null
  price_list_id: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
  subsidy_amount: number
  provided_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BillableSummary {
  id: string
  center_id: string
  client_id: string
  client_name: string | null
  client_code: string | null
  client_birth_date: string | null
  client_gender: string | null
  client_profile_image_url: string | null
  billable_date: string
  total_amount: number
  discount_amount: number
  subsidy_amount: number
  paid_amount: number
  unpaid_amount: number
  status: BillableStatus
  item_count: number
  item_summary: string
  is_package: boolean
  case_codes: string[]
  related_session_ids: string[]
  issued_at: string | null
  due_date: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface BillableDetail {
  id: string
  center_id: string
  client_id: string
  client_name: string | null
  client_code: string | null
  client_birth_date: string | null
  client_gender: string | null
  client_profile_image_url: string | null
  billable_date: string
  total_amount: number
  discount_amount: number
  subsidy_amount: number
  paid_amount: number
  unpaid_amount: number
  status: BillableStatus
  issued_at: string | null
  due_date: string | null
  notes: string | null
  created_by: string
  created_by_name: string | null
  items: BillableItemResponse[]
  /** 잔액 부족 등 비차단 경고 (v3) — 생성/수정 응답에서만 채워짐 */
  warnings?: string[]
  created_at: string
  updated_at: string
}

export interface BillableListResponse {
  items: BillableSummary[]
  total: number
  page: number
  size: number
  pages: number
  /** 필터 스코프 전체(페이지 무관)의 미수금 합계 */
  unpaid_total?: number
}

export interface BillableItemCreatePayload {
  item_type: BillableItemType
  item_id?: string | null
  related_type?: string | null
  related_case_id?: string | null
  related_session_id?: string | null
  client_voucher_id?: string | null
  price_list_id?: string | null
  description: string
  quantity: number
  unit_price: number
  provided_at?: string | null
  notes?: string | null
}

export interface CreateBillablePayload {
  client_id: string
  billable_date: string
  due_date?: string | null
  notes?: string | null
  discount_amount?: number
  /** 청구서 단위 바우처 지원금 — 백엔드가 바우처 연결 item들에 회기 비율로 분배 */
  subsidy_amount?: number
  items: BillableItemCreatePayload[]
}

export interface UpdateBillablePayload {
  billable_date?: string | null
  due_date?: string | null
  notes?: string | null
  discount_amount?: number | null
}

// ─── Actions ───

export const getBillableList = () => ({
  key: ['getBillableList'],
  request: async (params: {
    centerId: string | null | undefined
    status?: string
    client_id?: string
    search?: string
    page?: number
    size?: number
    sort?: 'asc' | 'desc'
    /** 청구 일자 범위 (YYYY-MM-DD) */
    date_from?: string
    date_to?: string
    /** 청구 대상 유형 — 'counseling' | 'assessment' */
    related_type?: string
  }): Promise<BillableListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 1, size: 20, pages: 0 }
    }
    const { centerId, ...query } = params
    return get<BillableListResponse>(`/centers/${centerId}/billables`, query)
  }
})

export interface BillablePrefillItem {
  reference_id: string
  description: string
  item_type: BillableItemType
  unit_price: number
  price_list_id: string | null
  client_voucher_id?: string | null
  voucher_name?: string | null
  voucher_remaining?: number | null
  voucher_total?: number | null
  voucher_support_amount_text?: string | null
}

export const getBillablePrefill = () => ({
  key: ['getBillablePrefill'],
  request: async (params: {
    centerId: string | null | undefined
    caseType: 'counseling' | 'assessment'
    caseId: string
  }): Promise<BillablePrefillItem[]> => {
    if (!params.centerId || !params.caseId) return []
    return get<BillablePrefillItem[]>(
      `/centers/${params.centerId}/billables/prefill`,
      { case_type: params.caseType, case_id: params.caseId }
    )
  }
})

export const getBillableByRelated = () => ({
  key: ['getBillableByRelated'],
  request: async (params: {
    centerId: string | null | undefined
    relatedType: string | string[]
    relatedCaseId?: string | null
    relatedSessionId?: string | null
  }): Promise<BillableSummary[]> => {
    if (!params.centerId) return []
    if (!params.relatedCaseId && !params.relatedSessionId) return []
    const typeValue = Array.isArray(params.relatedType)
      ? params.relatedType.join(',')
      : params.relatedType
    const query: Record<string, string> = { related_type: typeValue }
    if (params.relatedSessionId)
      query.related_session_id = params.relatedSessionId
    if (params.relatedCaseId) query.related_case_id = params.relatedCaseId
    return get<BillableSummary[]>(
      `/centers/${params.centerId}/billables/by-related`,
      query
    )
  }
})

export const getBillableDetail = () => ({
  key: ['getBillableDetail'],
  request: async (params: {
    centerId: string | null | undefined
    billableId: string
  }): Promise<BillableDetail> => {
    if (!params.centerId) {
      return {} as BillableDetail
    }
    return get<BillableDetail>(
      `/centers/${params.centerId}/billables/${params.billableId}`
    )
  }
})

export const postBillable = () => ({
  key: ['postBillable'],
  request: async (params: {
    centerId: string
    payload: CreateBillablePayload
  }) => {
    return post<BillableDetail>(
      `/centers/${params.centerId}/billables`,
      params.payload
    )
  }
})

export const patchBillable = () => ({
  key: ['patchBillable'],
  request: async (params: {
    centerId: string
    billableId: string
    payload: UpdateBillablePayload
  }) => {
    return patch<BillableDetail>(
      `/centers/${params.centerId}/billables/${params.billableId}`,
      params.payload
    )
  }
})

export const deleteBillable = () => ({
  key: ['deleteBillable'],
  request: async (params: { centerId: string; billableId: string }) => {
    return deleteResource<{ detail: string }>(
      `/centers/${params.centerId}/billables/${params.billableId}`
    )
  }
})

// ─── Payment ───

export type PaymentMethodType = 'card' | 'transfer' | 'cash'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금'
}

export interface PaymentResponse {
  id: string
  billable_id: string
  amount: number
  payment_method: PaymentMethodType
  paid_at: string
  receipt_number: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PaymentListResponse {
  items: PaymentResponse[]
  total_paid: number
}

export interface CreatePaymentPayload {
  amount: number
  payment_method: PaymentMethodType
  paid_at: string
  receipt_number?: string | null
  notes?: string | null
}

export const postPayment = () => ({
  key: ['postPayment'],
  request: async (params: {
    centerId: string
    billableId: string
    payload: CreatePaymentPayload
  }) => {
    return post<PaymentResponse>(
      `/centers/${params.centerId}/billables/${params.billableId}/payments`,
      params.payload
    )
  }
})

export const getPaymentList = () => ({
  key: ['getPaymentList'],
  request: async (params: {
    centerId: string | null | undefined
    billableId: string
  }): Promise<PaymentListResponse> => {
    if (!params.centerId) {
      return { items: [], total_paid: 0 }
    }
    return get<PaymentListResponse>(
      `/centers/${params.centerId}/billables/${params.billableId}/payments`
    )
  }
})

// ─── 청구 연동 대상 (검사/상담 세션 통합) ───

export type BillableTargetType = 'assessment' | 'counseling'

export interface BillableTargetReference {
  reference_id: string
  label: string
  item_type: string
}

export interface BillableTarget {
  type: BillableTargetType
  case_id: string
  case_code: string | null
  /** 세션 ID — 일정 없이 접수된 검사 등 세션 없는 케이스면 null */
  session_id: string | null
  client_id: string | null
  client_name: string | null
  /** 목록 행의 내담자 표기(아바타 + 이름 + 생년월일|성별) — 전체 탭과 같은 규격 */
  client_birth_date: string | null
  client_gender: string | null
  client_profile_image_url: string | null
  title: string
  subtitle: string | null
  scheduled_at: string | null
  created_at: string
  status: string
  references: BillableTargetReference[]
}

export interface BillableTargetCounts {
  all: number
  assessment: number
  counseling: number
}

export interface BillableTargetListResponse {
  items: BillableTarget[]
  total_counts: BillableTargetCounts
  total: number
  page: number
  size: number
  pages: number
}

const emptyTargetsResponse: BillableTargetListResponse = {
  items: [],
  total_counts: { all: 0, assessment: 0, counseling: 0 },
  total: 0,
  page: 1,
  size: 10,
  pages: 0
}

export const getTodayMissingBillables = () => ({
  key: ['getTodayMissingBillables'],
  request: async (params: {
    centerId: string | null | undefined
  }): Promise<BillableTarget[]> => {
    if (!params.centerId) return []
    return get<BillableTarget[]>(
      `/centers/${params.centerId}/billables/today-missing`
    )
  }
})

export const getBillableTargetsByClient = () => ({
  key: ['getBillableTargetsByClient'],
  request: async (params: {
    centerId: string | null | undefined
    clientId: string | null | undefined
    type?: BillableTargetType | 'all'
    page?: number
    size?: number
    includeBilled?: boolean
  }): Promise<BillableTargetListResponse> => {
    if (!params.centerId || !params.clientId) {
      return emptyTargetsResponse
    }
    const query: Record<string, string> = {}
    if (params.type && params.type !== 'all') query.type = params.type
    if (params.page) query.page = String(params.page)
    if (params.size) query.size = String(params.size)
    if (params.includeBilled) query.include_billed = 'true'
    return get<BillableTargetListResponse>(
      `/centers/${params.centerId}/billables/billable-targets/by-client/${params.clientId}`,
      query
    )
  }
})
