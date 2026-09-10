/**
 * [일정] — INFORMATION_SPEC §3-1/§3-2 v2 반영 시안 (lab)
 *
 * - 일정 상태 3가지(예정/완료/취소)로 정리. 노쇼는 일정 상태에서 제거.
 *   (내담자 출결 노쇼는 회기 바텀시트에서 다룸 — 본 시안 범위 밖)
 * - 3 뷰 자유 전환: 리스트형(주별) / 캘린더형(월별) / 통계
 * - 월별 캘린더는 production MonthCalendar 그대로 재사용
 * - mock data로 진행중·완료·취소(사유) 상태 시각 차별화 시연
 */

import { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  getWeekOfMonth,
  format,
  isSameDay,
  isToday as checkIsToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';

// 캘린더 타이틀 helper
const WEEK_OF_MONTH_LABELS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째'] as const;
function formatWeekOfMonth(date: Date): string {
  const week = getWeekOfMonth(date, { weekStartsOn: 1 });
  const label = WEEK_OF_MONTH_LABELS[week - 1] ?? `${week}째`;
  return `${format(date, 'M월')} ${label}주`;
}

import { MonthCalendar } from '../(tabs)/_components/MonthCalendar';
import type { ScheduleListItem } from '@/features/schedule';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

// ─── 스펙 v2 상태 enum (no_show 제거) ───
type LabScheduleStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

type LabScheduleType = 'counseling' | 'assessment';

type LabScheduleMock = {
  id: string;
  type: LabScheduleType; // 상담/검사 구분 — 카드 좌측 컬러 라인
  start: Date;
  end: Date;
  status: LabScheduleStatus;
  programName: string;
  roomName: string;
  primaryClient: { name: string; gender: 'male' | 'female'; age: number };
  extraClientsCount?: number; // 그룹 일정 "외 N명"
  cancelReason?: { code: string; note?: string }; // 취소 사유 enum + 비고
};

// ─── 시간 spine 상수 (리스트 뷰 타임라인) ───
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 21;
const HOUR_HEIGHT = 64; // 1시간 = 64dp (scale 적용은 사용처에서 s() 호출)

// ─── 시뮬레이션 NOW — lab 시안 일관성을 위해 오늘 13:30 고정 ───
const MOCK_NOW: Date = (() => {
  const d = new Date();
  d.setHours(13, 30, 0, 0);
  return d;
})();

function hourToOffset(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  // s() 적용 — spine·hour 라인이 s(HOUR_HEIGHT) 기준이라 카드 top도 같은 단위
  return (hours - TIMELINE_START_HOUR) * s(HOUR_HEIGHT);
}

function getMinutesUntil(date: Date): number {
  return Math.round((date.getTime() - MOCK_NOW.getTime()) / 60000);
}

// ─── mock 일정 데이터 (이번주 기준) ───
function buildMocks(): LabScheduleMock[] {
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const t = (offsetDays: number, h: number, m: number = 0) => {
    const d = addDays(today0, offsetDays);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const today = 0;
  const tomorrow = 1;
  const yesterday = -1;

  return [
    // 오늘 — MOCK_NOW(13:30) 기준 완료/취소/진행중/임박/예정 모두 분포
    {
      id: 'm1',
      type: 'counseling',
      start: t(today, 10, 0),
      end: t(today, 11, 0),
      status: 'completed',
      programName: '놀이치료-개인',
      roomName: '상담실 A',
      primaryClient: { name: '김민준', gender: 'male', age: 9 },
    },
    {
      id: 'm2',
      type: 'counseling',
      start: t(today, 11, 30),
      end: t(today, 12, 30),
      status: 'cancelled',
      programName: '인지치료-개인',
      roomName: '상담실 B',
      primaryClient: { name: '이서연', gender: 'female', age: 11 },
      cancelReason: { code: '내담자 사정', note: '감기로 인한 결석 통보' },
    },
    {
      id: 'm3',
      type: 'counseling',
      // 진행중 — MOCK_NOW(13:30) 안에 들어옴
      start: t(today, 13, 0),
      end: t(today, 14, 0),
      status: 'in_progress',
      programName: '놀이치료-그룹',
      roomName: '그룹실',
      primaryClient: { name: '박지호', gender: 'male', age: 8 },
      extraClientsCount: 2,
    },
    {
      id: 'm4',
      type: 'counseling',
      // 임박 — MOCK_NOW(13:30) + 30분
      start: t(today, 14, 0),
      end: t(today, 15, 0),
      status: 'upcoming',
      programName: '학습치료-개인',
      roomName: '상담실 C',
      primaryClient: { name: '최아람', gender: 'female', age: 12 },
    },
    {
      id: 'm5',
      type: 'assessment', // 검사 일정 — blue 라인
      start: t(today, 16, 0),
      end: t(today, 17, 0),
      status: 'upcoming',
      programName: 'K-WISC 종합검사',
      roomName: '검사실 1',
      primaryClient: { name: '정유나', gender: 'female', age: 10 },
    },
    {
      id: 'm6',
      type: 'counseling',
      start: t(today, 17, 30),
      end: t(today, 18, 30),
      status: 'upcoming',
      programName: '언어치료-개인',
      roomName: '상담실 B',
      primaryClient: { name: '오시우', gender: 'male', age: 7 },
    },
    // 내일
    {
      id: 'm7',
      type: 'counseling',
      start: t(tomorrow, 11, 0),
      end: t(tomorrow, 12, 0),
      status: 'upcoming',
      programName: '놀이치료-개인',
      roomName: '상담실 A',
      primaryClient: { name: '김민준', gender: 'male', age: 9 },
    },
    // 어제
    {
      id: 'm8',
      type: 'assessment', // 검사 — blue 라인
      start: t(yesterday, 14, 0),
      end: t(yesterday, 15, 0),
      status: 'completed',
      programName: 'BGT 검사',
      roomName: '검사실 2',
      primaryClient: { name: '윤서아', gender: 'female', age: 7 },
    },
  ];
}

// production MonthCalendar에 넘길 schedulesByDate (시각용 — content는 빈 객체로 OK)
function buildSchedulesByDate(
  mocks: LabScheduleMock[],
): Map<string, ScheduleListItem[]> {
  const map = new Map<string, ScheduleListItem[]>();
  for (const m of mocks) {
    const key = format(m.start, 'yyyy-MM-dd');
    const existing = map.get(key) ?? [];
    // MonthCalendar는 length만 보고 dot 개수 결정 — 최소 필드만 채움
    existing.push({
      id: m.id,
      start: m.start.toISOString(),
      end: m.end.toISOString(),
      schedule_type: 'counseling',
      room_name: m.roomName,
      counselor_name: null,
      client_names: [m.primaryClient.name],
      clients: [
        {
          id: m.primaryClient.name,
          name: m.primaryClient.name,
          gender: m.primaryClient.gender,
          birth_date: null,
        },
      ],
      title: null,
      program_name: m.programName,
      session_status: m.status,
    });
    map.set(key, existing);
  }
  return map;
}

type ViewMode = 'list' | 'calendar' | 'stats';

export default function ScheduleSpecV2Lab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const mocks = useMemo(() => buildMocks(), []);
  const schedulesByDate = useMemo(() => buildSchedulesByDate(mocks), [mocks]);

  const dayMocks = useMemo(
    () => mocks.filter((m) => isSameDay(m.start, selectedDate)),
    [mocks, selectedDate],
  );

  // 캘린더 타이틀 좌우 이동 핸들러
  const handlePrev = () => {
    if (viewMode === 'list') {
      setSelectedDate((d) => subWeeks(d, 1));
    } else if (viewMode === 'calendar') {
      setCalendarMonth((d) => subMonths(d, 1));
    }
  };
  const handleNext = () => {
    if (viewMode === 'list') {
      setSelectedDate((d) => addWeeks(d, 1));
    } else if (viewMode === 'calendar') {
      setCalendarMonth((d) => addMonths(d, 1));
    }
  };
  const goToday = () => {
    setSelectedDate(MOCK_NOW);
    setCalendarMonth(MOCK_NOW);
  };

  const calendarTitle =
    viewMode === 'list'
      ? formatWeekOfMonth(selectedDate)
      : format(calendarMonth, 'M월');
  const showCalendarHeader = viewMode === 'list' || viewMode === 'calendar';
  const isOnToday =
    viewMode === 'calendar'
      ? isSameDay(calendarMonth, MOCK_NOW) && isSameDay(selectedDate, MOCK_NOW)
      : isSameDay(selectedDate, MOCK_NOW);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 1행: 뒤로가기 + "일정" + 뷰 전환 토글 */}
        <View
          style={{
            height: s(52),
            paddingHorizontal: s(8),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.white,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
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
              일정
            </Typography>
          </View>
          <View style={{ paddingRight: s(12) }}>
            <ViewModeSegment value={viewMode} onChange={setViewMode} />
          </View>
        </View>

        {/* 2행: ◀ 캘린더 타이틀 ▶ + 오늘 버튼 (list/calendar 뷰만) */}
        {showCalendarHeader && (
          <View
            style={{
              paddingHorizontal: s(20),
              paddingTop: s(16),
              paddingBottom: s(10),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: COLORS.white,
            }}
          >
            <View style={{ width: s(52) }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(12),
              }}
            >
              <TouchableOpacity
                onPress={handlePrev}
                style={{
                  width: s(28),
                  height: s(28),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel={viewMode === 'list' ? '이전 주' : '이전 달'}
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
                style={{ color: COLORS.gray[900] }}
              >
                {calendarTitle}
              </Typography>
              <TouchableOpacity
                onPress={handleNext}
                style={{
                  width: s(28),
                  height: s(28),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                accessibilityLabel={viewMode === 'list' ? '다음 주' : '다음 달'}
              >
                <Ionicons
                  name="chevron-forward"
                  size={s(16)}
                  color={COLORS.gray[800]}
                />
              </TouchableOpacity>
            </View>
            {!isOnToday ? (
              <TouchableOpacity
                onPress={goToday}
                style={{
                  height: s(28),
                  paddingHorizontal: s(12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: s(6),
                  borderWidth: 1,
                  borderColor: COLORS.gray[200],
                }}
                accessibilityLabel="오늘로 이동"
              >
                <Typography
                  variant="label-01"
                  weight="medium"
                  style={{ color: COLORS.gray[700] }}
                >
                  오늘
                </Typography>
              </TouchableOpacity>
            ) : (
              <View style={{ width: s(52) }} />
            )}
          </View>
        )}

        {/* 3+4행: WeekStrip (list) 또는 MonthCalendar 요일·날짜 (calendar) — sticky 영역 */}
        {viewMode === 'list' && (
          <View style={{ backgroundColor: COLORS.white, paddingBottom: s(8) }}>
            <WeekStripLite
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              mocks={mocks}
            />
          </View>
        )}
        {viewMode === 'calendar' && (
          <View style={{ backgroundColor: COLORS.white, paddingBottom: s(8) }}>
            <MonthCalendar
              month={calendarMonth}
              selectedDate={selectedDate}
              schedulesByDate={schedulesByDate}
              onSelectDate={setSelectedDate}
            />
          </View>
        )}

        {/* 본문 — 콘텐츠만 */}
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + s(40),
          }}
          showsVerticalScrollIndicator={false}
        >
          {viewMode === 'list' && (
            <ListContent
              selectedDate={selectedDate}
              dayMocks={dayMocks}
            />
          )}
          {viewMode === 'calendar' && (
            <CalendarContent
              selectedDate={selectedDate}
              dayMocks={dayMocks}
            />
          )}
          {viewMode === 'stats' && <StatsView mocks={mocks} />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── 뷰 모드 segment (작은 아이콘 3개 — production 패턴) ───
function ViewModeSegment({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const items: Array<{
    key: ViewMode;
    icon: 'list-outline' | 'grid-outline' | 'stats-chart-outline';
    label: string;
  }> = [
    { key: 'list', icon: 'list-outline', label: '리스트 뷰' },
    { key: 'calendar', icon: 'grid-outline', label: '캘린더 뷰' },
    { key: 'stats', icon: 'stats-chart-outline', label: '통계' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        height: s(32),
        padding: s(2),
        gap: s(4),
        borderRadius: s(16),
        backgroundColor: COLORS.gray[50],
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
              width: s(40),
              height: s(28),
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: s(14),
              backgroundColor: active ? COLORS.white : 'transparent',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 2,
              elevation: active ? 1 : 0,
            }}
            accessibilityLabel={it.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={it.icon}
              size={s(18)}
              color={active ? COLORS.gray[900] : COLORS.gray[400]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 리스트 뷰 (주별) ───
// ─── 리스트 콘텐츠 — 헤더(WeekStrip + 캘린더 타이틀 + 오늘 버튼)는 페이지 레벨로 이동 ───
function ListContent({
  selectedDate,
  dayMocks,
}: {
  selectedDate: Date;
  dayMocks: LabScheduleMock[];
}) {
  if (dayMocks.length === 0) {
    return (
      <View
        style={{
          paddingVertical: s(48),
          alignItems: 'center',
          gap: s(8),
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={s(40)}
          color={COLORS.gray[300]}
        />
        <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>
          이 날짜에 등록된 일정이 없어요
        </Typography>
      </View>
    );
  }
  return <DayTimelineView dayMocks={dayMocks} selectedDate={selectedDate} />;
}

// ─── 주간 strip ───
function WeekStripLite({
  selectedDate,
  onSelectDate,
  mocks,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  mocks: LabScheduleMock[];
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mocks) {
      const k = format(m.start, 'yyyy-MM-dd');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [mocks]);

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: s(12),
        marginTop: s(4),
      }}
    >
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate);
        const isTodayFlag = checkIsToday(day);
        const isSunday = day.getDay() === 0;
        const count = countByDay.get(format(day, 'yyyy-MM-dd')) ?? 0;
        return (
          <TouchableOpacity
            key={day.toISOString()}
            onPress={() => onSelectDate(day)}
            style={{
              flex: 1,
              paddingVertical: s(8),
              alignItems: 'center',
              gap: s(4),
            }}
            activeOpacity={0.7}
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{
                color: isSunday ? COLORS.error : COLORS.gray[500],
              }}
            >
              {format(day, 'EEE', { locale: ko })}
            </Typography>
            <View
              style={{
                width: s(32),
                height: s(32),
                borderRadius: s(16),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected
                  ? COLORS.primary
                  : isTodayFlag
                    ? COLORS.primary50
                    : 'transparent',
              }}
            >
              <Typography
                variant="body-02"
                weight="semibold"
                style={{
                  color: selected
                    ? COLORS.white
                    : isTodayFlag
                      ? COLORS.primary
                      : COLORS.gray[900],
                }}
              >
                {format(day, 'd')}
              </Typography>
            </View>
            {count > 0 && (
              <View
                style={{
                  width: s(4),
                  height: s(4),
                  borderRadius: s(2),
                  backgroundColor: selected ? COLORS.primary : COLORS.gray[400],
                }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 하루 타임라인 뷰 (리스트 탭) ───
// 좌측 시간 spine + hour 라인 + 일정 카드(시작 시각 위치) + NOW 가로 마커
function DayTimelineView({
  dayMocks,
  selectedDate,
}: {
  dayMocks: LabScheduleMock[];
  selectedDate: Date;
}) {
  const isTodayView = isSameDay(selectedDate, MOCK_NOW);
  const hours = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, i) => TIMELINE_START_HOUR + i,
  );
  const totalHeight = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * s(HOUR_HEIGHT);

  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(20) }}>
      <View style={{ flexDirection: 'row', height: totalHeight }}>
        {/* 좌측 시간 spine — 숫자 우측 정렬 + 라인과 8px 간격 */}
        <View style={{ width: s(40) }}>
          {hours.map((h) => (
            <View
              key={h}
              style={{
                height: s(HOUR_HEIGHT),
                alignItems: 'flex-end',
                paddingRight: s(8),
              }}
            >
              <Typography
                variant="label-02"
                weight="medium"
                style={{ color: COLORS.gray[400], marginTop: -s(8) }}
              >
                {h}
              </Typography>
            </View>
          ))}
        </View>

        {/* 카드 영역 */}
        <View style={{ flex: 1, position: 'relative' }}>
          {/* hour 라인 (각 시간 시작점에 옅은 라인) */}
          {hours.map((h, idx) => (
            <View
              key={`line-${h}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: idx * s(HOUR_HEIGHT),
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: COLORS.gray[100],
              }}
            />
          ))}

          {/* 일정 카드 — 시작 시각 위치에 절대 배치 */}
          {dayMocks
            .filter(
              (m) =>
                m.start.getHours() >= TIMELINE_START_HOUR &&
                m.start.getHours() <= TIMELINE_END_HOUR,
            )
            .map((m) => {
              const top = hourToOffset(m.start);
              const height = Math.max(
                s(36),
                hourToOffset(m.end) - hourToOffset(m.start),
              );
              const minutesUntil =
                isTodayView && m.status === 'upcoming'
                  ? getMinutesUntil(m.start)
                  : null;
              const isImminent =
                minutesUntil !== null && minutesUntil > 0 && minutesUntil <= 30;
              return (
                <View
                  key={m.id}
                  style={{
                    position: 'absolute',
                    top,
                    left: s(8),
                    right: 0,
                    height,
                  }}
                >
                  <TimedScheduleCard
                    mock={m}
                    height={height}
                    minutesUntil={minutesUntil}
                    isImminent={isImminent}
                  />
                </View>
              );
            })}

          {/* NOW 가로 마커 — 오늘 보고 있을 때만 */}
          {isTodayView && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: hourToOffset(MOCK_NOW),
                left: -s(8),
                right: 0,
                height: 0,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: s(8),
                  height: s(8),
                  borderRadius: s(4),
                  backgroundColor: COLORS.negative,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundColor: COLORS.negative,
                }}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── 타임라인용 일정 카드 — 카드 안 시간 컬럼 제거 (spine이 시간 담당) ───
function TimedScheduleCard({
  mock,
  height,
  minutesUntil,
  isImminent,
}: {
  mock: LabScheduleMock;
  height: number;
  minutesUntil: number | null;
  isImminent: boolean;
}) {
  const router = useRouter();
  const isCancelled = mock.status === 'cancelled';
  const isInProgress = mock.status === 'in_progress';
  const isCompleted = mock.status === 'completed';

  // 카드 배경으로 상태 구분 — 보더 없이 cardBg 톤 차별화
  const cardBg = isInProgress
    ? COLORS.primary50 // 진행중 — primary tint
    : isCompleted
      ? COLORS.gray[100] // 완료 — 좀 더 진한 회색
      : isCancelled
        ? COLORS.paletteBg.red // 취소 — 옅은 빨강
        : COLORS.gray[50]; // 예정 (기본)
  // opacity 약하게 가라앉히기만 — 너무 흐려지지 않도록
  const contentOpacity = isCancelled ? 0.7 : isCompleted ? 0.85 : 1;

  // 타이틀 = [상담/검사] prefix + 내담자 이름 (그룹은 "외 N명"). 프로그램명은 메타로.
  const categoryPrefix = mock.type === 'assessment' ? '[검사]' : '[상담]';
  const titleText = mock.extraClientsCount
    ? `${categoryPrefix} ${mock.primaryClient.name} 외 ${mock.extraClientsCount}명`
    : `${categoryPrefix} ${mock.primaryClient.name}`;

  // 카테고리 dot 색 — 상담 green / 검사 blue (캘린더 dot과 일관)
  const categoryColor =
    mock.type === 'assessment' ? COLORS.assessment : COLORS.counseling;

  // 짧은 카드(15분 이하)에서만 메타 숨김 — 1시간 카드는 메타 표시
  const isShortCard = height < s(40);

  const handlePress = () => {
    router.push('/(main)/lab/schedule-detail-spec-v2');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${titleText} 상세 보기`}
      style={{ height }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: cardBg,
          borderRadius: s(12),
          paddingVertical: s(8),
          paddingHorizontal: s(12),
          // 진행중 카드는 살짝 그림자
          shadowColor: isInProgress ? COLORS.primary : 'transparent',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isInProgress ? 0.16 : 0,
          shadowRadius: isInProgress ? 8 : 0,
        }}
      >
        {/* 1행: 타이틀 + 성별·나이 + 상태/임박 뱃지 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
            opacity: contentOpacity,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            {/* 카테고리 dot — 상담 green / 검사 blue */}
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: categoryColor,
              }}
            />
            <Typography
              variant="body-02"
              weight="semibold"
              style={{
                color: COLORS.gray[900],
                textDecorationLine: isCancelled ? 'line-through' : 'none',
                textDecorationColor: COLORS.gray[500],
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {titleText}
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[500] }}
              numberOfLines={1}
            >
              {mock.primaryClient.gender === 'female' ? '여' : '남'} · 만{' '}
              {mock.primaryClient.age}세
            </Typography>
          </View>
          {isImminent && (
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(2),
                borderRadius: s(4),
                backgroundColor: COLORS.primary,
              }}
            >
              <Typography
                variant="label-02"
                weight="bold"
                style={{ color: COLORS.white }}
              >
                {minutesUntil}분 뒤
              </Typography>
            </View>
          )}
          {isInProgress && !isImminent && (
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(2),
                borderRadius: s(4),
                backgroundColor: 'rgba(255,146,0,0.12)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(3),
              }}
            >
              <Ionicons name="ellipse" size={6} color={COLORS.warning} />
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.warning }}
              >
                진행 중
              </Typography>
            </View>
          )}
          {isCancelled && (
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(2),
                borderRadius: s(4),
                backgroundColor: COLORS.paletteBg.red,
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.palette.red }}
              >
                취소
              </Typography>
            </View>
          )}
        </View>

        {/* 2행: 시간 범위 · 장소 · 프로그램 (짧은 카드면 숨김) */}
        {!isShortCard && (
          <View
            style={{
              marginTop: s(4),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
              opacity: contentOpacity,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[500] }}
            >
              {format(mock.start, 'HH:mm')}~{format(mock.end, 'HH:mm')}
            </Typography>
            {mock.roomName && (
              <>
                <View
                  style={{
                    width: 1,
                    height: s(8),
                    backgroundColor: COLORS.gray[300],
                  }}
                />
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.gray[500] }}
                  numberOfLines={1}
                >
                  {mock.roomName}
                </Typography>
              </>
            )}
            {mock.programName && (
              <>
                <View
                  style={{
                    width: 1,
                    height: s(8),
                    backgroundColor: COLORS.gray[300],
                  }}
                />
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.gray[500], flex: 1 }}
                  numberOfLines={1}
                >
                  {mock.programName}
                </Typography>
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── 캘린더 뷰 (월별) — production MonthCalendar 그대로 재사용 ───
// ─── 캘린더 콘텐츠 — 월 헤더 + MonthCalendar는 페이지 레벨로 이동. 선택일 일정 리스트만 ───
function CalendarContent({
  selectedDate,
  dayMocks,
}: {
  selectedDate: Date;
  dayMocks: LabScheduleMock[];
}) {
  return (
    <View>
      {/* 선택일 헤더 — "5월 22일 (목) · N건" */}
      <View
        style={{
          paddingHorizontal: s(20),
          marginTop: s(8),
        }}
      >
        <Typography variant="title-01" weight="semibold">
          {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
        </Typography>
        <Typography
          variant="body-03"
          style={{ color: COLORS.gray[500], marginTop: s(2) }}
        >
          {dayMocks.length}건의 일정
        </Typography>
      </View>

      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(16),
          gap: s(12),
        }}
      >
        {dayMocks.length === 0 ? (
          <View
            style={{
              paddingVertical: s(32),
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>
              이 날짜에 등록된 일정이 없어요
            </Typography>
          </View>
        ) : (
          dayMocks.map((m) => <LabScheduleCard key={m.id} mock={m} />)
        )}
      </View>
    </View>
  );
}

// ─── 통계 뷰 — production schedule.tsx StatsView 시각 패턴을 lab 안에 mock으로 재현 ───
// production 코드 직접 import는 디자이너 모드 영역 밖이라 시각 + mock 데이터만 동일하게.
// 노쇼는 스펙 v2에서 일정 상태 ❌ → mock noShow=0 → NoShowList 자연 미노출.

const STATS_MOCK = {
  counseling: 12,
  assessment: 3,
  noShow: 0,
  // 일(0) ~ 토(6) 분포
  weekdayCounts: [0, 3, 4, 2, 3, 2, 1],
};

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

function StatsView({ mocks: _mocks }: { mocks: LabScheduleMock[] }) {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(4),
        gap: s(12),
      }}
    >
      {/* 1) BigStatCard 3개 — tint 배경 */}
      <View style={{ flexDirection: 'row', gap: s(10) }}>
        <BigStatCard
          kind="counseling"
          label="상담"
          count={STATS_MOCK.counseling}
        />
        <BigStatCard
          kind="assessment"
          label="검사"
          count={STATS_MOCK.assessment}
        />
        <BigStatCard kind="noShow" label="노쇼" count={STATS_MOCK.noShow} />
      </View>

      {/* 2) 요일별 분포 */}
      <WeekdayDistribution counts={STATS_MOCK.weekdayCounts} />

      {/* 3) 노쇼 내역 — 스펙 v2 일정 상태에 노쇼 없음 → mock에선 자연스럽게 안 보임 */}
    </View>
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

  // lab 시안 — interaction 없음. 최댓값 막대에만 툴팁 고정.
  const activeIndex = maxIndex;

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
        style={{ color: COLORS.gray[900] }}
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
              <View style={{ width: '100%' }}>
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
              </View>
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

// ─── 일정 카드 (스펙 v2 반영: no_show 제거, 3 상태만) ───
function LabScheduleCard({ mock }: { mock: LabScheduleMock }) {
  const router = useRouter();
  const isCancelled = mock.status === 'cancelled';
  const isInProgress = mock.status === 'in_progress';
  const isCompleted = mock.status === 'completed';

  const cardBg = isInProgress ? COLORS.primary50 : COLORS.gray[50];
  const contentOpacity = isCancelled ? 0.55 : 1;

  const timeStartColor = isInProgress
    ? COLORS.primary700
    : isCancelled
      ? COLORS.gray[500]
      : COLORS.gray[900];
  const timeEndColor = isInProgress
    ? COLORS.primary
    : isCancelled
      ? COLORS.gray[400]
      : COLORS.gray[500];
  const timeLineColor = isInProgress ? COLORS.primary300 : COLORS.gray[300];

  // 타이틀 = [상담/검사] prefix + 내담자 이름 (그룹은 "외 N명")
  const categoryPrefix = mock.type === 'assessment' ? '[검사]' : '[상담]';
  const titleText = mock.extraClientsCount
    ? `${categoryPrefix} ${mock.primaryClient.name} 외 ${mock.extraClientsCount}명`
    : `${categoryPrefix} ${mock.primaryClient.name}`;

  // 카테고리 dot 색 — 상담 green / 검사 blue
  const categoryColor =
    mock.type === 'assessment' ? COLORS.assessment : COLORS.counseling;

  // 카드 탭 → [일정 상세] lab 화면 진입 (실험실 안 흐름 시연)
  const handlePress = () => {
    router.push('/(main)/lab/schedule-detail-spec-v2');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${titleText} 상세 보기`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* 시간 컬럼 */}
        <View
          style={{
            width: s(56),
            marginRight: s(12),
            paddingVertical: s(12),
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: timeStartColor }}
          >
            {format(mock.start, 'HH:mm')}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(12),
              backgroundColor: timeLineColor,
              marginVertical: s(4),
            }}
          />
          <Typography
            variant="body-01"
            weight="regular"
            style={{ color: timeEndColor }}
          >
            {format(mock.end, 'HH:mm')}
          </Typography>
        </View>

        {/* 카드 본문 */}
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: s(16),
            paddingVertical: s(12),
            paddingHorizontal: s(16),
            borderWidth: isInProgress ? 1.5 : 0,
            borderColor: isInProgress ? COLORS.primary300 : 'transparent',
          }}
        >
            {/* 1행: 타이틀 + 성별·나이 + 상태 뱃지 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(8),
                opacity: contentOpacity,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(6),
                }}
              >
                {/* 카테고리 dot — 상담 green / 검사 blue */}
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: categoryColor,
                  }}
                />
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{
                    color: COLORS.gray[900],
                    textDecorationLine: isCancelled ? 'line-through' : 'none',
                    textDecorationColor: COLORS.gray[500],
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {titleText}
                </Typography>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.gray[600] }}
                  numberOfLines={1}
                >
                  {mock.primaryClient.gender === 'female' ? '여' : '남'} · 만{' '}
                  {mock.primaryClient.age}세
                </Typography>
              </View>
              <StatusBadgeV2 status={mock.status} />
            </View>

          {/* 취소 사유는 카드에 노출하지 않음 — 상태 뱃지("취소")만 우상단 표시. 사유는 일정 상세에서 확인. */}

          {/* 일정 메타 (장소·프로그램) */}
          {!isCancelled && (
            <View
              style={{
                marginTop: s(12),
                gap: s(4),
                opacity: contentOpacity,
              }}
            >
              <MetaRow icon="location-20" text={mock.roomName} />
              <MetaRow icon="document-20" text={mock.programName} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaRow({
  icon,
  text,
}: {
  icon: 'location-20' | 'document-20';
  text: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      <Icon name={icon} size={s(20)} color={COLORS.gray[400]} />
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.gray[700], flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

// ─── 상태 뱃지 (스펙 v2: 4가지만 — no_show 제거) ───
function StatusBadgeV2({ status }: { status: LabScheduleStatus }) {
  const config: Record<
    LabScheduleStatus,
    { bg: string; fg: string; label: string; icon?: 'ellipse' | 'checkmark' | 'close' }
  > = {
    upcoming: {
      bg: COLORS.gray[100],
      fg: COLORS.gray[600],
      label: '예정',
    },
    in_progress: {
      bg: 'rgba(255,146,0,0.12)',
      fg: COLORS.warning,
      label: '진행 중',
      icon: 'ellipse',
    },
    completed: {
      bg: COLORS.paletteBg.green,
      fg: COLORS.palette.green,
      label: '완료',
      icon: 'checkmark',
    },
    cancelled: {
      bg: COLORS.paletteBg.red,
      fg: COLORS.palette.red,
      label: '취소',
      icon: 'close',
    },
  };
  const c = config[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bg,
        paddingHorizontal: s(8),
        paddingVertical: s(4),
        borderRadius: s(8),
        gap: s(4),
      }}
    >
      {c.icon && (
        <Ionicons
          name={c.icon}
          size={status === 'in_progress' ? 8 : 12}
          color={c.fg}
        />
      )}
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: c.fg }}
      >
        {c.label}
      </Typography>
    </View>
  );
}
