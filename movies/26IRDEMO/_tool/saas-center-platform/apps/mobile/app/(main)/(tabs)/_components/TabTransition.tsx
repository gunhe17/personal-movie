import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "@/shared/constants/theme";

/**
 * 탭 전환 시 콘텐츠가 살짝 커지며 떠오르는 "뿅" 진입 애니메이션.
 *
 * bottom-tabs 는 화면을 언마운트하지 않고 유지하므로, mount 기반 entering
 * 애니메이션은 첫 진입에만 동작한다. 따라서 `useFocusEffect` 로 포커스를
 * 얻을 때마다 재생하고, blur 시 즉시 초기값으로 되돌려(화면이 가려진 상태)
 * 다음 포커스에서 깜빡임 없이 0에서 시작하도록 한다.
 *
 * 모션 값은 디자인 시스템 §8.1 토큰을 따른다 (duration.normal + easing.enter).
 */
const FROM_SCALE = 0.96;
const ENTER_EASING = Easing.bezier(...MOTION.easing.enter);

type TabTransitionProps = {
  children: React.ReactNode;
};

export function TabTransition({ children }: TabTransitionProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(FROM_SCALE);

  useFocusEffect(
    useCallback(() => {
      const config = { duration: MOTION.duration.normal, easing: ENTER_EASING };
      opacity.value = withTiming(1, config);
      scale.value = withTiming(1, config);

      return () => {
        // blur 시점(화면이 가려진 상태)에 초기값으로 리셋 → 재진입 시 0부터 시작
        opacity.value = 0;
        scale.value = FROM_SCALE;
      };
    }, [opacity, scale]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>;
}

/**
 * 탭 스크린 default export 를 감싸 "뿅" 진입 애니메이션을 입힌다.
 * 사용: `export default withTabTransition(ScheduleScreen);`
 */
export function withTabTransition<P extends object>(Screen: React.ComponentType<P>) {
  return function TabTransitionScreen(props: P) {
    return (
      <TabTransition>
        <Screen {...props} />
      </TabTransition>
    );
  };
}
