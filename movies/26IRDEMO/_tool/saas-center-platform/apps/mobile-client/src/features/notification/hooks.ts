import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import {
  getNotificationSettings,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationSetting,
} from './api';
import type { AppNotificationSetting } from './types';

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    enabled: isAuthenticated,
  });
}

export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    enabled: isAuthenticated,
  });
}

function useNotificationInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function useMarkNotificationRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useNotificationInvalidation();
  return useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
}

export function useNotificationSettings() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
    enabled: isAuthenticated,
  });
}

export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setting: AppNotificationSetting) => updateNotificationSetting(setting),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
  });
}
