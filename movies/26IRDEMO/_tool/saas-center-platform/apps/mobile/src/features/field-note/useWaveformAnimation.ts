import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

interface UseWaveformAnimationParams {
  isRecording: boolean;
  isPaused: boolean;
}

interface UseWaveformAnimationReturn {
  /** REC 점 깜빡임용 opacity (Animated.Value) */
  recOpacity: Animated.Value;
}

/**
 * "REC" 점 blink 애니메이션 전용.
 *
 * 웨이브폼 자체는 WaveformBars 컴포넌트가 자체 imperative 구조로 처리하므로
 * 이 훅은 더 이상 levels 버퍼를 관리하지 않는다.
 */
export function useWaveformAnimation({
  isRecording,
  isPaused,
}: UseWaveformAnimationParams): UseWaveformAnimationReturn {
  const recOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording && !isPaused) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(recOpacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
          Animated.timing(recOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    } else {
      recOpacity.setValue(1);
    }
  }, [isRecording, isPaused, recOpacity]);

  return { recOpacity };
}
