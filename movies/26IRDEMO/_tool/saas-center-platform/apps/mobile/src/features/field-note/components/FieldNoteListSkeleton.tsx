import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const FND = COLORS.fieldnoteDark;
// 노트 카드와 동일한 다크 카드 톤(#252933, FieldNoteListContent HOME_CARD).
const CARD_BG = '#252933';
// 다크 카드 위 시머 — 화이트 오버레이 톤. 라이트 기본 그레이로는 안 보이므로 오버라이드.
const DARK_SHIMMER: [string, string] = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.12)'];

/**
 * 필드노트 노트 목록 로딩 스켈레톤.
 *
 * 실제 노트 카드(`FieldNoteListContent` NoteCard) 레이아웃을 그대로 흉내 — 데이터 도착 시
 * 레이아웃 점프 없음. 카드 = CARD_BG 박스, 1행(dot+이름 + 시간) / 2행(프로그램) / 3행(미리보기).
 * 공유 `Skeleton` 프리미티브에 다크 시머 색만 주입(애니메이션·타이밍은 공유 한 곳에서 관리, §6.2).
 */
export function FieldNoteListSkeleton({
  count = 6,
  bottomPadding,
}: {
  count?: number;
  bottomPadding?: number;
}) {
  return (
    <View
      style={{ paddingHorizontal: s(20), paddingTop: s(10), paddingBottom: bottomPadding ?? s(100) }}
      accessibilityLabel="필드노트 목록 불러오는 중"
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: CARD_BG,
            borderRadius: s(16),
            padding: s(16),
            marginBottom: s(12),
          }}
        >
          {/* 1행 — dot + 이름(좌) + 시간(우) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <SkeletonCircle size={7} colors={DARK_SHIMMER} />
              <Skeleton width={i % 2 === 0 ? 120 : 92} height={16} radius={6} colors={DARK_SHIMMER} />
            </View>
            <Skeleton width={42} height={12} radius={6} colors={DARK_SHIMMER} />
          </View>
          {/* 2행 — 프로그램 */}
          <View style={{ marginTop: s(8) }}>
            <Skeleton width={150} height={13} radius={6} colors={DARK_SHIMMER} />
          </View>
          {/* 3행 — 미리보기(짝수 카드만, 한 줄) */}
          {i % 2 === 0 && (
            <View style={{ marginTop: s(8) }}>
              <Skeleton width={'92%'} height={13} radius={6} colors={DARK_SHIMMER} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
