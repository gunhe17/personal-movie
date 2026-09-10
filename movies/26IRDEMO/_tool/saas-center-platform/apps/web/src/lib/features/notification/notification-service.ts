/**
 * 알림 서비스
 * 알림 목록/읽음 처리/전체 읽음 등 비즈니스 로직 캡슐화
 */

import { requireCenterId } from '$lib/stores/center.store'
import { snackbarStore } from '$lib/stores/snackbar'
import {
  patchMarkAsRead,
  patchMarkAllAsRead
} from '$lib/hooks/actions/notification.action'
import type { QueryClient } from '@tanstack/svelte-query'

export interface NotificationServiceDeps {
  queryClient: QueryClient
}

export function createNotificationService(deps: NotificationServiceDeps) {
  const { queryClient } = deps

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({
      queryKey: ['getNotificationList'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getUnreadCount'],
      exact: false
    })
  }

  /** 단건 읽음 처리 */
  const markAsRead = async (notificationId: string) => {
    try {
      const centerId = requireCenterId()
      await patchMarkAsRead().request({
        center_id: centerId,
        notification_id: notificationId
      })
      invalidateNotifications()
    } catch {
      snackbarStore.error('알림 읽음 처리에 실패했습니다.')
    }
  }

  /** 전체 읽음 처리 */
  const markAllAsRead = async () => {
    try {
      const centerId = requireCenterId()
      await patchMarkAllAsRead().request({
        center_id: centerId
      })
      invalidateNotifications()
    } catch {
      snackbarStore.error('전체 읽음 처리에 실패했습니다.')
    }
  }

  return {
    markAsRead,
    markAllAsRead,
    invalidateNotifications
  }
}
