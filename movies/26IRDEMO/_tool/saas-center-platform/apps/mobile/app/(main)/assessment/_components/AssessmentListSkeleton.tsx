import { View } from 'react-native';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 검사 현황 리스트 로딩 스켈레톤 — 실제 AssessmentCard(좌 D-day 박스 + 우 정보 스택)를 흉내.
 * 헤더·필터·카운트는 그대로 두고 리스트 본문만 이 스켈레톤으로 대체한다.
 */
export function AssessmentListSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <AssessmentCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** D-day 박스 + 우측 정보 스택 */
function AssessmentCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(14),
        flexDirection: 'row',
        gap: s(14),
        alignItems: 'stretch',
      }}
    >
      {/* 좌측 D-day 박스 */}
      <View
        style={{
          width: s(64),
          backgroundColor: COLORS.gray[100],
          borderRadius: s(12),
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: s(10),
          gap: s(6),
        }}
      >
        <Skeleton width={30} height={16} radius={4} />
        <Skeleton width={26} height={11} radius={4} />
      </View>

      {/* 우측 정보 스택 */}
      <View style={{ flex: 1, justifyContent: 'center', gap: s(8) }}>
        <View style={{ gap: s(6) }}>
          {/* 이름 + 상태 뱃지 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Skeleton width={108} height={16} radius={4} />
            <View style={{ flex: 1 }} />
            <Skeleton width={46} height={20} radius={8} />
          </View>
          {/* 성별·나이 · 검사명 */}
          <Skeleton width={150} height={13} radius={4} />
        </View>
        {/* progress bar + N/M건 */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View style={{ flex: 1 }}>
            <Skeleton width="100%" height={4} radius={2} />
          </View>
          <Skeleton width={34} height={12} radius={4} />
        </View>
      </View>
    </View>
  );
}
