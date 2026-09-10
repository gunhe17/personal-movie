import { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import { useCounselingCaseList, type CounselingCaseItem } from '@/features/counseling';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { SearchField } from '@/shared/components/ui/SearchField';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import {
  CounselingCaseCard,
  deriveCounselingStatus,
  type CounselingStatusKey,
} from '@/shared/components/cards/CounselingCaseCard';
import { CounselingListSkeleton } from './_components/CounselingListSkeleton';

type StatusKey = CounselingStatusKey;
type FilterKey = 'all' | StatusKey;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'in_progress', label: '진행중' },
  { key: 'completed', label: '완료' },
];

/** 오늘 자정 기준 D-day (정렬용). 음수=지남, 0=오늘, 양수=N일 후 */
function computeDDay(target: string | null): number | null {
  if (!target) return null;
  try {
    const t = parseDate(target);
    const targetMidnight = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const now = new Date();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export default function CounselingStatusScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useCounselingCaseList(centerId);
  const showSkeleton = useDelayedSkeleton(isLoading);

  const allItems = useMemo(() => data?.items ?? [], [data]);

  const itemsWithStatus = useMemo(
    () => allItems.map((item) => ({ item, status: deriveCounselingStatus(item) })),
    [allItems],
  );

  // 검색 필터: 내담자 이름 includes (대소문자 무시, 공백 정리)
  const searchedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return itemsWithStatus;
    return itemsWithStatus.filter((entry) =>
      entry.item.clients.some((c) => c.name?.toLowerCase().includes(q)),
    );
  }, [itemsWithStatus, search]);

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = {
      all: searchedItems.length,
      in_progress: 0,
      scheduled: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const { status } of searchedItems) {
      result[status] += 1;
    }
    return result;
  }, [searchedItems]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return searchedItems;
    return searchedItems.filter((entry) => entry.status === filter);
  }, [searchedItems, filter]);

  /** 다음 예정일 가까운 순 정렬 (오늘·임박 상위, 미지정은 맨 뒤) */
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aDay = computeDDay(a.item.next_session_start);
      const bDay = computeDDay(b.item.next_session_start);
      if (aDay === null && bDay === null) return 0;
      if (aDay === null) return 1;
      if (bDay === null) return -1;
      return aDay - bDay;
    });
  }, [filteredItems]);

  const clearSearch = useCallback(() => setSearch(''), []);

  // 빈 상태 문구 — §6.1 구조(아이콘+타이틀+설명) + §12.4 친근 존댓말(이유+다음 행동).
  const emptyContent = useMemo<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    desc: string;
  }>(() => {
    if (search.trim()) {
      return {
        icon: 'search-outline',
        title: '검색 결과가 없어요',
        desc: `'${search.trim()}'와 일치하는 내담자를 찾지 못했어요`,
      };
    }
    if (filter === 'in_progress') {
      return {
        icon: 'chatbubbles-outline',
        title: '진행 중인 상담이 없어요',
        desc: '진행 중인 상담 케이스가 여기에 모여요',
      };
    }
    if (filter === 'completed') {
      return {
        icon: 'checkmark-circle-outline',
        title: '완료된 상담이 없어요',
        desc: '종결된 상담 케이스가 여기에 모여요',
      };
    }
    return {
      icon: 'chatbubbles-outline',
      title: '아직 담당 상담이 없어요',
      desc: '상담 케이스가 배정되면 여기에서 확인할 수 있어요',
    };
  }, [search, filter]);

  // 안정 콜백 — 카드 memo가 효과를 내려면 onPress 참조가 고정돼야 한다.
  const handlePress = useCallback(
    (caseId: string) => router.push(`/(main)/counseling/${caseId}`),
    [router],
  );

  const renderItem = useCallback(
    ({
      item: entry,
      index,
    }: {
      item: { item: CounselingCaseItem; status: StatusKey };
      index: number;
    }) => (
      <Animated.View entering={FadeIn.delay(index * 50).duration(280)}>
        <CounselingCaseCard item={entry.item} onPress={handlePress} />
      </Animated.View>
    ),
    [handlePress],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          상담
        </Typography>
      </View>

      {/* 검색바 — 내담자 페이지와 동일 디자인 */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(20) }}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          onClear={clearSearch}
          placeholder="내담자 이름으로 검색해주세요"
          height={44}
          blurOnSubmit={false}
        />
      </View>

      {/* 회색 영역: 필터 pills + 카운트 + 리스트 */}
      <View className="flex-1 bg-background">
        {/* 필터 pills — 외곽 View에서 위·아래 16px 여백 */}
        <View style={{ paddingTop: 16, paddingBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = filter === tab.key;
              const count = counts[tab.key];
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${tab.label} 필터`}
                  accessibilityRole="button"
                  className="flex-row items-center gap-1 rounded-full"
                  style={{
                    height: s(32),
                    paddingHorizontal: s(12),
                    backgroundColor: isActive ? COLORS.gray[700] : 'transparent',
                    borderWidth: 1,
                    borderColor: isActive ? COLORS.gray[700] : COLORS.gray[300],
                  }}
                >
                  <Typography
                    variant="body-03"
                    weight="medium"
                    style={{ color: isActive ? '#FFFFFF' : COLORS.gray[600] }}
                  >
                    {tab.label}
                  </Typography>
                  <Typography
                    variant="label-02"
                    weight="regular"
                    style={{ color: isActive ? '#FFFFFF' : COLORS.gray[600] }}
                  >
                    {count}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 총 N개 */}
        <View className="px-5 pb-2">
          <Typography variant="label-01" className="text-gray-500">
            총 {filteredItems.length}개
          </Typography>
        </View>

        {/* 리스트 */}
        {showSkeleton ? (
          <CounselingListSkeleton />
        ) : isLoading ? (
          <View className="flex-1" />
        ) : isError ? (
          <View className="flex-1 items-center justify-center gap-2 py-16">
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[300]} />
            <Typography variant="body-03" className="text-gray-400">
              데이터를 불러올 수 없습니다
            </Typography>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.7}
              accessibilityLabel="다시 시도"
              accessibilityRole="button"
              className="mt-2 rounded-md bg-primary px-5 py-2"
            >
              <Typography variant="body-03" weight="semibold" className="text-white">
                다시 시도
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sortedItems}
            keyExtractor={(entry) => entry.item.case_id}
            renderItem={renderItem}
            initialNumToRender={8}
            windowSize={7}
            contentContainerStyle={{
              paddingHorizontal: 20,
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
            ListEmptyComponent={
              <View
                style={{ paddingVertical: s(48), gap: s(8) }}
                className="items-center px-8"
              >
                <Ionicons
                  name={emptyContent.icon}
                  size={48}
                  color={COLORS.gray[300]}
                />
                <Typography
                  variant="body-01"
                  weight="semibold"
                  className="text-gray-700"
                >
                  {emptyContent.title}
                </Typography>
                <Typography
                  variant="body-03"
                  className="text-center text-gray-400"
                >
                  {emptyContent.desc}
                </Typography>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
