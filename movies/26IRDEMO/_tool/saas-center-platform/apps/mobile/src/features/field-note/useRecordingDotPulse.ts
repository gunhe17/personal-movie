import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * "녹음 중" 표시용 빨간 점 깜빡임 애니메이션 (opacity 1 ↔ 0.3 loop).
 * 컴포넌트는 반환된 Animated.Value를 점의 opacity에 바인딩하면 됨.
 */
export function useRecordingDotPulse(active: boolean = true): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity]);

  return opacity;
}
