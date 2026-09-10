import { get, post, patch } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type {
  MarkReadResponse,
  NotificationListResponse,
  UnreadCountResponse
} from './types'

export function getNotificationList(): Action<
  NotificationListResponse,
  NotificationListResponse
> {
  return {
    key: ['getNotificationList'],
    request: async (params?: {
      institutionId: string
      page?: number
      size?: number
      unread_only?: boolean
    }) => {
      if (!params?.institutionId) {
        return { items: [], total: 0, unread_count: 0, page: 1, size: 20, pages: 1 }
      }
      const query = new URLSearchParams()
      if (params.page) query.set('page', String(params.page))
      if (params.size) query.set('size', String(params.size))
      if (params.unread_only) query.set('unread_only', 'true')

      const qs = query.toString()
      const url = `/institutions/${params.institutionId}/me/notifications${qs ? `?${qs}` : ''}`
      return await get<NotificationListResponse>(url)
    }
  }
}

export function getUnreadCount(): Action<
  UnreadCountResponse,
  UnreadCountResponse
> {
  return {
    key: ['getNotificationUnreadCount'],
    request: async (params?: { institutionId: string }) => {
      if (!params?.institutionId) {
        return { unread_count: 0 }
      }
      return await get<UnreadCountResponse>(
        `/institutions/${params.institutionId}/me/notifications/unread-count`
      )
    }
  }
}

export function markNotificationRead(): Action<MarkReadResponse> {
  return {
    key: ['getNotificationList', 'getNotificationUnreadCount'],
    request: async (params?: {
      institutionId: string
      notificationId: string
    }) => {
      if (!params?.institutionId || !params?.notificationId) {
        throw new Error('institutionId and notificationId are required')
      }
      return await patch<MarkReadResponse>(
        `/institutions/${params.institutionId}/me/notifications/${params.notificationId}/read`
      )
    }
  }
}

export function markAllNotificationsRead(): Action<MarkReadResponse> {
  return {
    key: ['getNotificationList', 'getNotificationUnreadCount'],
    request: async (params?: { institutionId: string }) => {
      if (!params?.institutionId) {
        throw new Error('institutionId is required')
      }
      return await post<MarkReadResponse>(
        `/institutions/${params.institutionId}/me/notifications/read-all`
      )
    }
  }
}
