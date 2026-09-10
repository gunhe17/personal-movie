import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * 등장 애니메이션 — 제자리에서 페이드 인 (움직임 없음).
 *
 * 마운트 시 opacity 0 → 1 로 자연스럽게 나타난다. 위에서 떨어지거나 밀려 올라오는
 * 위치 이동 없이 투명도만 변해 차분하게 안착한다. `index` 로 순서를 주면 70ms 씩
 * 지연돼 차례로 등장한다. RN `Animated`(useNativeDriver) 라 가볍다.
 *
 * 사용:
 *   const anim = useFadeIn(0);
 *   <Animated.View style={anim}>...</Animated.View>
 */
export function useFadeIn(index = 0) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      delay: index * 70,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [opacity, index]);

  return { opacity };
}
