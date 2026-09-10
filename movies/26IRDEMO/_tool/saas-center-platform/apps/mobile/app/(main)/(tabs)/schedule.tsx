import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  isSameDay,
  isSameMonth,
  isAfter,
  addDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import {
  useScheduleRange,
  type ScheduleListItem,
} from '@/features/schedule';
import { GENDER_LABELS } from '@/features/client';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import { SessionDetailView } from '@/features/counseling/session';
import { MonthCalendar } from './_components/MonthCalendar';
import { withTabTransition } from './_components/TabTransition';
import { WeekStrip } from './_components/WeekStrip';
import { DayTimeline, MonthlyEventCard, type CardLayout } from './_components/DayTimeline';
import { deriveStatus } from './_components/utils';
import { Icon, type IconName } from '@/shared/components/icons';

// 한글 서수 매핑 — getWeekOfMonth(1~6) → "첫째주" 형태
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

// 세그먼트 thumb 기하 — items render와 동일 계산이어야 thumb가 버튼 위로 정확히 정렬됨.
// 컨테이너 높이 32dp - padding 2dp*2 = 내부 28dp → thumb 높이 28dp로 내부 영역 가득.
// 컨테이너 라운드 8dp / thumb 라운드 6dp 로 둥근 사각형 동심 정렬.
const SEGMENT_ITEM_WIDTH = 40;
const SEGMENT_ITEM_HEIGHT = 28;
const SEGMENT_ITEM_GAP = 4;
const SEGMENT_PADDING = 2;
const SEGMENT_CONTAINER_RADIUS = 8;
const SEGMENT_THUMB_RADIUS = 6;

function ViewModeSegment({ value, onChange }: ViewModeSegmentProps) {
  const items: Array<{
    key: ViewMode;
    icon: IconName;
    size: number;
    label: string;
  }> = [
    { key: 'list', icon: 'calendar-monthly-20', size: s(20), label: '주간 뷰' },
    { key: 'grid', icon: 'calendar-weekly-20', size: s(20), label: '월간 뷰' },
    { key: 'stats', icon: 'calendar-dashboard-20', size: s(20), label: '대시보드' },
  ];

  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.key === value),
  );

  // RN 기본 Animated.Value — Expo Go 호환. reanimated 워클릿 없이 native driver로 부드러운 슬라이드.
  // s() 호출은 JS 시점에 끝나고 결과는 그냥 숫자라 worklet 안전성 이슈 없음.
  const stepPx = s(SEGMENT_ITEM_WIDTH + SEGMENT_ITEM_GAP);
  const anim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    // 물리 기반 spring — 탭 인디케이터처럼 입력에 따라가는 요소에 가장 자연스러운 모션.
    // damping 높여서 overshoot 없이 부드럽게 안착(작은 pill에 튕김은 어색).
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
        borderRadius: s(SEGMENT_CONTAINER_RADIUS),
      }}
      className="flex-row items-center bg-gray-50"
    >
      {/* 활성 thumb — absolute, 단일 인스턴스로 좌우 슬라이딩. 완전 pill 형태로 컨테이너와 동심 정렬. */}
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
            <Icon name={it.icon} size={it.size} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const SCREEN = Dimensions.get('window');

export default withTabTransition(ScheduleScreen);

