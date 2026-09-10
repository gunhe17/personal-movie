/**
 * Toggle 컴포넌트 (on/off 스위치)
 *
 * 디자인 시스템 토글. iOS 스타일 슬라이드 스위치.
 * 컨트롤드(value + onChange) 패턴.
 *
 * 디자인 스펙:
 * - 컨테이너 : 48 × 28, padding 4, rounded-full
 *   - inactive: bg-gray-200
 *   - active  : bg-primary-500 (#256ef4)
 * - 노브     : 20 × 20, white, rounded-full
 * - 트랜지션 : bg 색상 + 노브 위치 동시에 슬라이드 (180ms)
 *
 * @example
 *   const [on, setOn] = useState(false);
 *   <Toggle value={on} onChange={setOn} />
 *
 *   // disabled
 *   <Toggle value={true} onChange={() => {}} disabled />
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
} from 'react-native';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const DURATION_MS = 180;

// 디자인 토큰 (s() 스케일 적용 대상)
const WIDTH = 48;
const HEIGHT = 28;
const PADDING = 4;
const KNOB = 20;
const TRAVEL = WIDTH - KNOB - PADDING * 2; // 20

export interface ToggleProps
  extends Omit<PressableProps, 'children' | 'style' | 'onPress'> {
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export function Toggle({
  value,
  onChange,
  disabled,
  className = '',
  ...rest
}: ToggleProps) {
  // 0 = off, 1 = on. bg 색 보간은 native driver 미지원이라 false 사용.
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.gray[200], COLORS.primary],
  });

  const knobTranslateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, s(TRAVEL)],
  });

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      className={`${disabled ? 'opacity-50' : ''} ${className}`.trim()}
      {...rest}
    >
      <Animated.View
        style={{
          width: s(WIDTH),
          height: s(HEIGHT),
          padding: s(PADDING),
          borderRadius: s(HEIGHT / 2),
          backgroundColor: bgColor,
        }}
      >
        <Animated.View
          style={{
            width: s(KNOB),
            height: s(KNOB),
            borderRadius: s(KNOB / 2),
            backgroundColor: COLORS.white,
            transform: [{ translateX: knobTranslateX }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
