import { memo, useState, useMemo, useCallback } from 'react';
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
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore, usePermission } from '@/features/center';
import {
  useBillableList,
  BillableDetailSheet,
  ReceiptSheet,
  BILLABLE_STATUS_LABELS,
  BILLABLE_STATUS_PALETTE,
} from '@/features/billing';
import {
  ClientAvatar,
  genderToLabel,
  computeAge,
} from '@/features/billing/clientDisplay';
import type { BillableSummary, BillableStatus } from '@/features/billing';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { Badge } from '@/shared/components/ui/Badge';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { SearchField } from '@/shared/components/ui/SearchField';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { BillingListSkeleton } from './_components/BillingListSkeleton';

type FilterKey = 'all' | 'issued' | 'paid';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'issued', label: '결제 대기' },
  { key: 'paid', label: '결제 완료' },
];

function formatIssuedDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return format(parseDate(value), 'M월 d일', { locale: ko });
  } catch {
    return '-';
  }
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

// ──────────────── Compact Billing Card ────────────────

// memo + 안정 onPress(청구 id 전달) → 검색/필터 리렌더 시 변하지 않은 카드 유지.
const CompactBillingCard = memo(function CompactBillingCard({
  item,
  onPress,
}: {
  item: BillableSummary;
  onPress: (id: string) => void;
}) {
  const status = item.status as BillableStatus;
  const palette = BILLABLE_STATUS_PALETTE[status] ?? BILLABLE_STATUS_PALETTE.issued;
  const showUnpaid = status === 'issued' && item.unpaid_amount > 0;

  const clientName = item.client_name ?? '-';
  const genderLabel = genderToLabel(item.client_gender);
  const age = computeAge(item.client_birth_date);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${clientName} 청구 상세 보기`}
      accessibilityRole="button"
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(14),
        gap: s(12),
      }}
    >
      {/* 상단: 아바타 + 내담자 정보 + 상태 뱃지 — 아바타는 정보 stack 기준 세로 가운데 */}
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <ClientAvatar
          name={clientName}
          imageUrl={item.client_profile_image_url}
          seed={item.client_id}
        />

        {/* 정보 stack */}
        <View style={{ flex: 1, gap: s(4) }}>
          <View className="flex-row items-center" style={{ gap: s(8) }}>
            <View className="flex-row items-center" style={{ flex: 1, gap: s(6) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {clientName}
              </Typography>
              <GenderAgeMeta genderLabel={genderLabel} age={age} />
            </View>
            <BadgeRound bg={palette.bg} color={palette.color}>
              {BILLABLE_STATUS_LABELS[status]}
            </BadgeRound>
          </View>
          {/* 항목 요약 + 패키지 뱃지 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            {item.is_package && (
              <Badge bg={COLORS.gray[100]} color={COLORS.gray[600]}>
                패키지
              </Badge>
            )}
            <Typography
              variant="body-03"
              weight="medium"
              className="text-gray-800"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {item.item_summary || '-'}
            </Typography>
          </View>
        </View>
      </View>

      {/* divider */}
      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

      {/* 하단: 발행일 + 청구 금액 + 미수금 (레이블-값) — 라벨 너비 54 + 16px 간격 */}
      <View style={{ gap: s(8) }}>
        <View className="flex-row items-center" style={{ gap: s(16) }}>
          <Typography variant="body-03" className="text-body-default" style={{ width: s(54) }}>
            발행일
          </Typography>
          <Typography variant="body-03" className="text-body-strong">
            {formatIssuedDate(item.issued_at)}
          </Typography>
        </View>
        <View className="flex-row items-center" style={{ gap: s(16) }}>
          <Typography variant="body-03" className="text-body-default" style={{ width: s(54) }}>
            청구 금액
          </Typography>
          <Typography variant="body-02" className="text-body-strong">
            {formatAmount(item.total_amount)}
          </Typography>
        </View>
        {showUnpaid && (
          <View className="flex-row items-center" style={{ gap: s(16) }}>
            <Typography variant="body-03" className="text-body-default" style={{ width: s(54) }}>
              미수금
            </Typography>
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.error }}>
              {formatAmount(item.unpaid_amount)}
            </Typography>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ──────────────── Screen ────────────────

export default function BillingStatusScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const { can } = usePermission();

  if (!can('read:billing')) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['top']}>
        <Typography variant="body-01" className="text-gray-500">
          접근 권한이 없어요
        </Typography>
      </SafeAreaView>
    );
  }
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useBillableList(centerId);
  const showSkeleton = useDelayedSkeleton(isLoading);

  const allItems = useMemo(() => data?.items ?? [], [data]);

  const searchedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) =>
      (item.client_name ?? '').toLowerCase().includes(q),
    );
  }, [allItems, search]);

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { all: searchedItems.length, issued: 0, paid: 0 };
    for (const item of searchedItems) {
      if (item.status === 'issued') result.issued += 1;
      else if (item.status === 'paid') result.paid += 1;
    }
    return result;
  }, [searchedItems]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return searchedItems;
    return searchedItems.filter((i) => i.status === filter);
  }, [searchedItems, filter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aDate = a.issued_at ?? a.created_at;
      const bDate = b.issued_at ?? b.created_at;
      return bDate.localeCompare(aDate);
    });
  }, [filteredItems]);

  // 상세 시트 헤더(아바타/성별/나이/프로그램)는 BillableDetail에 없는 필드라 목록 요약으로 보강한다.
  const selectedSummary = useMemo(
    () => allItems.find((i) => i.id === detailId) ?? null,
    [allItems, detailId],
  );
  // 완납(paid) 건은 영수증 모달로, 그 외(발행됨 등)는 상세/납부 시트로 분기.
  // forceReceipt: 상세 시트에서 막 납부 완료한 직후(목록 status가 갱신되기 전) 영수증 전환용.
  const [forceReceipt, setForceReceipt] = useState(false);
  const showReceipt = !!detailId && (selectedSummary?.status === 'paid' || forceReceipt);
  const closeSheets = useCallback(() => {
    setDetailId(null);
    setForceReceipt(false);
  }, []);

  // 빈 상태 문구 — §6.1 구조(아이콘+타이틀+설명) + §12 친근 존댓말(이유+다음 행동).
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
    if (filter === 'issued') {
      return {
        icon: 'receipt-outline',
        title: '결제 대기 중인 청구가 없어요',
        desc: '미수금이 남은 청구가 여기에 모여요',
      };
    }
    if (filter === 'paid') {
      return {
        icon: 'checkmark-circle-outline',
        title: '결제 완료된 청구가 없어요',
        desc: '납부가 끝난 청구가 여기에 모여요',
      };
    }
    return {
      icon: 'receipt-outline',
      title: '아직 청구 내역이 없어요',
      desc: '회기를 마치면 상담·검사 상세에서 청구를 발행할 수 있어요',
    };
  }, [search, filter]);

  const clearSearch = useCallback(() => setSearch(''), []);

  // 안정 콜백 — 카드 memo가 효과를 내려면 onPress 참조가 고정돼야 한다.
  const handleOpen = useCallback((id: string) => {
    setForceReceipt(false);
    setDetailId(id);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: BillableSummary; index: number }) => (
      <Animated.View entering={FadeIn.delay(index * 40).duration(250)}>
        <CompactBillingCard item={item} onPress={handleOpen} />
      </Animated.View>
    ),
    [handleOpen],
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
          청구
        </Typography>
      </View>

      {/* 검색바 */}
      <View className="border-b border-gray-100 px-4 pb-4 pt-[10px]">
        <SearchField
          value={search}
          onChangeText={setSearch}
          onClear={clearSearch}
          placeholder="내담자 이름으로 검색해주세요"
          height={44}
          blurOnSubmit={false}
        />
      </View>

      {/* 회색 영역: 필터 + 리스트 */}
      <View className="flex-1 bg-background">
        {/* 필터 pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 8 }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.key;
            const count = counts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
                accessibilityLabel={`${tab.label} 필터 ${count}건`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
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

        {/* 총 N건 */}
        <View className="mt-1 px-5 py-[6px]">
          <Typography variant="body-03" className="text-gray-500">
            총 {filteredItems.length}건
          </Typography>
        </View>

        {/* 리스트 */}
        {showSkeleton ? (
          <BillingListSkeleton />
        ) : isLoading ? (
          <View className="flex-1" />
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8 py-16" style={{ gap: s(8) }}>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[300]} />
            <Typography variant="body-01" weight="semibold" className="text-gray-700">
              정보를 불러오지 못했어요
            </Typography>
            <Typography variant="body-03" className="text-center text-gray-400">
              잠시 후 다시 시도해 주세요
            </Typography>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.7}
              accessibilityLabel="다시 시도"
              accessibilityRole="button"
              className="mt-3 rounded-md bg-primary px-5 py-2.5"
            >
              <Typography variant="body-03" weight="semibold" className="text-white">
                다시 시도
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sortedItems}
            keyExtractor={(item) => item.id}
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
                <Ionicons name={emptyContent.icon} size={48} color={COLORS.gray[300]} />
                <Typography variant="body-01" weight="semibold" className="text-gray-700">
                  {emptyContent.title}
                </Typography>
                <Typography variant="body-03" className="text-center text-gray-400">
                  {emptyContent.desc}
                </Typography>
              </View>
            }
          />
        )}
      </View>

      {/* 완납 건 → 영수증 모달 / 그 외 → 청구 상세·납부 시트 (§3-2와 동일 재사용) */}
      <BillableDetailSheet
        visible={!!detailId && !showReceipt}
        onClose={closeSheets}
        centerId={centerId}
        billableId={detailId}
        summary={selectedSummary}
        onPaid={() => setForceReceipt(true)}
      />
      <ReceiptSheet
        visible={showReceipt}
        onClose={closeSheets}
        centerId={centerId}
        billableId={detailId}
        summary={selectedSummary}
      />
    </SafeAreaView>
  );
}
