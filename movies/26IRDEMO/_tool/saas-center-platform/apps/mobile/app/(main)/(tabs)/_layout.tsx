import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRole } from '@/features/center';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon, type IconName } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 탭 버튼 — 마이크로 애니메이션 포함 (DS §8.3).
 * - 비활성 → 활성: scale 팝 (1 → 1.18 → 1, spring) — 탭 전환에 작은 즐거움.
 * - 누름: 살짝 눌리는 press 피드백 (0.9 → 1).
 * 색 전환은 즉시(아이콘/라벨 prop). scale 만 애니메이트(useNativeDriver).
 */
function TabButton({
  focused,
  label,
  labelColor,
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  label: string;
  labelColor: string;
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
        Animated.timing(scale, { toValue: 1.18, duration: 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    wasFocused.current = focused;
  }, [focused, scale]);

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.9, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: s(6) }}
    >
      <Animated.View style={{ alignItems: 'center', gap: s(3), transform: [{ scale }] }}>
        {icon}
        <Typography variant="caption-01" weight={focused ? 'medium' : 'regular'} style={{ color: labelColor }}>
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

/**
 * 플로팅 라운드 바텀 탭바 — 화면 위에 떠 있는 흰 pill (토스 류).
 * 탭 구성·아이콘·활성 색 로직은 기존 그대로 두고, 컨테이너 모양만 개편한다.
 * - **투명 absolute 오버레이**: pill 이 화면 너비를 다 안 차지하므로, 컨테이너를 투명하게 두고
 *   화면 자체 배경(홈 그라데이션 등)이 pill 주위로 그대로 비치게 한다.
 * - 오버레이라 스크롤 콘텐츠가 뒤로 가릴 수 있어, 각 탭 화면은 `useTabBarClearance()` 만큼
 *   스크롤 하단 패딩을 더해 마지막 항목이 가리지 않게 한다.
 */
function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
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
        paddingBottom: insets.bottom + s(10),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          height: s(64),
          borderRadius: s(100),
          backgroundColor: COLORS.surface,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: s(8),
          // 우측에 전역 필드노트 FAB(64 + gap 10) 자리 확보 — pill 이 FAB 밑으로 들어가지 않게.
          marginRight: s(74),
          // boxShadow: offset/blur/spread/color (RN 0.81+ 신아키텍처) — iOS·Android 모두 양옆까지
          // 동일하게 그림자가 퍼진다. spread(4px)로 좌우 번짐 확보 (Android elevation은 하단 위주라 미사용).
          boxShadow: '0px 2px 12px 4px rgba(0, 0, 0, 0.06)',
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          // 실제 탭으로 선언된 라우트만 렌더한다.
          // expo-router 는 프로덕션 빌드에서 app/(tabs) 하위의 비-라우트 colocation
          // 파일(_components/* 등)까지 라우트로 등록한다 — "default export 없는 파일은
          // 제외" 필터가 dev(NODE_ENV==='development')에서만 동작하기 때문.
          // 이 잠입 라우트들은 <Tabs.Screen> 선언이 없어 tabBarIcon 이 없으므로 걸러낸다.
          if (!options.tabBarIcon) return null;

          // dev 전용 실험실 탭은 프로덕션에서 숨김 (href:null 보강).
          if (route.name === 'lab' && !__DEV__) return null;
          const focused = state.index === index;
          // 활성 탭 — 아이콘·라벨 모두 #2D333B(gray-800)
          const iconColor = focused ? COLORS.gray[800] : COLORS.gray[400];
          const labelColor = focused ? COLORS.gray[800] : COLORS.gray[400];
          const label =
            typeof options.title === 'string' ? options.title : route.name;

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
              labelColor={labelColor}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              icon={options.tabBarIcon?.({ focused, color: iconColor, size: s(24) })}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
      {/* 필드노트 FAB 는 (main) 전역(FieldNoteFab)에 항상 떠 있다 — 탭바 우측 marginRight 자리에
          정확히 겹쳐 정렬되며, 페이지 전환에도 사라지지 않는다. */}
    </View>
  );
}

export default function TabLayout() {
  const { hasFullAccess } = useRole();
  const insets = useSafeAreaInsets();

  const TAB_CONFIG: Array<{
    name: string;
    title: string;
    icon: IconName | { ionicon: keyof typeof Ionicons.glyphMap };
    hidden?: boolean;
  }> = [
    { name: 'index', title: '홈', icon: 'home' },
    { name: 'schedule', title: '일정', icon: 'calendar' },
    { name: 'clients', title: '내담자', icon: 'client' },
    {
      name: 'lab',
      title: '실험실',
      icon: { ionicon: 'flask-outline' },
      hidden: !__DEV__,
    },
    { name: 'more', title: '내 정보', icon: 'my-info' },
  ];

  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: TYPOGRAPHY.letterSpacing,
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: tab.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) =>
              typeof tab.icon === 'object' ? (
                <Ionicons name={tab.icon.ionicon} size={size} color={color} />
              ) : (
                <Icon name={tab.icon} size={size} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}
