import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  type SkPath,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '@/shared/constants/theme';
import {
  WAVEFORM_BAR_WIDTH,
  WAVEFORM_BAR_GAP,
  WAVEFORM_BAR_COUNT,
} from '../constants';

const BAR_MAX_HEIGHT = 60;
/** 무음 시에도 살짝 보이도록 최소 height (px) */
const BAR_MIN_HEIGHT = 3;
const BAR_PITCH = WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP;
/** 1 sample = 1 tick. 가로 스크롤 1회 분량 */
const SAMPLE_INTERVAL_MS = 80;
/** 컨테이너 높이 */
const CONTAINER_HEIGHT = BAR_MAX_HEIGHT + 4;

/** 보이는 바 + 좌측 슬라이드 아웃용 leading 바 1개 → 총 N+1 */
const TOTAL_BARS = WAVEFORM_BAR_COUNT + 1;
/** Canvas 폭 — 보이는 바 N개 분량 */
const CANVAS_WIDTH = WAVEFORM_BAR_COUNT * BAR_PITCH;

/** dB → 0~1 정규화.
 * iOS 마이크 노이즈 플로어가 -40dB 부근이라 -60 floor + sqrt 곡선으로는
 * 무음 상태도 ~0.58 잡혀서 항상 큰 바로 보였음.
 * 노이즈 플로어를 -45로 올리고 ^1.6 곡선으로 작은 소리는 더 작게 압축. */
function normalizeDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const NOISE_FLOOR = -45;
  const PEAK = -5;
  if (db <= NOISE_FLOOR) return 0;
  const clamped = Math.min(PEAK, db);
  const linear = (clamped - NOISE_FLOOR) / (PEAK - NOISE_FLOOR);
  return Math.pow(linear, 1.6);
}

interface WaveformBarsProps {
  meteringRef: React.MutableRefObject<number>;
  isRecording: boolean;
  isPaused: boolean;
  color?: string;
  height?: number;
  /** 막대 최대 높이(px) — 기본 60 */
  barMaxHeight?: number;
}

/**
 * 보이스메모 스타일 — react-native-skia 기반 가로 스크롤 웨이브폼.
 *
 * 핵심:
 *  - 모든 그리기가 Skia Canvas의 UI 스레드에서 single path로 처리
 *    → atomicity 자동 보장, 50개 바 동시 갱신해도 partial frame 없음 (블링크 없음)
 *  - buffer는 react-native-reanimated `useSharedValue` → JS↔UI 스레드 간 zero-copy 전달
 *  - useDerivedValue로 buffer → SkPath worklet 변환 → 매 frame UI 스레드에서 자동 재계산
 *  - offsetX shared value를 withTiming으로 linear 슬라이드 (UI 스레드에서 60fps)
 *
 *  동작:
 *   1. 매 SAMPLE_INTERVAL_MS마다 metering ref 읽어 buffer 좌측 시프트 + 새 샘플 push
 *   2. offsetX를 BAR_PITCH로 스냅 → 0으로 linear 애니메이션 (한 칸 슬라이드)
 *   3. buffer 시프트가 offsetX 스냅을 정확히 상쇄 → 시각 점프 없음
 *   4. N+1 바 렌더 (leading 바가 좌측으로 슬라이드 아웃, 새 바가 우측에서 슬라이드 인)
 */
export function WaveformBars({
  meteringRef,
  isRecording,
  isPaused,
  color = COLORS.gray[400],
  height,
  barMaxHeight = BAR_MAX_HEIGHT,
}: WaveformBarsProps) {
  const containerH = height ?? barMaxHeight + 4;
  const buffer = useSharedValue<number[]>(new Array(TOTAL_BARS).fill(0));
  const offsetX = useSharedValue(0);

  // buffer → SkPath (UI 스레드 worklet — buffer.value 변경 시 자동 재계산)
  const path = useDerivedValue<SkPath>(() => {
    const p = Skia.Path.Make();
    const buf = buffer.value;
    const cy = barMaxHeight / 2;
    for (let i = 0; i < buf.length; i++) {
      // bar i는 row 위치 (i-1)*BAR_PITCH — bar 0이 leading(좌측 클립용)
      const x = (i - 1) * BAR_PITCH + WAVEFORM_BAR_WIDTH / 2;
      const halfH = Math.max(BAR_MIN_HEIGHT, buf[i] * barMaxHeight) / 2;
      p.moveTo(x, cy - halfH);
      p.lineTo(x, cy + halfH);
    }
    return p;
  });

  // Group transform용 — translateX
  const transform = useDerivedValue(() => [{ translateX: offsetX.value }]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      const id = setInterval(() => {
        // 1. 새 샘플 + 좌측 시프트 (shared value 갱신은 UI 스레드 push)
        const lvl = normalizeDb(meteringRef.current);
        const next = new Array<number>(TOTAL_BARS);
        const cur = buffer.value;
        for (let i = 0; i < TOTAL_BARS - 1; i++) next[i] = cur[i + 1];
        next[TOTAL_BARS - 1] = lvl;
        buffer.value = next;

        // 2. translateX 스냅 + 슬라이드 (UI 스레드에서 60fps 보간)
        offsetX.value = BAR_PITCH;
        offsetX.value = withTiming(0, {
          duration: SAMPLE_INTERVAL_MS,
          easing: Easing.linear,
        });
      }, SAMPLE_INTERVAL_MS);
      return () => clearInterval(id);
    }

    // 일시정지/정지: 마지막 값 그대로 freeze (감쇠 없음).
    // 사용자가 재개하면 그 wave에서 이어서 그려진다.
  }, [isRecording, isPaused, meteringRef, buffer, offsetX]);

  return (
    <View style={[styles.container, { height: containerH }]}>
      <Canvas style={[styles.canvas, { height: barMaxHeight }]}>
        <Group transform={transform}>
          <Path
            path={path}
            color={color}
            style="stroke"
            strokeWidth={WAVEFORM_BAR_WIDTH}
            strokeCap="round"
          />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: BAR_MAX_HEIGHT,
  },
});
