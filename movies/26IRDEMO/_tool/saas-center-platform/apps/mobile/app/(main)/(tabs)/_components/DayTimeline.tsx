import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCenterStore } from '@/features/center';
import { openScheduleDetail } from '@/features/schedule';
import {
  format,
  isSameDay,
  differenceInMinutes,
  getHours,
  getMinutes,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { s } from '@/shared/utils/scale';
import { Icon } from '@/shared/components/icons';
import { deriveStatus, getAge } from './utils';

const HOUR_HEIGHT = 72;
const TIME_COL_WIDTH = 40;
const DEFAULT_START_HOUR = 9;
const END_HOUR = 24; // 일정 유무와 무관하게 24시까지 spine 항상 표시
const IMMINENT_WINDOW_MINUTES = 30;

// 동시간대 겹침 레인 배치 — 겹치는 일정을 좌우 분할해 가림 방지.
// 이중 배정은 허용 정책(경고 후 강행)이라 같은 시각 일정이 실제로 생긴다.
// 정렬(시작 시각 오름차순)된 items 기준, 겹침 클러스터 안에서 빈 레인을 그리디로 배정.
function computeLanes(
  items: ScheduleListItem[],
): Map<string, { lane: number; laneCount: number }> {
  const map = new Map<string, { lane: number; laneCount: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = []; // 레인별 마지막 종료 시각
  let clusterEnd = 0;
  const flush = () => {
    const laneCount = laneEnds.length;
    cluster.forEach((e) => map.set(e.id, { lane: e.lane, laneCount }));
    cluster = [];
    laneEnds = [];
  };
  for (const it of items) {
    const start = parseDate(it.start).getTime();
    const end = Math.max(parseDate(it.end).getTime(), start + 15 * 60000);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: it.id, lane });
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end);
  }
  flush();
  return map;
}

// 빈 시간 압축(collapseGaps) — 큰 갭(>임계)을 1시간 높이로 줄이고 가장자리 trim.
const COLLAPSE_THRESHOLD_MIN = 180; // 3시간 초과 내부 갭만 압축
const COLLAPSED_GAP_MIN = 60; // 압축 시 표시 높이 = 1시간

// 🚧 목업 할 일 — 빈 시간 배너 디자인 확인용. 디자인 확정되면 실데이터(§4 신호)로 교체.
const MOCK_GAP_TODOS: { title: string }[] = [
  { title: '미작성 상담일지 3건을 작성해보세요' },
  { title: '김은서님 검사 결과를 확인해보세요' },
];

type BreakReco = { title: string; scheduleId: string };
// start/end = 압축할 "완전히 빈 정시" 경계, span = 압축 전 길이, rawGap = 실제 빈 시간(라벨용)
// reco = 이 갭에 걸린 할 일 추천(있으면 밴드가 "비어있음" 대신 추천을 표시)
type CollapseBreak = {
  start: number;
  end: number;
  span: number;
  rawGap: number;
  reco: BreakReco | null;
};
type CollapseModel = { breaks: CollapseBreak[] } | null;

/** 일정↔일정 사이 큰 갭(>임계)을 압축하되, 부분 시간은 보존하고 "완전히 빈 정시 구간"만 압축한다.
 *  예) A가 10:30 종료면 10:30~11:00은 남기고 11:00부터 압축 → 11시 라인 유지.
 *  스파인은 0-24 전부 표시(가장자리 압축 X). reco가 걸친 갭은 밴드에 추천을 띄운다. */
function buildCollapse(
  items: ScheduleListItem[],
  enabled: boolean,
  reco: { start: number; end: number; title: string; scheduleId: string } | null,
): CollapseModel {
  if (!enabled || items.length < 2) return null;
  const abs = (iso: string) => {
    const d = parseDate(iso);
    return getHours(d) * 60 + getMinutes(d);
  };
  const breaks: CollapseBreak[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const aEnd = abs(items[i].end);
    const bStart = abs(items[i + 1].start);
    const rawGap = bStart - aEnd;
    if (rawGap <= COLLAPSE_THRESHOLD_MIN) continue;
    // 완전히 빈 정시 구간만 압축: A 종료 직후 정시 ~ B 시작 직전 정시
    const start = Math.ceil(aEnd / 60) * 60;
    const end = Math.floor(bStart / 60) * 60;
    const span = end - start;
    if (span <= COLLAPSED_GAP_MIN) continue; // 압축 이득 없음
    const brReco =
      reco && aEnd < reco.end && reco.start < bStart
        ? { title: reco.title, scheduleId: reco.scheduleId }
        : null;
    breaks.push({ start, end, span, rawGap, reco: brReco });
  }
  return breaks.length > 0 ? { breaks } : null;
}

/** 실시간(자정 기준 분) → 표시 Y. 0-24 선형에서 앞선 압축 구간이 줄인 만큼만 당겨준다.
 *  collapse=null이면 현행 0-24 선형(항등). */
function makeDisplayY(collapse: CollapseModel, hourPx: number) {
  return (absMinute: number) => {
    if (!collapse) return (absMinute / 60) * hourPx;
    let saved = 0;
    for (const br of collapse.breaks) {
      if (absMinute >= br.end) {
        saved += ((br.span - COLLAPSED_GAP_MIN) / 60) * hourPx;
      } else if (absMinute > br.start) {
        return (br.start / 60) * hourPx - saved;
      }
    }
    return (absMinute / 60) * hourPx - saved;
  };
}

function gapDurationLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분 비어있음`;
  if (m === 0) return `${h}시간 비어있음`;
  return `${h}시간 ${m}분 비어있음`;
}

// 할 일 배너 서브타이틀용 — "N시간이 비어요" 톤
function gapFreeLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분이 비어요`;
  if (m === 0) return `${h}시간이 비어요`;
  return `${h}시간 ${m}분이 비어요`;
}

/** 생략 표식 — 세로 점 3개(⋮). 압축 구간이 시간↔시간 사이에 있음을 알림. */
function OmitDots() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: s(2) }}>
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: COLORS.gray[400] }} />
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: COLORS.gray[400] }} />
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: COLORS.gray[400] }} />
    </View>
  );
}

/** 카드의 화면 좌표 (morph 인터랙션 시작점) — measureInWindow 결과 */
export type CardLayout = { x: number; y: number; width: number; height: number };

/** 카드 슬라이드 애니메이션 값 (outgoing/incoming) — spine/NOW 마커는 정적 유지, 카드만 슬라이드 */
export interface CardSlideAnim {
  outgoingTranslate: Animated.AnimatedInterpolation<number>;
  outgoingOpacity: Animated.AnimatedInterpolation<number>;
  incomingTranslate: Animated.AnimatedInterpolation<number>;
  incomingOpacity: Animated.AnimatedInterpolation<number>;
}

