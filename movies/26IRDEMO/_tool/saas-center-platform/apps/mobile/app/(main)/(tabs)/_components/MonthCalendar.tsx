import { useEffect, useMemo, useRef } from 'react';
import { View, TouchableOpacity, Animated, Easing } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday as checkIsToday,
  isAfter,
  startOfDay,
} from 'date-fns';
import { type ScheduleListItem } from '@/features/schedule';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
// 5건 이상 바쁜 날 — palette.red 8% 옅은 빨강
const BUSY_BG = 'rgba(210, 62, 70, 0.08)';
const BUSY_THRESHOLD = 5;

function BusyDayPill() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const shadowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -s(28),
        left: -s(40),
        right: -s(40),
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          backgroundColor: COLORS.palette.red,
          paddingHorizontal: s(10),
          paddingVertical: s(3),
          borderRadius: s(10),
          shadowColor: COLORS.palette.red,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          numberOfLines={1}
          style={{ color: COLORS.white }}
        >
          바쁜 날이에요
        </Typography>
      </Animated.View>
      <View
        style={{
          marginTop: -1,
          width: 0,
          height: 0,
          borderLeftWidth: s(4),
          borderRightWidth: s(4),
          borderTopWidth: s(4),
          borderStyle: 'solid',
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: COLORS.palette.red,
        }}
      />
    </View>
  );
}

/**
 * 날짜 숫자 + 선택 원 — 선택 시 원이 즉시 나타나지 않고 spring으로 팝인(자연스러운 인터랙션).
 * 선택 해제되는 날짜는 원이 작아지며 사라진다.
 */
function DayCircle({
  label,
  isSelected,
  isTodayFlag,
  inMonth,
  isSunday,
}: {
  label: string;
  isSelected: boolean;
  isTodayFlag: boolean;
  inMonth: boolean;
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
      style={{ width: s(28), height: s(28) }}
      className="items-center justify-center"
    >
      {/* 선택 원 — 스케일 spring + 빠른 페이드(흰 글자가 흰 배경에 묻히는 깜빡임 방지) */}
      <Animated.View
        style={{
          position: 'absolute',
          width: s(28),
          height: s(28),
          borderRadius: s(14),
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
            : !inMonth
              ? COLORS.gray[300]
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

interface MonthCalendarProps {
  month: Date;
  selectedDate: Date;
  schedulesByDate: Map<string, ScheduleListItem[]>;
  onSelectDate: (date: Date) => void;
}

export function MonthCalendar({
  month,
  selectedDate,
  schedulesByDate,
  onSelectDate,
}: MonthCalendarProps) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // 오늘 이후 가장 가까운 5+ 바쁜 날 — 자동 pill 대상 1개
  const nearestPeakDay = useMemo(() => {
    const today = startOfDay(new Date());
    for (const day of days) {
      if (!isSameMonth(day, month)) continue;
      const dayStart = startOfDay(day);
      if (isAfter(today, dayStart)) continue;
      const key = format(day, 'yyyy-MM-dd');
      const n = (schedulesByDate.get(key) ?? []).length;
      if (n >= BUSY_THRESHOLD) return dayStart;
    }
    return null;
  }, [days, month, schedulesByDate]);

  // 한 화면 pill 1개 규칙 — 선택일이 5+면 선택일만, 아니면 자동 highlight
  const selectedDayCount = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return (schedulesByDate.get(key) ?? []).length;
  }, [selectedDate, schedulesByDate]);
  const selectedIsBusy = selectedDayCount >= BUSY_THRESHOLD;

  return (
    <View style={{ paddingHorizontal: s(12) }}>
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

      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row">
          {week.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayFlag = checkIsToday(day);
            const key = format(day, 'yyyy-MM-dd');
            const events = schedulesByDate.get(key) ?? [];
            const count = events.length;
            // dot 스펙 — 1~3건: 시간순 dot N개 (카테고리 컬러) / 4건 이상: dot 3개 + "+N"
            const sortedEvents = [...events].sort(
              (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime(),
            );
            const visibleDots = sortedEvents.slice(0, 3);
            const overflowCount = Math.max(0, count - 3);
            const isSunday = day.getDay() === 0;

            // 밀도 배경 — 5건 이상 바쁜 날만 옅은 빨강
            const isBusy = inMonth && count >= BUSY_THRESHOLD;
            // pill 표시 — 한 화면에 1개. 선택일이 5+이면 선택일, 아니면 자동 highlight
            const isAutoPeak =
              isBusy &&
              nearestPeakDay !== null &&
              isSameDay(day, nearestPeakDay);
            const isPeakDay =
              isBusy && (selectedIsBusy ? isSelected : isAutoPeak);

            return (
              <View
                key={day.toISOString()}
                style={{ flex: 1, padding: s(2) }}
              >
                {/* 가장 바쁜 날 floating pill — 한 화면 1개, pulse 인터랙션 */}
                {isPeakDay && <BusyDayPill />}

                <TouchableOpacity
                  onPress={() => onSelectDate(day)}
                  activeOpacity={0.7}
                  style={{
                    aspectRatio: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isBusy ? BUSY_BG : 'transparent',
                    borderRadius: s(8),
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${format(day, 'yyyy년 M월 d일')}${
                    isBusy ? ` ${count}건` : ''
                  }${isPeakDay ? ' · 바쁜 날이에요' : ''}`}
                >
                  <DayCircle
                    label={format(day, 'd')}
                    isSelected={isSelected}
                    isTodayFlag={isTodayFlag}
                    inMonth={inMonth}
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
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
