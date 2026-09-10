/**
 * CS Memo Actions (Admin)
 * CS 전화 메모 관련 API action 함수들
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type MemoType = 'inquiry' | 'complaint' | 'request' | 'other'

export interface CSMemoSummary {
  id: string
  title: string
  memo_type: MemoType
  center_id: string | null
  center_name: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface CSMemoListResponse {
  items: CSMemoSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface CSMemoDetailResponse {
  id: string
  title: string
  content: string
  memo_type: MemoType
  center_id: string | null
  center_name: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface CSMemoCreateParams {
  title: string
  content: string
  memo_type: MemoType
  center_id?: string | null
}

export interface CSMemoUpdateParams {
  memoId: string
  title?: string
  content?: string
  memo_type?: MemoType
  center_id?: string | null
}

// ─── 메모 목록 ───

export const getCSMemoList = (): Action<CSMemoListResponse, CSMemoListResponse> => ({
  key: ['getCSMemoList'],
  request: async (params?: {
    search?: string
    memo_type?: MemoType
    center_id?: string
    date_from?: string
    date_to?: string
    sort_order?: 'asc' | 'desc'
    page?: number
    size?: number
  }): Promise<CSMemoListResponse> => {
    return get<CSMemoListResponse>('/admin/cs-memos', params)
  }
})

// ─── 메모 상세 ───

export const getCSMemoDetail = (): Action<CSMemoDetailResponse, CSMemoDetailResponse> => ({
  key: ['getCSMemoDetail'],
  request: async (params: { memoId: string }): Promise<CSMemoDetailResponse> => {
    return get<CSMemoDetailResponse>(`/admin/cs-memos/${params.memoId}`)
  }
})

// ─── 메모 작성 ───

export const postCreateCSMemo = () => ({
  key: ['postCreateCSMemo', 'getCSMemoList'],
  request: async (params: CSMemoCreateParams) => {
    return post('/admin/cs-memos', params)
  }
})

// ─── 메모 수정 ───

export const patchCSMemo = () => ({
  key: ['patchCSMemo', 'getCSMemoList', 'getCSMemoDetail'],
  request: async (params: CSMemoUpdateParams) => {
    const { memoId, ...body } = params
    return patch(`/admin/cs-memos/${memoId}`, body)
  }
})

// ─── 메모 삭제 ───

export const deleteCSMemo = () => ({
  key: ['deleteCSMemo', 'getCSMemoList'],
  request: async (params: { memoId: string }) => {
    return deleteResource(`/admin/cs-memos/${params.memoId}`)
  }
})

// ─── 메모 일괄 삭제 ───

export const bulkDeleteCSMemos = () => ({
  key: ['bulkDeleteCSMemos', 'getCSMemoList'],
  request: async (params: { memo_ids: string[] }) => {
    return deleteResource('/admin/cs-memos/batch', params)
  }
})
