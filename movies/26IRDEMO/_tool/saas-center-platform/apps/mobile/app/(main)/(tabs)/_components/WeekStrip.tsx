import { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday as checkIsToday,
} from 'date-fns';
import { type ScheduleListItem } from '@/features/schedule';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const CIRCLE_SIZE = s(28);
const ROW_PADDING_TOP = s(6);

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  schedulesByDate?: Map<string, ScheduleListItem[]>;
}

/**
 * 날짜 숫자 + 선택 원 — 선택 시 원이 즉시 나타나지 않고 spring으로 팝인(월간 캘린더와 동일 인터랙션).
 * 선택 해제되는 날짜는 원이 작아지며 사라진다.
 */
function WeekDayCircle({
  label,
  isSelected,
  isTodayFlag,
  isSunday,
}: {
  label: string;
  isSelected: boolean;
  isTodayFlag: boolean;
  isSunday: boolean;
}) {
  const anim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: isSelected ? 1 : 0,
      useNativeDriver: true,
      tension: 220,
      friction: 13,
    }).start();
  }, [isSelected, anim]);

  return (
    <View
      style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
      className="items-center justify-center"
    >
      {/* 선택 원 — 스케일 spring + 빠른 페이드(흰 글자가 흰 배경에 묻히는 깜빡임 방지) */}
      <Animated.View
        style={{
          position: 'absolute',
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: CIRCLE_SIZE / 2,
          backgroundColor: COLORS.primary,
          opacity: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ],
        }}
      />
      <Typography
        variant="body-02"
        weight={isSelected || isTodayFlag ? 'semibold' : 'medium'}
        style={{
          color: isSelected
            ? COLORS.white
            : isTodayFlag
              ? COLORS.primary
              : isSunday
                ? COLORS.error
                : COLORS.gray[800],
        }}
      >
        {label}
      </Typography>
    </View>
  );
}

export function WeekStrip({
  selectedDate,
  onSelectDate,
  schedulesByDate,
}: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <View style={{ paddingHorizontal: s(12) }} className="bg-surface">
      <View className="flex-row">
        {WEEKDAYS.map((w, idx) => (
          <View
            key={w}
            style={{ height: s(36) }}
            className="flex-1 items-center justify-center"
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: idx === 6 ? COLORS.error : COLORS.gray[500] }}
            >
              {w}
            </Typography>
          </View>
        ))}
      </View>

      <View className="flex-row">
        {days.map((day) => {
          const isTodayFlag = checkIsToday(day);
          const isSunday = day.getDay() === 0;
          const isSelected = isSameDay(day, selectedDate);

          // dot 스펙 — MonthCalendar와 동일
          const key = format(day, 'yyyy-MM-dd');
          const events = schedulesByDate?.get(key) ?? [];
          const sortedEvents = [...events].sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
          );
          const visibleDots = sortedEvents.slice(0, 3);
          const overflowCount = Math.max(0, events.length - 3);

          return (
            <TouchableOpacity
              key={day.toISOString()}
              onPress={() => onSelectDate(day)}
              activeOpacity={0.7}
              style={{ height: s(60), paddingTop: ROW_PADDING_TOP }}
              className="flex-1 items-center"
              accessibilityRole="button"
              accessibilityLabel={`${format(day, 'yyyy년 M월 d일')}${
                events.length > 0 ? ` ${events.length}건` : ''
              }`}
            >
              <WeekDayCircle
                label={format(day, 'd')}
                isSelected={isSelected}
                isTodayFlag={isTodayFlag}
                isSunday={isSunday}
              />
              <View
                style={{ marginTop: s(2), height: s(10), gap: s(3) }}
                className="flex-row items-center justify-center"
              >
                {visibleDots.map((e, i) => (
                  <View
                    key={i}
                    style={{
                      width: s(4),
                      height: s(4),
                      backgroundColor:
                        e.schedule_type === 'assessment'
                          ? COLORS.assessment
                          : COLORS.counseling,
                    }}
                    className="rounded-full"
                  />
                ))}
                {overflowCount > 0 && (
                  <Typography
                    variant="caption-01"
                    weight="medium"
                    style={{
                      color: COLORS.gray[500],
                      lineHeight: s(10),
                      includeFontPadding: false,
                      marginTop: s(2),
                    }}
                  >
                    +{overflowCount}
                  </Typography>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
