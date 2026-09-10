import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { MOTION } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useFieldNotePlatform } from '../platform/context';
import { useFieldNoteFabBehavior } from '../useFieldNoteFabBehavior';
import { ActiveFabPill } from './ActiveFabPill';
import { FieldNoteFabMark } from './FieldNoteFabMark';
import { useFabPositionStore } from '../fabPositionStore';

const SCREEN_PADDING = s(12);
/** 드래그 거리가 이 값 이상이면 tap 이 아니라 drag 로 인식 */
const TAP_VS_DRAG_THRESHOLD = 6;
/** 하단 탭바 회피 높이 — 플로팅 라운드 탭바(pill + 상하 패딩) 기준 (Tabs 안의 페이지에서만) */
const TAB_BAR_HEIGHT = s(64);

interface DraggableFabProps {
  topPadding?: number;
}

/**
 * 사용자가 자유롭게 드래그할 수 있는 필드노트 FAB.
 * - 드래그 종료 시 손 뗀 위치 그대로 유지 (snap 없음)
 * - 화면 범위 벗어나면 부드럽게 clamp 보정
 * - 위치는 AsyncStorage 에 영속 저장 → 앱 재시작 후 같은 위치
 * - 드래그 거리가 threshold 미만이면 tap 으로 처리
 *
 * RN 표준 PanResponder + Animated.ValueXY + offset 패턴 — setOffset/flattenOffset 으로
 * "지금까지 이동한 누적 위치" 와 "현재 제스처 변화량" 을 분리해서 jitter 없이 처리.
 */
