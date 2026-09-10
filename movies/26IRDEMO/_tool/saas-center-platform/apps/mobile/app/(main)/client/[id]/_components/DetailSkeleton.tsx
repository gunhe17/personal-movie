import { View, ScrollView } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 내담자 상세 로딩 스켈레톤 — 실제 상세 레이아웃(기록 카드 + 정보 카드)을 흉내.
 * 헤더는 실제 Header(뒤로가기 등)를 그대로 두고 본문만 이 스켈레톤으로 대체한다.
 */
export function ClientDetailSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40) }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* 그룹: 기록 (상담/검사/문서 진입 카드 3개) */}
      <SkelGroup>
        <SkelEntryCard />
        <SkelEntryCard />
        <SkelEntryCard />
      </SkelGroup>

      {/* 그룹: 정보 (레이블-값 3행) */}
      <SkelGroup>
        <View className="rounded-lg bg-surface" style={{ padding: s(16), gap: s(14) }}>
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center justify-between">
              <Skeleton width={56} height={13} radius={4} />
              <Skeleton width={120} height={13} radius={4} />
            </View>
          ))}
        </View>
      </SkelGroup>
    </ScrollView>
  );
}

/** 섹션 그룹 — 라벨 박스 + 자식 (실제 SectionGroup 간격과 동일) */
function SkelGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: s(20), marginBottom: s(24) }}>
      <Skeleton width={48} height={13} radius={4} style={{ marginBottom: s(10) }} />
      <View style={{ gap: s(10) }}>{children}</View>
    </View>
  );
}

/** 진입 카드 — gray 아이콘 사각 + 2줄 (실제 CategoryEntryCard 모양) */
function SkelEntryCard() {
  return (
    <View
      className="flex-row items-center"
      style={{ backgroundColor: COLORS.white, borderRadius: s(14), padding: s(16), gap: s(12) }}
    >
      <Skeleton width={40} height={40} radius={10} />
      <View className="flex-1" style={{ gap: s(8) }}>
        <Skeleton width={80} height={15} radius={4} />
        <Skeleton width={150} height={12} radius={4} />
      </View>
    </View>
  );
}
