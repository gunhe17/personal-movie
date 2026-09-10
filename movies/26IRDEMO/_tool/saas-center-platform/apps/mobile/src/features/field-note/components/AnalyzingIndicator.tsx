import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const ANALYZING_COLOR = COLORS.fieldnote ?? '#9B5DFF';

/** 펄스 점 — 카드 좌측 표식. 기본 보라(분석중), color prop 으로 다른 상태(녹음중 등)에 재사용.
 * scale 1.0↔1.4 + opacity 1↔0.45 부드러운 호흡 (1.2s 주기). */
export function AnalyzingPulseDot({
  size = 8,
  color = ANALYZING_COLOR,
  style,
}: {
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        },
        style,
      ]}
    />
  );
}

/** 라이브 파형 — 녹음 중 표식(재미). 막대들이 scaleY 로 출렁임 (1.2s 주기, 막대별 위상차). */
export function MiniWaveform({
  color = COLORS.error,
  bars = 5,
}: {
  color?: string;
  bars?: number;
}) {
  const vals = useRef(
    Array.from({ length: bars }, () => new Animated.Value(0.4)),
  ).current;

  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 320 + i * 90, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 300 + i * 70, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), height: s(16) }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: s(2.5),
            height: s(16),
            borderRadius: s(2),
            backgroundColor: color,
            transform: [{ scaleY: v }],
          }}
        />
      ))}
    </View>
  );
}

/** "분석중" 라벨 + 점 3개 순차 fade 애니메이션.
 * 분석중 상태 뱃지 안에서 사용. */
export function AnalyzingLabel({ text = '분석중' }: { text?: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(900 - delay),
        ]),
      );
    const loops = [make(a, 0), make(b, 200), make(c, 400)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b, c]);

  return (
    <View style={styles.labelRow}>
      <Typography
        variant="label-02"
        weight="medium"
        style={{ color: ANALYZING_COLOR }}
      >
        {text}
      </Typography>
      <View style={styles.dotsRow}>
        <Animated.Text style={[styles.dot, { opacity: a }]}>·</Animated.Text>
        <Animated.Text style={[styles.dot, { opacity: b }]}>·</Animated.Text>
        <Animated.Text style={[styles.dot, { opacity: c }]}>·</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: s(14),
  },
  dot: {
    fontSize: s(14),
    lineHeight: s(14),
    fontWeight: '700',
    color: ANALYZING_COLOR,
    marginLeft: s(1),
  },
});