export function DraggableFab({ topPadding }: DraggableFabProps) {
  const fab = useFieldNoteFabBehavior();
  const { navigate } = useFieldNotePlatform();
  const insets = useSafeAreaInsets();
  const screen = Dimensions.get('window');

  // 탭 동작: 녹음 여부와 무관하게 필드노트 홈(공간)으로 진입.
  // 녹음 중이라도 시트로 직행하지 않는다 — 홈에서 진행 중 녹음은 가운데 마이크(라이브)로
  // 표현되고, 거기서 목록·노트로 이동하거나 마이크를 눌러 시트를 다시 펼칠 수 있다.
  // (시트 직행은 홈·목록에 갈 수 없는 '덫'이 되어 제거.)
  const handleTap = useCallback(() => {
    navigate.toFieldNoteHome();
  }, [navigate]);
  // 현재 라우트가 (tabs) 안인지 — 탭바가 보이면 그 영역만큼 더 위로 막아야 함
  const segments = useSegments();
  const isInTabs = useMemo(
    () => segments.some((seg) => seg === '(tabs)'),
    [segments],
  );

  const storeX = useFabPositionStore((s) => s.x);
  const storeY = useFabPositionStore((s) => s.y);
  const isHydrated = useFabPositionStore((s) => s.isHydrated);
  const setPosition = useFabPositionStore((s) => s.setPosition);

  const minX = SCREEN_PADDING;
  const minY = (topPadding ?? insets.top) + s(8);
  // FAB 폭 측정 후 정확한 maxX, maxY 계산
  const [fabSize, setFabSize] = useState({ width: 0, height: 0 });
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== fabSize.width || height !== fabSize.height) {
      setFabSize({ width, height });
    }
  };
  // 페이지별 동적 하단 여백 — 탭바 있는 페이지는 탭바 + SafeArea, 상세 페이지는 SafeArea 만.
  // 탭바 없는 페이지에선 화면 거의 끝까지 내려갈 수 있음.
  const bottomReserve =
    insets.bottom + s(12) + (isInTabs ? TAB_BAR_HEIGHT : 0);
  const maxX = screen.width - fabSize.width - SCREEN_PADDING;
  const maxY = screen.height - fabSize.height - bottomReserve;

  // RN 표준 패턴: Animated.ValueXY + offset/value 분리.
  // pan = offset(누적 위치) + value(현재 제스처 변화).
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // press 시각 피드백
  const pressScale = useRef(new Animated.Value(1)).current;
  // 마운트 페이드인 — _layout 이 라우트 전환 후 마운트하므로, 도착 화면에서 부드럽게 등장.
  // pan transform 이 non-native 라 같은 노드의 opacity 도 non-native 로 맞춘다.
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: MOTION.duration.normal,
      easing: Easing.bezier(...MOTION.easing.enter),
      useNativeDriver: false,
    }).start();
  }, [appear]);

  // store hydration + fabSize 측정 후 초기 위치 설정
  useEffect(() => {
    if (!isHydrated || fabSize.width === 0) return;
    // 첫 진입(sentinel) 이면 우측 하단 기본 위치 (탭바 영역 회피)
    const initialX =
      storeX >= 0 ? storeX : screen.width - fabSize.width - SCREEN_PADDING;
    const initialY =
      storeY >= 0 ? storeY : screen.height - fabSize.height - bottomReserve;
    const clampedX = Math.min(Math.max(initialX, minX), maxX);
    const clampedY = Math.min(Math.max(initialY, minY), maxY);
    pan.setOffset({ x: clampedX, y: clampedY });
    pan.setValue({ x: 0, y: 0 });
    // sentinel 이었으면 계산된 기본 위치를 store 에 저장
    if (storeX < 0 || storeY < 0) {
      setPosition(clampedX, clampedY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, fabSize.width, fabSize.height]);

  // 페이지 전환으로 maxY 가 줄어들었을 때(탭바 있는 페이지 진입 등) FAB 이 회피 영역에
  // 가려지지 않도록 자동 보정. spring 으로 부드럽게 위로 이동.
  useEffect(() => {
    if (!isHydrated || fabSize.height === 0) return;
    // _offset 은 RN Animated 의 internal 필드지만 PanResponder 패턴에서 표준
    const offX = (pan.x as unknown as { _offset: number })._offset;
    const offY = (pan.y as unknown as { _offset: number })._offset;
    if (offY > maxY) {
      const targetY = maxY;
      Animated.spring(pan, {
        toValue: { x: 0, y: targetY - offY }, // offset 유지, value 만 보정
        damping: 18,
        stiffness: 220,
        useNativeDriver: false,
      }).start(() => {
        // 보정 후 offset 평탄화 — 다음 드래그 baseline 정확
        pan.flattenOffset();
        pan.setOffset({ x: offX, y: targetY });
        pan.setValue({ x: 0, y: 0 });
        setPosition(offX, targetY);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          // press scale down
          Animated.timing(pressScale, {
            toValue: 0.92,
            duration: 100,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: (_, g) => {
          // press scale 복귀
          Animated.spring(pressScale, {
            toValue: 1,
            damping: 14,
            stiffness: 220,
            useNativeDriver: false,
          }).start();

          const moved = Math.abs(g.dx) + Math.abs(g.dy);
          if (moved < TAP_VS_DRAG_THRESHOLD) {
            // tap — value 원복 (offset 기준점 이동 없음)
            pan.setValue({ x: 0, y: 0 });
            handleTap();
            return;
          }

          // 누적 offset 에 현재 value 를 합쳐 절대 위치로 평탄화
          pan.flattenOffset();
          // @ts-expect-error — Animated.Value._value 는 internal 하지만 안정적
          const x = pan.x._value as number;
          // @ts-expect-error
          const y = pan.y._value as number;
          // 화면 범위 clamp + 살짝 어긋난 경우 spring 보정
          const clampedX = Math.min(Math.max(x, minX), maxX);
          const clampedY = Math.min(Math.max(y, minY), maxY);
          if (Math.abs(clampedX - x) > 0.5 || Math.abs(clampedY - y) > 0.5) {
            Animated.spring(pan, {
              toValue: { x: clampedX, y: clampedY },
              damping: 18,
              stiffness: 220,
              useNativeDriver: false,
            }).start();
          }
          // 다음 드래그 baseline 을 위해 offset 재설정
          pan.setOffset({ x: clampedX, y: clampedY });
          pan.setValue({ x: 0, y: 0 });
          setPosition(clampedX, clampedY);
        },
        onPanResponderTerminate: () => {
          pan.flattenOffset();
          // @ts-expect-error
          const x = pan.x._value as number;
          // @ts-expect-error
          const y = pan.y._value as number;
          pan.setOffset({ x, y });
          pan.setValue({ x: 0, y: 0 });
          Animated.timing(pressScale, {
            toValue: 1,
            duration: 100,
            useNativeDriver: false,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minX, minY, maxX, maxY, handleTap],
  );

  return (
    <>
      <Animated.View
        onLayout={handleLayout}
        accessibilityLabel={fab.isActive ? '녹음 시트 열기' : '필드노트 홈 열기'}
        accessibilityRole="button"
        style={[
          styles.fabWrap,
          fab.isActive && styles.fabWrapActive,
          {
            opacity: appear,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: pressScale },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {fab.isActive ? <ActiveFabPill /> : <FieldNoteFabMark />}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 100,
    // 비활성(FieldNoteFabMark)은 자체 그림자를 가지므로 여기엔 그림자 없음(이중 방지).
  },
  fabWrapActive: {
    shadowColor: '#5B12FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
});