function ScheduleScreen() {
  const router = useRouter();
  const { focusToday } = useLocalSearchParams<{ focusToday?: string }>();
  const centerId = useCenterStore((st) => st.centerId);
  const tabClear = useTabBarClearance();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  /* ─── 날짜 전환 시 슬라이드 + fade ─── */
  const [outgoingDate, setOutgoingDate] = useState<Date | null>(null);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const slideProgress = useRef(new Animated.Value(0)).current;

  const animateToDate = useCallback(
    (newDate: Date) => {
      if (isSameDay(newDate, selectedDate)) return;
      const dir: 1 | -1 = isAfter(newDate, selectedDate) ? 1 : -1;
      setSlideDirection(dir);
      setOutgoingDate(selectedDate);
      setSelectedDate(newDate);
      slideProgress.setValue(0);
      Animated.timing(slideProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setOutgoingDate(null);
      });
    },
    [selectedDate, slideProgress],
  );

  // 드래그-따라가기 제스처 — 손가락 움직임에 따라 카드 layer가 실시간 이동, 임계값 넘으면 commit
  // outgoingDate(aux) = 손가락 반대편에 위치하는 preview 날짜
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const auxDateRef = useRef<Date | null>(null);
  const captureOffsetRef = useRef(0);
  const dragX = useRef(new Animated.Value(0)).current;
  const auxOffsetAnim = useRef(new Animated.Value(0)).current;
  const constOneAnim = useRef(new Animated.Value(1)).current;
  const [isDragMode, setIsDragMode] = useState(false);

  const swipePanResponder = useRef(
    PanResponder.create({
      // capture phase에서 우선 점유 (ScrollView보다 먼저). 5px 이상 horizontal이면 캐치
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 5,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 5,
      // 일단 잡으면 다른 responder에 양보 X
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_e, g) => {
        // capture 시점까지 이동한 dx를 offset으로 저장 — 그 만큼 빼서 카드가 0부터 시작
        captureOffsetRef.current = g.dx;
        setIsDragMode(true);
        dragX.setValue(0);
      },
      onPanResponderMove: (_e, g) => {
        const adjustedDx = g.dx - captureOffsetRef.current;
        dragX.setValue(adjustedDx);
        // direction에 따라 preview 결정 (1회만 set; 직전 set과 같은 날짜면 skip)
        if (adjustedDx < 0) {
          const next = addDays(selectedDateRef.current, 1);
          if (
            !auxDateRef.current ||
            !isSameDay(auxDateRef.current, next)
          ) {
            auxDateRef.current = next;
            setOutgoingDate(next);
            auxOffsetAnim.setValue(SCREEN.width);
          }
        } else if (adjustedDx > 0) {
          const prev = addDays(selectedDateRef.current, -1);
          if (
            !auxDateRef.current ||
            !isSameDay(auxDateRef.current, prev)
          ) {
            auxDateRef.current = prev;
            setOutgoingDate(prev);
            auxOffsetAnim.setValue(-SCREEN.width);
          }
        }
      },
      onPanResponderRelease: (_e, g) => {
        const adjustedDx = g.dx - captureOffsetRef.current;
        const threshold = SCREEN.width * 0.25;
        const shouldCommit =
          (Math.abs(adjustedDx) > threshold || Math.abs(g.vx) > 0.3) &&
          !!auxDateRef.current;
        if (shouldCommit) {
          const dir: 1 | -1 = adjustedDx < 0 ? 1 : -1;
          Animated.timing(dragX, {
            toValue: -dir * SCREEN.width,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            // dragX.setValue(0) 호출 X — React 재렌더 전에 dragX가 0이 되면
            // outgoing(preview) 레이어가 옛 incoming(과거 selectedDate) 카드를 잠깐 보여줘 깜빡임.
            // 다음 드래그 grant에서 dragX 0 reset되므로 여기서 굳이 reset 불필요.
            setSelectedDate(addDays(selectedDateRef.current, dir));
            setOutgoingDate(null);
            auxDateRef.current = null;
            setIsDragMode(false);
          });
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 180,
          }).start(() => {
            setOutgoingDate(null);
            auxDateRef.current = null;
            setIsDragMode(false);
          });
        }
      },
      onPanResponderTerminate: () => {
        // 다른 컴포넌트가 제스처 가져갈 때 cleanup
        Animated.spring(dragX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
        }).start(() => {
          setOutgoingDate(null);
          auxDateRef.current = null;
          setIsDragMode(false);
        });
      },
    }),
  ).current;

  // 드래그용 인터폴 — main(current) = dragX, aux(preview) = dragX + auxOffset
  const dragAuxTranslate = Animated.add(dragX, auxOffsetAnim);

  const outgoingTranslate = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -slideDirection * SCREEN.width],
  });
  const incomingTranslate = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirection * SCREEN.width, 0],
  });
  const outgoingOpacity = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });
  const incomingOpacity = slideProgress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.6, 1],
  });

  /* ─── 일정 카드 → 회기 상세 morph overlay ───
   * BriefStackHome의 chip→페이지 morph 패턴을 calendar 카드에 적용.
   * 카드 좌표에서 expand → 풀스크린 화이트 → 컨텐츠 fade-in.
   * 닫기 = reverse morph. */
  const [morphState, setMorphState] = useState<{
    scheduleId: string;
    layout: CardLayout;
  } | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const morphClosingRef = useRef(false);

  const openMorphOverlay = useCallback(
    (id: string, layout?: CardLayout) => {
      // layout 미측정(fallback) — morph 생략하고 일반 route push
      if (!layout) {
        router.push(`/(main)/schedule/${id}`);
        return;
      }
      morphClosingRef.current = false;
      setMorphState({ scheduleId: id, layout });
      expandAnim.setValue(0);
      contentAnim.setValue(0);
      Animated.parallel([
        // expand — 650ms inOut cubic (BriefStackHome 패턴 동일)
        Animated.timing(expandAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        // content fade-in — expand 60% 시점에 시작
        Animated.sequence([
          Animated.delay(380),
          Animated.timing(contentAnim, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [router, expandAnim, contentAnim],
  );

  const closeMorphOverlay = useCallback(() => {
    if (morphClosingRef.current) return;
    morphClosingRef.current = true;
    Animated.parallel([
      Animated.timing(contentAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setMorphState(null);
      morphClosingRef.current = false;
    });
  }, [contentAnim, expandAnim]);

  // 카드 좌표 ↔ 풀스크린 보간값 (morphState 없으면 의미 없음, fallback 사용)
  const morphLayout = morphState?.layout ?? {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  const expandWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [morphLayout.width, SCREEN.width],
  });
  const expandHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [morphLayout.height, SCREEN.height],
  });
  const expandTop = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [morphLayout.y, 0],
  });
  const expandLeft = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [morphLayout.x, 0],
  });
  const expandRadius = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(16), 0],
  });
  // 그림자는 expand 초반에 깊어졌다가 풀스크린에서 사라짐
  const overlayShadowOpacity = expandAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.18, 0],
  });
  // 카드 배경(gray-50) → 풀스크린 배경(white) 보간 — 색 전환을 morph에 동기화
  const overlayBackgroundColor = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.gray[50], COLORS.white],
  });

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

  // 홈에서 "전체보기"로 진입한 경우 오늘 날짜로 이동
  useEffect(() => {
    if (!focusToday) return;
    goToday();
  }, [focusToday, goToday]);

  const handlePrev = useCallback(() => {
    if (viewMode === 'list') {
      setSelectedDate((d) => subWeeks(d, 1));
    } else {
      // grid · stats — 모두 월 단위 네비게이션
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

  // 그리드 뷰: month 변경 시 selectedDate가 그 달 밖이면 첫날로 보정
  useEffect(() => {
    if (viewMode !== 'grid') return;
    setSelectedDate((d) => {
      const ms = startOfMonth(month);
      const me = endOfMonth(month);
      if (d < ms || d > me) return ms;
      return d;
    });
  }, [month, viewMode]);

  // 리스트 뷰: selectedDate가 다른 달로 가면 month state 동기화 (useScheduleRange 갱신)
  useEffect(() => {
    if (viewMode !== 'list') return;
    setMonth((m) => {
      const sameMonth =
        getMonthIdx(selectedDate) === getMonthIdx(m) &&
        getYear(selectedDate) === getYear(m);
      return sameMonth ? m : selectedDate;
    });
  }, [selectedDate, viewMode]);

  // 진입 시 NOW 위치 자동 스크롤 — 부모 ScrollView 기준 (grid·list 각각)
  const gridScrollRef = useRef<ScrollView>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const gridDayY = useRef<number | null>(null);
  const listDayY = useRef<number | null>(null);
  // 자동 스크롤(프로그램적)이 진행 중인지 — WeekStrip 방향 판정에서 제외용
  const listProgrammaticRef = useRef(false);
  // 스크롤 "1회" 제어는 DayTimeline이 날짜별로 담당 — 부모는 리포트가 올 때마다 스크롤
  const tryScroll = useCallback(
    (
      scrollRef: React.RefObject<ScrollView | null>,
      dayY: number | null,
      targetY: number,
      programmaticRef?: React.MutableRefObject<boolean>,
    ) => {
      if (dayY === null) return;
      // 진입/날짜 전환 후 약간 기다렸다가 부드럽게 스크롤
      setTimeout(() => {
        if (programmaticRef) programmaticRef.current = true;
        scrollRef.current?.scrollTo({
          y: Math.max(0, dayY + targetY - s(120)),
          animated: true,
        });
        // 스크롤 애니메이션이 끝날 즈음 플래그 해제
        if (programmaticRef) {
          setTimeout(() => {
            programmaticRef.current = false;
          }, 500);
        }
      }, 450);
    },
    [],
  );

  const handleGridDayLayout = useCallback((e: LayoutChangeEvent) => {
    gridDayY.current = e.nativeEvent.layout.y;
  }, []);
  const handleGridScrollTarget = useCallback(
    (_targetY: number) => {
      // 월간(grid) 뷰는 자동 스크롤을 적용하지 않는다 (일단 보류)
    },
    [],
  );

  const handleListDayLayout = useCallback((e: LayoutChangeEvent) => {
    listDayY.current = e.nativeEvent.layout.y;
  }, []);
  const handleListScrollTarget = useCallback(
    (targetY: number) => {
      tryScroll(listScrollRef, listDayY.current, targetY, listProgrammaticRef);
    },
    [tryScroll],
  );

  // ── WeekStrip 스크롤 방향 접기/펼치기 (리스트 뷰) ──
  // 아래로 스크롤=접힘, 위로=복귀. 선택일 헤더는 항상 고정. 자동 스크롤은 방향 판정에서 제외.
  // 구현: 헤더를 절대배치 오버레이로 띄우고 translateY(native driver)로 접는다.
  //  → 높이(layout)를 애니메이션하면 형제 reflow·ScrollView 리사이즈로 울렁거림이 생기므로 transform 사용.
  const [weekStripH, setWeekStripH] = useState(s(64));
  const [dayHeaderH, setDayHeaderH] = useState(s(45));
  const headerTranslateY = useRef(new Animated.Value(0)).current; // 0=펼침, -weekStripH=접힘
  const weekStripShownRef = useRef(true);
  const lastListYRef = useRef(0);

  const setStripShown = useCallback(
    (shown: boolean) => {
      Animated.timing(headerTranslateY, {
        toValue: shown ? 0 : -weekStripH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [headerTranslateY, weekStripH],
  );

  const onWeekStripLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && Math.abs(h - weekStripH) > 1) {
        setWeekStripH(h);
        // 접힌 상태면 새 높이에 맞춰 위치 보정
        if (!weekStripShownRef.current) headerTranslateY.setValue(-h);
      }
    },
    [weekStripH, headerTranslateY],
  );

  const onDayHeaderLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && Math.abs(h - dayHeaderH) > 1) setDayHeaderH(h);
    },
    [dayHeaderH],
  );

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // 바운스(overscroll) 구간을 방향 판정에서 제외 — 바닥/꼭대기에서 튕길 때
      // dy 부호가 뒤집혀 깜빡이는 문제 방지. y를 [0, maxY]로 클램프.
      const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
      const y = Math.min(Math.max(contentOffset.y, 0), maxY);
      // 자동 스크롤(날짜 전환 등 프로그램적) 중에는 방향 판정 무시 — WeekStrip 튀어나옴 방지
      if (listProgrammaticRef.current) {
        lastListYRef.current = y;
        return;
      }
      const dy = y - lastListYRef.current;
      if (Math.abs(dy) < s(8)) return; // 흔들림 무시(hysteresis), lastY 유지해 누적
      if (dy > 0 && weekStripShownRef.current && y > weekStripH * 0.5) {
        weekStripShownRef.current = false;
        setStripShown(false); // 아래로 → 접기
      } else if (dy < 0 && !weekStripShownRef.current) {
        weekStripShownRef.current = true;
        setStripShown(true); // 위로 → 펼치기
      }
      lastListYRef.current = y;
    },
    [weekStripH, setStripShown],
  );

  // 리스트 뷰 진입 시 WeekStrip을 펼친 상태로 초기화
  useEffect(() => {
    if (viewMode === 'list') {
      weekStripShownRef.current = true;
      headerTranslateY.setValue(0);
      lastListYRef.current = 0;
    }
  }, [viewMode, headerTranslateY]);

  // 캘린더(grid) 뷰의 날짜별 본문 — 빈 상태 OR DayTimeline. outgoing/incoming 양쪽 재사용
  const renderGridDayContent = useCallback(
    (date: Date, isCurrent: boolean) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const schedulesForDate = schedulesByDate.get(dateKey) ?? [];
      if (schedulesForDate.length === 0) {
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
        <DayTimeline
          date={date}
          weekSchedules={schedulesForDate}
          onItemPress={openMorphOverlay}
          noScrollWrap
          showHeader={false}
          onScrollTargetReady={isCurrent ? handleGridScrollTarget : undefined}
        />
      );
    },
    [schedulesByDate, openMorphOverlay, handleGridScrollTarget],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View
        style={{ height: s(52), paddingHorizontal: s(20) }}
        className="flex-row items-center justify-between bg-surface"
      >
        <Typography
          variant="headline-02"
          weight="bold"
          className="text-gray-900"
        >
          일정
        </Typography>
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
            <Icon name="arrow-left-16" size={s(16)} />
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
            <Icon name="arrow-right-16" size={s(16)} />
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
          // 전체 스크롤 — 캘린더는 위로 사라지고, 선택일 헤더는 sticky로 상단 고정
          <ScrollView
            ref={gridScrollRef}
            className="flex-1"
            stickyHeaderIndices={[1]}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={COLORS.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: tabClear }}
          >
            {/* index 0 — 캘린더 (스크롤로 위로 사라짐) */}
            <View className="bg-surface" style={{ paddingBottom: s(12) }}>
              <MonthCalendar
                month={month}
                selectedDate={selectedDate}
                schedulesByDate={schedulesByDate}
                onSelectDate={setSelectedDate}
              />
            </View>

            {/* index 1 — sticky 선택일 헤더 */}
            <ListDayStickyHeader
              date={selectedDate}
              schedules={selectedDaySchedules}
            />

            {/* index 2 — 선택일 일정 리스트 (그리드 모드는 캘린더 탭으로 날짜 변경) */}
            <View onLayout={handleGridDayLayout}>
              {renderGridDayContent(selectedDate, true)}
            </View>
          </ScrollView>
        ) : viewMode === 'list' ? (
          // WeekStrip은 스크롤 방향에 따라 접힘/펼침(헤더 오버레이 transform), 선택일 헤더는 항상 고정
          // overflow-hidden: 접힐 때 WeekStrip이 위(월 네비)로 삐져나가지 않고 상단에서 잘려 사라지게
          <View className="flex-1 overflow-hidden">
            <ScrollView
              ref={listScrollRef}
              className="flex-1"
              onScroll={onListScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={COLORS.primary}
                  progressViewOffset={weekStripH + dayHeaderH}
                />
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: weekStripH + dayHeaderH,
                paddingBottom: tabClear,
              }}
            >
              {/* 시간 spine + 카드. 카드만 슬라이드 + 좌우 스와이프 → 날짜 전환 */}
              <View
                onLayout={handleListDayLayout}
                {...swipePanResponder.panHandlers}
              >
              <DayTimeline
                date={selectedDate}
                weekSchedules={weekSchedules}
                onItemPress={openMorphOverlay}
                noScrollWrap
                showHeader={false}
                collapseGaps
                onScrollTargetReady={handleListScrollTarget}
                outgoingDate={outgoingDate}
                cardSlideAnim={
                  isDragMode
                    ? {
                        outgoingTranslate: dragAuxTranslate,
                        outgoingOpacity: constOneAnim,
                        incomingTranslate: dragX,
                        incomingOpacity: constOneAnim,
                      }
                    : {
                        outgoingTranslate,
                        outgoingOpacity,
                        incomingTranslate,
                        incomingOpacity,
                      }
                }
              />
              </View>
            </ScrollView>

            {/* 헤더 오버레이 — WeekStrip(스크롤 방향 접힘) + 선택일 헤더(고정).
                절대배치 + translateY로 접어 ScrollView 리사이즈/형제 reflow 없이 부드럽게. */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: [{ translateY: headerTranslateY }],
              }}
            >
              <View
                onLayout={onWeekStripLayout}
                style={{ backgroundColor: COLORS.white }}
              >
                <WeekStrip
                  selectedDate={selectedDate}
                  onSelectDate={animateToDate}
                  schedulesByDate={schedulesByDate}
                />
              </View>
              <View onLayout={onDayHeaderLayout}>
                <ListDayStickyHeader
                  date={selectedDate}
                  schedules={selectedDaySchedules}
                />
              </View>
            </Animated.View>
          </View>
        ) : (
          <StatsView
            schedules={schedules ?? []}
            month={month}
            centerId={centerId}
            isLoading={isLoading}
            isError={isError}
            isRefetching={isRefetching}
            onRefresh={refetch}
            onRetry={refetch}
          />
        )}
      </View>

      {/* ─── 일정 카드 → 회기 상세 morph overlay ─── */}
      {morphState && (
        <Animated.View
          pointerEvents="box-none"
          style={StyleSheet.absoluteFillObject}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: expandWidth,
              height: expandHeight,
              top: expandTop,
              left: expandLeft,
              borderRadius: expandRadius,
              backgroundColor: overlayBackgroundColor,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: overlayShadowOpacity,
              shadowOffset: { width: 0, height: 8 },
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            {/* 컨텐츠 fade-in — expand 60% 시점에 들어옴 */}
            <Animated.View
              style={{
                flex: 1,
                opacity: contentAnim,
              }}
            >
              <SessionDetailView
                scheduleId={morphState.scheduleId}
                onClose={closeMorphOverlay}
                withSafeArea
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// sticky 헤더 (리스트·캘린더 공통) — 날짜 타이틀 + 친근 톤·카운트 inline
function ListDayStickyHeader({
  date,
  schedules,
}: {
  date: Date;
  schedules: ScheduleListItem[];
}) {
  const isTodayView = isSameDay(date, new Date());

  const stats = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let inProgress = 0;
    let upcoming = 0;
    for (const it of schedules) {
      if (it.schedule_type === 'block') continue;
      const st = deriveStatus(it);
      if (st === 'completed') completed += 1;
      else if (st === 'cancelled') cancelled += 1;
      else if (st === 'no_show') noShow += 1;
      else if (st === 'in_progress') inProgress += 1;
      else if (st === 'upcoming') upcoming += 1;
    }
    return {
      total: schedules.length,
      completed,
      cancelled,
      noShow,
      inProgress,
      upcoming,
    };
  }, [schedules]);

  const dateTitle = format(date, 'yyyy년 M월 d일', { locale: ko });

  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingVertical: s(12),
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray[100],
        zIndex: 100,
        elevation: 4,
      }}
    >
      {/* 1줄: 날짜 타이틀 */}
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.gray[900] }}
      >
        {dateTitle}
      </Typography>

      {/* 2줄: 친근 톤 + 카운트 inline */}
      {stats.total === 0 ? (
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[500], marginTop: s(2) }}
        >
          {isTodayView ? '오늘은 한숨 돌리는 날이에요' : '일정 없음'}
        </Typography>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
            flexWrap: 'wrap',
            marginTop: s(2),
          }}
        >
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.gray[800] }}
          >
            {isTodayView
              ? `오늘 ${stats.total}명을 만나요`
              : `${stats.total}명을 만나요`}
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[500] }}
          >
            완료 {stats.completed}
            {stats.inProgress > 0 ? ` · 진행중 ${stats.inProgress}` : ''}
            {' · '}예정 {stats.upcoming}
            {stats.cancelled > 0 ? ` · 취소 ${stats.cancelled}` : ''}
            {stats.noShow > 0 ? ` · 노쇼 ${stats.noShow}` : ''}
          </Typography>
        </View>
      )}
    </View>
  );
}

