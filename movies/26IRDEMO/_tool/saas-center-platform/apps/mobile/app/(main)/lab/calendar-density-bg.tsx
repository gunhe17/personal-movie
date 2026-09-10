/**
 * [캘린더] 칸 밀도 배경 — 일정 많은 날을 한눈에 시안
 *
 * 2시안 비교:
 *  - A 현재: 배경 없음, dot만
 *  - B 밀도 배경: 일정 수에 따라 칸 배경 옅게→진하게
 *
 * 정보 차원 분리: dot=종류(상담 green / 검사 blue), 배경=밀도(개수)
 * mock 데이터로 한 달 다양한 분포(빈 날·1건·3건·5+건) 시연.
 */

import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
} from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

// ─── mock 일정 (이번 달 — 다양한 분포) ───
type MockKind = 'counseling' | 'assessment';
type MockSchedule = { id: string; date: Date; kind: MockKind };

function buildMonthMocks(month: Date): MockSchedule[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const mocks: MockSchedule[] = [];

  // 날짜별 패턴 — 일정 수를 다양하게 분포
  const patterns: Record<number, { c: number; a: number }> = {
    // dayOfMonth: { 상담 수, 검사 수 }
    1: { c: 1, a: 0 },
    3: { c: 2, a: 0 },
    5: { c: 3, a: 1 }, // 4건 — 중간
    7: { c: 0, a: 2 },
    9: { c: 5, a: 2 }, // 7건 — 많음
    10: { c: 1, a: 0 },
    12: { c: 4, a: 0 }, // 4건
    14: { c: 6, a: 1 }, // 7건 — 많음
    15: { c: 2, a: 0 },
    16: { c: 0, a: 1 },
    17: { c: 1, a: 0 },
    19: { c: 3, a: 2 }, // 5건
    21: { c: 8, a: 0 }, // 8건 — 매우 많음
    22: { c: 2, a: 1 }, // 3건
    24: { c: 1, a: 0 },
    26: { c: 4, a: 1 }, // 5건
    28: { c: 1, a: 0 },
  };

  let idCounter = 0;
  for (const day of days) {
    const dayNum = day.getDate();
    const pattern = patterns[dayNum];
    if (!pattern) continue;
    for (let i = 0; i < pattern.c; i++) {
      mocks.push({
        id: `m-${idCounter++}`,
        date: new Date(day),
        kind: 'counseling',
      });
    }
    for (let i = 0; i < pattern.a; i++) {
      mocks.push({
        id: `m-${idCounter++}`,
        date: new Date(day),
        kind: 'assessment',
      });
    }
  }
  return mocks;
}

function groupByDate(mocks: MockSchedule[]): Map<string, MockSchedule[]> {
  const map = new Map<string, MockSchedule[]>();
  for (const m of mocks) {
    const key = format(m.date, 'yyyy-MM-dd');
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}

type Variant = 'current' | 'density';

export default function CalendarDensityBgLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('density');
  const [month] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const mocks = useMemo(() => buildMonthMocks(month), [month]);
  const byDate = useMemo(() => groupByDate(mocks), [mocks]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View
          style={{
            height: s(52),
            paddingHorizontal: s(8),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: s(40),
              height: s(40),
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={s(24)} />
          </TouchableOpacity>
          <Typography variant="headline-02" weight="semibold">
            캘린더 밀도 시안
          </Typography>
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{ paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(16) }}
        >
          <VariantTabs value={variant} onChange={setVariant} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: s(40) }}
          showsVerticalScrollIndicator={false}
        >
          {/* 월 헤더 */}
          <View
            style={{
              paddingHorizontal: s(20),
              paddingBottom: s(8),
              alignItems: 'center',
            }}
          >
            <Typography variant="title-01" weight="semibold">
              {format(month, 'yyyy년 M월')}
            </Typography>
          </View>

          {variant === 'current' ? (
            <DemoMonthCalendar
              month={month}
              selectedDate={selectedDate}
              schedulesByDate={byDate}
              onSelectDate={setSelectedDate}
              applyDensity={false}
            />
          ) : (
            <DemoMonthCalendar
              month={month}
              selectedDate={selectedDate}
              schedulesByDate={byDate}
              onSelectDate={setSelectedDate}
              applyDensity={true}
            />
          )}

          {/* 안내 */}
          <View
            style={{
              marginHorizontal: s(20),
              marginTop: s(24),
              padding: s(14),
              borderRadius: s(12),
              backgroundColor: COLORS.gray[50],
              gap: s(8),
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.gray[700] }}
            >
              {variant === 'current' ? '현재 (대조군)' : '밀도 배경 (시안)'}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[600], lineHeight: s(20) }}
            >
              {variant === 'current'
                ? 'dot만 보여요. 일정이 많은 날은 칸 탭해서 확인해요.'
                : '5건 이상인 바쁜 날만 칸이 옅게 붉어져요. 가장 바쁜 날은 위에 라벨로 알려드려요.'}
            </Typography>
            <View style={{ marginTop: s(4), gap: s(4) }}>
              <DensityLegendRow
                color={
                  variant === 'density'
                    ? 'rgba(210, 62, 70, 0.14)'
                    : COLORS.white
                }
                label="5건 이상 · 바빠요"
              />
              {variant === 'density' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: s(8),
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: s(6),
                      paddingVertical: s(2),
                      borderRadius: s(4),
                      backgroundColor: COLORS.palette.red,
                    }}
                  >
                    <Typography
                      variant="label-02"
                      weight="bold"
                      style={{ color: COLORS.white }}
                    >
                      N건
                    </Typography>
                  </View>
                  <Typography
                    variant="label-01"
                    style={{ color: COLORS.gray[600] }}
                  >
                    이 달 가장 바쁜 날
                  </Typography>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── 시안 전환 탭 ───
