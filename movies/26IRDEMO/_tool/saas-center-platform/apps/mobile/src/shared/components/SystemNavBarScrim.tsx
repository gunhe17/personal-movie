import { useEffect, useSyncExternalStore } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { subscribeDarkNav, isDarkNavActive } from '@/features/field-note/useFieldNoteNavBar';

/**
 * 시스템 내비게이션 바(Android) 영역 스크림.
 *
 * Android 15+ edge-to-edge 에서는 시스템 내비 바가 투명이라, 그 영역(safe area bottom)에
 * 스크롤 콘텐츠가 그대로 비쳐 "선명하게" 보인다. 플로팅 pill 탭바 뒤는 흰 pill 로 가려져
 * 잘 안 보이는데(탭바는 insets.bottom 위에 떠 있음), 그 아래 시스템 내비 영역만 콘텐츠가
 * 선명하면 어색하다.
 *
 * 그래서 시스템 내비 영역(insets.bottom)에 페이지 배경색 틴트를 깐다. 영역 안에서 위→아래로
 * 투명→60% 페이드해 위쪽 경계를 모호하게 만들고(하드라인 방지), 아래는 60% 로 유지해
 * 콘텐츠를 은은히 흐린다(완전히 가리지는 않음).
 *
 * 높이는 insets.bottom 으로 제한 — 탭바 pill 은 그 위(insets.bottom+10)에 떠 있어 침범하지
 * 않는다. FAB·토스트도 더 위라 영향 없다(pointerEvents=none 이라 터치도 통과).
 *
 * - **Android 한정**: iOS 홈 인디케이터는 시스템이 알아서 처리하므로 불필요.
 * - **다크 내비 화면(필드노트)에선 끔**: useFieldNoteNavBar 가 다크 내비를 의도적으로 유지하는
 *   몰입 화면이라, 라이트 스크림을 덮으면 안 된다.
 *   ⚠️ 끄고 켤 때 mount/unmount 로 하드 컷하면, 필드노트→탭 전환 중 시스템 내비 영역이
 *   다크로 잠깐 보였다가 라이트 틴트가 툭 덮이며 "검정 쉐도우가 생겼다 사라지는" 플래시가 된다.
 *   그래서 항상 마운트해두고 **opacity 크로스페이드**로 부드럽게 전환한다(다크일 때 0, 라이트일 때 1).
 */

// 라이트 앱 페이지 배경(surface/page, #F7F8F8)을 60% 투명도로. 콘텐츠를 은은히 가리되
// 완전히 숨기지 않는다.
const TINT = 'rgba(247,248,248,0.6)';

// 다크↔라이트 내비 전환 시 틴트가 부드럽게 나타나고 사라지는 시간.
// 화면 슬라이드(250ms)와 비슷하게 맞춰 하드 컷 없이 자연스럽게 핸드오프.
const FADE_MS = 240;

export function SystemNavBarScrim() {
  const insets = useSafeAreaInsets();
  // 다크 내비(필드노트 몰입)일 땐 틴트를 0 으로 페이드아웃 — 기존 다크 내비를 그대로 둠.
  const darkNav = useSyncExternalStore(subscribeDarkNav, isDarkNavActive, isDarkNavActive);

  // 라이트 화면 = 1(틴트 보임), 다크 화면 = 0(틴트 숨김). 토글 시 크로스페이드.
  const opacity = useSharedValue(darkNav ? 0 : 1);
  useEffect(() => {
    opacity.value = withTiming(darkNav ? 0 : 1, {
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [darkNav, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (Platform.OS !== 'android' || insets.bottom <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom },
        animatedStyle,
      ]}
    >
      {/* 영역 안에서 위쪽 60% 구간은 투명→60% 페이드(경계 모호), 아래 40% 는 60% 유지. */}
      <LinearGradient
        colors={['rgba(247,248,248,0)', TINT, TINT]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