// 캘린더 뷰 sticky 헤더의 상태별 카운트 한 줄
function SelectedDayStatsLine({
  schedules,
}: {
  schedules: ScheduleListItem[];
}) {
  const stats = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let inProgress = 0;
    let upcoming = 0;
    for (const it of schedules) {
      if (it.schedule_type === 'block') continue;
      const st = deriveStatus(it);
      if (st === 'completed') completed += 1;
      else if (st === 'cancelled') cancelled += 1;
      else if (st === 'no_show') noShow += 1;
      else if (st === 'in_progress') inProgress += 1;
      else if (st === 'upcoming') upcoming += 1;
    }
    return {
      total: schedules.length,
      completed,
      cancelled,
      noShow,
      inProgress,
      upcoming,
    };
  }, [schedules]);

  if (stats.total === 0) {
    return (
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[500], marginTop: s(2) }}
      >
        일정 없음
      </Typography>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        flexWrap: 'wrap',
        marginTop: s(2),
      }}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[700] }}
      >
        {stats.total}건
      </Typography>
      <Typography
        variant="label-01"
        style={{ color: COLORS.gray[500] }}
      >
        완료 {stats.completed}
        {stats.inProgress > 0 ? ` · 진행중 ${stats.inProgress}` : ''}
        {' · '}남음 {stats.upcoming}
        {stats.cancelled > 0 ? ` · 취소 ${stats.cancelled}` : ''}
        {stats.noShow > 0 ? ` · 노쇼 ${stats.noShow}` : ''}
      </Typography>
    </View>
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
          <Typography
            variant="body-03"
            weight="semibold"
            className="text-white"
          >
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
    <View
      style={{ gap: s(10), marginTop: s(12), paddingHorizontal: s(20) }}
    >
      {schedules.map((item) => (
        <MonthlyEventCard
          key={item.id}
          item={item}
          onPress={() => onItemPress(item.id)}
        />
      ))}
    </View>
  );
}

