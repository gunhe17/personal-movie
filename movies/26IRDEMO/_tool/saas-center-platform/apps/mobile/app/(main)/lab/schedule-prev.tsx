/**
 * 백업 시안 · 기존 일정 메인 (캘린더 + 리스트 + 통계)
 *
 * `schedule-now-flow` 적용 이전 production 일정 페이지의 스냅샷.
 * 3-mode segment (캘린더/리스트/통계) 그대로, 실데이터(useScheduleRange) 연결되어 있음.
 *
 * 차이점 (lab 적응)
 *  - 좌상단 ← back 버튼 추가 (router.back)
 *  - 헤더 우측 "백업" pill 라벨
 *  - tab navigation 의존성(useLocalSearchParams의 focusToday) 제거
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  getWeekOfMonth,
  getMonth as getMonthIdx,
  getYear,
  format,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import {
  useScheduleRange,
  getScheduleColorByIndex,
  type ScheduleListItem,
} from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import { MonthCalendar } from '../(tabs)/_components/MonthCalendar';
import { ScheduleItem } from '../(tabs)/_components/ScheduleItem';
import { WeekStrip } from '../(tabs)/_components/WeekStrip';
import { DayTimeline } from '../(tabs)/_components/DayTimeline';
import { deriveStatus } from '../(tabs)/_components/utils';

const WEEK_OF_MONTH_LABELS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'] as const;

function formatWeekOfMonth(date: Date): string {
  const week = getWeekOfMonth(date, { weekStartsOn: 1 });
  const label = WEEK_OF_MONTH_LABELS[week - 1] ?? `${week}째`;
  return `${format(date, 'M월')} ${label}주`;
}

type ViewMode = 'grid' | 'list' | 'stats';

interface ViewModeSegmentProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

const SEGMENT_ITEM_WIDTH = 40;
const SEGMENT_ITEM_HEIGHT = 28;
const SEGMENT_ITEM_GAP = 4;
const SEGMENT_PADDING = 2;
const SEGMENT_THUMB_RADIUS = 14;

function ViewModeSegment({ value, onChange }: ViewModeSegmentProps) {
  const items: Array<{
    key: ViewMode;
    icon: 'grid-outline' | 'list-outline' | 'stats-chart-outline';
    size: number;
    label: string;
  }> = [
    { key: 'grid', icon: 'grid-outline', size: s(18), label: '캘린더 뷰' },
    { key: 'list', icon: 'list-outline', size: s(20), label: '리스트 뷰' },
    { key: 'stats', icon: 'stats-chart-outline', size: s(18), label: '통계' },
  ];

  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.key === value),
  );

  const stepPx = s(SEGMENT_ITEM_WIDTH + SEGMENT_ITEM_GAP);
  const anim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: activeIndex,
      useNativeDriver: true,
      damping: 20,
      stiffness: 180,
      mass: 1,
    }).start();
  }, [activeIndex, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, items.length - 1],
    outputRange: [0, stepPx * (items.length - 1)],
  });

  return (
    <View
      style={{
        height: s(32),
        padding: s(SEGMENT_PADDING),
        gap: s(SEGMENT_ITEM_GAP),
      }}
      className="flex-row items-center rounded-lg bg-gray-50"
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: s(SEGMENT_PADDING),
          top: s(SEGMENT_PADDING),
          width: s(SEGMENT_ITEM_WIDTH),
          height: s(SEGMENT_ITEM_HEIGHT),
          borderRadius: s(SEGMENT_THUMB_RADIUS),
          backgroundColor: COLORS.white,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
          elevation: 1,
          transform: [{ translateX }],
        }}
      />

      {items.map((it) => {
        const active = value === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => onChange(it.key)}
            activeOpacity={0.7}
            style={{
              width: s(SEGMENT_ITEM_WIDTH),
              height: s(SEGMENT_ITEM_HEIGHT),
            }}
            className="items-center justify-center rounded-md"
            accessibilityLabel={it.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={it.icon}
              size={it.size}
              color={active ? COLORS.gray[900] : COLORS.gray[400]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ScheduleScreenPrev() {
  const router = useRouter();
  const centerId = useCenterStore((st) => st.centerId);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const rangeStart = useMemo(
    () => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    [month],
  );
  const rangeEnd = useMemo(
    () => endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    [month],
  );

  const {
    data: schedules,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useScheduleRange(centerId, rangeStart, rangeEnd);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleListItem[]>();
    (schedules ?? [])
      .filter((it) => it.schedule_type !== 'block')
      .forEach((it) => {
        const key = format(parseDate(it.start), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
      });
    for (const list of map.values()) {
      list.sort(
        (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime(),
      );
    }
    return map;
  }, [schedules]);

  const selectedDaySchedules = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return schedulesByDate.get(key) ?? [];
  }, [schedulesByDate, selectedDate]);

  const weekSchedules = useMemo(() => {
    const wkStart = startOfWeek(selectedDate, { weekStartsOn: 1 }).getTime();
    const wkEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime();
    return (schedules ?? []).filter((it) => {
      const t = parseDate(it.start).getTime();
      return t >= wkStart && t <= wkEnd;
    });
  }, [schedules, selectedDate]);

  const goToday = useCallback(() => {
    const today = new Date();
    setMonth(today);
    setSelectedDate(today);
  }, []);

  const handlePrev = useCallback(() => {
    if (viewMode === 'list') {
      setSelectedDate((d) => subWeeks(d, 1));
    } else {
      setMonth((m) => subMonths(m, 1));
    }
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === 'list') {
      setSelectedDate((d) => addWeeks(d, 1));
    } else {
      setMonth((m) => addMonths(m, 1));
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'grid') return;
    setSelectedDate((d) => {
      const ms = startOfMonth(month);
      const me = endOfMonth(month);
      if (d < ms || d > me) return ms;
      return d;
    });
  }, [month, viewMode]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    setMonth((m) => {
      const sameMonth =
        getMonthIdx(selectedDate) === getMonthIdx(m) &&
        getYear(selectedDate) === getYear(m);
      return sameMonth ? m : selectedDate;
    });
  }, [selectedDate, viewMode]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View
        style={{ height: s(52), paddingHorizontal: s(20) }}
        className="flex-row items-center justify-between bg-surface"
      >
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <Typography
            variant="headline-02"
            weight="bold"
            className="text-gray-900"
          >
            일정
          </Typography>
          <View
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(2),
              borderRadius: s(6),
              backgroundColor: COLORS.gray[100],
            }}
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              백업
            </Typography>
          </View>
        </View>
        <ViewModeSegment value={viewMode} onChange={setViewMode} />
      </View>

      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(16),
          paddingBottom: s(10),
        }}
        className="flex-row items-center justify-between bg-surface"
      >
        <View style={{ width: s(52) }} />
        <View className="flex-row items-center" style={{ gap: s(12) }}>
          <TouchableOpacity
            onPress={handlePrev}
            activeOpacity={0.7}
            style={{ width: s(28), height: s(28) }}
            className="items-center justify-center"
            accessibilityLabel={viewMode === 'list' ? '이전 주' : '이전 달'}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-back"
              size={s(16)}
              color={COLORS.gray[800]}
            />
          </TouchableOpacity>
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            {viewMode === 'list'
              ? formatWeekOfMonth(selectedDate)
              : format(month, 'M월')}
          </Typography>
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.7}
            style={{ width: s(28), height: s(28) }}
            className="items-center justify-center"
            accessibilityLabel={viewMode === 'list' ? '다음 주' : '다음 달'}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-forward"
              size={s(16)}
              color={COLORS.gray[800]}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={goToday}
          activeOpacity={0.7}
          style={{ height: s(28), paddingHorizontal: s(12) }}
          className="items-center justify-center rounded-md border border-gray-200"
          accessibilityLabel="오늘로 이동"
          accessibilityRole="button"
        >
          <Typography
            variant="label-01"
            weight="medium"
            className="text-gray-700"
          >
            오늘
          </Typography>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {viewMode === 'grid' ? (
          <>
            <View className="bg-surface" style={{ paddingBottom: s(12) }}>
              <MonthCalendar
                month={month}
                selectedDate={selectedDate}
                schedulesByDate={schedulesByDate}
                onSelectDate={setSelectedDate}
              />
            </View>

            <View style={{ paddingHorizontal: s(20), paddingTop: s(20) }}>
              <Typography variant="body-02" className="text-gray-700">
                {format(selectedDate, 'yyyy년 MM월 dd일', { locale: ko })}
              </Typography>
            </View>

            <View className="flex-1" style={{ position: 'relative' }}>
              <ScrollView
                className="flex-1"
                contentContainerClassName="pb-10"
                refreshControl={
                  <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={refetch}
                    tintColor={COLORS.primary}
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                <DayEvents
                  isLoading={isLoading}
                  isError={isError}
                  schedules={selectedDaySchedules}
                  onItemPress={(id) => router.push(`/(main)/schedule/${id}`)}
                  onRetry={refetch}
                />
              </ScrollView>
              <LinearGradient
                pointerEvents="none"
                colors={[COLORS.white, 'rgba(255,255,255,0)']}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: s(24),
                }}
              />
            </View>
          </>
        ) : viewMode === 'list' ? (
          <>
            <WeekStrip
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <View className="flex-1 bg-surface">
              <DayTimeline
                date={selectedDate}
                weekSchedules={weekSchedules}
                onItemPress={(id) => router.push(`/(main)/schedule/${id}`)}
              />
            </View>
          </>
        ) : (
          <StatsView
            schedules={schedules ?? []}
            month={month}
            isLoading={isLoading}
            isError={isError}
            isRefetching={isRefetching}
            onRefresh={refetch}
            onRetry={refetch}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

interface DayEventsProps {
  isLoading: boolean;
  isError: boolean;
  schedules: ScheduleListItem[];
  onItemPress: (id: string) => void;
  onRetry: () => void;
}

function DayEvents({
  isLoading,
  isError,
  schedules,
  onItemPress,
  onRetry,
}: DayEventsProps) {
  if (isLoading) {
    return (
      <View className="items-center" style={{ paddingVertical: s(40) }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (isError) {
    return (
      <View
        className="items-center"
        style={{ paddingVertical: s(40), gap: s(8) }}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={s(40)}
          color={COLORS.gray[300]}
        />
        <Typography variant="body-03" className="text-gray-500">
          일정을 불러올 수 없습니다
        </Typography>
        <TouchableOpacity
          onPress={onRetry}
          style={{
            marginTop: s(4),
            paddingHorizontal: s(20),
            paddingVertical: s(8),
          }}
          className="rounded-md bg-primary"
        >
          <Typography variant="body-03" weight="semibold" className="text-white">
            다시 시도
          </Typography>
        </TouchableOpacity>
      </View>
    );
  }
  if (schedules.length === 0) {
    return (
      <View
        className="items-center"
        style={{ paddingVertical: s(40), gap: s(8) }}
      >
        <Ionicons
          name="calendar-outline"
          size={s(40)}
          color={COLORS.gray[300]}
        />
        <Typography variant="body-02" className="text-gray-500">
          이 날 일정이 없어요
        </Typography>
      </View>
    );
  }

  return (
    <View style={{ gap: s(10), marginTop: s(12), paddingHorizontal: s(20) }}>
      {schedules.map((item, idx) => (
        <ScheduleItem
          key={item.id}
          item={item}
          barColor={getScheduleColorByIndex(idx)}
          onPress={() => onItemPress(item.id)}
        />
      ))}
    </View>
  );
}

/* ───────────────────────── Stats View ───────────────────────── */

