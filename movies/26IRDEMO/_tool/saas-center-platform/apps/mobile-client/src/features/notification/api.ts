import apiClient from '@/shared/api/client';
import type {
  AppNotificationList,
  AppNotificationSetting,
} from './types';

export async function getNotifications(page = 1): Promise<AppNotificationList> {
  const { data } = await apiClient.get<AppNotificationList>('/app/notifications', {
    params: { page, size: 30 },
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>(
    '/app/notifications/unread-count',
  );
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/app/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/app/notifications/read-all');
}

export async function getNotificationSettings(): Promise<AppNotificationSetting[]> {
  const { data } = await apiClient.get<AppNotificationSetting[]>(
    '/app/notification-settings',
  );
  return data;
}

export async function updateNotificationSetting(
  setting: AppNotificationSetting,
): Promise<AppNotificationSetting> {
  const { data } = await apiClient.put<AppNotificationSetting>(
    '/app/notification-settings',
    setting,
  );
  return data;
}

export async function registerPushToken(params: {
  token: string;
  platform: string;
  device_info?: string;
}): Promise<void> {
  await apiClient.post('/app/push-tokens', params);
}

/** 토큰은 쿼리로 — ExponentPushToken[...] 의 대괄호가 경로에선 깨진다 */
export async function unregisterPushToken(token: string): Promise<void> {
  await apiClient.delete('/app/push-tokens', { params: { token } });
}
