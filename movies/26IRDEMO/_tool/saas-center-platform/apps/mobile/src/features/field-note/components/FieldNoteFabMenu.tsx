import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const SCREEN_PADDING = s(12);
const MENU_WIDTH = s(168);
const ITEM_H = s(48);
const MENU_PAD_V = s(6);
const GAP = s(10);
const MENU_HEIGHT = ITEM_H * 2 + MENU_PAD_V * 2 + StyleSheet.hairlineWidth;

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FieldNoteFabMenuProps {
  visible: boolean;
  /** FAB 의 resting 위치/크기. 메뉴는 이 좌표를 기준으로 위/아래·좌/우 적응. */
  anchor: Anchor;
  onRecord: () => void;
  onOpenList: () => void;
  onClose: () => void;
}

/**
 * FAB 탭 시 뜨는 2버튼 미니메뉴 (녹음하기 / 목록보기).
 *
 * - FAB 가 화면 아래쪽이면 위로, 위쪽이면 아래로 펼친다.
 * - FAB 가 우측이면 우측 정렬, 좌측이면 좌측 정렬.
 * - 바깥(scrim) 탭으로 닫힘.
 * - 모션은 디자인 시스템 §8 마이크로인터랙션(빠른 fade+scale)을 따른다. 바텀시트(500ms)와 다름.
 */
export function FieldNoteFabMenu({
  visible,
  anchor,
  onRecord,
  onOpenList,
  onClose,
}: FieldNoteFabMenuProps) {
  const insets = useSafeAreaInsets();
  const screen = Dimensions.get('window');
  const anim = useRef(new Animated.Value(0)).current;
  // 퇴장 애니메이션 동안 마운트 유지를 위한 내부 상태
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        damping: 16,
        stiffness: 240,
        mass: 0.6,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  // 방향 결정 — FAB 중심이 화면 절반보다 아래/우측인지로 판단
  const openUp = anchor.y + anchor.height / 2 > screen.height / 2;
  const alignRight = anchor.x + anchor.width / 2 > screen.width / 2;

  const rawTop = openUp
    ? anchor.y - MENU_HEIGHT - GAP
    : anchor.y + anchor.height + GAP;
  const rawLeft = alignRight
    ? anchor.x + anchor.width - MENU_WIDTH
    : anchor.x;

  const top = Math.min(
    Math.max(rawTop, insets.top + s(8)),
    screen.height - MENU_HEIGHT - insets.bottom - s(8),
  );
  const left = Math.min(
    Math.max(rawLeft, SCREEN_PADDING),
    screen.width - MENU_WIDTH - SCREEN_PADDING,
  );

  // 펼쳐지는 방향에서 살짝 솟아오르는 느낌
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [openUp ? s(8) : s(-8), 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="메뉴 닫기"
      />
      <Animated.View
        style={[
          styles.menu,
          {
            top,
            left,
            width: MENU_WIDTH,
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }, { translateY }],
          },
        ]}
      >
        <Pressable
          style={styles.item}
          onPress={onRecord}
          accessibilityRole="button"
          accessibilityLabel="녹음하기"
        >
          <Ionicons name="mic" size={s(20)} color={COLORS.fieldnote} />
          <Typography variant="body-02" weight="medium" className="text-gray-900">
            녹음하기
          </Typography>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          style={styles.item}
          onPress={onOpenList}
          accessibilityRole="button"
          accessibilityLabel="목록보기"
        >
          <Ionicons name="list" size={s(20)} color={COLORS.gray[600]} />
          <Typography variant="body-02" weight="medium" className="text-gray-900">
            목록보기
          </Typography>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    backgroundColor: COLORS.surface,
    borderRadius: s(14),
    paddingVertical: MENU_PAD_V,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  item: {
    height: ITEM_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingHorizontal: s(16),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray[100],
    marginHorizontal: s(12),
  },
});
