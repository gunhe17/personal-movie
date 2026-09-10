/** 알림함 — 센터 구분 없는 단일 인박스(서버가 recipient_id로만 스코프한다). */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type AppNotification,
} from '@/features/notification';
import {
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { nowKst, toKst } from '@/shared/utils/date';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';

const ACCENT = COLORS.button.primary.bg;

const CATEGORY_ICON: Record<
  string,
  React.ComponentProps<typeof Ionicons>['name']
> = {
  assessment: 'clipboard-outline',
  counseling: 'chatbubble-ellipses-outline',
  system: 'information-circle-outline',
};

function formatWhen(iso: string): string {
  // 서버 UTC naive → KST 벽시계. 지금도 같은 축(nowKst)으로 재야 차이가 맞는다
  const created = toKst(iso);
  const diffMinutes = Math.floor(
    (nowKst().getTime() - created.getTime()) / 60000,
  );
  if (diffMinutes < 1) return '방금';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)}시간 전`;
  return `${created.getMonth() + 1}월 ${created.getDate()}일`;
}

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row gap-3 px-4 py-4"
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
        backgroundColor: item.is_read ? COLORS.surface : COLORS.blue[50],
      })}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: COLORS.blue[50] }}
      >
        <Ionicons
          name={CATEGORY_ICON[item.category] ?? 'notifications-outline'}
          size={20}
          color={ACCENT}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Typography
            variant="body-02"
            weight="semibold"
            className="flex-1"
            numberOfLines={1}
            style={{ color: COLORS.text.title.default }}
          >
            {item.title}
          </Typography>
          <Typography
            variant="label-02"
            className="ml-2"
            style={{ color: COLORS.text.caption.default }}
          >
            {formatWhen(item.created_at)}
          </Typography>
        </View>
        <Typography
          variant="body-03"
          className="mt-1"
          numberOfLines={2}
          style={{ color: COLORS.text.body.default }}
        >
          {item.body}
        </Typography>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const notificationsQuery = useNotifications();
  const refreshControl = useRefreshControl(() => notificationsQuery.refetch());
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notificationsQuery.data?.items ?? [];
  const hasUnread = items.some((item) => !item.is_read);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View
        className="h-[52px] flex-row items-center px-4"
        style={{ columnGap: 4 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          className="flex-1"
          style={{ color: COLORS.text.title.default }}
        >
          알림
        </Typography>
        {hasUnread ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAllRead.mutate()}
            hitSlop={8}
          >
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: ACCENT }}
            >
              모두 읽음
            </Typography>
          </Pressable>
        ) : null}
      </View>

      {notificationsQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : notificationsQuery.isError ? (
        <ErrorView
          className="flex-1"
          onRetry={() => notificationsQuery.refetch()}
        />
      ) : items.length === 0 ? (
        // 빈 알림함도 당겨서 새로고침 가능해야 한다 — "새 알림 왔나?"가 가장 흔한 확인
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <EmptyView
            title="아직 알림이 없어요"
            description={'센터에서 일정이 잡히거나 바뀌면\n여기로 알려드릴게요'}
            className="flex-1"
          />
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingBottom: s(40) }}
        >
          <View
            className="mt-2 overflow-hidden rounded-xl bg-surface"
            style={{ marginHorizontal: 16 }}
          >
            {items.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? (
                  <View
                    className="mx-4"
                    style={{ height: 1, backgroundColor: COLORS.border.subtle }}
                  />
                ) : null}
                <NotificationRow
                  item={item}
                  onPress={() => {
                    if (!item.is_read) markRead.mutate(item.id);
                  }}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
