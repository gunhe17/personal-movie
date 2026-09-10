/**
 * 기록 작성 플로팅 버튼 — 시안 793:7573.
 *
 * h52 pill(흰 배경 + border/subtle 테두리 + 틸 글로우)에 연필 20 + "작성하기".
 * 탭바 pill(68) 위로 12 띄워 띄운다 — 기록이 하나라도 있을 때만 쓴다(빈 화면은
 * RecordEmptyState가 자기 CTA를 갖는다).
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '@/shared/components/ui';
import { COLORS, SHADOWS } from '@/shared/constants/theme';
import { useTabBarBottomPadding } from '@/shared/hooks/useTabBarClearance';
import { s } from '@/shared/utils/scale';
import PencilIcon20 from '@assets/icons/20/PencilIcon20.svg';

/** 탭바 pill 높이(_layout.tsx와 같은 값) + 시안의 12 간격 */
const TAB_PILL_HEIGHT = 68;
const GAP_ABOVE_TAB_BAR = 12;

export function RecordWriteFab({ onPress }: { onPress: () => void }) {
  const bottomPadding = useTabBarBottomPadding();
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.04 }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomPadding + s(TAB_PILL_HEIGHT + GAP_ABOVE_TAB_BAR),
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="기록 작성하기"
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 140 });
        }}
      >
        <Animated.View
          style={[
            {
              height: s(52),
              paddingHorizontal: s(20),
              columnGap: s(4),
              borderRadius: s(26),
              borderWidth: 1,
              borderColor: COLORS.border.subtle,
              backgroundColor: COLORS.surface,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              ...SHADOWS.glow,
            },
            style,
          ]}
        >
          <PencilIcon20 width={s(20)} height={s(20)} />
          <Typography
            variant="body-01"
            weight="medium"
            style={{ color: COLORS.action.primary }}
          >
            작성하기
          </Typography>
        </Animated.View>
      </Pressable>
    </View>
  );
}
