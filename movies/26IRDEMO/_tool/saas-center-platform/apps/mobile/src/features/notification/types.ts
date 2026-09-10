export interface NotificationItem {
  id: string;
  category: 'assessment' | 'counseling' | 'system';
  event_type: string;
  priority: 'important' | 'normal';
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface PushTokenResponse {
  id: string;
  token: string;
  device_info: string | null;
  platform: string;
  is_active: boolean;
  created_at: string;
}

// --- Notification Settings ---

export interface NotificationSetting {
  id: string;
  center_id: string;
  account_id: string;
  category: string;
  event_type: string | null;
  channel_in_app: boolean;
  channel_push: boolean;
  channel_alarmtalk: boolean;
}

export interface NotificationSettingListResponse {
  items: NotificationSetting[];
}

export interface NotificationSettingUpsert {
  category: string;
  event_type?: string | null;
  channel_in_app: boolean;
  channel_push: boolean;
  channel_alarmtalk: boolean;
}
