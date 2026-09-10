import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 청구 현황 리스트 로딩 스켈레톤 — 실제 CompactBillingCard(아바타+이름/성별·나이+뱃지 / 항목요약 / divider / 발행일·금액·미수금)를 흉내.
 * 헤더·검색바·필터·카운트는 그대로 두고 리스트 본문만 이 스켈레톤으로 대체한다.
 */
export function BillingListSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <BillingCardSkeleton key={i} />
      ))}
    </View>
  );
}

function BillingCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(14),
        gap: s(12),
      }}
    >
      {/* 상단: 아바타 + (이름·성별/나이 + 뱃지 / 항목 요약) */}
      <View className="flex-row items-start" style={{ gap: s(12) }}>
        <SkeletonCircle size={s(48)} />
        <View style={{ flex: 1, gap: s(4) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Skeleton width={90} height={16} radius={4} />
            <Skeleton width={56} height={13} radius={4} />
            <View style={{ flex: 1 }} />
            <Skeleton width={40} height={18} radius={9} />
          </View>
          <Skeleton width={160} height={14} radius={4} />
        </View>
      </View>

      {/* divider */}
      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

      {/* 하단: 레이블-값 3행 */}
      <View style={{ gap: s(8) }}>
        <View className="flex-row items-center justify-between">
          <Skeleton width={40} height={14} radius={4} />
          <Skeleton width={60} height={14} radius={4} />
        </View>
        <View className="flex-row items-center justify-between">
          <Skeleton width={56} height={14} radius={4} />
          <Skeleton width={72} height={15} radius={4} />
        </View>
        <View className="flex-row items-center justify-between">
          <Skeleton width={40} height={14} radius={4} />
          <Skeleton width={64} height={15} radius={4} />
        </View>
      </View>
    </View>
  );
}
