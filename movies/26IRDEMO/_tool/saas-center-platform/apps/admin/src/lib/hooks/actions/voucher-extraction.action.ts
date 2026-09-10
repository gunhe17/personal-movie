/**
 * Voucher Extraction Actions (Admin)
 * 신 모델: voucher_files/voucher_drafts 제거 → voucher_extractions.
 * 업로드 즉시 추출 시작(status=started) → 워커가 completed/failed 로 전이.
 * 프론트는 status 폴링으로 진행을 관찰하고, completed 의 후보를 확정한다.
 */

import { appInstance, get, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type VoucherExtractionStatus =
  | 'processing'
  | 'review'
  | 'paused'
  | 'completed'
  | 'failed'

export interface VoucherExtractionDocumentItem {
  id: string
  name: string
  /** 확장자 (pdf·hwpx·md ...) */
  file_type: string
  /** 다운로드용 presigned URL (1h) */
  url: string | null
}

export interface VoucherExtractionSummary {
  id: string
  status: VoucherExtractionStatus
  /** 대표 원본 문서명 (global_documents.name) — 없으면 null */
  name: string | null
  /** completed.type — 추출된 자료 유형 (없을 수 있음) */
  type: string | null
  document_count: number
  candidate_count: number
  started_at: string | null
  completed_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

export interface VoucherExtractionListResponse {
  items: VoucherExtractionSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface VoucherExtractionDetailResponse {
  id: string
  status: VoucherExtractionStatus
  type: string | null
  source_url: string | null
  /** 입력 원본 문서 (업로드 원본: pdf·hwpx 등) */
  source_documents: VoucherExtractionDocumentItem[]
  /** 산출/가공 문서 (가공 md, 제출용 서식 png 등) */
  artifact_documents: VoucherExtractionDocumentItem[]
  /** completed.meta — 문서 단위 공통(전 후보 공유):
   *  {organization, year, usage_period, application_period, application_method, contact}
   *  각 값 = 셀 {value, page, quote, quote_pdf, match} | null */
  meta: Record<string, unknown>
  /** completed.vouchers — 런타임 리치 스키마(정본): 각 항목
   *  {no, name, code, span:[p-AAA,p-BBB], fields:{12키: 셀|배열|하위객체, 노드={value,page,quote,…}}} */
  candidates: Record<string, unknown>[]
  /** completed.forms — 확정된 서식 단위(여러 장 = 한 서식):
   *  {title, kind, page_range:[a,b], pages:[{page:"p-NNN", global_document_id}]}.
   *  구형(확정 게이트 이전)은 {page, title, kind, global_document_id} 페이지 단위. */
  forms: Record<string, unknown>[]
  /** 진행 상태 — {stage, data:{spans, form_pages, vouchers …}}. review 중엔 data.spans·
   *  form_pages 가 확정 화면의 재료. 완료 시 무시 */
  progress: { stage?: string; data?: Record<string, unknown> } | null
  started_at: string | null
  completed_at: string | null
  failed_at: string | null
  /** completed_at − started_at (둘 다 있을 때만) */
  latency_ms: number | null
  /** 실패 사유 (status=failed 일 때만) */
  failed: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ─── 목록 / 상세 ───

export const getVoucherExtractionList = (): Action<
  VoucherExtractionListResponse,
  VoucherExtractionListResponse
> => ({
  key: ['getVoucherExtractionList'],
  request: async (params?: {
    status?: VoucherExtractionStatus
    page?: number
    size?: number
  }): Promise<VoucherExtractionListResponse> => {
    return get<VoucherExtractionListResponse>(
      '/admin/voucher-extractions',
      params
    )
  }
})

export const getVoucherExtractionDetail = (): Action<
  VoucherExtractionDetailResponse,
  VoucherExtractionDetailResponse
> => ({
  key: ['getVoucherExtractionDetail'],
  request: async (params: {
    extractionId: string
  }): Promise<VoucherExtractionDetailResponse> => {
    return get<VoucherExtractionDetailResponse>(
      `/admin/voucher-extractions/${params.extractionId}`
    )
  }
})

// ─── 업로드 (multipart) — 업로드 즉시 추출 시작 ───

/** 업로드 시 고를 자료 유형 (백엔드 VoucherFileType 과 일치). */
export type VoucherFileType =
  | 'business_guide'
  | 'manual'
  | 'form'
  | 'supplementary'
  | 'notice'

export interface UploadVoucherExtractionResponse {
  id: string
  status: string
  message: string
}

export interface UploadVoucherExtractionParams {
  name: string
  type: VoucherFileType
  source_url?: string | null
  /** 같은 자료의 여러 확장자(PDF/HWPX 등)를 한 번에 묶어 업로드 */
  files: File[]
}

export const uploadVoucherExtraction = (): Action<
  UploadVoucherExtractionResponse
> => ({
  key: ['uploadVoucherExtraction', 'getVoucherExtractionList'],
  request: async (params: UploadVoucherExtractionParams) => {
    const formData = new FormData()
    formData.append('name', params.name)
    formData.append('type', params.type)
    if (params.source_url) formData.append('source_url', params.source_url)
    for (const f of params.files) formData.append('files', f)

    const response = await appInstance.post<UploadVoucherExtractionResponse>(
      '/admin/voucher-extractions',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<UploadVoucherExtractionResponse>
  }
})

// ─── 재추출 (failed → started) ───

export const retryVoucherExtraction = (): Action<{
  id: string
  status: string
}> => ({
  key: [
    'retryVoucherExtraction',
    'getVoucherExtractionList',
    'getVoucherExtractionDetail'
  ],
  request: async (params: { extractionId: string }) => {
    const response = await appInstance.post<{ id: string; status: string }>(
      `/admin/voucher-extractions/${params.extractionId}/retry`,
      {}
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      id: string
      status: string
    }>
  }
})

export const stopVoucherExtraction = (): Action<{
  id: string
  status: string
}> => ({
  key: [
    'stopVoucherExtraction',
    'getVoucherExtractionList',
    'getVoucherExtractionDetail'
  ],
  request: async (params: { extractionId: string }) => {
    const response = await appInstance.post<{ id: string; status: string }>(
      `/admin/voucher-extractions/${params.extractionId}/stop`,
      {}
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      id: string
      status: string
    }>
  }
})

export const resumeVoucherExtraction = (): Action<{
  id: string
  status: string
}> => ({
  key: [
    'resumeVoucherExtraction',
    'getVoucherExtractionList',
    'getVoucherExtractionDetail'
  ],
  request: async (params: { extractionId: string }) => {
    const response = await appInstance.post<{ id: string; status: string }>(
      `/admin/voucher-extractions/${params.extractionId}/resume`,
      {}
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      id: string
      status: string
    }>
  }
})

export interface LayoutSpanItem {
  name: string
  code?: string | null
  start_page: number
  end_page: number
}

export interface LayoutFormItem {
  title: string
  kind: string
  start_page: number
  end_page: number
}

export const confirmVoucherLayout = (): Action<{
  id: string
  status: string
}> => ({
  key: [
    'confirmVoucherLayout',
    'getVoucherExtractionList',
    'getVoucherExtractionDetail'
  ],
  request: async (params: {
    extractionId: string
    spans: LayoutSpanItem[]
    forms: LayoutFormItem[]
  }) => {
    const response = await appInstance.post<{ id: string; status: string }>(
      `/admin/voucher-extractions/${params.extractionId}/confirm-layout`,
      { spans: params.spans, forms: params.forms }
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      id: string
      status: string
    }>
  }
})

// ─── 확정 (편집된 voucher payload → 카탈로그 승격) ───

export interface ConfirmVoucherDocumentLink {
  global_document_id: string
  /** 이 문서에서 이 바우처가 차지하는 쪽 — 원본은 구간, 서식 png 는 그 한 쪽 */
  page_range?: [number, number] | null
}

export interface ConfirmExtractionVoucherItem {
  name: string
  program_name: string
  program_organization: string
  program_year: number
  usage_start_date?: string | null
  usage_end_date?: string | null
  application_method?: string | null
  application_start_date?: string | null
  application_end_date?: string | null
  support_amount?: Record<string, unknown> | null
  support_scope?: string | null
  support_target?: string | null
  contact?: string | null
  page_range?: [number, number] | null
}

export interface ConfirmedVoucherItem {
  voucher_id: string
  name: string
  program_year: number
  /** True: 새 Voucher 생성, False: 기존 재사용 */
  voucher_created: boolean
}

export interface ConfirmExtractionResponse {
  extraction_id: string
  items: ConfirmedVoucherItem[]
  voucher_created_count: number
  voucher_reused_count: number
  link_created_count: number
}

export const confirmVoucherExtraction = (): Action<ConfirmExtractionResponse> => ({
  key: [
    'confirmVoucherExtraction',
    'getVoucherExtractionList',
    'getVoucherExtractionDetail',
    'getVoucherList'
  ],
  request: async (params: {
    extractionId: string
    vouchers: ConfirmExtractionVoucherItem[]
  }) => {
    const response = await appInstance.post<ConfirmExtractionResponse>(
      `/admin/voucher-extractions/${params.extractionId}/confirm`,
      { vouchers: params.vouchers }
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<ConfirmExtractionResponse>
  }
})

// ─── 삭제 (soft) ───

export const deleteVoucherExtraction = () => ({
  key: ['deleteVoucherExtraction', 'getVoucherExtractionList'],
  request: async (params: { extractionId: string }) => {
    return deleteResource(`/admin/voucher-extractions/${params.extractionId}`)
  }
})