interface DayTimelineProps {
  date: Date;
  weekSchedules: ScheduleListItem[];
  /** 카드 탭 시 호출. layout은 morph overlay 시작점 (캘린더 카드 → 회기 상세 morph용). 미지원 호출자는 무시 가능. */
  onItemPress: (id: string, layout?: CardLayout) => void;
  /** 외부 ScrollView 안에서 사용 — 내부 ScrollView 제거 + 자동 스크롤 비활성 */
  noScrollWrap?: boolean;
  /** 상단 요약 영역 표시 여부 (캘린더 뷰는 sticky 헤더에 정보 통합되어 있어 false) */
  showHeader?: boolean;
  /** 자동 스크롤 타겟 y 위치 (DayTimeline 내부 기준). 부모 ScrollView가 자동 스크롤할 때 사용. 날짜별 1회 재호출 보장 */
  onScrollTargetReady?: (yWithinTimeline: number) => void;
  /** 날짜 전환 시 outgoing 날짜 — 카드 슬라이드 애니메이션 용 */
  outgoingDate?: Date | null;
  /** 카드 슬라이드 애니메이션 값 (부모가 관리) */
  cardSlideAnim?: CardSlideAnim;
  /** 빈 시간 압축: 큰 갭(>3h)을 1시간으로 줄이고 가장자리 trim (리스트 뷰 전용) */
  collapseGaps?: boolean;
}

