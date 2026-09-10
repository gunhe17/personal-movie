/**
 * 공용 Tabs — 밑줄 탭 (피그마 Tab / Tab/atomic 608:6962).
 *
 * 전문가앱 `Tabs`(균등분할 + translateX 슬라이드)의 내담자앱 포팅본. 다른 점:
 * 내담자앱 시안은 탭이 hug 폭으로 왼쪽부터 붙으므로, 인디케이터 폭이 탭마다 다르다
 * → 각 탭의 onLayout으로 x·width를 재서 인디케이터를 슬라이드시킨다.
 *
 * 줄 전체에 1px 구분선이 깔리고, 활성 탭 밑에만 1.5px 인디케이터가 겹쳐 그려진다
 * (탭마다 보더를 켜고 끄면 높이가 흔들린다 — 오버레이 하나로 처리).
 * 라벨 색도 같은 progress로 보간해 인디케이터와 함께 넘어간다.
 *
 * `Segment`(pill 칩)와는 시각 톤이 달라 별도 컴포넌트로 둔다.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedTypography } from './AnimatedTypography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/** 전문가앱 Tabs와 같은 슬라이드 시간 */
const DURATION = 220;

// worklet 안에서 s()를 부르면 UI 스레드가 죽는다 — 렌더 밖에서 숫자로 굳힌다
const HEIGHT = s(44);
const PADDING_X = s(24);
const INDICATOR_H = 1.5;

const ACTIVE_COLOR = COLORS.text.body.strong;
const INACTIVE_COLOR = COLORS.text.body.subtle;

export interface TabOption<T extends string = string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 인디케이터 슬라이드 (기본 true) */
  animated?: boolean;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  animated = true,
}: TabsProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  // 각 탭의 실측 위치 — hug 폭이라 렌더 후에야 알 수 있다
  const [layouts, setLayouts] = useState<{ x: number; width: number }[]>([]);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  /** 활성 탭 인덱스(보간용) — 라벨 색이 인디케이터와 같은 속도로 넘어가게 */
  const progress = useSharedValue(activeIndex);
  /** 첫 측정은 애니메이션 없이 제자리에 놓는다 (열자마자 미끄러지지 않게) */
  const settled = useRef(false);

  const moveTo = useCallback(
    (index: number, layoutList: { x: number; width: number }[]) => {
      const target = layoutList[index];
      if (!target) return;
      const instant = !settled.current || !animated;
      if (instant) {
        indicatorX.value = target.x;
        indicatorW.value = target.width;
        progress.value = index;
        settled.current = true;
        return;
      }
      indicatorX.value = withTiming(target.x, { duration: DURATION });
      indicatorW.value = withTiming(target.width, { duration: DURATION });
      progress.value = withTiming(index, { duration: DURATION });
    },
    [animated, indicatorW, indicatorX, progress],
  );

  const handleLayout = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setLayouts((prev) => {
        if (prev[index]?.x === x && prev[index]?.width === width) return prev;
        const next = [...prev];
        next[index] = { x, width };
        return next;
      });
    },
    [],
  );

  // 측정값이나 선택이 바뀌면 인디케이터를 다시 맞춘다
  const measuredCount = layouts.filter(Boolean).length;
  React.useEffect(() => {
    if (measuredCount === 0) return;
    moveTo(activeIndex, layouts);
  }, [activeIndex, layouts, measuredCount, moveTo]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    // 구분선은 화면 폭 전체, 탭 줄은 좌우 16 안쪽.
    // ⚠️ 안쪽 줄에 padding 대신 margin을 쓴다 — padding을 주면 탭의 onLayout.x는
    //    border box 기준(16부터), 인디케이터의 absolute left는 padding box 기준(0=16)이라
    //    두 좌표계가 어긋나 인디케이터가 한 칸 밀린다.
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.default,
      }}
    >
      <View
        className="flex-row items-center"
        style={{ height: HEIGHT, marginHorizontal: 16 }}
      >
        {options.map((option, index) => (
          <TabItem
            key={option.value}
            label={option.label}
            index={index}
            progress={progress}
            selected={option.value === value}
            onLayout={handleLayout(index)}
            onPress={() => onChange(option.value)}
          />
        ))}

        <Animated.View
          style={[
            {
              position: 'absolute',
              // 컨테이너 하단 구분선 위에 겹쳐 그린다
              bottom: -1,
              left: 0,
              height: INDICATOR_H,
              backgroundColor: COLORS.gray[900],
              pointerEvents: 'none',
            },
            indicatorStyle,
          ]}
        />
      </View>
    </View>
  );
}

function TabItem({
  label,
  index,
  progress,
  selected,
  onLayout,
  onPress,
}: {
  label: string;
  index: number;
  progress: { value: number };
  selected: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const labelStyle = useAnimatedStyle(() => {
    // 이웃 탭으로 넘어가는 구간(거리 0~1)만 색을 섞는다
    const distance = Math.min(1, Math.abs(progress.value - index));
    return {
      color: interpolateColor(
        distance,
        [0, 1],
        [ACTIVE_COLOR, INACTIVE_COLOR],
      ),
    };
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onLayout={onLayout}
      onPress={onPress}
      style={{
        height: HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: PADDING_X,
      }}
    >
      <AnimatedTypography variant="body-03" weight="medium" style={labelStyle}>
        {label}
      </AnimatedTypography>
    </Pressable>
  );
}
