import { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import { useNoticeList, type NoticeCategory, type NoticeItem } from '@/features/notice';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import { Typography } from '@/shared/components/ui/Typography';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { NoticesListSkeleton } from './_components/NoticesListSkeleton';

/** 카테고리별 라벨 + 뱃지 색(연한 채움 + 진한 글자). 의미 있는 구분에만 색을 쓴다(§디자인 색 철학). */
const CATEGORY_STYLE: Record<
  NoticeCategory,
  { label: string; bg: string; fg: string }
> = {
  announcement: { label: '공지', bg: COLORS.gray[100], fg: COLORS.gray[600] },
  update: { label: '업데이트', bg: COLORS.primary50, fg: COLORS.primary700 },
  maintenance: { label: '점검', bg: COLORS.trans.yellow, fg: COLORS.warning },
};

function formatNoticeDate(iso: string): string {
  return format(parseDate(iso), 'yyyy. MM. dd', { locale: ko });
}

/** 메타 구분 세로선 — 10px, gray-200 */
function MetaDivider() {
  return (
    <View style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }} />
  );
}

export default function NoticesScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNoticeList(centerId);
  const showSkeleton = useDelayedSkeleton(isLoading);

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NoticeItem; index: number }) => {
      const cat = CATEGORY_STYLE[item.category];
      const publishedIso = item.published_at ?? item.created_at;

      return (
        <Animated.View entering={FadeIn.delay(index * 40).duration(250)}>
          <TouchableOpacity
            className="rounded-lg bg-surface p-4"
            style={{ gap: s(10) }}
            activeOpacity={0.7}
            onPress={() => router.push(`/(main)/notices/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${cat.label} ${item.title}`}
          >
            {/* 상단: 카테고리 + 고정 + 안읽음 dot */}
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <View
                style={{ backgroundColor: cat.bg }}
                className="rounded-full px-2.5 py-1"
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: cat.fg }}
                >
                  {cat.label}
                </Typography>
              </View>
              {item.is_pinned && (
                <View className="flex-row items-center" style={{ gap: s(2) }}>
                  <Ionicons name="bookmark" size={12} color={COLORS.warning} />
                  <Typography
                    variant="label-02"
                    weight="medium"
                    style={{ color: COLORS.warning }}
                  >
                    고정
                  </Typography>
                </View>
              )}
              <View style={{ flex: 1 }} />
              {!item.is_read && (
                <View
                  style={{
                    width: s(7),
                    height: s(7),
                    borderRadius: s(4),
                    backgroundColor: COLORS.primary,
                  }}
                />
              )}
            </View>

            {/* 제목 */}
            <Typography
              variant="body-01"
              weight={item.is_read ? 'medium' : 'semibold'}
              className="text-gray-900"
              numberOfLines={2}
            >
              {item.title}
            </Typography>

            {/* 하단: 날짜 · 작성자 */}
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <Typography variant="label-01" className="text-gray-500">
                {formatNoticeDate(publishedIso)}
              </Typography>
              {item.created_by_name && (
                <>
                  <MetaDivider />
                  <Typography variant="label-01" className="text-gray-500">
                    {item.created_by_name}
                  </Typography>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          공지사항
        </Typography>
      </View>

      {/* 회색 영역: 카드 리스트 */}
      <View className="flex-1 bg-background">
        {showSkeleton ? (
          <NoticesListSkeleton />
        ) : isLoading ? (
          <View className="flex-1" />
        ) : isError ? (
          <View
            className="flex-1 items-center justify-center px-8"
            style={{ gap: s(8) }}
          >
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[300]} />
            <Typography variant="body-01" weight="semibold" className="text-gray-700">
              공지사항을 불러오지 못했어요
            </Typography>
            <Typography variant="body-03" className="text-center text-gray-400">
              잠시 후 다시 시도해 주세요
            </Typography>
            <TouchableOpacity
              className="mt-3 rounded-md bg-primary px-5 py-2.5"
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
            initialNumToRender={8}
            windowSize={7}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: s(16),
              paddingBottom: 32,
              gap: 12,
            }}
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
              <View
                style={{ paddingVertical: s(48), gap: s(8) }}
                className="items-center px-8"
              >
                <Icon name="notice" size={28} color={COLORS.gray[300]} />
                <Typography variant="body-01" weight="semibold" className="text-gray-700">
                  아직 공지사항이 없어요
                </Typography>
                <Typography variant="body-03" className="text-center text-gray-400">
                  새로운 소식이 올라오면 여기에서 알려드릴게요
                </Typography>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