export function DayTimeline({
  date,
  weekSchedules,
  onItemPress,
  noScrollWrap = false,
  showHeader = true,
  onScrollTargetReady,
  outgoingDate,
  cardSlideAnim,
  collapseGaps = false,
}: DayTimelineProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const centerId = useCenterStore((s) => s.centerId);
  // 실시간 NOW — 1분마다 갱신 (임박 카운트다운/NOW 마커 위치)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(
    () => weekSchedules.filter((it) => it.schedule_type !== 'block'),
    [weekSchedules],
  );

  // 범위는 항상 00:00~24:00 고정 — spine은 자정부터 자정까지 표시
  const startHour = 0;
  const endHour = END_HOUR;

  const dayItems = useMemo(
    () =>
      visible
        .filter((it) => isSameDay(parseDate(it.start), date))
        .sort(
          (a, b) =>
            parseDate(a.start).getTime() - parseDate(b.start).getTime(),
        ),
    [visible, date],
  );

  // outgoing(전환 직전) 날짜의 dayItems — 슬라이드 애니메이션 중에만 사용
  const outgoingDayItems = useMemo(
    () =>
      outgoingDate
        ? visible
            .filter((it) => isSameDay(parseDate(it.start), outgoingDate))
            .sort(
              (a, b) =>
                parseDate(a.start).getTime() - parseDate(b.start).getTime(),
            )
        : [],
    [visible, outgoingDate],
  );

  // 겹침 레인 배치 (동시간대 카드 가림 방지)
  const laneMap = useMemo(() => computeLanes(dayItems), [dayItems]);
  const outgoingLaneMap = useMemo(
    () => computeLanes(outgoingDayItems),
    [outgoingDayItems],
  );

  const hourPx = s(HOUR_HEIGHT);
  const totalHours = endHour - startHour;
  const hours = Array.from({ length: totalHours }, (_, i) => startHour + i);

  const isTodayView = isSameDay(date, now);

  // 오늘 요약 — 상태별 카운트
  const dayStats = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let inProgress = 0;
    let upcoming = 0;
    for (const it of dayItems) {
      const st = deriveStatus(it);
      if (st === 'completed') completed += 1;
      else if (st === 'cancelled') cancelled += 1;
      else if (st === 'no_show') noShow += 1;
      else if (st === 'in_progress') inProgress += 1;
      else if (st === 'upcoming') upcoming += 1;
    }
    return {
      total: dayItems.length,
      completed,
      cancelled,
      noShow,
      inProgress,
      upcoming,
    };
  }, [dayItems]);

  // 다음 일정 카운트다운 — 오늘 보고 있을 때만
  const nextSchedule = useMemo(() => {
    if (!isTodayView) return null;
    return dayItems.find((it) => {
      const st = parseDate(it.start);
      return st.getTime() > now.getTime() && deriveStatus(it) === 'upcoming';
    });
  }, [dayItems, isTodayView, now]);
  const minutesUntilNext = nextSchedule
    ? Math.round(
        (parseDate(nextSchedule.start).getTime() - now.getTime()) / 60000,
      )
    : null;
  const nextPrimaryName = (() => {
    if (!nextSchedule) return null;
    const p = nextSchedule.clients?.[0];
    return p?.name ?? nextSchedule.client_names?.[0] ?? null;
  })();
  // 60분 이상은 시간 단위로 — "75분 뒤" 대신 "1시간 15분 뒤"
  const formatUntil = (min: number) => {
    if (min < 60) return `${min}분 뒤`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`;
  };
  // 지금 진행 중인 일정이 있으면(= 빈 시간 아님) 다음 일정 안내 툴팁은 숨김
  const inProgressNow =
    isTodayView && dayItems.some((it) => deriveStatus(it) === 'in_progress');
  const tooltipText =
    !inProgressNow && minutesUntilNext !== null && minutesUntilNext > 0
      ? nextPrimaryName
        ? `${formatUntil(minutesUntilNext)} ${nextPrimaryName}님과 만나요`
        : `${formatUntil(minutesUntilNext)} 일정이에요`
      : null;

  // 빈 시간 추천 — 오늘 + 완료된 직전 회기 이후 첫 빈 시간(30분+) 1건만
  // 룰: 직전 schedule이 '완료' 상태 → 그 뒤 gap (다음 schedule 시작 or 일과 종료 18시까지),
  //     30분 이상, gap이 아직 안 끝남, 점심(12-13) 제외
  const recommendation = useMemo(() => {
    if (!isTodayView) return null;
    if (dayItems.length < 1) return null;
    const LUNCH_START = 12;
    const LUNCH_END = 13;
    // 카드 콘텐츠(아이콘+타이틀 2행+CTA+padding) ≈ s(95) + 위 s(8) margin = s(103)
    // HOUR_HEIGHT s(96) 기준 약 65분. 안전 margin 포함 60분 이상 gap만 추천.
    const MIN_GAP_MINUTES = 60;
    const WORK_END_HOUR = 18;
    const nowMs = now.getTime();
    for (let i = 0; i < dayItems.length; i++) {
      const curr = dayItems[i];
      const status = deriveStatus(curr);
      // 일지 작성 추천은 '완료' 회기에만 적합 (in_progress·upcoming·cancelled·no_show 제외)
      if (status !== 'completed') continue;
      const currEnd = parseDate(curr.end);
      const next = dayItems[i + 1] ?? null;
      let gapEndMs: number;
      let gapEndHour: number;
      if (next) {
        const nextStart = parseDate(next.start);
        gapEndMs = nextStart.getTime();
        gapEndHour = getHours(nextStart) + getMinutes(nextStart) / 60;
      } else {
        // 마지막 회기 — 일과 종료(18시)까지 gap으로 가정
        const workEnd = new Date(currEnd);
        workEnd.setHours(WORK_END_HOUR, 0, 0, 0);
        gapEndMs = workEnd.getTime();
        gapEndHour = WORK_END_HOUR;
      }
      const gapMinutes = (gapEndMs - currEnd.getTime()) / 60000;
      if (gapMinutes < MIN_GAP_MINUTES) continue;
      if (gapEndMs <= nowMs) continue;
      const gapStartHour = getHours(currEnd) + getMinutes(currEnd) / 60;
      // 점심 구간(12-13)과 거의 일치하는 gap은 제외
      if (gapStartHour >= LUNCH_START && gapEndHour <= LUNCH_END) continue;
      const primary = curr.clients?.[0];
      const name = primary?.name ?? curr.client_names?.[0] ?? null;
      if (!name) continue;
      // 카드 표시 위치 — gap 안에 있으면 현재 시각으로 따라가고, 아직 미래 gap이면 gap 시작에 고정 (C 하이브리드)
      const nowHourFloat = getHours(now) + getMinutes(now) / 60;
      const displayStartHour = Math.max(gapStartHour, nowHourFloat);
      return {
        gapStartHour, // 이전(완료) 일정 하단 = gap 시작 — 상단 이격 계산용
        startHour: displayStartHour,
        endHour: gapEndHour,
        actionTitle: `다음 일정 전, ${name}님의 상담 내용을 정리해보세요`,
        scheduleId: curr.id,
      };
    }
    return null;
  }, [dayItems, isTodayView, now]);

  // ── 빈 시간 압축 좌표(collapseGaps) ── 추천 카드가 놓인 갭은 압축 제외(카드가 그 자리를 채움).
  const reco = recommendation
    ? {
        start: recommendation.gapStartHour * 60,
        end: recommendation.endHour * 60,
        title: recommendation.actionTitle,
        scheduleId: recommendation.scheduleId,
      }
    : null;
  const collapse = useMemo(
    () => buildCollapse(dayItems, collapseGaps, reco),
    // reco 는 recommendation 파생값 — recommendation 을 dep 으로 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayItems, collapseGaps, recommendation],
  );
  const outgoingCollapse = useMemo(
    () => buildCollapse(outgoingDayItems, collapseGaps, null),
    [outgoingDayItems, collapseGaps],
  );
  const displayY = useMemo(() => makeDisplayY(collapse, hourPx), [collapse, hourPx]);
  const outgoingDisplayY = useMemo(
    () => makeDisplayY(outgoingCollapse, hourPx),
    [outgoingCollapse, hourPx],
  );

  // 시간 눈금(marks=0~23) + 그리드 라인(lines=0~24) + 전체 높이. 0-24 전부 표시, 압축 구간 내부 정시만 생략.
  const spine = useMemo(() => {
    const insideBreak = (h: number) =>
      !!collapse && collapse.breaks.some((br) => br.start < h * 60 && h * 60 < br.end);
    const marks: number[] = [];
    for (let h = startHour; h < endHour; h++) if (!insideBreak(h)) marks.push(h);
    const lines: number[] = [];
    for (let h = startHour; h <= endHour; h++) if (!insideBreak(h)) lines.push(h);
    return { marks, lines, height: displayY(endHour * 60) };
  }, [collapse, startHour, endHour, displayY]);

  // NOW 마커 — 오늘이고 압축 구간 내부가 아닐 때만 (스파인 0-24라 항상 범위 안)
  const nowAbs = getHours(now) * 60 + getMinutes(now);
  const nowInsideBreak =
    !!collapse && collapse.breaks.some((br) => br.start < nowAbs && nowAbs < br.end);
  const showNowMarker = isTodayView && !nowInsideBreak;
  const nowTop = displayY(nowAbs);

  // 자동 스크롤 타겟 — 진입 시 오늘이면 현재 시각으로. 그 외 날짜는 첫 일정, 없으면 09:00.
  const scrollTargetTop = (() => {
    if (isTodayView) return nowTop;
    if (dayItems.length > 0) {
      const st = parseDate(dayItems[0].start);
      return displayY(getHours(st) * 60 + getMinutes(st));
    }
    return displayY(DEFAULT_START_HOUR * 60);
  })();

  // 추천 카드 배치 — 이전/다음 일정 카드와 "어떤 경우에도 s(16) 이상" 이격되도록 클램프.
  //  · top = max(표시 시작 위치, 이전 카드 하단 + 16)  → 위로 16 보장
  //  · maxHeight = 다음 카드 상단 - top - 16 (overflow hidden) → 아래로 16 보장
  //  · 남는 공간이 카드 한 장(108)도 안 되면 끼워넣지 않고 숨김(겹침 방지)
  const recLayout = useMemo(() => {
    if (!recommendation) return null;
    const GAP = s(16);
    const NOW_GAP = s(8); // NOW 라인과 추천 카드 사이 최소 이격
    const prevBottomPx = displayY(recommendation.gapStartHour * 60);
    const nextTopPx = displayY(recommendation.endHour * 60);
    const desiredPx = displayY(recommendation.startHour * 60);
    let topPx = Math.max(desiredPx, prevBottomPx + GAP);
    // NOW 라인을 따라 떠 있을 때 라인에 붙지 않도록 8px 아래로 이격
    if (showNowMarker) topPx = Math.max(topPx, nowTop + NOW_GAP);
    const maxHeight = nextTopPx - topPx - GAP;
    if (maxHeight < s(108)) return null;
    return { topPx, maxHeight };
  }, [recommendation, displayY, showNowMarker, nowTop]);

  // NOW 마커·임박 칩 공통 pulse (살짝 호흡)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const pulseOpacityNow = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });
  // 툴팁 floating bob — 위아래 2px 살짝 떠다님
  const tooltipFloat = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  // 자동 스크롤 (자체 ScrollView 모드) — 날짜별 1회. 첫 일정으로, 없으면 폴백(오늘=현재시각/그 외=09:00)
  const scrollRef = useRef<ScrollView>(null);
  const scrolledDateRef = useRef<string | null>(null); // 확정(첫 일정) 스크롤 완료한 날짜
  const scrolledEmptyDateRef = useRef<string | null>(null); // 빈 폴백 스크롤 완료한 날짜
  useEffect(() => {
    if (noScrollWrap) return; // 외부 ScrollView 모드는 부모가 처리
    const dateKey = format(date, 'yyyy-MM-dd');
    if (scrolledDateRef.current === dateKey) return; // 이 날짜 확정 스크롤 완료
    const hasItems = dayItems.length > 0;
    if (!hasItems && scrolledEmptyDateRef.current === dateKey) return; // 빈 폴백 1회
    if (hasItems) scrolledDateRef.current = dateKey;
    else scrolledEmptyDateRef.current = dateKey; // 데이터 도착 시 확정 스크롤이 덮어씀
    const targetTop = scrollTargetTop;
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, targetTop - s(120)),
        animated: false,
      });
    }, 50);
  }, [noScrollWrap, date, dayItems.length, scrollTargetTop]);

  // 외부 ScrollView 모드 — 부모에게 스크롤 타겟 y를 알려줌 (부모가 스크롤 처리). 날짜별 1회
  const reportedDateRef = useRef<string | null>(null); // 확정(첫 일정) 리포트 완료한 날짜
  const reportedEmptyDateRef = useRef<string | null>(null); // 빈 폴백 리포트 완료한 날짜
  useEffect(() => {
    if (!noScrollWrap) return;
    const dateKey = format(date, 'yyyy-MM-dd');
    if (reportedDateRef.current === dateKey) return; // 이 날짜 확정 리포트 완료
    const hasItems = dayItems.length > 0;
    if (!hasItems && reportedEmptyDateRef.current === dateKey) return; // 빈 폴백 1회
    if (hasItems) reportedDateRef.current = dateKey;
    else reportedEmptyDateRef.current = dateKey; // 데이터 도착 시 확정 리포트가 덮어씀
    // s(20) = noScrollWrap 모드의 outer paddingTop
    onScrollTargetReady?.(scrollTargetTop + s(20));
  }, [noScrollWrap, date, dayItems.length, scrollTargetTop, onScrollTargetReady]);

  return (
    <View style={{ flex: 1 }}>
      {/* 상단 요약 — 월간 sticky 헤더 포맷과 동일. 텍스트 크기만 body-02로 작게 */}
      {showHeader && dayStats.total > 0 && (
        <View
          style={{
            paddingHorizontal: s(20),
            paddingTop: s(12),
            paddingBottom: s(12),
            backgroundColor: COLORS.white,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.gray[100],
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {isTodayView
              ? `오늘 ${dayStats.total}명을 만나요`
              : format(date, 'M월 d일 (EEE)', { locale: ko })}
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[500], marginTop: s(2) }}
          >
            완료 {dayStats.completed}
            {dayStats.inProgress > 0
              ? ` · 진행중 ${dayStats.inProgress}`
              : ''}
            {' · '}남음 {dayStats.upcoming}
            {dayStats.cancelled > 0 ? ` · 취소 ${dayStats.cancelled}` : ''}
            {dayStats.noShow > 0 ? ` · 노쇼 ${dayStats.noShow}` : ''}
          </Typography>
        </View>
      )}

    {noScrollWrap ? (
      <View style={{ paddingTop: s(20), paddingBottom: s(40), paddingRight: s(16) }}>
      <View className="flex-row" style={{ minHeight: spine.height }}>
        {/* 좌측 시간 spine — 숫자 우측 정렬 + 라인과 8px 간격 */}
        <View style={{ width: s(TIME_COL_WIDTH) }}>
          {spine.marks.map((h) => (
            <View
              key={h}
              style={{
                position: 'absolute',
                top: displayY(h * 60) - s(8),
                right: s(8),
              }}
            >
              <Typography
                variant="label-02"
                weight="medium"
                style={{ color: COLORS.gray[400] }}
              >
                {String(h).padStart(2, '0')}
              </Typography>
            </View>
          ))}
          {collapse?.breaks.map((br, i) => (
            <View
              key={`om-${i}`}
              style={{
                position: 'absolute',
                top:
                  displayY(br.start) +
                  ((COLLAPSED_GAP_MIN / 60) * hourPx) / 2 -
                  s(7),
                right: s(10),
              }}
            >
              <OmitDots />
            </View>
          ))}
        </View>

        {/* 카드 영역 */}
        <View className="flex-1" style={{ position: 'relative' }}>
          {/* hour 라인 — collapse 시 압축 좌표, 압축 구간 내부 시각은 생략 */}
          {spine.lines.map((h) => (
            <View
              key={`line-${h}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: displayY(h * 60),
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: COLORS.gray[100],
              }}
            />
          ))}

          {/* outgoing 카드 레이어 — 슬라이드 아웃 중에만 (recommendation 제외) */}
          {outgoingDate && cardSlideAnim && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: [{ translateX: cardSlideAnim.outgoingTranslate }],
                opacity: cardSlideAnim.outgoingOpacity,
              }}
            >
              {outgoingDayItems.map((item, idx) => {
                const st = parseDate(item.start);
                const en = parseDate(item.end);
                const startMins =
                  (getHours(st) - startHour) * 60 + getMinutes(st);
                const durationMins = Math.max(
                  differenceInMinutes(en, st),
                  15,
                );
                const top = outgoingDisplayY(startMins);
                const height = Math.max(
                  (durationMins / 60) * hourPx - s(6),
                  s(36),
                );
                const status = deriveStatus(item);
                const laneInfo = outgoingLaneMap.get(item.id);
                return (
                  <TimelineEventCard
                    key={item.id}
                    index={idx}
                    item={item}
                    top={top}
                    height={height}
                    status={status}
                    minutesUntil={null}
                    isImminent={false}
                    lane={laneInfo?.lane}
                    laneCount={laneInfo?.laneCount}
                    onPress={() => {}}
                  />
                );
              })}
            </Animated.View>
          )}

          {/* incoming 카드 레이어 — 현재 선택일 (recommendation + cards) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              },
              outgoingDate && cardSlideAnim
                ? {
                    transform: [
                      { translateX: cardSlideAnim.incomingTranslate },
                    ],
                    opacity: cardSlideAnim.incomingOpacity,
                  }
                : null,
            ]}
          >
            {/* 빈 시간 추천 카드 — 일정 카드보다 먼저 렌더 (overflow 시 일정 카드가 위에 덮음) */}
            {recommendation && recLayout && (
              <View
                style={{
                  position: 'absolute',
                  top: recLayout.topPx,
                  left: s(8),
                  right: 0,
                  maxHeight: recLayout.maxHeight,
                  overflow: 'hidden',
                }}
              >
                <GapRecommendationCard
                  actionTitle={recommendation.actionTitle}
                  onPress={() =>
                    openScheduleDetail(
                      router,
                      queryClient,
                      centerId,
                      recommendation.scheduleId,
                      { extra: { openWizard: '1' } },
                    )
                  }
                />
              </View>
            )}

            {/* 일정 카드 — 시작 시각 위치 절대 배치 */}
            {dayItems.map((item, idx) => {
              const st = parseDate(item.start);
              const en = parseDate(item.end);
              const startMins =
                (getHours(st) - startHour) * 60 + getMinutes(st);
              const durationMins = Math.max(differenceInMinutes(en, st), 15);
              const top = displayY(startMins);
              // 카드 높이에서 s(6) 빼 연속 일정(예: 1–2시·2–3시) 사이에 갭 확보
              const height = Math.max((durationMins / 60) * hourPx - s(6), s(36));

              // 임박 — 오늘이고 예정 상태이며 30분 안 시작
              const minutesUntil = isTodayView
                ? Math.round((st.getTime() - now.getTime()) / 60000)
                : null;
              const status = deriveStatus(item);
              const isImminent =
                minutesUntil !== null &&
                minutesUntil > 0 &&
                minutesUntil <= IMMINENT_WINDOW_MINUTES &&
                status === 'upcoming';

              const laneInfo = laneMap.get(item.id);
              return (
                <TimelineEventCard
                  key={item.id}
                  index={idx}
                  item={item}
                  top={top}
                  height={height}
                  status={status}
                  minutesUntil={isImminent ? minutesUntil : null}
                  isImminent={isImminent}
                  lane={laneInfo?.lane}
                  laneCount={laneInfo?.laneCount}
                  onPress={(layout) => onItemPress(item.id, layout)}
                />
              );
            })}
          </Animated.View>

          {/* 압축된 빈 시간 밴드 — 할 일 있으면 mint 배너(🚧목업), 없으면 gray "N시간 비어있음" */}
          {collapse?.breaks.map((br, i) => {
            // 상하 여백 s(4)씩 → 밴드 높이 s(64) (서브타이틀 2줄 확보)
            const top = displayY(br.start) + s(4);
            const height = (COLLAPSED_GAP_MIN / 60) * hourPx - s(8);
            // 🚧 목업: 짝수 갭에 할 일 노출, 홀수 갭은 비어있음 — 확정 후 br.reco(실데이터)로 교체
            const todo =
              i % 2 === 0
                ? MOCK_GAP_TODOS[Math.floor(i / 2) % MOCK_GAP_TODOS.length]
                : null;
            if (todo) {
              return (
                <TouchableOpacity
                  key={`gap-${i}`}
                  activeOpacity={0.7}
                  onPress={() => {}}
                  style={{
                    position: 'absolute',
                    top,
                    left: s(8),
                    right: 0,
                    height,
                    borderRadius: s(8),
                    backgroundColor: COLORS.paletteBg.mint,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: s(12),
                    gap: s(8),
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={todo.title}
                >
                  <Icon name="memo2-28" size={s(28)} />
                  <View style={{ flex: 1 }}>
                    <Typography
                      variant="label-02"
                      weight="regular"
                      style={{ color: COLORS.gray[500] }}
                      numberOfLines={1}
                    >
                      {gapFreeLabel(br.rawGap)}
                    </Typography>
                    <Typography
                      variant="body-03"
                      weight="semibold"
                      style={{ color: COLORS.gray[900] }}
                      numberOfLines={1}
                    >
                      {todo.title}
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={s(16)} color={COLORS.palette.mint} />
                </TouchableOpacity>
              );
            }
            return (
              <View
                key={`gap-${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  // 위아래 카드와 s(8)씩 띄움 (밴드가 카드에 붙어 보이지 않도록)
                  top,
                  left: s(8),
                  right: 0,
                  height,
                  borderRadius: s(8),
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: COLORS.gray[300],
                  backgroundColor: COLORS.gray[50],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.gray[500] }}
                >
                  {gapDurationLabel(br.rawGap)}
                </Typography>
              </View>
            );
          })}

          {/* NOW 가로 마커 — 오늘 보고 있고 spine 범위 안일 때만. dot pulse + 플로팅 툴팁 (정적) */}
          {showNowMarker && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: nowTop,
                left: -s(8),
                right: 0,
              }}
            >
              {/* 연속된 빨간 라인 — 배경 레이어 */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: s(8),
                  right: 0,
                  height: 1.5,
                  backgroundColor: COLORS.negative,
                }}
              />
              {/* dot — 라인 중앙 정렬 */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: -s(3.25),
                  left: 0,
                  width: s(8),
                  height: s(8),
                  borderRadius: s(4),
                  backgroundColor: COLORS.negative,
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacityNow,
                }}
              />
              {/* 플로팅 툴팁 — 라인 위에 떠 있음 + 캐럿 + bob 애니메이션 */}
              {tooltipText && (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: -s(34),
                    left: s(16),
                    backgroundColor: COLORS.gray[900],
                    paddingHorizontal: s(10),
                    paddingVertical: s(5),
                    borderRadius: s(8),
                    maxWidth: '85%',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.18,
                    shadowRadius: 6,
                    elevation: 4,
                    transform: [{ translateY: tooltipFloat }],
                  }}
                >
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.white }}
                    numberOfLines={1}
                  >
                    {tooltipText}
                  </Typography>
                  {/* 아래쪽 캐럿 — 라인을 가리킴 */}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -s(4),
                      left: s(12),
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
                </Animated.View>
              )}
            </View>
          )}
        </View>
      </View>
      </View>
    ) : (
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: s(8),
          paddingBottom: s(40),
          paddingRight: s(16),
        }}
      >
        <View className="flex-row" style={{ minHeight: hourPx * totalHours }}>
          {/* 좌측 시간 spine — 숫자 우측 정렬 + 라인과 8px 간격 */}
          <View style={{ width: s(TIME_COL_WIDTH) }}>
            {hours.map((h) => (
              <View
                key={h}
                style={{
                  height: hourPx,
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
          <View className="flex-1" style={{ position: 'relative' }}>
            {Array.from({ length: totalHours + 1 }, (_, i) => (
              <View
                key={`line-${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: i * hourPx,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: COLORS.gray[100],
                }}
              />
            ))}

            {/* outgoing 카드 레이어 — 슬라이드 아웃 중에만 (recommendation 제외) */}
            {outgoingDate && cardSlideAnim && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  transform: [{ translateX: cardSlideAnim.outgoingTranslate }],
                  opacity: cardSlideAnim.outgoingOpacity,
                }}
              >
                {outgoingDayItems.map((item, idx) => {
                  const st = parseDate(item.start);
                  const en = parseDate(item.end);
                  const startMins =
                    (getHours(st) - startHour) * 60 + getMinutes(st);
                  const durationMins = Math.max(
                    differenceInMinutes(en, st),
                    15,
                  );
                  const top = (startMins / 60) * hourPx;
                  const height = Math.max(
                    (durationMins / 60) * hourPx,
                    s(36),
                  );
                  const status = deriveStatus(item);
                  return (
                    <TimelineEventCard
                      key={item.id}
                      index={idx}
                      item={item}
                      top={top}
                      height={height}
                      status={status}
                      minutesUntil={null}
                      isImminent={false}
                      onPress={() => {}}
                    />
                  );
                })}
              </Animated.View>
            )}

            {/* incoming 카드 레이어 — 현재 선택일 */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                },
                outgoingDate && cardSlideAnim
                  ? {
                      transform: [
                        { translateX: cardSlideAnim.incomingTranslate },
                      ],
                      opacity: cardSlideAnim.incomingOpacity,
                    }
                  : null,
              ]}
            >
              {/* 빈 시간 추천 카드 */}
              {recommendation && recLayout && (
                <View
                  style={{
                    position: 'absolute',
                    top: recLayout.topPx,
                    left: s(8),
                    right: 0,
                    maxHeight: recLayout.maxHeight,
                    overflow: 'hidden',
                  }}
                >
                  <GapRecommendationCard
                    actionTitle={recommendation.actionTitle}
                    onPress={() =>
                      openScheduleDetail(
                        router,
                        queryClient,
                        centerId,
                        recommendation.scheduleId,
                        { extra: { openWizard: '1' } },
                      )
                    }
                  />
                </View>
              )}

              {dayItems.map((item, idx) => {
                const st = parseDate(item.start);
                const en = parseDate(item.end);
                const startMins =
                  (getHours(st) - startHour) * 60 + getMinutes(st);
                const durationMins = Math.max(differenceInMinutes(en, st), 15);
                const top = (startMins / 60) * hourPx;
                const height = Math.max((durationMins / 60) * hourPx, s(36));

                const minutesUntil = isTodayView
                  ? Math.round((st.getTime() - now.getTime()) / 60000)
                  : null;
                const status = deriveStatus(item);
                const isImminent =
                  minutesUntil !== null &&
                  minutesUntil > 0 &&
                  minutesUntil <= IMMINENT_WINDOW_MINUTES &&
                  status === 'upcoming';

                const laneInfo = laneMap.get(item.id);
                return (
                  <TimelineEventCard
                    key={item.id}
                    item={item}
                    top={top}
                    height={height}
                    status={status}
                    minutesUntil={isImminent ? minutesUntil : null}
                    isImminent={isImminent}
                    lane={laneInfo?.lane}
                    laneCount={laneInfo?.laneCount}
                    onPress={(layout) => onItemPress(item.id, layout)}
                  />
                );
              })}
            </Animated.View>

            {showNowMarker && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: nowTop,
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
      </ScrollView>
    )}
    </View>
  );
}

