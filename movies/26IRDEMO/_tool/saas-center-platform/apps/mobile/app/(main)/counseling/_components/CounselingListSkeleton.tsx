import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 상담 현황 리스트 로딩 스켈레톤 — 실제 CompactCaseCard(아바타 + 정보 + 하단 진행도)를 흉내.
 * 헤더·검색바·필터·카운트는 그대로 두고 리스트 본문만 이 스켈레톤으로 대체한다.
 */
export function CounselingListSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <CaseCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** 아바타 + 정보 + 하단 진행도 (상담/검사 공통 카드 모양, height 150) */
function CaseCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        height: s(150),
        paddingHorizontal: s(16),
        paddingVertical: s(16),
        justifyContent: 'space-between',
      }}
    >
      {/* 상단: 아바타 + 정보 */}
      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <SkeletonCircle size={s(44)} />
        <View style={{ flex: 1, gap: s(8) }}>
          {/* 이름 + 우상단 뱃지 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Skeleton width={108} height={16} radius={4} />
            <View style={{ flex: 1 }} />
            <Skeleton width={60} height={28} radius={14} />
          </View>
          {/* 프로그램명 */}
          <Skeleton width={120} height={13} radius={4} />
          {/* 다음 회기 일시 */}
          <Skeleton width={150} height={13} radius={4} />
        </View>
      </View>

      {/* 하단: 구분선 + 진행도 */}
      <View>
        <View style={{ height: 1, backgroundColor: COLORS.gray[100], marginBottom: s(12) }} />
        <View className="flex-row items-center" style={{ gap: s(10) }}>
          <Skeleton width={34} height={13} radius={4} />
          <View style={{ flex: 1 }}>
            <Skeleton width="100%" height={6} radius={3} />
          </View>
          <Skeleton width={34} height={13} radius={4} />
        </View>
      </View>
    </View>
  );
}
