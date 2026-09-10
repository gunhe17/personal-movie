/**
 * 기록 탭 주간 스트립 — 피그마 414:4095.
 *
 * 일정 탭 달력(월 격자, 날짜=원)과 달리 기록 탭은 한 주만 가로로 편다:
 * 위=날짜 숫자 / 아래=요일 글자를 담은 32 원(선택일=다크 원 + 흰 글자).
 * 선택일 기준 그 주(일~토)를 그린다.
 *
 * 선택 전환은 리마운트가 아니라 **애니메이션**이다 — 다크 원을 절대 배치로 깔고
 * opacity만 보간해 켠다. backgroundColor를 건드리지 않으니 안드로이드에서
 * borderRadius가 네모로 남는 문제(옛 key 리마운트 우회의 이유)도 안 생기고,
 * 날짜를 옮길 때 눈에 걸리는 깜빡임이 사라진다.
 *
 * 원 아래 14px은 시안 414:4111의 기록 점 행 — 4px 점 최대 3개 + 초과분 "+N".
 * ⚠️ 건수를 받지만 화면은 유무와 3점까지만 쓴다. 연속 일수·"이번 주 N회" 같은
 * 카운터를 얹으면 §7-1 스트릭 금지 위반이다.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns';
import { AnimatedTypography, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 선택 전환 시간 — 공용 Chip(150)과 맞춘다 */
const DURATION = 150;

const MAX_DOTS = 3;

interface RecordWeekStripProps {
  selected: Date;
  onSelect: (date: Date) => void;
  /** `YYYY-MM-DD` → 그날 기록 수 */
  countsByDate?: Record<string, number>;
}

export function RecordWeekStrip({
  selected,
  onSelect,
  countsByDate,
}: RecordWeekStripProps) {
  // 선택일이 속한 주(일요일 시작)
  const days = eachDayOfInterval({
    start: startOfWeek(selected),
    end: endOfWeek(selected),
  });

  return (
    <View className="flex-row items-start">
      {days.map((day, i) => {
        const isSelected = isSameDay(day, selected);
        const isSunday = i === 0;
        const numberColor = isSunday
          ? COLORS.calendar.sunday
          : COLORS.text.body.strong;
        const weekdayRestColor = isSunday
          ? COLORS.calendar.sunday
          : COLORS.text.body.strong;
        return (
          <Pressable
            key={day.toISOString()}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={format(day, 'M월 d일')}
            onPress={() => onSelect(day)}
            className="flex-1 items-center"
            style={{ rowGap: s(3) }}
          >
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: numberColor }}
            >
              {format(day, 'd')}
            </Typography>
            <View className="items-center">
              <StripDayCircle
                label={WEEKDAYS[i]}
                selected={isSelected}
                restColor={weekdayRestColor}
              />
              <RecordDots
                count={countsByDate?.[format(day, 'yyyy-MM-dd')] ?? 0}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 요일 글자 + 선택 원. 원은 항상 그려 두고 opacity만 켜고, 글자색은 보간한다 —
 * 리마운트가 없어 날짜를 연달아 옮겨도 깜빡이지 않는다.
 */
function StripDayCircle({
  label,
  selected,
  restColor,
}: {
  label: string;
  selected: boolean;
  restColor: string;
}) {
  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: DURATION }),
    [selected],
  );
  const circleStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [restColor, COLORS.text.state.inverse],
    ),
  }));

  return (
    <View
      className="items-center justify-center"
      style={{ width: s(32), height: s(32) }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: s(32),
            height: s(32),
            borderRadius: s(32),
            backgroundColor: COLORS.bg.emphasis,
          },
          circleStyle,
        ]}
      />
      <AnimatedTypography variant="body-03" weight="medium" style={labelStyle}>
        {label}
      </AnimatedTypography>
    </View>
  );
}

function RecordDots({ count }: { count: number }) {
  const dots = Math.min(count, MAX_DOTS);
  return (
    <View
      className="flex-row items-center justify-center"
      style={{ height: s(14), columnGap: s(3) }}
    >
      {dots > 0 ? (
        <View className="flex-row items-center" style={{ columnGap: s(2) }}>
          {Array.from({ length: dots }).map((_, i) => (
            <View
              key={i}
              style={{
                width: s(4),
                height: s(4),
                borderRadius: s(4),
                backgroundColor: COLORS.action.primary,
              }}
            />
          ))}
        </View>
      ) : null}
      {count > MAX_DOTS ? (
        <Typography
          variant="caption-01"
          style={{ color: COLORS.text.caption.default }}
        >
          {`+${count - MAX_DOTS}`}
        </Typography>
      ) : null}
    </View>
  );
}
