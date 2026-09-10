import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui';
import { s } from '@/shared/utils/scale';
import { useTabBarBottomPadding } from '@/shared/hooks/useTabBarClearance';
import { useAndroidBackExit } from '@/shared/hooks/useAndroidBackExit';
import CareboardIcon24 from '@assets/icons/24/CareboardIcon24.svg';

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IoniconName, inactive: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

/**
 * 케어보드 — 시안 전용 벡터(Menu_Icon 174:1364). Ionicons에 대응 글리프가 없다.
 * 시안도 활성/비활성을 색으로만 가르므로 fill=currentColor로 색만 받는다.
 */
function careboardIcon({ color }: { color: string }) {
  return <CareboardIcon24 width={24} height={24} color={color} />;
}

/**
 * 탭 버튼 — 마이크로 애니메이션 (전문가앱 구조 포팅).
 * 비활성→활성: scale 팝(1→1.18→1 spring) / 누름: press 피드백(0.9→1).
 */
function TabButton({
  focused,
  label,
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasFocused = useRef(focused);

  useEffect(() => {
    if (focused && !wasFocused.current) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    wasFocused.current = focused;
  }, [focused, scale]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
      }}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: s(6) }}
    >
      <Animated.View style={{ alignItems: 'center', gap: s(4), transform: [{ scale }] }}>
        {icon}
        <Typography
          variant="label-02"
          weight={focused ? 'medium' : 'regular'}
          style={{ color: COLORS.text.title.default }}
        >
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

/**
 * 플로팅 라운드 바텀 탭바 — 피그마 Menu(179:1414) · 전문가앱 FloatingTabBar 구조 포팅.
 *
 * - 투명 absolute 오버레이 + 흰 pill(r100, shadow/floating). 화면 배경이 pill 주위로 비친다.
 * - 하단 여백 = useTabBarBottomPadding() — 시스템 내비 인셋 바로 위에 붙되(간격 0),
 *   인셋 0 기기에선 최소 8 확보. iOS 홈 인디케이터·Android 시스템 바와 겹치지 않는다.
 * - 오버레이라 각 탭 화면 스크롤은 useTabBarClearance()만큼 하단 패딩을 더한다.
 */
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const bottomPadding = useTabBarBottomPadding();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        paddingHorizontal: s(16),
        paddingTop: s(8),
        paddingBottom: bottomPadding,
      }}
    >
      {/* 그림자는 바깥 View가 — pill 본체는 overflow:hidden이라 그림자를 잘라먹는다 */}
      <View
        style={{
          borderRadius: 100,
          // 피그마 shadow/floating(0 −1 15.8 @8%) — boxShadow는 iOS·Android 모두 사방으로 퍼짐
          boxShadow: '0px -1px 15.8px 0px rgba(0, 11, 20, 0.08)',
        }}
      >
        {/*
          시안 Menu(179:1414) = bg rgba(255,255,255,0.8) + backdrop-blur 10 + 흰 테두리 1.
          backdrop blur는 생략한다 — expo-blur는 네이티브 모듈이라 커밋된 프리빌드
          (android/)와 배포된 dev client를 다시 빌드해야 하고, 위에 덮이는 80% 흰
          배경 탓에 실제로 비치는 블러도 거의 없다. profile-detail의 선례와 동일.
        */}
        <View
          style={{
            flexDirection: 'row',
            height: s(68),
            borderRadius: 100,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: COLORS.white,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: s(8),
          }}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];

            // 프로덕션 빌드에서 (tabs) 하위 비-라우트 colocation 파일(_components/* 등)이
            // 라우트로 잠입할 수 있다 — <Tabs.Screen> 선언이 없는 라우트는 tabBarIcon이
            // 없으므로 걸러낸다 (전문가앱과 동일 방어).
            if (!options.tabBarIcon) return null;

            const focused = state.index === index;
            const iconColor = focused ? COLORS.gray[800] : COLORS.gray[400];
            const label = typeof options.title === 'string' ? options.title : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabButton
                key={route.key}
                focused={focused}
                label={label}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                icon={options.tabBarIcon?.({
                  focused,
                  color: iconColor,
                  size: 24,
                })}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  useAndroidBackExit();

  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => <FloatingTabBar {...props} />}
      // ⚠️ 탭 animation('shift'/'fade') 금지 — react-native-screens detach와 레이스로
      // 간헐적 빈 화면이 남는 미해결 버그(react-navigation#12755, expo#39514).
      // 전문가앱과 동일하게 무애니메이션이 안정 기준선.
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '홈', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: '일정', tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: '기록', tabBarIcon: tabIcon('reader', 'reader-outline') }}
      />
      {/* 라우트명은 activity 유지 — 시안 라벨만 '케어보드'(화면 구조 개편은 별도 기획) */}
      <Tabs.Screen
        name="activity"
        options={{ title: '케어보드', tabBarIcon: careboardIcon }}
      />
      <Tabs.Screen
        name="my"
        options={{ title: '마이', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
