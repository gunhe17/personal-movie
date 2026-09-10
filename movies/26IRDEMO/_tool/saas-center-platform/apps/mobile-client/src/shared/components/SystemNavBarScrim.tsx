import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TAB_BAR_BOTTOM_GAP } from '@/shared/hooks/useTabBarClearance';
import { s } from '@/shared/utils/scale';

/**
 * 시스템 내비게이션 바(Android) 영역 스크림 — 전문가앱 구조 포팅(다크 내비 크로스페이드 제외).
 *
 * Android 15+ edge-to-edge 에서는 시스템 내비 바가 투명이라, 그 영역(safe area bottom)에
 * 스크롤 콘텐츠가 그대로 비쳐 선명하게 보인다. 플로팅 pill 탭바는 그 위(insets.bottom+10)에
 * 떠 있어 가려지지 않지만, 그 아래 시스템 내비 영역만 콘텐츠가 선명하면 어색하다.
 *
 * 그래서 시스템 내비 영역(insets.bottom)에 페이지 배경색(bg/base) 틴트를 깐다.
 * 위→아래 투명→60% 페이드로 위 경계를 모호하게 만들고, 아래는 60%를 유지해
 * 콘텐츠를 은은히 흐린다(완전히 가리지는 않음). pointerEvents=none — 터치 통과.
 *
 * iOS 홈 인디케이터는 시스템이 알아서 처리하므로 Android 한정.
 */

// 페이지 배경(bg/base, gray/50 #F5F7F8)을 60% 투명도로.
const TINT = 'rgba(245,247,248,0.6)';

export function SystemNavBarScrim() {
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'android' || insets.bottom <= 0) return null;

  // 시스템 내비 영역 + 탭바 pill 하단 간격까지 덮는다 — 간격 띠에만 콘텐츠가
  // 선명하게 비치는 구간이 남지 않게. 확장분의 최상단은 그라데이션상 투명이라
  // pill 밑단을 침범해도 시각적 영향 없음.
  const height = insets.bottom + s(TAB_BAR_BOTTOM_GAP);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
    >
      {/* 위쪽 60% 구간은 투명→60% 페이드(경계 모호), 아래 40%는 60% 유지 */}
      <LinearGradient
        colors={['rgba(245,247,248,0)', TINT, TINT]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
