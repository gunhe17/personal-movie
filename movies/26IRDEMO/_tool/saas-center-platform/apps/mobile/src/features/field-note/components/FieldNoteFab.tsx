import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOTION } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useFieldNotePlatform } from '../platform/context';
import { useFieldNoteFabBehavior } from '../useFieldNoteFabBehavior';
import { FieldNoteFabMark } from './FieldNoteFabMark';

/**
 * 필드노트 FAB — 항상 화면 우측 하단 고정(드래그 없음).
 * (main) 전역(Stack·Tabs 바깥)에서 렌더되므로 페이지 전환에도 언마운트되지 않고 같은 자리에 유지된다.
 * 위치는 모든 화면에서 동일 — 탭 화면에선 바텀 내비 pill 의 우측 여백(marginRight)에 정확히 겹쳐 정렬.
 * 탭 동작은 녹음 여부와 무관하게 필드노트 홈으로 진입(기존 동작 유지).
 */
export function FieldNoteFab() {
  const fab = useFieldNoteFabBehavior();
  const { navigate } = useFieldNotePlatform();
  const insets = useSafeAreaInsets();

  // 마운트 페이드인 — 첫 등장(또는 필드노트 섹션에서 빠져나올 때)만. 전환마다 다시 돌지 않음.
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: MOTION.duration.normal,
      easing: Easing.bezier(...MOTION.easing.enter),
      useNativeDriver: true,
    }).start();
  }, [appear]);

  // 누름 피드백 — 탭바 버튼(_layout TabButton)과 동일하게: 눌리면 살짝 줄고, 떼면 spring 으로 통통 복귀.
  const scale = useRef(new Animated.Value(1)).current;
  // 중복 진입 방지 락 — 한 제스처에서 한 번만 push. 새 누름(pressIn)마다 초기화.
  const navLock = useRef(false);
  const handlePressIn = () => {
    navLock.current = false;
    Animated.timing(scale, { toValue: 0.9, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };
  // 탭 확정 시: 복귀 모션(onPressOut spring)이 보이도록 한 박자 뒤 전환.
  // 네비게이션을 애니메이션 finished 콜백에 묶지 않는다 — pressOut/press spring 이 서로를
  // 중단시켜 finished=false 가 되면 전환이 누락되던 버그 방지(매번 확실히 동작).
  const handlePress = () => {
    if (navLock.current) return;
    navLock.current = true;
    setTimeout(() => navigate.toFieldNoteHome(), 200);
  };

  // 탭바 pill 과 동일하게 화면 하단 정렬: pill bottom = insets.bottom + 10, 높이 64로 동일.
  const bottom = insets.bottom + s(10);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { right: s(16), bottom, opacity: appear, transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={fab.isActive ? '녹음 시트 열기' : '필드노트 홈 열기'}
      >
        {/* 녹음 중에도 원 모습 유지 — 가운데 막대만 이퀄라이저로 움직인다. */}
        <FieldNoteFabMark active={fab.isActive} paused={fab.isPaused} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    borderRadius: 100,
    // FieldNoteFabMark 이 자체 그림자를 가지므로 여기엔 그림자 없음(활성/비활성 동일 원 형태).
  },
});
