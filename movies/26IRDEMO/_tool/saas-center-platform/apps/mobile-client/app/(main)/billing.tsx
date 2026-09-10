/**
 * 청구서 — 조회 전용(인앱 결제 없음, 설계 §0-3). 시안 661:8379.
 *
 * 탭(결제 완료 / 결제 전) + 평면 목록(날짜 · 항목·센터 · 금액). 카드 아닌 행 리스트.
 * 상태 라벨은 중립 표현만(§7-1 "연체·빨강 금지").
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptModal, useBillables, type AppBillable } from '@/features/billing';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import { ErrorView, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

type BillTab = 'paid' | 'unpaid';

/** 탭 폭 — worklet에 넘길 숫자로 미리 계산. */
const TAB_W = s(82);

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** "YYYY-MM-DD" → "M.D" */
function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}.${Number(day)}`;
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="h-11 items-center justify-center"
      style={{ width: TAB_W }}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: active ? COLORS.text.body.strong : COLORS.text.body.subtle }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

/** 청구 행 — 날짜 · (항목 + 센터) · 금액. 탭하면 영수증 모달. */
function BillRow({ billable, onPress }: { billable: AppBillable; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-[60px] flex-row items-center"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ width: s(40), color: COLORS.text.body.subtle }}
      >
        {formatShortDate(billable.billable_date)}
      </Typography>
      <View className="flex-1" style={{ marginLeft: s(20), rowGap: s(8) }}>
        <Typography
          variant="body-01"
          weight="semibold"
          numberOfLines={1}
          style={{ color: COLORS.text.body.strong }}
        >
          {billable.item_summary || '청구서'}
        </Typography>
        {billable.center_name ? (
          <Typography
            variant="body-03"
            numberOfLines={1}
            style={{ color: COLORS.text.body.subtle }}
          >
            {billable.center_name}
          </Typography>
        ) : null}
      </View>
      <Typography
        variant="body-01"
        weight="semibold"
        className="ml-2"
        style={{ color: COLORS.text.body.default }}
      >
        {formatWon(billable.total_amount)}
      </Typography>
    </Pressable>
  );
}

export default function BillingScreen() {
  const router = useRouter();
  const billablesQuery = useBillables();
  const refreshControl = useRefreshControl(() => billablesQuery.refetch());
  const billables = billablesQuery.data ?? [];

  const [tab, setTab] = useState<BillTab>('paid');
  const [detailTarget, setDetailTarget] = useState<AppBillable | null>(null);

  const indicatorX = useSharedValue(0);
  useEffect(() => {
    indicatorX.value = withTiming(tab === 'paid' ? 0 : TAB_W, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [tab, indicatorX]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const shown = billables.filter((b) =>
    tab === 'paid' ? b.status === 'paid' : b.status !== 'paid',
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-[52px] flex-row items-center px-4" style={{ columnGap: 4 }}>
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
          style={{ color: COLORS.text.title.default }}
        >
          청구서
        </Typography>
      </View>

      {billablesQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : billablesQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => billablesQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }}
        >
          <View className="px-4">
            {/* 탭 — 결제 완료 / 결제 전 (하단 인디케이터 슬라이드) */}
            <View style={{ position: 'relative' }}>
              <View
                className="flex-row"
                style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border.default }}
              >
                <TabButton
                  label="결제 완료"
                  active={tab === 'paid'}
                  onPress={() => setTab('paid')}
                />
                <TabButton
                  label="결제 전"
                  active={tab === 'unpaid'}
                  onPress={() => setTab('unpaid')}
                />
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: TAB_W,
                    height: 1.5,
                    backgroundColor: COLORS.gray[900],
                  },
                  indicatorStyle,
                ]}
              />
            </View>

            {/* 목록 — 탭 전환 시 페이드 */}
            <Animated.View key={tab} entering={FadeIn.duration(200)} className="mt-4">
              {shown.length === 0 ? (
                <Typography
                  variant="body-02"
                  className="py-10 text-center"
                  style={{ color: COLORS.text.caption.default }}
                >
                  {tab === 'paid'
                    ? '결제 완료된 청구서가 없어요'
                    : '결제 전 청구서가 없어요'}
                </Typography>
              ) : (
                <View style={{ rowGap: s(16) }}>
                  {shown.map((billable) => (
                    <BillRow
                      key={billable.id}
                      billable={billable}
                      onPress={() => setDetailTarget(billable)}
                    />
                  ))}
                </View>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      )}

      <ReceiptModal
        visible={detailTarget !== null}
        billableId={detailTarget?.id ?? null}
        centerId={detailTarget?.center_id ?? null}
        onClose={() => setDetailTarget(null)}
      />
    </SafeAreaView>
  );
}