/* ───────────────────────── Stats View ─────────────────────────
 * 실험실 schedule-monthly-stats.tsx 의 "D · 스탯 모드" 시안 동일 적용:
 *  1) 컬러 tint 배경 BigStatCard 3개 (상담 / 검사 / 노쇼)
 *  2) 요일별 분포 — gray-50 카드 안의 막대그래프 (일~토)
 *  3) 노쇼 내역 — gray-50 카드 안의 미니 리스트 (이름 + 날짜)
 *
 * 데이터: useScheduleRange로 이미 fetch된 월간 schedules 그대로 집계.
 */

// 카테고리 메타 — 라벨 + 커스텀 두 톤 아이콘(색 하드코딩, color prop 미사용).
const STAT_META = {
  counseling: { label: '상담', icon: 'counseling2-28' as IconName },
  assessment: { label: '검사', icon: 'assessment2-28' as IconName },
} as const;

// gray 페이지 위 흰 카드의 옅은 띄움 — shadow-card 토큰(0 1px 4px rgba(0,0,0,0.06)).
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
} as const;

// 생년월일 → 만 나이. (SessionDetailSheet 계산식과 동일)
function computeAge(birth?: string | null): number | null {
  if (!birth) return null;
  try {
    const b = parseDate(birth);
    const now = new Date();
    let y = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) y -= 1;
    return y;
  } catch {
    return null;
  }
}