const STAT_COLOR = {
  counseling: COLORS.counseling,
  assessment: COLORS.assessment,
  noShow: COLORS.negative,
} as const;

const STAT_BG = {
  counseling: 'rgba(5, 177, 122, 0.06)',
  assessment: 'rgba(52, 149, 245, 0.06)',
  noShow: 'rgba(255, 66, 66, 0.05)',
} as const;

interface StatsViewProps {
  schedules: ScheduleListItem[];
  month: Date;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onRetry: () => void;
}

function StatsView({
  schedules,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  onRetry,
}: StatsViewProps) {
  const stats = useMemo(() => {
    let counseling = 0;
    let assessment = 0;
    let noShow = 0;
    for (const sch of schedules) {
      if (sch.schedule_type === 'block') continue;
      if (sch.schedule_type === 'counseling') counseling += 1;
      else if (sch.schedule_type === 'assessment') assessment += 1;
      if (deriveStatus(sch) === 'no_show') noShow += 1;
    }
    return { counseling, assessment, noShow };
  }, [schedules]);

  const weekdayCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const sch of schedules) {
      if (sch.schedule_type === 'block') continue;
      const day = parseDate(sch.start).getDay();
      counts[day] += 1;
    }
    return counts;
  }, [schedules]);

  const noShowItems = useMemo(() => {
    return schedules
      .filter((sch) => deriveStatus(sch) === 'no_show')
      .sort(
        (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime(),
      );
  }, [schedules]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ gap: s(8), paddingHorizontal: s(20) }}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={s(40)}
          color={COLORS.gray[300]}
        />
        <Typography variant="body-03" className="text-gray-500">
          통계를 불러올 수 없습니다
        </Typography>
        <TouchableOpacity
          onPress={onRetry}
          style={{
            marginTop: s(4),
            paddingHorizontal: s(20),
            paddingVertical: s(8),
          }}
          className="rounded-md bg-primary"
        >
          <Typography variant="body-03" weight="semibold" className="text-white">
            다시 시도
          </Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(8),
        paddingBottom: s(40),
        gap: s(12),
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', gap: s(10) }}>
        <BigStatCard kind="counseling" label="상담" count={stats.counseling} />
        <BigStatCard kind="assessment" label="검사" count={stats.assessment} />
        <BigStatCard kind="noShow" label="노쇼" count={stats.noShow} />
      </View>

      <WeekdayDistribution counts={weekdayCounts} />

      {noShowItems.length > 0 && (
        <NoShowList items={noShowItems} total={stats.noShow} />
      )}
    </ScrollView>
  );
}

