/**
 * 공용 Chip(필터 칩) — 피그마 Chip 셋(66:8) 구현.
 *
 * h34(r17) px14 border1 gap4 · 라벨 14/16 Medium.
 * default = surface+gray/200 테두리+body 텍스트 / selected = 액센트 틴트+액센트 테두리·텍스트.
 * 액센트는 피그마 시안(블루) 기준 — 그린/블루 확정 시 button.primary와 함께 교체.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 16px 아이콘 슬롯 (피그마 인스턴스 스왑 자리) */
  icon?: React.ReactNode;
}

const BG_DEFAULT = COLORS.surface;
const BG_SELECTED = COLORS.button.secondary.bg;
const BORDER_DEFAULT = COLORS.gray[200];
const BORDER_SELECTED = COLORS.button.primary.bg;
const TEXT_DEFAULT = COLORS.text.body.default;
const TEXT_SELECTED = COLORS.button.primary.bg;
const DURATION = 150;

export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: DURATION }),
    [selected],
  );

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [BG_DEFAULT, BG_SELECTED]),
    borderColor: interpolateColor(progress.value, [0, 1], [BORDER_DEFAULT, BORDER_SELECTED]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          {
            height: 34,
            borderRadius: 17,
            borderWidth: 1,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          containerStyle,
        ]}
      >
        {icon ? <View style={{ width: 16, height: 16, marginRight: 4 }}>{icon}</View> : null}
        <Typography
          weight="medium"
          style={{
            fontSize: s(14),
            lineHeight: s(16),
            color: selected ? TEXT_SELECTED : TEXT_DEFAULT,
          }}
        >
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}