// 한 달 집계 — 해당 캘린더 월에 실제 속한 일정만(앞/뒤 주의 타 월 spillover 제외).
function aggregateMonth(items: ScheduleListItem[], month: Date) {
  let counseling = 0;
  let assessment = 0;
  let noShow = 0;
  let total = 0;
  for (const sch of items) {
    if (sch.schedule_type === 'block') continue;
    if (!isSameMonth(parseDate(sch.start), month)) continue;
    total += 1;
    if (sch.schedule_type === 'counseling') counseling += 1;
    else if (sch.schedule_type === 'assessment') assessment += 1;
    if (deriveStatus(sch) === 'no_show') noShow += 1;
  }
  return { counseling, assessment, noShow, total };
}

interface StatsViewProps {
  schedules: ScheduleListItem[];
  month: Date;
  centerId: string | null;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onRetry: () => void;
}

interface DayBucket {
  date: Date;
  counseling: number;
  assessment: number;
  total: number;
}

function StatsView({
  schedules,
  month,
  centerId,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  onRetry,
}: StatsViewProps) {
  const tabClear = useTabBarClearance();

  // ── 지난달 데이터 (비교용) — 같은 일정 조회 API를 이전 달 범위로 한 번 더 호출 ──
  const prevMonth = useMemo(() => subMonths(month, 1), [month]);
  const prevRangeStart = useMemo(
    () => startOfWeek(startOfMonth(prevMonth), { weekStartsOn: 1 }),
    [prevMonth],
  );
  const prevRangeEnd = useMemo(
    () => endOfWeek(endOfMonth(prevMonth), { weekStartsOn: 1 }),
    [prevMonth],
  );
  const { data: prevSchedules } = useScheduleRange(
    centerId,
    prevRangeStart,
    prevRangeEnd,
  );

  // 이번달 / 지난달 집계 (해당 달에 실제 속한 일정만)
  const cur = useMemo(() => aggregateMonth(schedules, month), [schedules, month]);
  const prev = useMemo(
    () => aggregateMonth(prevSchedules ?? [], prevMonth),
    [prevSchedules, prevMonth],
  );

  // 노쇼 내역 — 이번달, 시간순
  const noShowItems = useMemo(() => {
    return schedules
      .filter(
        (sch) =>
          isSameMonth(parseDate(sch.start), month) &&
          deriveStatus(sch) === 'no_show',
      )
      .sort(
        (a, b) =>
          parseDate(a.start).getTime() - parseDate(b.start).getTime(),
      );
  }, [schedules, month]);

  // ── 주 단위 분포 ── 달의 각 주(월요일 시작 — 앱·fetch 범위와 동일)를 순회. 주 네비는 달 안에서만.
  const weeks = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const last = startOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const arr: Date[] = [];
    let d = first;
    while (d <= last) {
      arr.push(d);
      d = addDays(d, 7);
    }
    return arr;
  }, [month]);

  const [weekIdx, setWeekIdx] = useState(0);
  // 달이 바뀌면 첫째주로 리셋
  useEffect(() => {
    setWeekIdx(0);
  }, [month]);
  const safeIdx = Math.min(weekIdx, Math.max(0, weeks.length - 1));
  const weekStart = weeks[safeIdx] ?? startOfWeek(month, { weekStartsOn: 1 });

  // 선택 주의 7일 버킷 (상담/검사/총)
  const weekDays = useMemo<DayBucket[]>(() => {
    const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(weekStart, i),
      counseling: 0,
      assessment: 0,
      total: 0,
    }));
    for (const sch of schedules) {
      if (sch.schedule_type === 'block') continue;
      const t = parseDate(sch.start);
      const idx = days.findIndex((d) => isSameDay(d.date, t));
      if (idx < 0) continue;
      days[idx].total += 1;
      if (sch.schedule_type === 'counseling') days[idx].counseling += 1;
      else if (sch.schedule_type === 'assessment') days[idx].assessment += 1;
    }
    return days;
  }, [schedules, weekStart]);

  // 월단위 정규화 기준 — 그 달(주 네비 범위) 전체에서 하루 최댓값. 모든 주가 같은 스케일.
  const monthMaxDaily = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const sch of schedules) {
      if (sch.schedule_type === 'block') continue;
      const key = format(parseDate(sch.start), 'yyyy-MM-dd');
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    return Math.max(1, ...perDay.values());
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
          <Typography
            variant="body-03"
            weight="semibold"
            className="text-white"
          >
            다시 시도
          </Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: COLORS.gray[50] }}
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(24),
        paddingBottom: tabClear,
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
      {/* 0) 총 건수 헤드라인 — Title_02(18/26 SemiBold) = 코드 title-01 + semibold */}
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.gray[900], marginBottom: s(4) }}
      >
        총 {cur.total}건의 일정이 있어요
      </Typography>

      {/* 1) 상담 / 검사 — 흰 카드 2개 + 지난달 대비 증감 */}
      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <StatCard
          kind="counseling"
          count={cur.counseling}
          diff={cur.counseling - prev.counseling}
        />
        <StatCard
          kind="assessment"
          count={cur.assessment}
          diff={cur.assessment - prev.assessment}
        />
      </View>

      {/* 2) 노쇼 — 펼침 가능 카드 (성별·나이 리스트) */}
      <NoShowCard
        count={cur.noShow}
        diff={cur.noShow - prev.noShow}
        items={noShowItems}
      />

      {/* 3) 요일별 분포 — 주 단위 + 주 네비 */}
      <WeeklyDistribution
        monthLabel={month}
        weekIndex={safeIdx}
        weekCount={weeks.length}
        weekKey={weekStart.getTime()}
        days={weekDays}
        monthMax={monthMaxDaily}
        onPrev={() => setWeekIdx((i) => Math.max(0, i - 1))}
        onNext={() =>
          setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))
        }
      />
    </ScrollView>
  );
}

