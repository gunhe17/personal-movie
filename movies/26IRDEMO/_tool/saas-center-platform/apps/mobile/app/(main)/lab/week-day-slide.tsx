import { useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 일정 주간 보기 — 날짜 전환 시 좌우 슬라이드 인터랙션 lab
 *
 * 컨셉:
 *   - 26 → 27 (다음 날): 기존 카드 좌측으로 슬라이드 아웃 + 새 카드 우측에서 슬라이드 인
 *   - 27 → 26 (이전 날): 기존 카드 우측으로 슬라이드 아웃 + 새 카드 좌측에서 슬라이드 인
 *
 * 구현:
 *   - 단일 Animated.Value progress (0→1) 로 양쪽 View의 translateX 동기화
 *   - direction (+1 다음 / -1 이전) 으로 방향 분기
 *   - 애니메이션 중에는 outgoingDate를 별도 렌더(absolute), 끝나면 unmount
 */

const SCREEN_WIDTH = Dimensions.get('window').width;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface MockSchedule {
  id: string;
  time: string;
  title: string;
  meta: string;
  type: 'counseling' | 'assessment';
}

// 한 주 mock — 날짜별 0~4건
function getMockSchedules(date: Date): MockSchedule[] {
  const day = date.getDay(); // 0=일 ~ 6=토
  const base = date.getDate();
  if (day === 0) return []; // 일요일 휴무
  if (day === 6) return [
    {
      id: `${base}-1`,
      time: '10:00 ~ 10:50',
      title: '[상담] 박서연',
      meta: '상담실 A · 놀이치료-개인',
      type: 'counseling',
    },
  ];
  // 평일 평균 3건
  const count = (base % 4) + 2;
  const types: MockSchedule['type'][] = ['counseling', 'counseling', 'assessment'];
  const names = ['김민준', '이지호', '박서연 외 2명', '한지우', '최도윤'];
  return Array.from({ length: count }, (_, i) => ({
    id: `${base}-${i}`,
    time: `${10 + i * 2}:00 ~ ${10 + i * 2}:50`,
    title: `[${types[i % 3] === 'counseling' ? '상담' : '검사'}] ${names[i % names.length]}`,
    meta:
      types[i % 3] === 'counseling'
        ? '상담실 A · 놀이치료-개인'
        : '검사실 · K-WISC',
    type: types[i % 3],
  }));
}

export default function WeekDaySlideLab() {
  const router = useRouter();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [outgoingDate, setOutgoingDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleSelectDate = useCallback(
    (newDate: Date) => {
      if (animating) return;
      if (isSameDay(newDate, currentDate)) return;
      const dir = isAfter(newDate, currentDate) ? 1 : -1;
      setDirection(dir);
      setOutgoingDate(currentDate);
      setCurrentDate(newDate);
      setAnimating(true);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setAnimating(false);
        setOutgoingDate(null);
      });
    },
    [animating, currentDate, progress],
  );

  const outgoingTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -direction * SCREEN_WIDTH],
  });
  const incomingTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction * SCREEN_WIDTH, 0],
  });
  // 슬라이드와 함께 fade — outgoing은 0.6까지만 빠지게(완전 투명은 휑함), incoming은 0→1
  const outgoingOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });
  const incomingOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.6, 1],
  });

  const currentSchedules = getMockSchedules(currentDate);
  const outgoingSchedules = outgoingDate ? getMockSchedules(outgoingDate) : [];

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              주간 날짜 슬라이드
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* WeekStrip 미니 */}
        <View
          style={{
            paddingHorizontal: s(12),
            paddingTop: s(4),
            paddingBottom: s(12),
          }}
        >
          <View className="flex-row">
            {WEEKDAYS.map((w, idx) => (
              <View
                key={w}
                style={{ height: s(28) }}
                className="flex-1 items-center justify-center"
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{
                    color: idx === 6 ? COLORS.error : COLORS.gray[500],
                  }}
                >
                  {w}
                </Typography>
              </View>
            ))}
          </View>
          <View className="flex-row">
            {days.map((day) => {
              const isSelected = isSameDay(day, currentDate);
              const isToday = isSameDay(day, today);
              const isSunday = day.getDay() === 0;
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  onPress={() => handleSelectDate(day)}
                  activeOpacity={0.7}
                  style={{ height: s(44), paddingTop: s(4) }}
                  className="flex-1 items-center"
                >
                  <View
                    style={{ width: s(28), height: s(28) }}
                    className={`items-center justify-center rounded-full ${
                      isSelected ? 'bg-primary' : ''
                    }`}
                  >
                    <Typography
                      variant="body-02"
                      weight={isSelected || isToday ? 'semibold' : 'medium'}
                      style={{
                        color: isSelected
                          ? COLORS.white
                          : isToday
                            ? COLORS.primary
                            : isSunday
                              ? COLORS.error
                              : COLORS.gray[800],
                      }}
                    >
                      {format(day, 'd')}
                    </Typography>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* 선택일 헤더 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingVertical: s(12),
          backgroundColor: COLORS.white,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.gray[100],
        }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {format(currentDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
        </Typography>
      </View>

      {/* 카드 영역 — 슬라이드 carousel */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {/* outgoing (애니메이션 중에만 렌더) */}
        {outgoingDate && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              transform: [{ translateX: outgoingTranslate }],
              opacity: outgoingOpacity,
            }}
          >
            <ScheduleList schedules={outgoingSchedules} />
          </Animated.View>
        )}
        {/* incoming (현재 선택일) */}
        <Animated.View
          style={{
            flex: 1,
            transform: [
              { translateX: outgoingDate ? incomingTranslate : 0 },
            ],
            opacity: outgoingDate ? incomingOpacity : 1,
          }}
        >
          <ScheduleList schedules={currentSchedules} />
        </Animated.View>
      </View>
    </View>
  );
}

/* ───────── Schedule List ───────── */

function ScheduleList({ schedules }: { schedules: MockSchedule[] }) {
  if (schedules.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: s(80),
          gap: s(8),
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={s(40)}
          color={COLORS.gray[300]}
        />
        <Typography
          variant="body-03"
          style={{ color: COLORS.gray[400] }}
        >
          이 날은 한숨 돌리는 날이에요
        </Typography>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(16),
        paddingBottom: s(40),
        gap: s(10),
      }}
      showsVerticalScrollIndicator={false}
    >
      {schedules.map((sch) => (
        <ScheduleCard key={sch.id} schedule={sch} />
      ))}
    </ScrollView>
  );
}

function ScheduleCard({ schedule }: { schedule: MockSchedule }) {
  const categoryColor =
    schedule.type === 'assessment' ? COLORS.assessment : COLORS.counseling;
  return (
    <View
      style={{
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[50],
        gap: s(6),
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}
      >
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
          style={{ color: COLORS.gray[900] }}
        >
          {schedule.title}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[700] }}
      >
        {schedule.time}
      </Typography>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[600] }}
      >
        {schedule.meta}
      </Typography>
    </View>
  );
}
