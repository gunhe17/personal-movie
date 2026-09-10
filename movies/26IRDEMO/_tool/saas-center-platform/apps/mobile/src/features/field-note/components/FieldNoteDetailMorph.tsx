import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { FieldNoteDetailView } from './FieldNoteDetailView';

const FND = COLORS.fieldnoteDark;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ENTER_MS = 440;
const EXIT_MS = 300;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldNoteDetailMorphProps {
  fieldNoteId: string;
  /** 탭한 카드의 화면 사각형(measureInWindow) — morph 출발점 */
  rect: Rect;
  /** 역재생 완료 후 호출 — 부모가 오버레이 언마운트 */
  onClosed: () => void;
}

/**
 * 목록 카드 → 풀스크린 상세로 커지는 container transform 오버레이.
 *
 * 라우트 이동이 아니라 목록 화면 안 오버레이 — 탭한 카드 위치에서 transform 으로 확대,
 * 안에서 실제 상세(`FieldNoteDetailView`)가 페이드인. 닫기는 역재생 후 언마운트.
 * 상세에서 다른 라우트로 push 하면 그 위에 스택되므로 정상 동작.
 */
export function FieldNoteDetailMorph({ fieldNoteId, rect, onClosed }: FieldNoteDetailMorphProps) {
  const progress = useSharedValue(0);
  const closingRef = useRef(false);
  const radiusStart = s(16);

  // center-origin 보정으로 rect ↔ 풀스크린
  const sx0 = rect.w / SCREEN_W;
  const sy0 = rect.h / SCREEN_H;
  const tx0 = rect.x - (SCREEN_W - rect.w) / 2;
  const ty0 = rect.y - (SCREEN_H - rect.h) / 2;

  useEffect(() => {
    progress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.value = withTiming(
      0,
      { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClosed)();
      },
    );
  }, [progress, onClosed]);

  // Android 하드웨어 백 → 역재생 닫기 (목록 라우트 pop 방지)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.5]),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1], [0, 1], Extrapolation.CLAMP),
    borderRadius: interpolate(progress.value, [0, 1], [radiusStart, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [tx0, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [ty0, 0]) },
      { scaleX: interpolate(progress.value, [0, 1], [sx0, 1]) },
      { scaleY: interpolate(progress.value, [0, 1], [sy0, 1]) },
    ],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
      />
      <Animated.View style={[styles.panel, { width: SCREEN_W, height: SCREEN_H }, panelStyle]}>
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <FieldNoteDetailView fieldNoteId={fieldNoteId} onClose={handleClose} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: FND.bg,
    overflow: 'hidden',
  },
});
