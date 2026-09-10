import apiClient from '@/shared/api/client';
import type {
  NotificationListResponse,
  UnreadCountResponse,
  PushTokenResponse,
  NotificationSettingListResponse,
  NotificationSetting,
  NotificationSettingUpsert,
} from './types';

export async function getNotificationList(
  centerId: string,
  params?: { category?: string; is_read?: boolean; page?: number; size?: number },
): Promise<NotificationListResponse> {
  const response = await apiClient.get<NotificationListResponse>(
    `/centers/${centerId}/notifications`,
    { params },
  );
  return response.data;
}

export async function getUnreadCount(centerId: string): Promise<UnreadCountResponse> {
  const response = await apiClient.get<UnreadCountResponse>(
    `/centers/${centerId}/notifications/unread-count`,
  );
  return response.data;
}

export async function markAsRead(centerId: string, notificationId: string): Promise<void> {
  await apiClient.patch(`/centers/${centerId}/notifications/${notificationId}/read`);
}

export async function markAllAsRead(centerId: string): Promise<{ updated_count: number }> {
  const response = await apiClient.patch<{ updated_count: number }>(
    `/centers/${centerId}/notifications/read-all`,
  );
  return response.data;
}

// --- Push Token ---

export async function registerPushToken(
  centerId: string,
  token: string,
  platform: 'ios' | 'android',
  deviceInfo?: string,
): Promise<PushTokenResponse> {
  const response = await apiClient.post<PushTokenResponse>(
    `/centers/${centerId}/notifications/push-tokens`,
    { token, platform, device_info: deviceInfo ?? null },
  );
  return response.data;
}

export async function unregisterPushToken(
  centerId: string,
  token: string,
): Promise<void> {
  // iOS Expo 토큰(`ExponentPushToken[...]`)의 `[`, `]`처럼 URL path에
  // 부적합한 문자를 피하기 위해 토큰은 쿼리 파라미터로 전달한다.
  // axios가 params를 자동으로 URL 인코딩하므로 플랫폼 불문 안전.
  await apiClient.delete(`/centers/${centerId}/notifications/push-tokens`, {
    params: { token },
  });
}

// --- Notification Settings ---

export async function getNotificationSettings(
  centerId: string,
): Promise<NotificationSettingListResponse> {
  const response = await apiClient.get<NotificationSettingListResponse>(
    `/centers/${centerId}/notification-settings`,
  );
  return response.data;
}

export async function upsertNotificationSetting(
  centerId: string,
  data: NotificationSettingUpsert,
): Promise<NotificationSetting> {
  const response = await apiClient.put<NotificationSetting>(
    `/centers/${centerId}/notification-settings`,
    data,
  );
  return response.data;
}

export async function deleteNotificationSetting(
  centerId: string,
  settingId: string,
): Promise<void> {
  await apiClient.delete(`/centers/${centerId}/notification-settings/${settingId}`);
}