/** 지난달 대비 증감 한 줄 — 텍스트는 차분한 gray, 방향 caret만 컬러 포인트 */
function ComparisonLine({ diff }: { diff: number }) {
  if (diff === 0) {
    return (
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}
      >
        <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
          지난달과 동일
        </Typography>
        <Ionicons name="remove" size={s(12)} color={COLORS.gray[500]} />
      </View>
    );
  }
  const up = diff > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
        지난달 대비 {Math.abs(diff)}건
      </Typography>
      <Ionicons
        name={up ? 'caret-up' : 'caret-down'}
        size={s(11)}
        color={up ? COLORS.negative : COLORS.info}
      />
    </View>
  );
}

function StatCard({
  kind,
  count,
  diff,
}: {
  kind: 'counseling' | 'assessment';
  count: number;
  diff: number;
}) {
  const meta = STAT_META[kind];
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        padding: s(12),
        ...CARD_SHADOW,
      }}
    >
      {/* 라벨 — 카드 상단 단독 (body-03 14pt medium, text/body/default) */}
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        {meta.label}
      </Typography>

      {/* 아이콘(28) + 숫자(semibold 20) + 건 → 증감 */}
      <View style={{ marginTop: s(16), gap: s(8) }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}
        >
          <Icon name={meta.icon} size={s(28)} />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}
          >
            <Typography
              weight="semibold"
              style={{
                fontSize: s(24),
                lineHeight: s(30),
                letterSpacing: -0.41,
                color: COLORS.gray[900],
              }}
            >
              {count}
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[600], transform: [{ translateY: s(1) }] }}
            >
              건
            </Typography>
          </View>
        </View>

        <ComparisonLine diff={diff} />
      </View>
    </View>
  );
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_BAR_HEIGHT = 120; // dp — 트랙(풀하이트) 기준

