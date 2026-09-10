export type NotificationCategory = 'assessment' | 'counseling' | 'system' | '*';

/** GET /app/notifications 항목 */
export interface AppNotification {
  id: string;
  category: NotificationCategory;
  event_type: string;
  priority: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface AppNotificationList {
  items: AppNotification[];
  page: number;
  size: number;
  pages: number;
}

/** 앱에는 인앱/푸시 두 축만 — 알림톡은 Client.phone 경로라 앱 계정과 무관 */
export interface AppNotificationSetting {
  category: string;
  channel_in_app: boolean;
  channel_push: boolean;
}
