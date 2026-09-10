import { View } from 'react-native';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';

/**
 * 공지사항 리스트 로딩 스켈레톤 — 실제 공지 카드(카테고리 pill → 제목 → 날짜)를 흉내.
 * 헤더는 그대로 두고 회색 영역의 카드 리스트만 이 스켈레톤으로 대체한다.
 */
export function NoticesListSkeleton() {
  return (
    <View style={{ flex: 1, paddingTop: s(16), paddingHorizontal: 20, gap: 12 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          className="rounded-lg bg-surface p-4"
          style={{ gap: s(10) }}
        >
          <Skeleton width={48} height={22} radius={999} />
          <Skeleton width={i % 2 === 0 ? '82%' : '64%'} height={16} radius={4} />
          <Skeleton width={96} height={13} radius={4} />
        </View>
      ))}
    </View>
  );
}
