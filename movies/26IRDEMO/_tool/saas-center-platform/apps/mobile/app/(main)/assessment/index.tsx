import { useState, useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import {
  useAssessmentCaseList,
  type AssessmentCaseItem,
} from '@/features/assessment';
import { Typography } from '@/shared/components/ui/Typography';
import { SearchField } from '@/shared/components/ui/SearchField';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { AssessmentCaseCard } from '@/shared/components/cards/AssessmentCaseCard';
import { AssessmentListSkeleton } from './_components/AssessmentListSkeleton';

type FilterKey = 'processing' | 'completed' | undefined;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: undefined, label: '전체' },
  { key: 'processing', label: '진행중' },
  { key: 'completed', label: '완료' },
];

export default function AssessmentStatusScreen() {
  const router = useRouter();
  const centerId = useCenterStore((st) => st.centerId);
  const [filter, setFilter] = useState<FilterKey>(undefined);
  const [search, setSearch] = useState('');

  // 카운트 계산을 위해 필터 없이 가져와 클라이언트에서 분류한다.
  // 백엔드 size 상한이 100이라 100으로 호출.
  const { data, isLoading, isError, refetch, isRefetching } =
    useAssessmentCaseList(centerId, undefined, 100);
  const showSkeleton = useDelayedSkeleton(isLoading);

  const allItems = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    const c = { total: 0, processing: 0, completed: 0 };
    for (const it of allItems) {
      if (it.status === 'cancelled') continue;
      c.total++;
      if (it.status === 'processing') c.processing++;
      else if (it.status === 'completed') c.completed++;
    }
    return c;
  }, [allItems]);

  const items = useMemo(() => {
    let base = allItems.filter((i) => i.status !== 'cancelled');
    if (filter) base = base.filter((i) => i.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((i) =>
        i.clients.some((c) => c.name?.toLowerCase().includes(q)),
      );
    }
    return base;
  }, [allItems, filter, search]);

  const getTabCount = (key: FilterKey): number => {
    if (key === undefined) return counts.total;
    return counts[key];
  };

  // 안정 콜백 — 카드 memo가 효과를 내려면 onPress 참조가 고정돼야 한다.
  const handlePress = useCallback(
    (caseId: string) => router.push(`/(main)/assessment/${caseId}`),
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AssessmentCaseItem; index: number }) => (
      <Animated.View entering={FadeIn.delay(index * 50).duration(280)}>
        <AssessmentCaseCard item={item} onPress={handlePress} />
      </Animated.View>
    ),
    [handlePress],
  );

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
    if (filter === 'processing') {
      return {
        icon: 'reader-outline',
        title: '진행 중인 검사가 없어요',
        desc: '진행 중인 검사가 여기에 모여요',
      };
    }
    if (filter === 'completed') {
      return {
        icon: 'checkmark-circle-outline',
        title: '완료된 검사가 없어요',
        desc: '완료된 검사가 여기에 모여요',
      };
    }
    return {
      icon: 'reader-outline',
      title: '아직 담당 검사가 없어요',
      desc: '검사 일정이 잡히면 여기에서 확인할 수 있어요',
    };
  }, [search, filter]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          className="mr-1"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          검사
        </Typography>
      </View>

      {/* 검색바 — 흰 배경 컨테이너 */}
      <View className="bg-surface px-4 pb-4 pt-[10px]">
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="이름, 전화번호로 검색해주세요"
          height={44}
          blurOnSubmit={false}
        />
      </View>

      {/* 회색 영역 — 필터 칩 + 카운트 + 리스트 (gray-50) */}
      <View className="flex-1 bg-background">
        {/* 필터 칩 — 상담 현황과 동일 톤 */}
        <View style={{ paddingTop: 16, paddingBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = filter === tab.key;
              const count = getTabCount(tab.key);
              return (
                <TouchableOpacity
                  key={tab.label}
                  onPress={() => setFilter(tab.key)}
                  activeOpacity={0.7}
                  accessibilityLabel={`${tab.label} ${count}건`}
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

        {/* 총 개수 */}
        <View className="px-5 pb-2">
          <Typography variant="label-01" className="text-gray-500">
            총 {items.length}개
          </Typography>
        </View>

        {/* 리스트 */}
        {showSkeleton ? (
          <AssessmentListSkeleton />
        ) : isLoading ? (
          <View className="flex-1" />
        ) : isError ? (
          <View className="flex-1 items-center justify-center gap-2 px-5">
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
            data={items}
            keyExtractor={(item) => item.case_id}
            renderItem={renderItem}
            initialNumToRender={8}
            windowSize={7}
            keyboardShouldPersistTaps="handled"
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
