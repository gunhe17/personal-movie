import { View } from 'react-native';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 상담일지 리스트 로딩 스켈레톤 — 실제 회기 그룹 카드(날짜 헤더 + 시간·장소·프로그램 + 내담자 row)를 흉내.
 * 헤더·검색바·필터·카운트는 그대로 두고 리스트 본문만 이 스켈레톤으로 대체한다.
 */
export function NotesListSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: s(20), paddingTop: s(4), paddingBottom: s(40) }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <NoteGroupSkeleton key={i} />
      ))}
    </View>
  );
}

function NoteGroupSkeleton() {
  return (
    <View style={{ marginBottom: s(16) }}>
      {/* 날짜 헤더 */}
      <Skeleton
        width={120}
        height={13}
        radius={4}
        style={{ marginBottom: s(12), marginLeft: s(4) }}
      />

      {/* 회기 카드 */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
        }}
      >
        {/* 시간 ~ 시간 | 장소 */}
        <View className="flex-row items-center" style={{ gap: s(10) }}>
          <Skeleton width={92} height={16} radius={4} />
          <Skeleton width={56} height={13} radius={4} />
        </View>
        {/* 프로그램명 */}
        <Skeleton width={140} height={12} radius={4} style={{ marginTop: s(6) }} />

        {/* divider */}
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginVertical: s(14),
          }}
        />

        {/* 내담자 row */}
        <View className="flex-row items-center justify-between">
          <View style={{ gap: s(6) }}>
            <Skeleton width={80} height={14} radius={4} />
            <Skeleton width={112} height={12} radius={4} />
          </View>
          <Skeleton width={48} height={22} radius={8} />
        </View>
      </View>
    </View>
  );
}
