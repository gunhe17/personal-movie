/**
 * Notice Actions (Admin)
 * 공지사항 관련 API action 함수들
 */

import { get, post, patch, deleteResource } from '$services/api/instances'
import type { Action } from '$types/apiResponse'

// ─── 타입 ───

export type NoticeCategory = 'maintenance' | 'update' | 'announcement'

export interface NoticeSummary {
  id: string
  title: string
  category: NoticeCategory
  is_published: boolean
  is_pinned: boolean
  read_count: number
  target_read_count: number
  published_at: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface NoticeListResponse {
  items: NoticeSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface AttachmentItem {
  url: string
  path: string
  name: string
  size: number
  content_type: string
}

export interface NoticeDetailResponse {
  id: string
  title: string
  content: string
  category: NoticeCategory
  is_published: boolean
  is_pinned: boolean
  published_at: string | null
  created_by: string
  created_by_name: string | null
  attachments: AttachmentItem[] | null
  created_at: string
  updated_at: string
}

export interface NoticeCreateParams {
  title: string
  content: string
  category: NoticeCategory
  is_published: boolean
  is_pinned: boolean
  attachments?: AttachmentItem[]
}

// ─── 공지 목록 ───

export const getNoticeList = (): Action<NoticeListResponse, NoticeListResponse> => ({
  key: ['getNoticeList'],
  request: async (params?: {
    category?: NoticeCategory
    is_published?: boolean
    search?: string
    sort_order?: 'asc' | 'desc'
    page?: number
    size?: number
  }): Promise<NoticeListResponse> => {
    return get<NoticeListResponse>('/admin/notices', params)
  }
})

// ─── 공지 상세 ───

export const getNoticeDetail = (): Action<NoticeDetailResponse, NoticeDetailResponse> => ({
  key: ['getNoticeDetail'],
  request: async (params: { noticeId: string }): Promise<NoticeDetailResponse> => {
    return get<NoticeDetailResponse>(`/admin/notices/${params.noticeId}`)
  }
})

// ─── 공지 작성 ───

export const postCreateNotice = () => ({
  key: ['postCreateNotice', 'getNoticeList'],
  request: async (params: NoticeCreateParams) => {
    return post('/admin/notices', params)
  }
})

// ─── 공지 수정 ───

export const patchNotice = () => ({
  key: ['patchNotice', 'getNoticeList', 'getNoticeDetail'],
  request: async (params: { noticeId: string; [key: string]: any }) => {
    const { noticeId, ...body } = params
    return patch(`/admin/notices/${noticeId}`, body)
  }
})

// ─── 공지 삭제 ───

export const deleteNotice = () => ({
  key: ['deleteNotice', 'getNoticeList'],
  request: async (params: { noticeId: string }) => {
    return deleteResource(`/admin/notices/${params.noticeId}`)
  }
})

// ─── 읽음 현황 타입 ───

export interface NoticeReadCenterSummary {
  center_id: string
  center_name: string
  is_read: boolean
  first_read_at: string | null
  read_count: number
  target_read_count: number
  member_count: number
}

export interface NoticeReadStatusResponse {
  total_centers: number
  read_centers: number
  unread_centers: number
  last_notified_at: string | null
  centers: NoticeReadCenterSummary[]
  page: number
  size: number
  pages: number
}

export interface NotifyNoticeResponse {
  message: string
  target_member_count: number
}

export interface NoticeReadMemberDetail {
  member_id: string
  name: string
  role_name: string
  read_at: string | null
}

export interface NoticeReadCenterDetailResponse {
  center_id: string
  center_name: string
  members: NoticeReadMemberDetail[]
}

// ─── 읽음 현황 조회 ───

export const getNoticeReadStatus = (): Action<
  NoticeReadStatusResponse,
  NoticeReadStatusResponse
> => ({
  key: ['getNoticeReadStatus'],
  request: async (params: {
    noticeId: string
    search?: string
    is_read?: boolean
    page?: number
    size?: number
  }): Promise<NoticeReadStatusResponse> => {
    const { noticeId, ...query } = params
    return get<NoticeReadStatusResponse>(
      `/admin/notices/${noticeId}/read-status`,
      query
    )
  }
})

export const getNoticeReadCenterDetail = (): Action<
  NoticeReadCenterDetailResponse,
  NoticeReadCenterDetailResponse
> => ({
  key: ['getNoticeReadCenterDetail'],
  request: async (params: {
    noticeId: string
    centerId: string
  }): Promise<NoticeReadCenterDetailResponse> => {
    return get<NoticeReadCenterDetailResponse>(
      `/admin/notices/${params.noticeId}/read-status/${params.centerId}`
    )
  }
})

// ─── 미열람자 알림 발송 ───

export const postNotifyUnread = () => ({
  key: ['postNotifyUnread', 'getNoticeReadStatus'],
  request: async (params: { noticeId: string }) => {
    return post<NotifyNoticeResponse>(`/admin/notices/${params.noticeId}/remind`)
  }
})