function WeeklyDistribution({
  monthLabel,
  weekIndex,
  weekCount,
  weekKey,
  days,
  monthMax,
  onPrev,
  onNext,
}: {
  monthLabel: Date;
  weekIndex: number;
  weekCount: number;
  weekKey: number;
  days: DayBucket[];
  monthMax: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const counts = days.map((d) => d.total);
  // 막대 높이 정규화 기준 = 월단위 하루 최댓값 (모든 주 동일 스케일 → 주 간 비교 가능)
  const maxCount = Math.max(1, monthMax);
  // 기본 표시 막대(툴팁)는 그 주 안의 최댓값 날
  const maxIndex = counts.indexOf(Math.max(...counts));
  const hasAny = counts.some((n) => n > 0);

  // 선택 막대 — 주 진입 시 최댓값 막대에 기본 표시. null이면 툴팁 숨김(막대 밖 탭 시).
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  useEffect(() => {
    setSelectedIndex(maxIndex);
    // 새 주의 최댓값 막대로 — weekKey 변경 시에만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);
  const activeIndex = selectedIndex;

  // 주 전환 — 막대는 방향대로 슬라이드 인, 합계(건수)는 시간차 두고 떠오름(스와이프 느낌)
  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const footerOpacity = useRef(new Animated.Value(1)).current;
  const footerY = useRef(new Animated.Value(0)).current;
  const prevWeekIndexRef = useRef(weekIndex);
  useEffect(() => {
    const dir =
      weekIndex > prevWeekIndexRef.current
        ? 1
        : weekIndex < prevWeekIndexRef.current
          ? -1
          : 0;
    prevWeekIndexRef.current = weekIndex;
    if (dir === 0) return; // 최초 마운트·동일 주
    // 막대 — 다음(→)이면 오른쪽, 이전(←)이면 왼쪽에서 슬라이드 인
    slideX.setValue(dir * s(48));
    slideOpacity.setValue(0);
    // 합계 — 막대 먼저 보이고 약간의 시간차 후 떠오름
    footerOpacity.setValue(0);
    footerY.setValue(s(8));
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(170),
        Animated.parallel([
          Animated.timing(footerOpacity, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.timing(footerY, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  // 주 합계
  const weekTotal = counts.reduce((a, b) => a + b, 0);
  const weekCounseling = days.reduce((a, d) => a + d.counseling, 0);
  const weekAssessment = days.reduce((a, d) => a + d.assessment, 0);

  const weekLabel = `${format(monthLabel, 'M월')} ${
    WEEK_OF_MONTH_LABELS[weekIndex] ?? `${weekIndex + 1}째`
  }주`;

  return (
    // 컨테이너 상단 마진 24
    <View style={{ gap: s(8), marginTop: s(24) }}>
      {/* 섹션 타이틀 — 컨테이너 밖, 높이 20, body-03 medium, text/body/default */}
      <View style={{ height: s(20), justifyContent: 'center' }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.gray[600] }}
        >
          요일별 분포
        </Typography>
      </View>

      {/* 카드 = 막대 밖 영역 탭 시 툴팁 해제 (막대·주 네비 내부 터치는 각자 처리) */}
      <Pressable
      onPress={() => setSelectedIndex(null)}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        // 상단 여백(6월 첫째주 위) 24, 좌우·하단 12. 내부 간격(nav↔막대↔총N건) 20
        paddingTop: s(24),
        paddingHorizontal: s(12),
        paddingBottom: s(12),
        gap: s(20),
        ...CARD_SHADOW,
      }}
    >
      {/* 주 네비게이션 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(12),
        }}
      >
        <TouchableOpacity
          onPress={onPrev}
          disabled={weekIndex <= 0}
          activeOpacity={0.7}
          hitSlop={8}
          style={{ opacity: weekIndex <= 0 ? 0.3 : 1 }}
          accessibilityLabel="이전 주"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={s(16)} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {weekLabel}
        </Typography>
        <TouchableOpacity
          onPress={onNext}
          disabled={weekIndex >= weekCount - 1}
          activeOpacity={0.7}
          hitSlop={8}
          style={{ opacity: weekIndex >= weekCount - 1 ? 0.3 : 1 }}
          accessibilityLabel="다음 주"
          accessibilityRole="button"
        >
          <Ionicons
            name="chevron-forward"
            size={s(16)}
            color={COLORS.gray[700]}
          />
        </TouchableOpacity>
      </View>

      {/* 막대 그래프 — 큰 영역: 카드로부터 좌우 16, 내부 좌우 3.5 / 컬럼 40, 간격 4. 주 전환 시 슬라이드 인(그래프 먼저) */}
      <Animated.View
        style={{
          flexDirection: 'row',
          gap: s(4),
          alignItems: 'flex-end',
          justifyContent: 'center',
          marginHorizontal: s(4),
          paddingHorizontal: s(3.5),
          transform: [{ translateX: slideX }],
          opacity: slideOpacity,
        }}
      >
        {days.map((day, i) => {
          const isSunday = day.date.getDay() === 0;
          const ratio = day.total / maxCount;
          const fillHeight =
            day.total > 0
              ? Math.max(s(8), Math.round(ratio * s(MAX_BAR_HEIGHT)))
              : 0;
          const showTooltip = hasAny && i === activeIndex;

          return (
            // 활성 컬럼 zIndex를 올려 툴팁이 옆 막대들 위로 뜨게 함
            <View
              key={i}
              style={{
                width: s(40),
                gap: s(8),
                alignItems: 'center',
                zIndex: showTooltip ? 20 : 1,
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  setSelectedIndex((prev) => (prev === i ? null : i))
                }
                activeOpacity={0.7}
                hitSlop={6}
                style={{ width: '100%', alignItems: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={`${format(day.date, 'd일')} 상담 ${day.counseling}건 검사 ${day.assessment}건`}
              >
                {/* 트랙 — 막대 폭 28, 풀하이트 연회색, 하단 정렬로 필을 바닥에 둠 */}
                <View
                  style={{
                    width: s(28),
                    height: s(MAX_BAR_HEIGHT),
                    backgroundColor: COLORS.gray[100],
                    borderRadius: s(6),
                    justifyContent: 'flex-end',
                  }}
                >
                  {showTooltip && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: fillHeight + s(8),
                        left: -s(100),
                        right: -s(100),
                        alignItems: 'center',
                      }}
                    >
                      <BarTooltip
                        counseling={day.counseling}
                        assessment={day.assessment}
                        total={day.total}
                      />
                    </View>
                  )}
                  {/* 필 — primary 블루 (이미지 기준, md 중립 예외) */}
                  {fillHeight > 0 && (
                    <View
                      style={{
                        width: '100%',
                        height: fillHeight,
                        backgroundColor: COLORS.primary,
                        borderRadius: s(6),
                      }}
                    />
                  )}
                </View>
              </TouchableOpacity>
              {/* 날짜 숫자 + 요일 — label-02, text/label/default. 날짜 medium. 주말 라벨만 빨강 */}
              <View style={{ alignItems: 'center', gap: s(1) }}>
                <Typography
                  variant="label-02"
                  weight="medium"
                  style={{
                    color: isSunday ? COLORS.negative : COLORS.gray[600],
                  }}
                >
                  {format(day.date, 'd')}
                </Typography>
                <Typography
                  variant="label-02"
                  style={{
                    color: isSunday ? COLORS.negative : COLORS.gray[600],
                  }}
                >
                  {WEEKDAY_LABELS[day.date.getDay()]}
                </Typography>
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* 주 합계 — 막대보다 시간차 두고 떠오름(footerOpacity·footerY) */}
      <Animated.View
        style={{
          gap: s(12),
          opacity: footerOpacity,
          transform: [{ translateY: footerY }],
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}
        >
          <View
            style={{ flex: 1, height: 1, backgroundColor: COLORS.gray[100] }}
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(4) }}
          >
            <Typography variant="body-03" style={{ color: COLORS.gray[500] }}>
              총
            </Typography>
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              {weekTotal}건
            </Typography>
          </View>
          <View
            style={{ flex: 1, height: 1, backgroundColor: COLORS.gray[100] }}
          />
        </View>

        {/* 상담/검사 박스 — 연회색 컨테이너, 가운데 세로 구분선, 숫자 primary */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            // md bg/surface-sunken(#F5F7F8) — 코드 최근접 gray-50
            backgroundColor: COLORS.gray[50],
            borderRadius: s(10),
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: s(6),
              paddingVertical: s(12),
            }}
          >
            <Typography variant="body-03" style={{ color: COLORS.gray[600] }}>
              상담
            </Typography>
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: COLORS.primary }}
            >
              {weekCounseling}건
            </Typography>
          </View>
          <View
            style={{ width: 1, height: s(20), backgroundColor: COLORS.gray[200] }}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: s(6),
              paddingVertical: s(12),
            }}
          >
            <Typography variant="body-03" style={{ color: COLORS.gray[600] }}>
              검사
            </Typography>
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: COLORS.primary }}
            >
              {weekAssessment}건
            </Typography>
          </View>
        </View>
      </Animated.View>
    </Pressable>
    </View>
  );
}

/** 툴팁 내부 한 줄 — 라벨 + 건수 (다크 배경 위 흰 텍스트) */
function TooltipRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s(12),
      }}
    >
      <Typography
        variant="label-01"
        style={{ color: bold ? COLORS.white : 'rgba(255,255,255,0.7)' }}
      >
        {label}
      </Typography>
      <Typography
        variant="label-01"
        weight={bold ? 'bold' : 'medium'}
        style={{ color: COLORS.white }}
      >
        {value}건
      </Typography>
    </View>
  );
}

