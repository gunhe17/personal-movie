/**
 * Notification Actions
 * 알림 관련 API action 함수들
 */

import { get, patch, put, deleteResource } from '$lib/services/api/instances'

// ============ 알림 타입 ============

export interface NotificationType {
  id: string
  category: string
  event_type: string
  priority: string
  title: string
  body: string
  data: Record<string, any> | null
  is_read: boolean
  created_at: string
}

export interface NotificationDetailType extends NotificationType {
  center_id: string
  recipient_id: string
  read_at: string | null
}

export interface NotificationListResponse {
  items: NotificationType[]
  total: number
  page: number
  size: number
  pages: number
}

export interface UnreadCountResponse {
  count: number
}

export interface MarkAllReadResponse {
  updated_count: number
}

// ============ 알림 설정 타입 ============

export interface NotificationSettingType {
  id: string
  center_id: string
  account_id: string
  category: string
  event_type: string | null
  channel_in_app: boolean
  channel_push: boolean
  channel_alarmtalk: boolean
  created_at: string
  updated_at: string
}

export interface NotificationSettingListResponse {
  items: NotificationSettingType[]
}

export interface NotificationSettingUpsert {
  category: string
  event_type?: string | null
  channel_in_app: boolean
  channel_push: boolean
  channel_alarmtalk: boolean
}

// ============ getNotificationList ============

export const getNotificationList = () => ({
  key: ['getNotificationList'],
  request: async (request: {
    center_id: string
    category?: string
    is_read?: boolean
    search?: string
    page?: number
    size?: number
    sort?: 'asc' | 'desc'
  }) => {
    const { center_id, ...params } = request
    if (!center_id) return { items: [], total: 0, page: 1, size: 20, pages: 0 }

    const queryParams = new URLSearchParams()
    if (params.category) queryParams.append('category', params.category)
    if (params.is_read !== undefined)
      queryParams.append('is_read', String(params.is_read))
    if (params.search) queryParams.append('search', params.search)
    if (params.page) queryParams.append('page', String(params.page))
    if (params.size) queryParams.append('size', String(params.size))
    if (params.sort) queryParams.append('sort', params.sort)

    const qs = queryParams.toString()
    const url = `centers/${center_id}/notifications${qs ? `?${qs}` : ''}`
    return await get<NotificationListResponse>(url)
  }
})

// ============ getUnreadCount ============

export const getUnreadCount = () => ({
  key: ['getUnreadCount'],
  request: async (request: { center_id: string }) => {
    const { center_id } = request
    if (!center_id) return { count: 0 }
    return await get<UnreadCountResponse>(
      `centers/${center_id}/notifications/unread-count`
    )
  }
})

// ============ patchMarkAsRead ============

export const patchMarkAsRead = () => ({
  key: ['getNotificationList', 'getUnreadCount'],
  request: async (request: { center_id: string; notification_id: string }) => {
    const { center_id, notification_id } = request
    return await patch<NotificationDetailType>(
      `centers/${center_id}/notifications/${notification_id}/read`
    )
  }
})

// ============ patchMarkAllAsRead ============

export const patchMarkAllAsRead = () => ({
  key: ['getNotificationList', 'getUnreadCount'],
  request: async (request: { center_id: string }) => {
    const { center_id } = request
    return await patch<MarkAllReadResponse>(
      `centers/${center_id}/notifications/read-all`
    )
  }
})

// ============ 알림 설정 ============

export const getNotificationSettings = () => ({
  key: ['getNotificationSettings'],
  request: async (request: { center_id: string }) => {
    const { center_id } = request
    if (!center_id) return { items: [] }
    return await get<NotificationSettingListResponse>(
      `centers/${center_id}/notification-settings`
    )
  }
})

export const putNotificationSetting = () => ({
  key: ['getNotificationSettings'],
  request: async (request: {
    center_id: string
    payload: NotificationSettingUpsert
  }) => {
    const { center_id, payload } = request
    return await put<NotificationSettingType>(
      `centers/${center_id}/notification-settings`,
      payload
    )
  }
})

export const deleteNotificationSetting = () => ({
  key: ['getNotificationSettings'],
  request: async (request: { center_id: string; setting_id: string }) => {
    const { center_id, setting_id } = request
    return await deleteResource<void>(
      `centers/${center_id}/notification-settings/${setting_id}`
    )
  }
})