// ─── 카드 본문 (Timeline·Monthly 공통, lab schedule-spec-v2 시안 적용) ───
interface ScheduleCardContentProps {
  item: ScheduleListItem;
  status: ReturnType<typeof deriveStatus>;
  minutesUntil: number | null;
  isImminent: boolean;
  showMeta?: boolean; // 짧은 카드면 false (시간 spine timeline에서만 사용)
  narrow?: boolean; // 겹침 레인 분할로 카드 폭이 절반 이하일 때 — 이름 우선 압축 표기
}

function ScheduleCardContent({
  item,
  status,
  minutesUntil,
  isImminent,
  showMeta = true,
  narrow = false,
}: ScheduleCardContentProps) {
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const isNoShow = status === 'no_show';

  // 카드 배경으로 상태 구분
  // 정상 흐름(예정·완료)·노쇼 = gray-50, 취소 = gray-75(한 단계 낮춤), 진행중 = primary-50
  // 노쇼는 면색을 기본과 같게 두고 상태 뱃지로만 구분한다
  const cardBg = isInProgress
    ? COLORS.primary50
    : isCancelled
      ? COLORS.gray[75]
      : COLORS.gray[50];
  // 취소는 "없던 일" — 텍스트를 disabled(gray-400)로 처리. 노쇼는 기본 톤 유지
  const titleColor = isCancelled ? COLORS.text.state.disabled : COLORS.gray[900];
  const metaColor = isCancelled ? COLORS.text.state.disabled : COLORS.gray[700];
  const subtitleColor = isCancelled
    ? COLORS.text.state.disabled
    : COLORS.gray[500];

  // 카테고리 dot 색 — 상담 green / 검사 blue (캘린더 dot과 일관)
  const categoryColor =
    item.schedule_type === 'assessment' ? COLORS.assessment : COLORS.counseling;

  // 타이틀
  const typeLabel = SCHEDULE_TYPE_LABELS[item.schedule_type] ?? item.schedule_type;
  const categoryPrefix = `[${typeLabel}]`;
  const primary = item.clients?.[0];
  const primaryName = primary?.name ?? item.client_names?.[0] ?? item.title ?? '';
  const extraCount = Math.max(
    0,
    (item.clients?.length ?? item.client_names?.length ?? 0) - 1,
  );
  // narrow(레인 분할) 시 [상담]/[검사] 프리픽스 생략 — 카테고리 dot이 도메인을 대신 전달, 이름 폭 확보
  const titleText = narrow
    ? extraCount > 0
      ? `${primaryName} 외 ${extraCount}명`
      : primaryName
    : extraCount > 0
      ? `${categoryPrefix} ${primaryName} 외 ${extraCount}명`
      : `${categoryPrefix} ${primaryName}`;

  // 성별·나이 — 구분 세로선(GenderAgeMeta) 표준. 그룹 일정은 첫 내담자 기준이 무의미해 표시 안 함
  const genderLabel =
    primary?.gender === 'female'
      ? '여'
      : primary?.gender === 'male'
        ? '남'
        : null;
  const age = primary?.birth_date != null ? getAge(primary.birth_date) : null;

  // 메타: 시간 · 장소 · 프로그램
  const startStr = format(parseDate(item.start), 'HH:mm');
  const endStr = format(parseDate(item.end), 'HH:mm');

  // 케이스 서브타이틀 — "{case_code}의 N회기" (둘 다 있을 때만, 강조 X 캡션)
  const caseSubtitle =
    item.case_code && item.session_number != null
      ? `${item.case_code}의 ${item.session_number}회기`
      : null;

  // 그룹 일정 부분 출결 신호 — 좌측 stripe + 하단 라벨 (G안)
  // 일정 자체가 노쇼/취소면 중복이라 숨김. 데이터 미수신 시 (undefined) 신호 없음.
  const partialAbsent = item.partial_absent_count ?? 0;
  const partialNoShow = item.partial_no_show_count ?? 0;
  const hasPartialIssue = partialAbsent > 0 || partialNoShow > 0;
  const isGroup = extraCount > 0;
  const showAttendanceSignal =
    isGroup && hasPartialIssue && !isNoShow && !isCancelled;
  const signalParts: string[] = [];
  if (partialAbsent > 0) signalParts.push(`불참 ${partialAbsent}`);
  if (partialNoShow > 0) signalParts.push(`노쇼 ${partialNoShow}`);
  const signalText = signalParts.join(' · ');

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: cardBg,
        borderRadius: s(12),
        overflow: 'hidden',
        borderWidth: isInProgress ? 1 : 0,
        borderColor: isInProgress ? COLORS.primary300 : 'transparent',
        shadowColor: isInProgress ? COLORS.primary : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isInProgress ? 0.16 : 0,
        shadowRadius: isInProgress ? 8 : 0,
      }}
    >
      {/* 좌측 red stripe — 그룹 일정 부분 출결 이슈 발생 시 */}
      {showAttendanceSignal && (
        <View
          style={{
            width: s(3),
            backgroundColor: COLORS.palette.red,
          }}
        />
      )}
      <View
        style={{
          flex: 1,
          paddingVertical: s(8),
          paddingHorizontal: s(12),
        }}
      >
        {/* 케이스 서브타이틀 — 최상단, 강조 X 캡션 */}
        {caseSubtitle && (
          <Typography
            variant="caption-01"
            style={{
              color: subtitleColor,
              marginBottom: s(2),
            }}
            numberOfLines={1}
          >
            {caseSubtitle}
          </Typography>
        )}

        {/* 타이틀+메타를 한 프레임으로, 그 프레임과 배지를 한 행으로 묶음 → 배지 유무로 간격 안 변하게 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: s(6),
          }}
        >
          {/* 좌측 프레임: 타이틀 행 + 메타 행 */}
          <View style={{ flex: 1 }}>
            {/* 타이틀 행: dot + 이름 + 성별·나이 */}
            <View
              style={{
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
                  color: titleColor,
                  textDecorationLine: isCancelled ? 'line-through' : 'none',
                  textDecorationColor: COLORS.gray[500],
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {titleText}
              </Typography>
              {!isGroup && !narrow && (
                <GenderAgeMeta
                  genderLabel={genderLabel}
                  age={age}
                  color={isCancelled ? COLORS.text.state.disabled : undefined}
                />
              )}
            </View>

            {/* 메타 행(narrow): 한 줄 말줄임 — 줄바꿈되면 카드 높이를 넘겨 잘려 보임 */}
            {showMeta && narrow && (
              <Typography
                variant="body-03"
                style={{
                  marginTop: s(4),
                  color: metaColor,
                  textDecorationLine: isCancelled ? 'line-through' : 'none',
                  textDecorationColor: COLORS.gray[500],
                }}
                numberOfLines={1}
              >
                {[`${startStr}~${endStr}`, item.room_name, item.program_name]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}

            {/* 메타 행: 시간 · 장소 · 프로그램 — 짧은 카드면 숨김 */}
            {showMeta && !narrow && (
              <View
                style={{
                  marginTop: s(4),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(6),
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  variant="body-03"
                  style={{
                    color: metaColor,
                    textDecorationLine: isCancelled ? 'line-through' : 'none',
                    textDecorationColor: COLORS.gray[500],
                  }}
                >
                  {startStr}~{endStr}
                </Typography>
                {item.room_name && (
                  <>
                    <View
                      style={{
                        width: 1,
                        height: s(10),
                        backgroundColor: COLORS.gray[300],
                      }}
                    />
                    <Typography
                      variant="body-03"
                      style={{
                        color: metaColor,
                        textDecorationLine: isCancelled ? 'line-through' : 'none',
                        textDecorationColor: COLORS.gray[500],
                      }}
                      numberOfLines={1}
                    >
                      {item.room_name}
                    </Typography>
                  </>
                )}
                {item.program_name && (
                  <>
                    <View
                      style={{
                        width: 1,
                        height: s(10),
                        backgroundColor: COLORS.gray[300],
                      }}
                    />
                    <Typography
                      variant="body-03"
                      style={{
                        color: metaColor,
                        flex: 1,
                        textDecorationLine: isCancelled ? 'line-through' : 'none',
                        textDecorationColor: COLORS.gray[500],
                      }}
                      numberOfLines={1}
                    >
                      {item.program_name}
                    </Typography>
                  </>
                )}
              </View>
            )}
          </View>

          {/* 배지 — 프레임과 같은 행, 상단 정렬 (배지 높이가 타이틀↔메타 간격에 영향 X) */}
          {isImminent && minutesUntil !== null && (
            <ImminentChip minutesUntil={minutesUntil} />
          )}
          {isInProgress && !isImminent && <StatusBadge status="in_progress" />}
          {isCompleted && <StatusBadge status="completed" />}
          {isCancelled && <StatusBadge status="cancelled" />}
          {isNoShow && <StatusBadge status="no_show" />}
        </View>

        {/* 3행: 그룹 부분 출결 신호 — D 하단 라벨 */}
        {showAttendanceSignal && (
          <View
            style={{
              marginTop: s(8),
              paddingTop: s(8),
              borderTopWidth: 1,
              borderTopColor: COLORS.gray[200],
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <View
              style={{
                width: s(4),
                height: s(4),
                borderRadius: s(2),
                backgroundColor: COLORS.palette.red,
              }}
            />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.palette.red }}
            >
              {signalText}
            </Typography>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── 빈 시간 추천 카드 — "지금 처리하면 좋아요" 헤더 + solid primary tint 카드 ───
// (단일 추천 = 일지 작성. 멀티/카운터는 추가 종류 데이터 연동 시 lab gap-recommendation B안으로 확장)
function GapRecommendationCard({
  actionTitle,
  onPress,
}: {
  actionTitle: string;
  onPress: () => void;
}) {
  return (
    <View>
      {/* 추천 카드 */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          backgroundColor: COLORS.primary50,
          borderRadius: s(16),
          paddingVertical: s(16),
          paddingHorizontal: s(16),
          gap: s(8),
        }}
      >
        {/* 아이콘 + (라벨+제목 프레임) — 아이콘은 프레임 높이 기준 수직 중앙 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
          <Icon name="memo2-white-32" size={s(32)} />
          <View style={{ flex: 1, gap: s(4) }}>
            {/* 작은 타이틀 라벨 — semibold 13, primary (배너 내부 eyebrow) */}
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary }}
            >
              지금 처리하면 좋아요
            </Typography>
            {/* 제목 — text/body/strong, semibold 15 */}
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
              numberOfLines={2}
            >
              {actionTitle}
            </Typography>
          </View>
        </View>
        {/* 바로가기 — text/label/default, medium 13 + icon/primary 16 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0,
          }}
        >
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.text.label.default }}
          >
            바로가기
          </Typography>
          <Icon name="arrow-right-16" size={s(16)} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── 임박 칩 (살짝 호흡 pulse) ───
function ImminentChip({ minutesUntil }: { minutesUntil: number }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);
  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.7],
  });
  return (
    <Animated.View
      style={{
        paddingHorizontal: s(6),
        paddingVertical: s(2),
        borderRadius: s(4),
        backgroundColor: COLORS.primary,
        opacity,
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {minutesUntil}분 뒤
      </Typography>
    </Animated.View>
  );
}

// 상담 상세 회기 리스트(SessionStatusBadge)와 동일한 상태별 컬러·크기. tag 토큰 사용.
const STATUS_BADGE_CONFIG: Record<
  'in_progress' | 'completed' | 'cancelled' | 'no_show',
  { bg: string; text: string; label: string }
> = {
  // 회기 리스트엔 없는 상태 — 디자인 시스템 상태 매핑(진행중→Blue) 적용
  in_progress: { bg: COLORS.tag.blue.bg, text: COLORS.tag.blue.fg, label: '진행 중' },
  completed: { bg: COLORS.tag.green.bg, text: COLORS.tag.green.fg, label: '완료' },
  cancelled: { bg: COLORS.tag.red.bg, text: COLORS.tag.red.fg, label: '취소' },
  no_show: { bg: COLORS.tag.orange.bg, text: COLORS.tag.orange.fg, label: '노쇼' },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_BADGE_CONFIG }) {
  const cfg = STATUS_BADGE_CONFIG[status];
  return (
    <BadgeRound bg={cfg.bg} color={cfg.text}>
      {cfg.label}
    </BadgeRound>
  );
}

// ─── 타임라인 카드 (시간 spine + 절대 배치 + 진입 fade-in + tap spring) ───
interface TimelineEventCardProps {
  item: ScheduleListItem;
  top: number;
  height: number;
  status: ReturnType<typeof deriveStatus>;
  minutesUntil: number | null;
  isImminent: boolean;
  /** 카드 탭 시 카드의 화면 좌표 함께 전달 (morph 시작점) */
  onPress: (layout?: CardLayout) => void;
  /** stagger fade-in delay 계산용 (카드 순서) */
  index?: number;
  /** 동시간대 겹침 시 좌우 분할 레인 (computeLanes) */
  lane?: number;
  laneCount?: number;
}

function TimelineEventCard({
  item,
  top,
  height,
  status,
  minutesUntil,
  isImminent,
  onPress,
  index = 0,
  lane = 0,
  laneCount = 1,
}: TimelineEventCardProps) {
  const cardRef = useRef<View>(null);
  const showMeta = height >= s(54);
  const primary = item.clients?.[0];
  const primaryName =
    primary?.name ?? item.client_names?.[0] ?? item.title ?? '';

  // 진입 fade-in 제거 — 슬라이드 애니메이션 자체가 entrance 역할. 카드가 mount 후 깜빡이며 등장 X.

  // 탭 spring 피드백 (눌림 시 살짝 작아짐)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 18,
      stiffness: 280,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 240,
    }).start();
  };

  const handlePress = () => {
    // 카드의 화면 좌표 측정 → morph overlay 시작점. 측정 실패 시 layout 없이 호출 (fallback)
    if (cardRef.current) {
      cardRef.current.measureInWindow((x, y, w, h) => {
        onPress({ x, y, width: w, height: h });
      });
    } else {
      onPress();
    }
  };

  // 겹침 레인: 단일 레인은 기존 레이아웃 그대로, 복수 레인은 % 폭으로 좌우 분할
  const horizontal =
    laneCount > 1
      ? {
          left: `${(lane * 100) / laneCount}%` as const,
          width: `${100 / laneCount}%` as const,
        }
      : { left: s(8), right: 0 };
  return (
    <Animated.View
      ref={cardRef}
      style={{
        position: 'absolute',
        top,
        height,
        transform: [{ scale: scaleAnim }],
        ...horizontal,
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${primaryName} 상세 보기`}
        style={{
          flex: 1,
          marginLeft: laneCount > 1 ? (lane === 0 ? s(8) : s(3)) : 0,
          marginRight: laneCount > 1 && lane < laneCount - 1 ? s(3) : 0,
        }}
      >
        <ScheduleCardContent
          item={item}
          status={status}
          minutesUntil={minutesUntil}
          isImminent={isImminent}
          showMeta={showMeta}
          narrow={laneCount > 1}
        />
      </Pressable>
    </Animated.View>
  );
}

// ─── 월별 보기 카드 (인라인, 시간 spine 없음) ───
interface MonthlyEventCardProps {
  item: ScheduleListItem;
  onPress: () => void;
}

export function MonthlyEventCard({ item, onPress }: MonthlyEventCardProps) {
  const status = deriveStatus(item);
  const primary = item.clients?.[0];
  const primaryName =
    primary?.name ?? item.client_names?.[0] ?? item.title ?? '';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${primaryName} 상세 보기`}
    >
      <ScheduleCardContent
        item={item}
        status={status}
        minutesUntil={null}
        isImminent={false}
        showMeta={true}
      />
    </TouchableOpacity>
  );
}
