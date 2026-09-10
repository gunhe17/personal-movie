import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import { useCenterStore } from '@/features/center';
import {
  useNotificationList,
  useNotificationCategoryCounts,
  useMarkAsRead,
  useMarkAllAsRead,
  handleNotificationNavigation,
  type NotificationCategoryFilter,
  type NotificationItem,
} from '@/features/notification';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Icon, type IconName } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';

type TabKey = 'all' | 'assessment' | 'counseling' | 'system';

const TAB_LABEL: Record<TabKey, string> = {
  all: '전체',
  assessment: '검사',
  counseling: '상담',
  system: '공지',
};

const CATEGORY_ICON: Record<NotificationItem['category'], IconName> = {
  counseling: 'noti-counseling',
  assessment: 'noti-assessment',
  system: 'noti-notice',
};

function tabToCategory(tab: TabKey): NotificationCategoryFilter {
  return tab === 'all' ? null : tab;
}

function formatNotifDate(iso: string): string {
  return format(parseDate(iso), 'yyyy-MM-dd');
}

// memo + 안정 onPress → 탭 전환/리스트 갱신 시 변하지 않은 행은 다시 그리지 않는다.
const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (item: NotificationItem) => void;
}) {
  const iconName = CATEGORY_ICON[item.category];
  const unread = !item.is_read;

  return (
    <TouchableOpacity
      className={`flex-row gap-3 border-b border-gray-100 px-5 py-4 ${
        unread ? 'bg-primary-50' : 'bg-surface'
      }`}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${unread ? '읽지 않음' : '읽음'}`}
    >
      <View className="pt-0.5">
        <Icon name={iconName} size={24} />
      </View>
      <View className="flex-1 gap-0.5">
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {item.title}
        </Typography>
        <Typography variant="body-03" className="text-gray-600" numberOfLines={2}>
          {item.body}
        </Typography>
        <Typography variant="label-01" className="mt-0.5 text-gray-400">
          {formatNotifDate(item.created_at)}
        </Typography>
      </View>
      {unread && <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
    </TouchableOpacity>
  );
});

export default function NotificationsScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const [tab, setTab] = useState<TabKey>('all');

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationList(centerId, tabToCategory(tab));
  const counts = useNotificationCategoryCounts(centerId);
  const markAsRead = useMarkAsRead(centerId);
  const markAllAsRead = useMarkAllAsRead(centerId);

  // 알림 목록 진입 시 앱 아이콘 뱃지 초기화
  useEffect(() => {
    Notifications.setBadgeCountAsync(0);
  }, []);

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handlePress = useCallback(
    (item: NotificationItem) => {
      if (!item.is_read) {
        markAsRead.mutate(item.id);
      }
      const navData = { type: item.category, ...((item.data as Record<string, unknown>) ?? {}) };
      handleNotificationNavigation(navData, router);
    },
    [markAsRead, router],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead.mutate();
    Notifications.setBadgeCountAsync(0);
  }, [markAllAsRead]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow item={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  const TABS: Array<{ key: TabKey; count: number }> = [
    { key: 'all', count: counts.total },
    { key: 'assessment', count: counts.assessment },
    { key: 'counseling', count: counts.counseling },
    { key: 'system', count: counts.system },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            알림
          </Typography>
        </View>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="모든 알림 읽음 처리"
        >
          <Typography variant="label-01" weight="medium" className="text-gray-500">
            모두 읽음
          </Typography>
        </TouchableOpacity>
      </View>

      {/* 필터 탭 */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 12,
            alignItems: 'center',
          }}
        >
        {TABS.map(({ key, count }) => {
          const selected = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
              style={{ flexShrink: 0 }}
              className={`flex-row items-center gap-1 rounded-full px-3.5 py-1.5 ${
                selected ? 'bg-gray-900' : 'bg-gray-100'
              }`}
              accessibilityRole="button"
              accessibilityLabel={`${TAB_LABEL[key]} ${count}건`}
              accessibilityState={{ selected }}
            >
              <Text
                className={`text-body-03 ${
                  selected ? 'font-semibold text-white' : 'font-medium text-gray-600'
                }`}
              >
                {TAB_LABEL[key]} {count}
              </Text>
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>

      {/* 리스트 */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Typography variant="body-02" className="text-gray-500">
            알림을 불러올 수 없습니다
          </Typography>
          <TouchableOpacity
            className="rounded-md bg-primary px-4 py-2"
            onPress={() => refetch()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Typography variant="body-03" weight="semibold" className="text-white">
              다시 시도
            </Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Typography variant="body-02" className="text-gray-400">
                알림이 없습니다
              </Typography>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
