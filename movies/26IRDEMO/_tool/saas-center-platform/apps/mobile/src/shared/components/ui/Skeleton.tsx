import { useEffect, useRef, useState } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface SkeletonProps {
  /** number 면 s() 스케일 적용, '50%' 같은 문자열이면 그대로 */
  width?: DimensionValue;
  /** s() 적용 (기본 16) */
  height?: number;
  /** s() 적용 (기본 8) */
  radius?: number;
  /**
   * 시머 색 [시작, 끝]. 기본은 라이트 배경용 gray-100 ↔ gray-200.
   * 다크 배경(예: 필드노트 sub-app)에선 화이트 오버레이 톤을 넘겨 대비를 맞춘다.
   */
  colors?: [string, string];
  style?: ViewStyle;
}

/**
 * 로딩 스켈레톤 기본 박스 (공유 프리미티브).
 *
 * 디자인 스펙 §6.2 — gray-100 ↔ gray-200 으로 1.4초 반복(ease-in-out).
 * 페이지별 스켈레톤은 이 박스를 **실제 화면 레이아웃 모양으로 조합**해서 만든다.
 * (애니메이션·색·타이밍은 여기 한 곳에서만 관리)
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, colors, style }: SkeletonProps) {
  const progress = useSharedValue(0);
  const from = colors?.[0] ?? COLORS.gray[100];
  const to = colors?.[1] ?? COLORS.gray[200];

  useEffect(() => {
    // 700ms × 왕복 = 1.4초 한 사이클
    progress.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [from, to]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: typeof width === 'number' ? s(width) : width,
          height: s(height),
          borderRadius: s(radius),
        },
        animated,
        style,
      ]}
    />
  );
}

/** 원형(아바타) 스켈레톤 — Skeleton 의 정사각 + 반지름 = size/2 단축 */
export function SkeletonCircle({
  size,
  colors,
  style,
}: {
  size: number;
  colors?: [string, string];
  style?: ViewStyle;
}) {
  return <Skeleton width={size} height={size} radius={size / 2} colors={colors} style={style} />;
}

/**
 * 스켈레톤 깜빡임 방지 게이트.
 *
 * 빠른 로딩에서 스켈레톤이 번쩍였다 사라지는 것을 막는다.
 *  - `delay`(기본 200ms) 안에 로딩이 끝나면 스켈레톤을 **아예 표시하지 않음** → 빠른 로딩은 바로 콘텐츠
 *  - 일단 표시되면 최소 `minDuration`(기본 400ms) 유지 → 떴다 곧장 사라지는 on/off flash 방지
 *
 * 캐시(staleTime)가 있으면 재방문 시 isLoading 자체가 false 라 스켈레톤은 콜드 로딩에만 등장한다.
 *
 * @example
 *   const showSkeleton = useDelayedSkeleton(isLoading);
 *   return showSkeleton ? <XxxSkeleton /> : isLoading ? null : <Content />;
 */
export function useDelayedSkeleton(
  loading: boolean,
  { delay = 200, minDuration = 400 }: { delay?: number; minDuration?: number } = {},
): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (loading) {
      // 아직 표시 전이면 delay 후에만 표시 (그 전에 끝나면 영영 안 뜸)
      if (!show) {
        delayTimer = setTimeout(() => {
          shownAt.current = Date.now();
          setShow(true);
        }, delay);
      }
    } else if (show) {
      // 로딩 끝 — 최소 표시 시간만큼 채우고 숨김
      const elapsed = shownAt.current ? Date.now() - shownAt.current : minDuration;
      hideTimer = setTimeout(
        () => {
          shownAt.current = null;
          setShow(false);
        },
        Math.max(0, minDuration - elapsed),
      );
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [loading, show, delay, minDuration]);

  return show;
}
