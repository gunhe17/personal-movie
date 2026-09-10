import { useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';

interface WheelPickerProps<T extends string | number> {
  data: T[];
  value: T;
  onChange: (next: T) => void;
  /** 행 높이 (기본 44) */
  itemHeight?: number;
  /** 보여줄 행 수, 홀수 (기본 5) */
  visibleCount?: number;
  /** 표시 텍스트 변환 (기본 String) */
  format?: (item: T) => string;
}

export function WheelPicker<T extends string | number>({
  data,
  value,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  format = (v) => String(v),
}: WheelPickerProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = itemHeight * visibleCount;
  const padding = (containerHeight - itemHeight) / 2;
  const selectedIndex = data.findIndex((d) => d === value);

  useEffect(() => {
    if (selectedIndex < 0) return;
    // 외부 value 변경 시 스크롤 위치 동기화
    scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
  }, [selectedIndex, itemHeight]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / itemHeight);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    const next = data[clamped];
    if (next !== value) onChange(next);
  };

  return (
    <View style={{ height: containerHeight }} className="relative flex-1">
      {/* 중앙 선택 영역 가이드 라인 (옵션) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: padding,
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {data.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <View
              key={`${item}-${idx}`}
              style={{ height: itemHeight }}
              className="items-center justify-center"
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: isSelected ? '600' : '400',
                  color: isSelected ? COLORS.gray[900] : COLORS.gray[400],
                  letterSpacing: TYPOGRAPHY.letterSpacing,
                }}
              >
                {format(item)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