function BigStatCard({
  kind,
  label,
  count,
}: {
  kind: 'counseling' | 'assessment' | 'noShow';
  label: string;
  count: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: STAT_BG[kind],
        borderRadius: s(16),
        paddingVertical: s(14),
        paddingHorizontal: s(12),
        justifyContent: 'space-between',
        minHeight: s(86),
      }}
    >
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: STAT_COLOR[kind] }}
      >
        {label}
      </Typography>
      <Typography
        weight="bold"
        style={{
          fontSize: s(24),
          lineHeight: s(30),
          color: COLORS.gray[900],
          letterSpacing: -0.5,
        }}
      >
        {count}
      </Typography>
    </View>
  );
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_BAR_HEIGHT = 80;

function WeekdayDistribution({ counts }: { counts: number[] }) {
  const maxCount = Math.max(1, ...counts);
  const maxIndex = counts.indexOf(maxCount);
  const hasAny = maxCount > 0;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const activeIndex = selectedIndex ?? maxIndex;

  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        padding: s(16),
        gap: s(12),
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
      >
        요일별 분포
      </Typography>
      <View
        style={{
          flexDirection: 'row',
          gap: s(6),
          alignItems: 'flex-end',
          height: s(MAX_BAR_HEIGHT + 24),
        }}
      >
        {counts.map((n, i) => {
          const isSunday = i === 0;
          const ratio = n / maxCount;
          const barHeight = Math.max(s(4), Math.round(ratio * s(MAX_BAR_HEIGHT)));
          const showTooltip = hasAny && i === activeIndex;

          return (
            <View
              key={i}
              style={{ flex: 1, gap: s(6), alignItems: 'center' }}
            >
              <TouchableOpacity
                onPress={() => setSelectedIndex(i)}
                activeOpacity={0.7}
                hitSlop={6}
                style={{ width: '100%' }}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_LABELS[i]}요일 ${n}건`}
              >
                {showTooltip && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      bottom: barHeight + s(6),
                      left: -s(100),
                      right: -s(100),
                      alignItems: 'center',
                    }}
                  >
                    <BarTooltip count={n} />
                  </View>
                )}
                <View
                  style={{
                    width: '100%',
                    height: barHeight,
                    backgroundColor: isSunday
                      ? COLORS.gray[200]
                      : COLORS.gray[700],
                    borderRadius: s(4),
                    opacity: 0.85,
                  }}
                />
              </TouchableOpacity>
              <Typography
                variant="caption-01"
                style={{
                  color: isSunday ? COLORS.negative : COLORS.gray[500],
                }}
              >
                {WEEKDAY_LABELS[i]}
              </Typography>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BarTooltip({ count }: { count: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          backgroundColor: COLORS.gray[900],
          borderRadius: s(8),
          paddingHorizontal: s(10),
          paddingVertical: s(6),
        }}
      >
        <Typography
          variant="body-03"
          weight="bold"
          style={{ color: COLORS.white }}
        >
          {count}건
        </Typography>
      </View>
      <View
        style={{
          marginTop: -1,
          width: 0,
          height: 0,
          borderLeftWidth: s(5),
          borderRightWidth: s(5),
          borderTopWidth: s(5),
          borderStyle: 'solid',
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: COLORS.gray[900],
        }}
      />
    </View>
  );
}

function NoShowList({
  items,
  total,
}: {
  items: ScheduleListItem[];
  total: number;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        padding: s(16),
        gap: s(12),
      }}
    >
      <View className="flex-row items-center justify-between">
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
        >
          노쇼 내역
        </Typography>
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.negative }}
        >
          {total}건
        </Typography>
      </View>
      {items.map((sch) => {
        const primary = sch.clients?.[0];
        const name = primary?.name ?? sch.title ?? '내담자';
        const dateLabel = format(parseDate(sch.start), 'M월 d일', {
          locale: ko,
        });
        return (
          <View
            key={sch.id}
            className="flex-row items-center justify-between"
            style={{ paddingVertical: s(4) }}
          >
            <View className="flex-row items-center" style={{ gap: s(8) }}>
              <View
                style={{
                  width: s(6),
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: COLORS.negative,
                }}
              />
              <Typography
                variant="body-03"
                className="text-gray-900"
                numberOfLines={1}
              >
                {name}
              </Typography>
            </View>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              {dateLabel}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}
