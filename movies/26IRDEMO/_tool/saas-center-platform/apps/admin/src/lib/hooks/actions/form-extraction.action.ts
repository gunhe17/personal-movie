import { appInstance } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// 서식 스키마 추출 (form_extractions) — 원본 문서의 한 쪽에서 FormSchema 를 추출해
// FormTemplate 으로 확정한다. 백엔드 API 는 완비돼 있고 여기는 admin 배선만.

export interface FormExtractionDetail {
  id: string
  status: 'processing' | 'completed' | 'failed'
  name: string
  /** completed — FormSchema draft {pages, fields, elements} */
  schema: Record<string, unknown> | null
  failed: string | null
}

export const createFormExtractionFromDocument = (): Action<{
  id: string
  status: string
}> => ({
  key: ['createFormExtractionFromDocument'],
  request: async (params: {
    source_document_id: string
    name: string
    /** 서식이 걸친 쪽 — 여러 장이면 한 서식으로 추출된다 */
    pages: number[]
  }) => {
    const response = await appInstance.post<{ id: string; status: string }>(
      `/admin/form-extractions/from-document`,
      {
        source_document_id: params.source_document_id,
        name: params.name,
        page_range: [Math.min(...params.pages), Math.max(...params.pages)]
      }
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      id: string
      status: string
    }>
  }
})

export const getFormExtractionDetail = (): Action<FormExtractionDetail> => ({
  key: ['getFormExtractionDetail'],
  request: async (params: { extractionId: string }) => {
    const response = await appInstance.get<FormExtractionDetail>(
      `/admin/form-extractions/${params.extractionId}`
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<FormExtractionDetail>
  }
})

export const confirmFormExtraction = (): Action<{
  template_id: string
  name: string
  version: number
}> => ({
  key: ['confirmFormExtraction'],
  request: async (params: {
    extractionId: string
    name: string
    schema: Record<string, unknown>
    /** 이 서식을 쓰는 바우처들 — 빈 배열이면 어디에도 붙이지 않는다 */
    voucher_ids?: string[]
    kind?: string
  }) => {
    const response = await appInstance.post<{
      template_id: string
      name: string
      version: number
    }>(`/admin/form-extractions/${params.extractionId}/confirm`, {
      name: params.name,
      schema: params.schema,
      voucher_ids: params.voucher_ids ?? [],
      kind: params.kind ?? '기타'
    })
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      template_id: string
      name: string
      version: number
    }>
  }
})

export interface FormExtractionSummary {
  id: string
  status: 'processing' | 'completed' | 'failed'
  name: string
  source_document_id: string
  /** page_range 시작 쪽 — 원본 문서에서 이 서식이 있던 자리 */
  page: number | null
  created_at: string
}

export const listFormExtractions = (): Action<{ items: FormExtractionSummary[] }> => ({
  key: ['listFormExtractions'],
  request: async (params: { size?: number }) => {
    const response = await appInstance.get<{ items: FormExtractionSummary[] }>(
      `/admin/form-extractions`,
      { params: { size: params.size ?? 100 } }
    )
    return response.data as unknown as import('$types/apiResponse').ApiResponse<{
      items: FormExtractionSummary[]
    }>
  }
})
