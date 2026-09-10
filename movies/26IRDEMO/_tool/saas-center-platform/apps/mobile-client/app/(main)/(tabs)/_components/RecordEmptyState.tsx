/**
 * 기록 빈 상태 — 시안 323:5287.
 *
 * 세 갈래로 갈린다:
 *   - 프로필 0 → 기록을 붙일 대상이 없다. 안내로 끝내지 않고 그 자리에서 만들게 한다
 *     (§1 "정보가 아니라 행동 대본" — 마이 탭까지 찾아가게 두지 않는다)
 *   - 저장한 기록 뷰 → 저장이 없는 것이지 기록이 없는 게 아니라 작성 유도가 안 맞는다
 *   - 그 외 → 시안대로 작성 유도
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Typography } from '@/shared/components/ui';
import { COLORS, SHADOWS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import PencilIcon20 from '@assets/icons/20/PencilIcon20.svg';

type EmptyKind = 'no-profile' | 'bookmark' | 'no-record';

const COPY: Record<EmptyKind, { title: string; cta: string | null }> = {
  'no-profile': {
    title: '아직 등록된 아이가 없어요',
    cta: '아이 추가하기',
  },
  bookmark: {
    title: '저장한 기록이 없어요',
    cta: null,
  },
  'no-record': {
    title: '오늘의 작은 변화도 놓치지 마세요',
    cta: '작성하기',
  },
};

interface RecordEmptyStateProps {
  kind: EmptyKind;
  focusName: string;
  paddingBottom: number;
  onPress: () => void;
}

export function RecordEmptyState({
  kind,
  focusName,
  paddingBottom,
  onPress,
}: RecordEmptyStateProps) {
  const copy = COPY[kind];
  return (
    <View
      className="flex-1 items-center justify-center px-6"
      style={{ paddingBottom }}
    >
      <Image
        source={require('@assets/images/records/note.png')}
        style={{ width: s(122), height: s(115) }}
        resizeMode="contain"
      />
      <Typography
        variant="title-01"
        weight="semibold"
        className="mt-5 text-center"
        style={{ color: COLORS.text.title.default }}
      >
        {copy.title}
      </Typography>
      <Typography
        variant="body-02-reading"
        className="mt-2 text-center"
        style={{ color: COLORS.text.body.default }}
      >
        {kind === 'no-profile'
          ? '기록을 남길 아이를 먼저 추가해 주세요'
          : kind === 'bookmark'
            ? '다시 보고 싶은 기록을 저장해두면 여기 모여요'
            : `${focusName}의 하루를 자유롭게 작성해보세요\n기록을 공유하면 상담사가 다음 상담에 참고해요`}
      </Typography>

      {copy.cta === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.cta}
          onPress={onPress}
          className="mt-5"
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
        >
          <View
            className="flex-row items-center rounded-full border bg-surface"
            style={{
              columnGap: s(4),
              height: s(52),
              paddingHorizontal: s(20),
              borderColor: COLORS.border.subtle,
              ...SHADOWS.glow,
            }}
          >
            <PencilIcon20 width={20} height={20} />
            <Typography
              variant="body-01"
              weight="medium"
              style={{ color: COLORS.action.primary }}
            >
              {copy.cta}
            </Typography>
          </View>
        </Pressable>
      )}
    </View>
  );
}
