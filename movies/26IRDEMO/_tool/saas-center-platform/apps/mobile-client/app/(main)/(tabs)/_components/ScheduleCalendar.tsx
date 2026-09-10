/**
 * 월 달력 — 피그마 일정 탭 414:4290.
 *
 * 날짜별 점은 그날 일정이 있는 프로필의 식별색(profileColorAt)을 그대로 쓴다 —
 * 필터 칩·카드 뱃지와 같은 색이라 "누구 일정인지"가 한 색으로 읽힌다.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Typography, type BadgeColor } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import ArrowLeftIcon20 from '@assets/icons/20/ArrowLeftIcon20.svg';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** 한 칸에 표시하는 점 최대 개수 — 넘치면 잘린다(카드 목록이 정본) */
const MAX_DOTS = 3;

function weekdayColor(index: number): string {
  if (index === 0) return COLORS.calendar.sunday;
  if (index === 6) return COLORS.calendar.saturday;
  return COLORS.text.label.default;
}

interface ScheduleCalendarProps {
  month: Date;
  selected: Date;
  /** 'yyyy-MM-dd' → 그날 일정이 있는 프로필 색(중복 제거) */
  dotsByDate: Map<string, BadgeColor[]>;
  countLabel: string;
  onSelect: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function ScheduleCalendar({
  month,
  selected,
  dotsByDate,
  countLabel,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: ScheduleCalendarProps) {
  // 달력 격자 = 그 달을 감싸는 주 단위 구간(주 시작 = 일요일)
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <View className="gap-2">
      {/* 월 이동 헤더 */}
      <View className="flex-row items-center justify-between">
        <View className="gap-2">
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.state.brand }}
          >
            {countLabel}
          </Typography>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            {format(month, 'yyyy년 M월')}
          </Typography>
        </View>
        <View className="flex-row items-start" style={{ columnGap: s(12) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            onPress={onPrevMonth}
            hitSlop={8}
          >
            <ArrowLeftIcon20 width={20} height={20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            onPress={onNextMonth}
            hitSlop={8}
          >
            <ArrowRightIcon20 width={20} height={20} />
          </Pressable>
        </View>
      </View>

      {/* 요일 */}
      <View className="mt-3 flex-row items-center">
        {WEEKDAYS.map((label, i) => (
          <Typography
            key={label}
            variant="label-02"
            weight="medium"
            className="flex-1 text-center"
            style={{ color: weekdayColor(i) }}
          >
            {label}
          </Typography>
        ))}
      </View>

      {/* 날짜 격자 */}
      <View className="mt-3" style={{ rowGap: s(4) }}>
        {weeks.map((week) => (
          <View key={week[0].toISOString()} className="flex-row items-center">
            {week.map((day, i) => {
              const inMonth = isSameMonth(day, month);
              const isSelected = isSameDay(day, selected);
              const dots = inMonth ? (dotsByDate.get(format(day, 'yyyy-MM-dd')) ?? []) : [];
              return (
                <Pressable
                  key={day.toISOString()}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={format(day, 'M월 d일')}
                  disabled={!inMonth}
                  onPress={() => onSelect(day)}
                  className="flex-1 items-center justify-center py-1"
                  style={{ rowGap: s(2) }}
                >
                  <View
                    // Android는 backgroundColor가 동적으로 바뀌면 borderRadius를 다시
                    // 안 그려 네모로 남는다 — 선택 토글 시 key로 리마운트해 새로 그린다.
                    key={isSelected ? 'sel' : 'unsel'}
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: s(32),
                      height: s(32),
                      borderRadius: s(32),
                      backgroundColor: isSelected
                        ? COLORS.action.primary
                        : 'transparent',
                    }}
                  >
                    {inMonth ? (
                      <Typography
                        variant="body-03"
                        weight="medium"
                        style={{
                          color: isSelected
                            ? COLORS.text.state.inverse
                            : i === 0
                              ? COLORS.calendar.sunday
                              : COLORS.text.body.strong,
                        }}
                      >
                        {format(day, 'd')}
                      </Typography>
                    ) : null}
                  </View>
                  {/* 점 자리는 항상 확보 — 있고 없고로 행 높이가 튀지 않게 */}
                  <View className="flex-row" style={{ height: s(4), columnGap: s(4) }}>
                    {dots.slice(0, MAX_DOTS).map((color, di) => (
                      <View
                        key={di}
                        style={{
                          width: s(4),
                          height: s(4),
                          borderRadius: s(2),
                          backgroundColor: COLORS.tag[color].fg,
                        }}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
