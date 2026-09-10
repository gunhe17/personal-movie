import { View, ScrollView } from 'react-native';
import { COLORS } from '@/shared/constants/theme';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';

/**
 * 검사 상세 로딩 스켈레톤 — 실제 레이아웃(Hero + 검사정보 카드 + 검사 항목 + 내담자) 흉내.
 * 디자인 §6.2: 콘텐츠 로딩은 스피너가 아니라 스켈레톤. 헤더는 chrome 이라 로딩 중에도 유지.
 */
export function AssessmentDetailSkeleton() {
  return (
    <ScrollView
      style={{ backgroundColor: COLORS.white }}
      scrollEnabled={false}
      contentContainerStyle={{ paddingBottom: s(32) }}
    >
      {/* Gray Zone — Hero + 검사정보 카드 */}
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(12), paddingBottom: s(20) }}>
        <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(16) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={80} height={16} />
            <Skeleton width={44} height={20} radius={10} />
          </View>
          <Skeleton width={200} height={24} />
          <Skeleton width={120} height={20} />
          <Skeleton width="100%" height={6} radius={3} />
        </View>
        <View style={{ marginHorizontal: s(20), marginTop: s(12), backgroundColor: COLORS.white, borderRadius: s(16), padding: s(16), gap: s(10) }}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="55%" height={16} />
        </View>
      </View>

      {/* White Zone — 검사 항목 + 내담자 */}
      <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingHorizontal: s(20), gap: s(10) }}>
        <Skeleton width={80} height={20} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={84} radius={16} />
        ))}
        <View style={{ height: s(14) }} />
        <Skeleton width={60} height={20} />
        <Skeleton width="100%" height={120} radius={16} />
      </View>
    </ScrollView>
  );
}
