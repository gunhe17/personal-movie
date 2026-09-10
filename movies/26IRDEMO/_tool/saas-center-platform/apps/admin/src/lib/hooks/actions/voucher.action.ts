/**
 * Voucher Actions (Admin)
 * 바우처 사업 카탈로그 + 자료 연결 관련 API.
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export interface AdminVoucherSummary {
  id: string
  name: string
  program_name: string
  program_organization: string
  program_year: number
  usage_start_date: string | null
  usage_end_date: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AdminVoucherFileRef {
  id: string
  name: string
  /** 확장자/타입 (pdf·hwpx·md ...) — global_documents.file_type */
  file_type: string
  page_range: [number, number] | null
  deleted_at: string | null
}

export interface AdminVoucherDetailResponse {
  id: string
  name: string
  program_name: string
  program_organization: string
  program_year: number

  usage_start_date: string | null
  usage_end_date: string | null
  application_method: string | null
  application_start_date: string | null
  application_end_date: string | null

  /**
   * 지원금 구조화 정보 (자유 schema dict).
   * 예: { "통화": "KRW", "월총액": { "최소": 180000, "최대": 250000 },
   *       "정부지원금": null, "본인부담금": null, "가격탄력제": true,
   *       "등급별": [{ "등급": 1, "기준": "...", ... }] }
   * 내부 키 schema는 백엔드와의 코드 상 약속.
   */
  support_amount: Record<string, unknown> | null
  support_scope: string | null
  support_target: string | null
  contact: string | null
  /** 추출 정규화 레코드(§1~§10, 바우처-정규화-토의.md). 원문 앵커 ref 동반, 참고용. */
  record: Record<string, unknown> | null

  documents: AdminVoucherFileRef[]

  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AdminVoucherListResponse {
  items: AdminVoucherSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AdminVoucherCreateLinkPayload {
  global_document_id: string
  page_range?: [number, number] | null
}

export interface AdminVoucherCreatePayload {
  name: string
  program_name: string
  program_organization: string
  program_year: number
  usage_start_date?: string | null
  usage_end_date?: string | null
  application_method?: string | null
  application_start_date?: string | null
  application_end_date?: string | null
  /** 지원금 구조화 정보 (자유 schema dict) — 입력자가 `원문` 등 메타는 제거하고 보낼 것 */
  support_amount?: Record<string, unknown> | null
  support_scope?: string | null
  support_target?: string | null
  contact?: string | null
  /** 추출 정규화 record(§1~§10) — 정본. 편집 시 support_* 는 이로부터 재파생 */
  record?: Record<string, unknown> | null
  /** 등록과 동시에 생성할 자료 연결 (옵션, 백엔드에서 한 트랜잭션 처리) */
  document_links?: AdminVoucherCreateLinkPayload[]
}

export type AdminVoucherUpdatePayload = Partial<
  Omit<AdminVoucherCreatePayload, 'document_links'>
>

/** 문서 카탈로그 항목 (링크 후보 picker) — GET /admin/documents */
export interface AdminDocumentSummary {
  id: string
  name: string
  /** 확장자 (pdf·hwpx·md ...) */
  file_type: string
  created_at: string
  deleted_at: string | null
}

export interface AdminDocumentListResponse {
  items: AdminDocumentSummary[]
  total: number
  page: number
  size: number
  pages: number
}

/** voucher_documents 링크 1건 + 연결 문서 요약 — POST/GET /admin/vouchers/{id}/documents */
export interface VoucherDocumentLinkResponse {
  id: string
  voucher_id: string
  global_document_id: string
  page_range: [number, number] | null
  name: string | null
  file_type: string | null
  deleted_at: string | null
  created_at: string
}

// ─── 목록 / 상세 ───

export const getVoucherList = (): Action<AdminVoucherListResponse, AdminVoucherListResponse> => ({
  key: ['getVoucherList'],
  request: async (params?: {
    q?: string
    year?: number
    organization?: string
    page?: number
    size?: number
  }): Promise<AdminVoucherListResponse> => {
    return get<AdminVoucherListResponse>('/admin/vouchers', params)
  }
})

export const getVoucherDetail = (): Action<AdminVoucherDetailResponse, AdminVoucherDetailResponse> => ({
  key: ['getVoucherDetail'],
  request: async (params: { voucherId: string }): Promise<AdminVoucherDetailResponse> => {
    return get<AdminVoucherDetailResponse>(`/admin/vouchers/${params.voucherId}`)
  }
})

// ─── 생성 / 수정 / 삭제 ───

export const postCreateVoucher = () => ({
  key: ['postCreateVoucher', 'getVoucherList'],
  request: async (params: AdminVoucherCreatePayload) => {
    return post<AdminVoucherDetailResponse>('/admin/vouchers', params)
  }
})

export const patchVoucher = () => ({
  key: ['patchVoucher', 'getVoucherList', 'getVoucherDetail'],
  request: async (params: { voucherId: string } & AdminVoucherUpdatePayload) => {
    const { voucherId, ...body } = params
    return patch<AdminVoucherDetailResponse>(`/admin/vouchers/${voucherId}`, body)
  }
})

export const deleteVoucher = () => ({
  key: ['deleteVoucher', 'getVoucherList', 'getVoucherDetail'],
  request: async (params: { voucherId: string }) => {
    return deleteResource(`/admin/vouchers/${params.voucherId}`)
  }
})

// ─── 문서 카탈로그 (링크 후보 picker) ───

export const getDocumentList = (): Action<
  AdminDocumentListResponse,
  AdminDocumentListResponse
> => ({
  key: ['getDocumentList'],
  request: async (params?: {
    q?: string
    page?: number
    size?: number
  }): Promise<AdminDocumentListResponse> => {
    return get<AdminDocumentListResponse>('/admin/documents', params)
  }
})

// ─── 자료 링크 (voucher_documents) ───

export const getVoucherDocuments = (): Action<
  VoucherDocumentLinkResponse[],
  VoucherDocumentLinkResponse[]
> => ({
  key: ['getVoucherDocuments'],
  request: async (params: {
    voucherId: string
  }): Promise<VoucherDocumentLinkResponse[]> => {
    return get<VoucherDocumentLinkResponse[]>(
      `/admin/vouchers/${params.voucherId}/documents`
    )
  }
})

export const linkVoucherDocument = () => ({
  key: ['linkVoucherDocument', 'getVoucherDetail', 'getVoucherDocuments'],
  request: async (params: {
    voucherId: string
    global_document_id: string
    page_range?: [number, number] | null
  }) => {
    const { voucherId, ...body } = params
    return post<VoucherDocumentLinkResponse>(
      `/admin/vouchers/${voucherId}/documents`,
      body
    )
  }
})

export const unlinkVoucherDocument = () => ({
  key: ['unlinkVoucherDocument', 'getVoucherDetail', 'getVoucherDocuments'],
  request: async (params: { voucherId: string; globalDocumentId: string }) => {
    return deleteResource(
      `/admin/vouchers/${params.voucherId}/documents/${params.globalDocumentId}`
    )
  }
})