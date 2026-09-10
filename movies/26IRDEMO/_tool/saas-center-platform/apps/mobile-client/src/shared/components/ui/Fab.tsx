/**
 * 공용 FAB — 피그마 Fab 셋(65:7) 구현.
 *
 * 원형 56(r28) / extended(라벨 있으면)=h56 pl20 pr22 gap6 · 라벨 16/20 SemiBold.
 * 그림자 = 피그마 shadow/floating(0 −1 15.8 #000B14 8%) 인라인 적용
 * (SHADOWS 토큰 갱신은 엘리베이션 정본 확정까지 보류 상태라 여기만 사용).
 * 액센트는 피그마 시안(블루) 기준 — 그린/블루 확정 시 button.primary와 함께 교체.
 */
import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface FabProps {
  onPress: () => void;
  /** 24px 아이콘 슬롯 (피그마 인스턴스 스왑 자리) */
  icon: React.ReactNode;
  /** 있으면 extended형(아이콘+라벨), 없으면 원형 */
  label?: string;
  style?: ViewStyle;
}

const FLOATING_SHADOW = {
  shadowColor: '#000B14',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.08,
  shadowRadius: 7.9,
  elevation: 6,
} as const;

export function Fab({ onPress, icon, label, style }: FabProps) {
  const pressed = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 100 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 100 });
      }}
    >
      <Animated.View
        style={[
          {
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.button.primary.bg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            ...(label ? { paddingLeft: 20, paddingRight: 22 } : { width: 56 }),
            ...FLOATING_SHADOW,
          },
          pressStyle,
          style,
        ]}
      >
        <View style={{ width: 24, height: 24 }}>{icon}</View>
        {label ? (
          <Typography
            weight="semibold"
            style={{
              marginLeft: 6,
              fontSize: s(16),
              lineHeight: s(20),
              color: COLORS.white,
            }}
          >
            {label}
          </Typography>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
