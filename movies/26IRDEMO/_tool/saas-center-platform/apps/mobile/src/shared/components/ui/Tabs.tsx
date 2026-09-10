/**
 * Tabs 컴포넌트 (언더라인 필터/탭)
 *
 * 화면 상단에서 카테고리/뷰를 토글하는 가로 탭. 컨트롤드(value + onChange) 패턴.
 * `Segment`는 pill 칩, `Tabs`는 언더라인 — 시각 톤이 다르므로 별도 컴포넌트.
 *
 * 디자인 스펙:
 * - 각 탭은 균등 분할(flex-1)
 * - 텍스트: body-02 / medium
 * - 활성   : 하단 indicator **2px** gray-800, 라벨 text-text(#191919, 기본)
 * - 비활성 : 하단 border **1px** gray-200, 라벨 text-gray-500
 *
 * 구현 노트:
 * - 모든 탭은 `border-b border-gray-200`(1px) 베이스라인 → 높이 시프트 없음.
 * - 활성 탭의 2px 보더는 단일 indicator overlay가 담당 (시각상 2px gray-800).
 * - `animated=true` (기본): indicator가 활성 탭 위치로 translateX 슬라이드 (220ms).
 * - `animated=false`: indicator가 활성 탭 위치에 즉시 점프 (트랜지션 없음).
 *
 * @example
 *   type View = 'list' | 'calendar';
 *   const [view, setView] = useState<View>('list');
 *   <Tabs<View>
 *     value={view}
 *     onChange={setView}
 *     options={[
 *       { value: 'list',     label: '목록' },
 *       { value: 'calendar', label: '캘린더' },
 *     ]}
 *   />
 *
 *   // 균등 분할 끄기(콘텐츠 폭만), 슬라이드 애니메이션 끄기
 *   <Tabs equalWidth={false} animated={false} ... />
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  View,
  type ViewProps,
} from 'react-native';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';

export interface TabOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string>
  extends Omit<ViewProps, 'children'> {
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
  /** 탭 균등 분할 여부 (기본 true). false면 콘텐츠 폭만큼만 차지 + 슬라이드 애니 비활성 */
  equalWidth?: boolean;
  /** 활성 indicator 슬라이드 애니메이션 (기본 true). equalWidth=false 또는 옵션 1개면 자동 비활성 */
  animated?: boolean;
}

const INDICATOR_DURATION_MS = 220;

export function Tabs<T extends string = string>({
  value,
  options,
  onChange,
  equalWidth = true,
  animated = true,
  className = '',
  style,
  onLayout,
  ...rest
}: TabsProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;
  const showIndicator = activeIndex >= 0 && equalWidth;

  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorAnim = useRef(new Animated.Value(safeIndex)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(indicatorAnim, {
        toValue: safeIndex,
        duration: INDICATOR_DURATION_MS,
        useNativeDriver: true,
      }).start();
    } else {
      indicatorAnim.setValue(safeIndex);
    }
  }, [safeIndex, indicatorAnim, animated]);

  const tabWidth = options.length > 0 ? containerWidth / options.length : 0;
  const indicatorTranslateX =
    options.length > 1
      ? indicatorAnim.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: options.map((_, i) => i * tabWidth),
        })
      : 0;

  return (
    <View
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
        onLayout?.(e);
      }}
      className={`relative flex-row ${className}`.trim()}
      style={style}
      {...rest}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isDisabled = !!opt.disabled;
        const widthClass = equalWidth ? 'flex-1' : '';
        const labelClass = isActive ? 'text-text' : 'text-gray-500';
        const opacityClass = isDisabled ? 'opacity-50' : '';

        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={isDisabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: isDisabled }}
            className={`${widthClass} items-center py-3 border-b border-gray-200 ${opacityClass}`.trim()}
          >
            <Typography
              variant="body-02"
              weight="medium"
              className={labelClass}
            >
              {opt.label}
            </Typography>
          </Pressable>
        );
      })}
      {/* 활성 탭 하단 2px indicator — 항상 overlay로 렌더, animated에 따라 슬라이드 or 점프 */}
      {showIndicator && containerWidth > 0 && tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            width: tabWidth,
            height: 2,
            backgroundColor: COLORS.gray[800],
            transform: [{ translateX: indicatorTranslateX }],
          }}
        />
      )}
    </View>
  );
}
