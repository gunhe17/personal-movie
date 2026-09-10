/**
 * 공용 Toggle(스위치) — 피그마 Toggle 셋(58:8) 구현.
 *
 * 트랙 48×28(r14) · knob 20 흰 원(+그림자) · off=gray/300 → on=액센트.
 * 액센트는 피그마 시안(블루) 기준 — 그린/블루 확정 시 button.primary와 함께 교체.
 */
import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/shared/constants/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const TRACK_OFF = COLORS.gray[300];
const TRACK_ON = COLORS.button.primary.bg;
// knob 이동 거리: left 4 → 24
const KNOB_TRAVEL = 20;
const DURATION = 180;

export function Toggle({ value, onValueChange, disabled = false }: ToggleProps) {
  const progress = useDerivedValue(
    () => withTiming(value ? 1 : 0, { duration: DURATION }),
    [value],
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [TRACK_OFF, TRACK_ON]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * KNOB_TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={[{ width: 48, height: 28, borderRadius: 14, justifyContent: 'center' }, trackStyle]}
      >
        <Animated.View
          style={[
            {
              width: 20,
              height: 20,
              borderRadius: 10,
              marginLeft: 4,
              backgroundColor: COLORS.white,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.15,
              shadowRadius: 2,
              elevation: 2,
            },
            knobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
