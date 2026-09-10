import { get } from '$lib/services/api/instances'

// ─── 타입 ───

export type NoticeCategory = 'maintenance' | 'update' | 'announcement'

export interface NoticeSummary {
  id: string
  title: string
  category: NoticeCategory
  is_published: boolean
  is_pinned: boolean
  is_read: boolean
  published_at: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface AttachmentItem {
  url: string
  path: string
  name: string
  size: number
  content_type: string
}

export interface NoticeSiblingItem {
  id: string
  title: string
}

export interface NoticeSiblings {
  prev: NoticeSiblingItem | null
  next: NoticeSiblingItem | null
}

export interface NoticeDetail {
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
  siblings: NoticeSiblings
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

// ─── Actions ───

export const getNoticeList = () => ({
  key: ['getNoticeList'],
  request: async (params?: {
    search?: string
    category?: NoticeCategory
    page?: number
    size?: number
    center_id?: string
  }): Promise<NoticeListResponse> => {
    return get<NoticeListResponse>('/notices', params)
  }
})

export const getNoticeDetail = () => ({
  key: ['getNoticeDetail'],
  request: async (params: {
    noticeId: string
    center_id?: string
  }): Promise<NoticeDetail> => {
    const { noticeId, ...query } = params
    return get<NoticeDetail>(`/notices/${noticeId}`, query)
  }
})
