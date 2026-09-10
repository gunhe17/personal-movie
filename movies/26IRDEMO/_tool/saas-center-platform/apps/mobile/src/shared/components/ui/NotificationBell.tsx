import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface NotificationBellProps {
  /** 안 읽은 알림 수. 0 초과면 dot 표시 + 종 흔들림 모션. */
  count?: number;
  onPress: () => void;
  /** 벨 아이콘 색 (헤더 배경에 맞춰). 기본 gray-800. */
  color?: string;
  /** unread dot 의 흰 림 색 — 어두운 헤더면 헤더 배경색을 넘겨 자연스럽게. 기본 white. */
  dotBorderColor?: string;
  size?: number;
}

/**
 * 헤더 알림 벨 — 공용 컴포넌트.
 * 안 읽은 알림(count > 0)이 있으면 실제 종처럼 좌우로 흔들린다 (DS §8.3 아이콘 마이크로 인터랙션).
 * - 진폭이 점점 줄어드는 damped 흔들림(약 0.5초) 한 번 → 5초 쉬고 반복 (unread 남아있는 동안).
 * - 산만하지 않게 간헐적으로만 울린다. 알림을 다 읽으면(count=0) 멈춘다.
 * - 회전 축은 상단(transformOrigin: top) — 매달린 종처럼 윗점을 기준으로 흔들린다.
 * - dot(알림 배지)은 함께 흔들리지 않고 제자리 고정.
 */
export function NotificationBell({
  count = 0,
  onPress,
  color = COLORS.gray[800],
  dotBorderColor = COLORS.white,
  size = 24,
}: NotificationBellProps) {
  const hasUnread = count > 0;
  // -1 ~ 1 정규값 → 좌우 회전각으로 보간. 0 = 정지.
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasUnread) {
      swing.stopAnimation(() => swing.setValue(0));
      return;
    }
    let cancelled = false;
    let restTimer: ReturnType<typeof setTimeout> | undefined;

    const to = (value: number, duration: number) =>
      Animated.timing(swing, {
        toValue: value,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    // 진폭 감쇠: 크게 한 번 → 점점 작게 → 멈춤. 종이 울리고 잦아드는 느낌.
    const ring = Animated.sequence([
      to(-1, 60),
      to(0.78, 110),
      to(-0.58, 100),
      to(0.38, 90),
      to(-0.18, 80),
      to(0, 70),
    ]);

    const loop = () => {
      if (cancelled) return;
      ring.reset();
      ring.start(({ finished }) => {
        if (cancelled || !finished) return;
        restTimer = setTimeout(loop, 5000);
      });
    };
    loop();

    return () => {
      cancelled = true;
      if (restTimer) clearTimeout(restTimer);
      swing.stopAnimation(() => swing.setValue(0));
    };
  }, [hasUnread, swing]);

  const rotate = swing.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-14deg', '14deg'],
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`알림${hasUnread ? `, ${count}개 읽지 않음` : ''}`}
      style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ transformOrigin: 'top center', transform: [{ rotate }] }}>
        <Ionicons name="notifications-outline" size={size} color={color} />
      </Animated.View>
      {hasUnread && (
        <View
          style={{
            position: 'absolute',
            right: s(8),
            top: s(8),
            width: s(8),
            height: s(8),
            borderRadius: s(4),
            backgroundColor: COLORS.negative,
            borderWidth: 1.5,
            borderColor: dotBorderColor,
          }}
        />
      )}
    </Pressable>
  );
}