function VariantTabs({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  const items: Array<{ key: Variant; label: string }> = [
    { key: 'current', label: 'A 현재' },
    { key: 'density', label: 'B 밀도 배경' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.gray[50],
        borderRadius: s(10),
        padding: s(4),
        gap: s(4),
      }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => onChange(it.key)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              height: s(34),
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: s(8),
              backgroundColor: active ? COLORS.white : 'transparent',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 2,
              elevation: active ? 1 : 0,
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Typography
              variant="body-03"
              weight={active ? 'semibold' : 'medium'}
              style={{
                color: active ? COLORS.gray[900] : COLORS.gray[500],
              }}
            >
              {it.label}
            </Typography>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DensityLegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <View
        style={{
          width: s(20),
          height: s(16),
          borderRadius: s(3),
          backgroundColor: color,
          borderWidth: 1,
          borderColor: COLORS.gray[200],
        }}
      />
      <Typography
        variant="label-01"
        style={{ color: COLORS.gray[600] }}
      >
        {label}
      </Typography>
    </View>
  );
}

// ─── 데모 캘린더 — production MonthCalendar 패턴 + applyDensity 옵션 ───
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function DemoMonthCalendar({
  month,
  selectedDate,
  schedulesByDate,
  onSelectDate,
  applyDensity,
}: {
  month: Date;
  selectedDate: Date;
  schedulesByDate: Map<string, MockSchedule[]>;
  onSelectDate: (d: Date) => void;
  applyDensity: boolean;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // 한 달 중 가장 바쁜 일정 수 — pill 강조 기준 (5+ 이상이고 max)
  const maxCount = useMemo(() => {
    let max = 0;
    for (const day of days) {
      if (!isSameMonth(day, month)) continue;
      const key = format(day, 'yyyy-MM-dd');
      const n = (schedulesByDate.get(key) ?? []).length;
      if (n > max) max = n;
    }
    return max;
  }, [days, month, schedulesByDate]);

  return (
    <View style={{ paddingHorizontal: s(12) }}>
      {/* 요일 */}
      <View style={{ flexDirection: 'row' }}>
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

      {/* 날짜 칸 */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayFlag = checkIsToday(day);
            const key = format(day, 'yyyy-MM-dd');
            const events = schedulesByDate.get(key) ?? [];
            const count = events.length;
            const hasCounseling = events.some((e) => e.kind === 'counseling');
            const hasAssessment = events.some((e) => e.kind === 'assessment');
            const isSunday = day.getDay() === 0;

            // 밀도 배경 — red 톤. 5건 이상인 날만 표시.
            const densityBg =
              applyDensity && inMonth && count >= 5
                ? 'rgba(210, 62, 70, 0.14)' // palette.red 14%
                : 'transparent';

            // 가장 바쁜 날 — 5+이고 한 달 max인 날에만 floating pill
            const isPeakDay =
              applyDensity && inMonth && count >= 5 && count === maxCount;

            return (
              <View
                key={day.toISOString()}
                style={{ flex: 1, padding: s(2) }} // 칸 사이 위아래좌우 2dp 여유
              >
                {/* 가장 바쁜 날 floating pill — 칸 위쪽에 떠 있음 */}
                {isPeakDay && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -s(20),
                      left: 0,
                      right: 0,
                      alignItems: 'center',
                      zIndex: 10,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: COLORS.palette.red,
                        paddingHorizontal: s(6),
                        paddingVertical: s(2),
                        borderRadius: s(4),
                      }}
                    >
                      <Typography
                        variant="label-02"
                        weight="bold"
                        style={{ color: COLORS.white }}
                      >
                        {count}건
                      </Typography>
                    </View>
                    {/* caret — pill 아래 가리키는 삼각형 */}
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
                )}

                <TouchableOpacity
                  onPress={() => onSelectDate(day)}
                  activeOpacity={0.7}
                  style={{
                    aspectRatio: 1, // 정사각형 배경 영역
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: densityBg,
                    borderRadius: s(8),
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${format(day, 'M월 d일')} ${count}건${
                    isPeakDay ? ' · 가장 바쁜 날' : ''
                  }`}
                >
                  <View
                    style={{
                      width: s(28),
                      height: s(28),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: s(14),
                      backgroundColor: isSelected
                        ? COLORS.primary
                        : 'transparent',
                    }}
                  >
                    <Typography
                      variant="body-02"
                      weight={
                        isSelected || isTodayFlag ? 'semibold' : 'medium'
                      }
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
                      {format(day, 'd')}
                    </Typography>
                  </View>

                  {/* 카테고리 dot — 종류만 (A안) */}
                  <View
                    style={{
                      marginTop: s(4),
                      height: s(4),
                      gap: s(3),
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    {hasCounseling && (
                      <View
                        style={{
                          width: s(4),
                          height: s(4),
                          borderRadius: s(2),
                          backgroundColor: COLORS.counseling,
                        }}
                      />
                    )}
                    {hasAssessment && (
                      <View
                        style={{
                          width: s(4),
                          height: s(4),
                          borderRadius: s(2),
                          backgroundColor: COLORS.assessment,
                        }}
                      />
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