/** 막대 위 다크 카드 툴팁 — 상담/검사/총 분리 + 하단 삼각형 화살표 */
function BarTooltip({
  counseling,
  assessment,
  total,
}: {
  counseling: number;
  assessment: number;
  total: number;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: s(80),
          backgroundColor: COLORS.gray[900],
          borderRadius: s(8),
          paddingHorizontal: s(12),
          paddingVertical: s(8),
          gap: s(2),
        }}
      >
        <TooltipRow label="상담" value={counseling} />
        <TooltipRow label="검사" value={assessment} />
        <View
          style={{
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.18)',
            marginVertical: s(3),
          }}
        />
        <TooltipRow label="총" value={total} bold />
      </View>
      {/* 아래로 향한 이등변 삼각형 — width:0/height:0 + border 트릭.
          borderTopWidth + 좌우 transparent border 로 위에서 아래로 좁아지는 모양.
          marginTop -1 로 박스 하단과 1dp 겹쳐 sub-pixel 흰 선 방지. */}
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

function NoShowCard({
  count,
  diff,
  items,
}: {
  count: number;
  diff: number;
  items: ScheduleListItem[];
}) {
  const [open, setOpen] = useState(false);
  const expandable = items.length > 0;

  // 펼침/닫힘 애니메이션 — 측정한 리스트 높이로 height + opacity + chevron 회전.
  // Expo Go 호환 위해 RN Animated 사용(height는 native driver 불가 → false).
  const anim = useRef(new Animated.Value(0)).current;
  const [contentH, setContentH] = useState(0);

  const toggle = useCallback(() => {
    if (!expandable) return;
    const next = !open;
    setOpen(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: 260,
      // 열 땐 감속(ease-out), 닫을 땐 가속(ease-in)으로 자연스럽게
      easing: next ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [open, expandable, anim]);

  const listHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentH],
  });
  const chevronRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        padding: s(12),
        ...CARD_SHADOW,
      }}
    >
      {/* 헤더 — 탭하면 펼침 */}
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={expandable ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`노쇼 ${count}건${expandable ? (open ? ' 접기' : ' 펼치기') : ''}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* 상담/검사 카드와 동일 레이아웃 */}
        <View style={{ flex: 1 }}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            노쇼
          </Typography>
          <View style={{ marginTop: s(16), gap: s(8) }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}
            >
              <Icon name="noshow-28" size={s(28)} />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(4),
                }}
              >
                <Typography
                  weight="semibold"
                  style={{
                    fontSize: s(24),
                    lineHeight: s(30),
                    letterSpacing: -0.41,
                    color: COLORS.gray[900],
                  }}
                >
                  {count}
                </Typography>
                <Typography
                  variant="label-01"
                  style={{
                    color: COLORS.gray[600],
                    transform: [{ translateY: s(1) }],
                  }}
                >
                  건
                </Typography>
              </View>
            </View>
            <ComparisonLine diff={diff} />
          </View>
        </View>

        {expandable && (
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Icon name="arrow-down-20" size={s(20)} />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* 펼침 리스트 — height/opacity 애니메이션. 간격을 padding으로만 두어 onLayout 측정에 모두 포함 */}
      {expandable && (
        <Animated.View
          style={{ height: listHeight, opacity: anim, overflow: 'hidden' }}
        >
          <View
            onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
            style={{ paddingTop: s(14) }}
          >
            <View
              style={{
                paddingTop: s(14),
                borderTopWidth: 1,
                borderTopColor: COLORS.gray[100],
                gap: s(10),
              }}
            >
              {items.map((sch) => (
                <NoShowRow key={sch.id} sch={sch} />
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** 노쇼 리스트 한 줄 — [이름 성별 나이] ... 날짜 (compact 기본 노출) */
function NoShowRow({ sch }: { sch: ScheduleListItem }) {
  const router = useRouter();
  const primary = sch.clients?.[0];
  const clientId = primary?.id;
  const name = primary?.name ?? sch.title ?? '내담자';
  const genderLabel = primary?.gender ? GENDER_LABELS[primary.gender] : null;
  const age = computeAge(primary?.birth_date);
  const dateLabel = format(parseDate(sch.start), 'M월 d일', { locale: ko });

  return (
    <View
      className="flex-row items-center justify-between"
      style={{ gap: s(8) }}
    >
      {/* 이름·정보 탭 → 내담자 상세 (clientId 없으면 비활성) */}
      <TouchableOpacity
        onPress={
          clientId
            ? () => router.push(`/(main)/client/${clientId}`)
            : undefined
        }
        disabled={!clientId}
        activeOpacity={0.6}
        hitSlop={6}
        className="flex-row items-center"
        style={{ flex: 1, gap: s(8) }}
        accessibilityRole="button"
        accessibilityLabel={`${name} 내담자 상세 보기`}
      >
        {/* 이름 — body-03 semibold, text/body/strong */}
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
          numberOfLines={1}
        >
          {name}
        </Typography>

        {/* 성별 · 구분선 · 나이 — label-01 regular, text/label/default */}
        {(genderLabel || age != null) && (
          <View className="flex-row items-center" style={{ gap: s(4) }}>
            {genderLabel && (
              <Typography
                variant="label-01"
                style={{ color: COLORS.gray[600] }}
              >
                {genderLabel}
              </Typography>
            )}
            {genderLabel && age != null && (
              <View
                style={{
                  width: 1,
                  height: s(10),
                  backgroundColor: COLORS.gray[100],
                }}
              />
            )}
            {age != null && (
              <Typography
                variant="label-01"
                style={{ color: COLORS.gray[600] }}
              >
                {`만 ${age}세`}
              </Typography>
            )}
          </View>
        )}
      </TouchableOpacity>
      {/* 날짜 — body03 regular, text/body/default */}
      <Typography variant="body-03" style={{ color: COLORS.gray[600] }}>
        {dateLabel}
      </Typography>
    </View>
  );
}

