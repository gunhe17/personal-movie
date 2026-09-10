import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 FAB 활성(녹음 중) 상태의 가운데 흰 네모 안에 들어가는 이퀄라이저 막대.
 * 정적 물결(Fieldnote_Wave.svg)을 대체 — 같은 #25A2F3 톤의 세로 막대들이
 * 바닥을 고정한 채 위아래로 부드럽게 호흡한다.
 *
 * 부드러움: 각 막대를 0→1 로 끊김 없이 도는 위상값으로 구동하고, raised-cosine
 * 곡선으로 보간한다. 시퀀스 ping-pong 처럼 정점/바닥에서 멈췄다 반전하지 않아
 * 속도가 연속이라 자연스럽다. 막대별 위상·주기·진폭을 달리해 동기화도 깬다.
 *
 * 성능: scaleY + translateY 변환만 사용해 native driver 로 구동(JS 스레드 점유 X).
 * 막대 크기는 render 단계에서 s()로 숫자 계산해 넘긴다(worklet 아님 — RN Animated 라 안전).
 */
const BAR_COLOR = '#25A2F3';
const BAR_W = s(2.6);
const BAR_GAP = s(2.2);
const BAR_H = s(13);

// 막대별: 위상 오프셋·주기(ms)·최소/최대 스케일. 서로 달라야 자연스럽다.
const BARS = [
  { offset: 0.0, period: 1150, min: 0.4, max: 1.0 },
  { offset: 0.5, period: 920, min: 0.45, max: 0.92 },
  { offset: 0.22, period: 1320, min: 0.35, max: 0.9 },
  { offset: 0.78, period: 1040, min: 0.5, max: 1.0 },
];

// 위상[0,1] → 부드러운 스케일 곡선을 만드는 보간 waypoint 수.
const STEPS = 12;
const INPUT = Array.from({ length: STEPS + 1 }, (_, k) => k / STEPS);

export function FieldNoteFabBars({ paused = false }: { paused?: boolean }) {
  const phases = useRef(BARS.map(() => new Animated.Value(0))).current;

  // 막대별 scaleY·translateY outputRange 를 미리 계산(렌더 단계 — worklet 아님).
  const ranges = useMemo(
    () =>
      BARS.map((b) => {
        const scale = INPUT.map((t) => {
          // raised-cosine: 0.5-0.5cos 는 [0,1] 양 끝에서 속도 0 이라 루프 이음새가 매끄럽다.
          const wave = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t + b.offset));
          return b.min + (b.max - b.min) * wave;
        });
        // 바닥 고정: 줄어든 만큼 아래로 내려 바닥선을 맞춘다.
        const translate = scale.map((sc) => (BAR_H * (1 - sc)) / 2);
        return { scale, translate };
      }),
    [],
  );

  useEffect(() => {
    if (paused) {
      phases.forEach((p) => p.stopAnimation());
      return;
    }
    const loops = phases.map((p, i) => {
      p.setValue(0);
      return Animated.loop(
        Animated.timing(p, {
          toValue: 1,
          duration: BARS[i].period,
          easing: Easing.linear, // 위상은 등속 — 곡선(보간)이 부드러움을 만든다.
          useNativeDriver: true,
        }),
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [paused, phases]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: BAR_H,
        gap: BAR_GAP,
      }}
    >
      {phases.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            width: BAR_W,
            height: BAR_H,
            borderRadius: BAR_W / 2,
            backgroundColor: BAR_COLOR,
            transform: [
              { scaleY: p.interpolate({ inputRange: INPUT, outputRange: ranges[i].scale }) },
              { translateY: p.interpolate({ inputRange: INPUT, outputRange: ranges[i].translate }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
