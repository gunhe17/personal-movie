import { useInfiniteQuery, useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotificationList, getUnreadCount, markAsRead, markAllAsRead, getNotificationSettings, upsertNotificationSetting } from './api';
import type { NotificationItem, NotificationListResponse, UnreadCountResponse, NotificationSettingUpsert } from './types';

const PAGE_SIZE = 20;

export type NotificationCategoryFilter = NotificationItem['category'] | null;

export function useNotificationList(
  centerId: string | null,
  category: NotificationCategoryFilter = null,
) {
  return useInfiniteQuery({
    queryKey: ['notificationList', centerId, category],
    queryFn: ({ pageParam }) =>
      getNotificationList(centerId!, {
        page: pageParam,
        size: PAGE_SIZE,
        category: category ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: !!centerId,
    staleTime: 60 * 1000,
  });
}

/**
 * 카테고리별 총 알림 개수 (탭 라벨용).
 * size=1 로 호출하여 응답의 `total` 만 사용.
 */
export function useNotificationCategoryCounts(centerId: string | null) {
  const CATEGORIES: Array<NotificationItem['category']> = ['assessment', 'counseling', 'system'];

  const queries = useQueries({
    queries: [
      {
        queryKey: ['notificationCount', centerId, null] as const,
        queryFn: () => getNotificationList(centerId!, { size: 1 }),
        enabled: !!centerId,
        staleTime: 60 * 1000,
      },
      ...CATEGORIES.map((cat) => ({
        queryKey: ['notificationCount', centerId, cat] as const,
        queryFn: () => getNotificationList(centerId!, { size: 1, category: cat }),
        enabled: !!centerId,
        staleTime: 60 * 1000,
      })),
    ],
  });

  const [all, assessment, counseling, system] = queries;
  return {
    total: all.data?.total ?? 0,
    assessment: assessment.data?.total ?? 0,
    counseling: counseling.data?.total ?? 0,
    system: system.data?.total ?? 0,
    isLoading: queries.some((q) => q.isLoading),
  };
}

export function useUnreadCount(centerId: string | null) {
  return useQuery({
    queryKey: ['notificationUnreadCount', centerId],
    queryFn: () => getUnreadCount(centerId!),
    enabled: !!centerId,
    staleTime: 60 * 1000,
  });
}

export function useMarkAsRead(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markAsRead(centerId!, notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notificationList', centerId] });

      // unread count 낙관적 감소
      const prevCount = queryClient.getQueryData<UnreadCountResponse>(['notificationUnreadCount', centerId]);
      if (prevCount && prevCount.count > 0) {
        queryClient.setQueryData<UnreadCountResponse>(['notificationUnreadCount', centerId], {
          count: prevCount.count - 1,
        });
      }

      return { prevCount };
    },
    onError: (_err, _id, context) => {
      if (context?.prevCount) {
        queryClient.setQueryData(['notificationUnreadCount', centerId], context.prevCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationList', centerId] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', centerId] });
    },
  });
}

export function useMarkAllAsRead(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllAsRead(centerId!),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notificationList', centerId] });

      const prevCount = queryClient.getQueryData<UnreadCountResponse>(['notificationUnreadCount', centerId]);
      queryClient.setQueryData<UnreadCountResponse>(['notificationUnreadCount', centerId], { count: 0 });

      return { prevCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevCount) {
        queryClient.setQueryData(['notificationUnreadCount', centerId], context.prevCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationList', centerId] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', centerId] });
    },
  });
}

// --- Notification Settings ---

export function useNotificationSettings(centerId: string | null) {
  return useQuery({
    queryKey: ['notificationSettings', centerId],
    queryFn: () => getNotificationSettings(centerId!),
    enabled: !!centerId,
  });
}

export function useUpsertNotificationSetting(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationSettingUpsert) =>
      upsertNotificationSetting(centerId!, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings', centerId] });
    },
  });
}
