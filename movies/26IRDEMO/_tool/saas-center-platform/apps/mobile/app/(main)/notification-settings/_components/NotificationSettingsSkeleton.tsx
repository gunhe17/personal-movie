import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';

/**
 * 알림 설정 로딩 스켈레톤 — 전체 알림(master) 카드 + 섹션 토글 카드를 흉내.
 * 헤더는 그대로 두고 본문만 이 스켈레톤으로 대체한다.
 */
export function NotificationSettingsSkeleton() {
  return (
    <View style={{ flex: 1, paddingTop: s(16) }}>
      {/* master 카드 */}
      <View
        className="mx-5 flex-row items-center rounded-lg bg-surface p-4"
        style={{ gap: s(12) }}
      >
        <SkeletonCircle size={40} />
        <View style={{ flex: 1, gap: s(6) }}>
          <Skeleton width={72} height={16} radius={4} />
          <Skeleton width={120} height={12} radius={4} />
        </View>
        <Skeleton width={48} height={28} radius={999} />
      </View>

      {/* 섹션 카드 2개 */}
      {Array.from({ length: 2 }).map((_, sectionIdx) => (
        <View key={sectionIdx} style={{ marginTop: s(24) }}>
          <View className="px-5" style={{ marginBottom: s(8) }}>
            <Skeleton width={48} height={13} radius={4} />
          </View>
          <View className="mx-5 rounded-lg bg-surface p-4">
            <View className="flex-row items-center" style={{ gap: s(12) }}>
              <Skeleton width={36} height={36} radius={10} />
              <View style={{ flex: 1, gap: s(6) }}>
                <Skeleton width={100} height={15} radius={4} />
                <Skeleton width="70%" height={11} radius={4} />
              </View>
              <Skeleton width={48} height={28} radius={999} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
