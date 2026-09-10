/**
 * 공용 Checkbox — 피그마 Checkbox 셋(58:16) 구현. 상태 3종: on · off · disabled.
 *
 * 터치영역 28×28 · 박스 20(r6) · on=액센트 채움+흰 체크 · off=gray/300 테두리
 * disabled=gray/50 채움+gray/200 테두리. 체크 패스는 피그마 export 벡터 그대로.
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
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/shared/constants/theme';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const BOX_OFF_BORDER = COLORS.gray[300];
const BOX_ON = COLORS.button.primary.bg;
const BOX_OFF_BG = 'rgba(255,255,255,0)';
const DURATION = 150;

export function Checkbox({ checked, onChange, disabled = false }: CheckboxProps) {
  const progress = useDerivedValue(
    () => withTiming(checked ? 1 : 0, { duration: DURATION }),
    [checked],
  );

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [BOX_OFF_BG, BOX_ON]),
    borderColor: interpolateColor(progress.value, [0, 1], [BOX_OFF_BORDER, BOX_ON]),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      className="h-7 w-7 items-center justify-center"
    >
      {disabled ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            borderWidth: 1.5,
            backgroundColor: COLORS.gray[50],
            borderColor: COLORS.gray[200],
          }}
        />
      ) : (
        <Animated.View
          style={[
            {
              width: 20,
              height: 20,
              borderRadius: 6,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
            },
            boxStyle,
          ]}
        >
          <Animated.View style={checkStyle}>
            <Svg width={12.5} height={10} viewBox="0 0 12.5 10" fill="none">
              <Path
                d="M1 5.00003L5 9.00003L11.5 1.00003"
                stroke={COLORS.white}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}
