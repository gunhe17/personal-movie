import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
  type ScheduleType,
} from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import { COLORS, SHADOWS, GAP, RADIUS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';
import { deriveStatus, getAge, type ScheduleStatus } from './utils';

/**
 * 지금 흐름 (Now-Flow) 뷰
 *
 * 차별화 축
 *   기존 grid/list 뷰     = "달력/주 단위로 일정 훑기" — 시간 도구
 *   ─────────────────────────────────────────────────
 *   flow 뷰              = "지금 시각 기준 흐름 + 임박 강조"
 *                          좌측 시간 spine + NOW 마커 + 다음 임박 1건 풀 HERO
 *
 * 진입/스크롤 인터랙션
 *   - 진입 즉시 다음 임박 일정으로 자동 스크롤 + 포커스 강조
 *   - 스크롤 시 viewport 상단 30% 위치에 가장 가까운 카드가 포커스
 *   - 포커스 = 좌측 spine dot 의 primary300 halo ring + 카드 shadow lift + 살짝 translateY -2
 *   - 모든 전환은 220ms Animated.timing 으로 부드럽게
 *
 * 강약 (Visual Hierarchy)
 *   1순위 HERO          다음 임박 1건 — 풀카드 + 좌측 primary 6px 라인 + 카운트다운
 *   2순위 IN_PROGRESS   진행 중 — 좌측 warning 4px 라인 + "진행 중" pill
 *   3순위 PLAIN         그 외 예정 — 일반 compact 카드
 *   4순위 PAST          마친/취소/노쇼 — opacity 0.55 dim
 */

interface NowFlowViewProps {
  todaySchedules: ScheduleListItem[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onItemPress: (id: string) => void;
}

type FlowState = 'past' | 'in_progress' | 'upcoming';

interface FlowAction {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

interface FlowEntry {
  item: ScheduleListItem;
  start: Date;
  end: Date;
  startMin: number;
  endMin: number;
  state: FlowState;
  /** 세분 상태 — past 안에서 completed/cancelled/no_show 를 시각적으로 구분하기 위해 보관 */
  status: ScheduleStatus;
  clientName: string;
  meta: string;
  typeLabel: string;
  action: FlowAction | null;
}

function toMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// upcoming 일정의 "지금 뭘 준비해야 하는지" mock — ID 해시로 4종 중 매핑.
// 백엔드에 prep_actions API 가 붙으면 그 값을 그대로 entry.action 에 주입.
const UPCOMING_PREP_ACTIONS: FlowAction[] = [
  { label: '이전 회기 일지 확인하기', iconName: 'document-text-outline' },
  { label: '사전기록지 확인하기', iconName: 'document-attach-outline' },
  { label: '검사 결과 검토하기', iconName: 'analytics-outline' },
  { label: '보호자 메시지 확인하기', iconName: 'chatbubble-ellipses-outline' },
];

function getPrepAction(id: string): FlowAction {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return UPCOMING_PREP_ACTIONS[hash % UPCOMING_PREP_ACTIONS.length];
}

function pickAction(status: ScheduleStatus, id: string): FlowAction | null {
  if (status === 'upcoming') return getPrepAction(id);
  if (status === 'in_progress')
    return { label: '일지 작성하기', iconName: 'create-outline' };
  if (status === 'no_show')
    return { label: '리마인드 보내기', iconName: 'send-outline' };
  // completed / cancelled — 추가 액션 없음
  return null;
}

function buildEntries(
  schedules: ScheduleListItem[],
  now: Date,
): FlowEntry[] {
  return schedules
    .filter((sch) => sch.schedule_type !== 'block')
    .map((sch): FlowEntry => {
      const start = parseDate(sch.start);
      const end = parseDate(sch.end);
      const status = deriveStatus(sch);
      let state: FlowState;
      if (status === 'in_progress') state = 'in_progress';
      else if (
        status === 'completed' ||
        status === 'no_show' ||
        status === 'cancelled'
      )
        state = 'past';
      else state = 'upcoming';

      const primary = sch.clients?.[0];
      const clientName = primary?.name ?? sch.title ?? '내담자';
      const gender =
        primary?.gender === 'female'
          ? '여'
          : primary?.gender === 'male'
            ? '남'
            : null;
      const ageText =
        primary?.birth_date != null
          ? `만 ${getAge(primary.birth_date)}세`
          : null;
      const meta = [gender, ageText].filter(Boolean).join(' · ');
      const typeLabel =
        SCHEDULE_TYPE_LABELS[sch.schedule_type] ?? sch.schedule_type;

      return {
        item: sch,
        start,
        end,
        startMin: toMinutes(start),
        endMin: toMinutes(end),
        state,
        status,
        clientName,
        meta,
        typeLabel,
        action: pickAction(status, sch.id),
      };
    })
    .sort((a, b) => a.startMin - b.startMin);
}

/** 다음 임박 = state in_progress(우선) 또는 첫 upcoming */
function pickHeroId(entries: FlowEntry[]): string | null {
  const inProgress = entries.find((e) => e.state === 'in_progress');
  if (inProgress) return inProgress.item.id;
  const upcoming = entries.find((e) => e.state === 'upcoming');
  if (upcoming) return upcoming.item.id;
  return null;
}

const FOCUS_ANCHOR_RATIO = 0.3;
const SPINE_LEFT = 64;
const SPINE_X = SPINE_LEFT - 16;

const TYPE_COLOR: Record<ScheduleType, { solid: string; light: string }> = {
  counseling: { solid: COLORS.counseling, light: COLORS.counselingLight },
  assessment: { solid: COLORS.assessment, light: COLORS.assessmentLight },
  meeting: { solid: COLORS.gray[600], light: COLORS.gray[100] },
  block: { solid: COLORS.gray[400], light: COLORS.gray[100] },
};

/* ─────────────────────── Top-level Component ─────────────────────── */

export function NowFlowView({
  todaySchedules,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  onRetry,
  onItemPress,
}: NowFlowViewProps) {
  // NOW 는 1분마다 갱신해 "지금 HH:MM" / countdown 이 자연스럽게 흐름
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const entries = useMemo(
    () => buildEntries(todaySchedules, now),
    [todaySchedules, now],
  );

  const heroId = useMemo(() => pickHeroId(entries), [entries]);

  const initialFocusId = useMemo(() => {
    return heroId ?? entries[entries.length - 1]?.item.id ?? null;
  }, [heroId, entries]);

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

  if (entries.length === 0) {
    return (
      <EmptyToday
        isRefetching={isRefetching}
        onRefresh={onRefresh}
        now={now}
      />
    );
  }

  return (
    <FlowScrollBody
      entries={entries}
      heroId={heroId}
      initialFocusId={initialFocusId}
      now={now}
      isRefetching={isRefetching}
      onRefresh={onRefresh}
      onItemPress={onItemPress}
    />
  );
}

function EmptyToday({
  isRefetching,
  onRefresh,
  now,
}: {
  isRefetching: boolean;
  onRefresh: () => void;
  now: Date;
}) {
  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      showsVerticalScrollIndicator={false}
    >
      <View
        className="items-center"
        style={{ gap: s(12), paddingHorizontal: s(20) }}
      >
        <View
          style={{
            width: s(64),
            height: s(64),
            borderRadius: s(32),
            backgroundColor: COLORS.gray[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={s(32)}
            color={COLORS.gray[400]}
          />
        </View>
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-title-default"
        >
          오늘 일정이 없어요
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, textAlign: 'center' }}
        >
          {format(now, 'M월 d일 (EEE)', { locale: ko })}는 비어 있어요.{'\n'}
          다른 보기로 다른 날짜를 확인해 보세요.
        </Typography>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────── Scroll Body w/ Focus ─────────────────────── */

interface FlowScrollBodyProps {
  entries: FlowEntry[];
  heroId: string | null;
  initialFocusId: string | null;
  now: Date;
  isRefetching: boolean;
  onRefresh: () => void;
  onItemPress: (id: string) => void;
}

function FlowScrollBody({
  entries,
  heroId,
  initialFocusId,
  now,
  isRefetching,
  onRefresh,
  onItemPress,
}: FlowScrollBodyProps) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, View | null>>({});
  const rowOffsetsRef = useRef<Record<string, { y: number; h: number }>>({});
  const viewportHRef = useRef<number>(0);
  const didInitialScrollRef = useRef<boolean>(false);

  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId);

  // handleScroll 은 useCallback([]) 으로 한 번만 만들어 ScrollView prop 변동을 피한다.
  // heroId 가 시간 흐름에 따라 바뀔 수 있으니 ref 로 최신값을 잡아둠.
  const heroIdRef = useRef<string | null>(heroId);
  useEffect(() => {
    heroIdRef.current = heroId;
  }, [heroId]);

  // initialFocusId 가 바뀌면 (예: 시간 흐름에 따라 다음 임박 변경) 포커스도 따라감
  // 단, 사용자가 이미 스크롤해 둔 상태면 다른 카드에 포커스가 있을 수 있으므로 그건 유지
  // → didInitialScrollRef 가 false 일 때만 (즉, 초기 진입 직후만) 따라가도록 함
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    setFocusedId(initialFocusId);
  }, [initialFocusId]);

  const registerRow = useCallback((id: string, ref: View | null) => {
    rowRefs.current[id] = ref;
  }, []);

  const measureRows = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    Object.entries(rowRefs.current).forEach(([id, ref]) => {
      if (!ref) return;
      ref.measureLayout(
        content as unknown as number,
        (_x: number, y: number, _w: number, h: number) => {
          rowOffsetsRef.current[id] = { y, h };
        },
        () => {},
      );
    });
  }, []);

  const tryInitialScroll = useCallback(() => {
    if (didInitialScrollRef.current) return;
    if (!initialFocusId) {
      didInitialScrollRef.current = true;
      return;
    }
    const offset = rowOffsetsRef.current[initialFocusId];
    const vh = viewportHRef.current;
    if (!offset || vh <= 0) return;
    const targetY = Math.max(0, offset.y - vh * FOCUS_ANCHOR_RATIO);
    scrollRef.current?.scrollTo({ y: targetY, animated: false });
    didInitialScrollRef.current = true;
  }, [initialFocusId]);

  useEffect(() => {
    const delays = [80, 180, 320];
    const timers = delays.map((d) =>
      setTimeout(() => {
        measureRows();
        tryInitialScroll();
      }, d),
    );
    return () => timers.forEach(clearTimeout);
  }, [measureRows, tryInitialScroll]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollY = e.nativeEvent.contentOffset.y;
      const vh = e.nativeEvent.layoutMeasurement.height;
      if (vh > 0) viewportHRef.current = vh;
      if (vh <= 0) return;

      // HERO bias — HERO 카드 center 가 viewport 안에 있으면 항상 HERO 에 lock.
      // "지금 가장 중요한 1건" 이 화면에 보이는 동안 다른 카드로 포커스가 튀지 않음.
      const currentHeroId = heroIdRef.current;
      if (currentHeroId) {
        const heroOff = rowOffsetsRef.current[currentHeroId];
        if (heroOff) {
          const heroCenter = heroOff.y + heroOff.h / 2;
          const viewTop = scrollY;
          const viewBottom = scrollY + vh;
          if (heroCenter >= viewTop && heroCenter <= viewBottom) {
            setFocusedId((prev) =>
              currentHeroId !== prev ? currentHeroId : prev,
            );
            return;
          }
        }
      }

      // HERO 가 viewport 밖 → 상단 30% anchor 와 가장 가까운 카드로 포커스 전환
      const anchor = scrollY + vh * FOCUS_ANCHOR_RATIO;
      let closestId: string | null = null;
      let minDist = Infinity;
      Object.entries(rowOffsetsRef.current).forEach(([id, off]) => {
        const center = off.y + off.h / 2;
        const dist = Math.abs(center - anchor);
        if (dist < minDist) {
          minDist = dist;
          closestId = id;
        }
      });
      if (closestId) {
        setFocusedId((prev) => (closestId !== prev ? closestId : prev));
      }
    },
    [],
  );

  const summary = useMemo(() => {
    const past = entries.filter((e) => e.state === 'past').length;
    const inProgress = entries.filter((e) => e.state === 'in_progress').length;
    const upcoming = entries.filter((e) => e.state === 'upcoming').length;
    return { past, inProgress, upcoming, total: entries.length };
  }, [entries]);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onLayout={(e) => {
        viewportHRef.current = e.nativeEvent.layout.height;
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
      contentContainerStyle={{
        paddingTop: s(GAP.related),
        paddingBottom: s(160),
      }}
    >
      <View ref={contentRef}>
        <View style={{ gap: s(GAP.section) }}>
          <NowHeader now={now} summary={summary} />
          <TimelineSpine
            entries={entries}
            now={now}
            heroId={heroId}
            focusedId={focusedId}
            registerRow={registerRow}
            onRowsLayout={measureRows}
            onItemPress={onItemPress}
          />
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────── NowHeader ─────────────────────── */

function NowHeader({
  now,
  summary,
}: {
  now: Date;
  summary: { past: number; inProgress: number; upcoming: number; total: number };
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        style={{
          backgroundColor: COLORS.primary75,
          borderRadius: s(RADIUS.lg),
          padding: s(GAP.related),
          gap: s(GAP.card),
        }}
      >
        <View className="flex-row items-baseline justify-between">
          <View className="flex-row items-baseline" style={{ gap: s(8) }}>
            <Typography
              variant="headline-02"
              weight="bold"
              className="text-title-default"
            >
              지금 {format(now, 'HH:mm')}
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: COLORS.text.body.subtle }}
            >
              {format(now, 'M월 d일 (EEE)', { locale: ko })}
            </Typography>
          </View>
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              borderRadius: s(RADIUS.sm),
              backgroundColor: COLORS.white,
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.primary500 }}
            >
              오늘 {summary.total}건
            </Typography>
          </View>
        </View>

        <View className="flex-row" style={{ gap: s(GAP.card) }}>
          <SummaryChip
            label="마침"
            count={summary.past}
            color={COLORS.text.body.subtle}
          />
          <View style={{ width: 1, backgroundColor: COLORS.gray[200] }} />
          <SummaryChip
            label="진행 중"
            count={summary.inProgress}
            color={COLORS.warning}
          />
          <View style={{ width: 1, backgroundColor: COLORS.gray[200] }} />
          <SummaryChip
            label="남음"
            count={summary.upcoming}
            color={COLORS.primary500}
          />
        </View>
      </View>
    </View>
  );
}

function SummaryChip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={{ flex: 1, gap: s(2) }}>
      <Typography
        variant="label-02"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        {label}
      </Typography>
      <View className="flex-row items-baseline" style={{ gap: s(2) }}>
        <Typography variant="headline-02" weight="bold" style={{ color }}>
          {count}
        </Typography>
        <Typography
          variant="label-02"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          건
        </Typography>
      </View>
    </View>
  );
}

/* ─────────────────────── Timeline Spine ─────────────────────── */

function TimelineSpine({
  entries,
  now,
  heroId,
  focusedId,
  registerRow,
  onRowsLayout,
  onItemPress,
}: {
  entries: FlowEntry[];
  now: Date;
  heroId: string | null;
  focusedId: string | null;
  registerRow: (id: string, ref: View | null) => void;
  onRowsLayout: () => void;
  onItemPress: (id: string) => void;
}) {
  // NOW marker 위치: 첫 upcoming 직전. 모두 past 면 끝, 모두 upcoming 이면 처음.
  const nowInsertIndex = useMemo(() => {
    const idx = entries.findIndex((e) => e.startMin > toMinutes(now));
    return idx === -1 ? entries.length : idx;
  }, [entries, now]);

  return (
    <View
      style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}
      onLayout={onRowsLayout}
    >
      <View style={{ position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            left: s(SPINE_X),
            top: s(12),
            bottom: s(12),
            width: s(2),
            backgroundColor: COLORS.gray[200],
            borderRadius: s(1),
          }}
        />

        <View style={{ gap: s(GAP.related) }}>
          {entries.map((entry, idx) => {
            const isNowInsert = idx === nowInsertIndex;
            return (
              <View key={entry.item.id}>
                {isNowInsert && <NowMarker now={now} />}
                <TimelineRow
                  entry={entry}
                  isHero={heroId === entry.item.id}
                  isFocused={focusedId === entry.item.id}
                  now={now}
                  registerRow={registerRow}
                  onPress={() => onItemPress(entry.item.id)}
                />
              </View>
            );
          })}
          {nowInsertIndex === entries.length && <NowMarker now={now} />}
        </View>
      </View>
    </View>
  );
}

function NowMarker({ now }: { now: Date }) {
  return (
    <View
      className="flex-row items-center"
      style={{
        marginVertical: s(GAP.intra),
        height: s(24),
      }}
    >
      <View
        style={{
          width: s(SPINE_LEFT - 8),
          alignItems: 'flex-end',
          paddingRight: s(8),
        }}
      >
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(RADIUS.sm),
            backgroundColor: COLORS.primary500,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            지금 {format(now, 'HH:mm')}
          </Typography>
        </View>
      </View>
      <View
        style={{
          position: 'absolute',
          left: s(SPINE_X - 5),
          width: s(12),
          height: s(12),
          borderRadius: s(6),
          backgroundColor: COLORS.primary500,
          borderWidth: 2,
          borderColor: COLORS.white,
        }}
      />
      <View
        style={{
          flex: 1,
          marginLeft: s(16),
          height: 1,
          backgroundColor: COLORS.primary500,
          opacity: 0.4,
        }}
      />
    </View>
  );
}

/* ─────────────────────── Timeline Row ─────────────────────── */

function TimelineRow({
  entry,
  isHero,
  isFocused,
  now,
  registerRow,
  onPress,
}: {
  entry: FlowEntry;
  isHero: boolean;
  isFocused: boolean;
  now: Date;
  registerRow: (id: string, ref: View | null) => void;
  onPress: () => void;
}) {
  const focusAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const setRowRef = useCallback(
    (ref: View | null) => {
      registerRow(entry.item.id, ref);
    },
    [entry.item.id, registerRow],
  );

  const ringOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });
  const ringScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const { state, status } = entry;
  const isInProgress = state === 'in_progress';

  // 지나간 일정 — completed / cancelled / no_show 시각 차별화.
  //  - completed (정상 종료): 살짝 dim. 줄긋기 없음. "지나간 정상 일정"
  //  - cancelled (취소)     : 진하게 dim + 줄긋기. "이 일정은 없었던 것"
  //  - no_show (노쇼)       : 살짝 dim, 줄긋기 없음. "왔어야 하는데 안 옴"
  const rowOpacity =
    status === 'cancelled'
      ? 0.5
      : status === 'completed'
        ? 0.75
        : status === 'no_show'
          ? 0.85
          : 1;

  return (
    <View
      ref={setRowRef}
      className="flex-row"
      style={{ opacity: rowOpacity }}
    >
      {/* 좌측 시간 컬럼 */}
      <View
        style={{
          width: s(SPINE_LEFT - 16),
          paddingRight: s(8),
          paddingTop: s(isHero ? 12 : 8),
          alignItems: 'flex-end',
        }}
      >
        <Typography
          variant="body-02"
          weight={isHero ? 'bold' : 'semibold'}
          style={{
            color:
              isHero && isInProgress
                ? COLORS.primary500
                : isInProgress
                  ? COLORS.warning
                  : state === 'past'
                    ? COLORS.text.body.subtle
                    : COLORS.text.title.default,
          }}
        >
          {format(entry.start, 'HH:mm')}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
        >
          ~{format(entry.end, 'HH:mm')}
        </Typography>
      </View>

      {/* dot + focus ring */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: s(SPINE_X - 14),
          top: s(isHero ? 9 : 7),
          width: s(28),
          height: s(28),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.primary300,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <RowDot state={state} isHero={isHero} typeColor={TYPE_COLOR[entry.item.schedule_type].solid} />
      </View>

      {/* 우측 카드 영역 — 마진은 각 카드의 Animated.View 자체에 적용 (아래 카드
       *  컴포넌트들의 outer style 참고). 부모 View 에 marginRight 를 둬도 자식
       *  Animated.View 의 시각적 폭에 일관 반영이 잘 안 되는 케이스가 있어
       *  카드 박스 자체에 marginHorizontal:16 을 박았다. */}
      <View style={{ flex: 1 }}>
        {isHero ? (
          <HeroCard entry={entry} now={now} focusAnim={focusAnim} onPress={onPress} />
        ) : isInProgress ? (
          <InProgressCard entry={entry} focusAnim={focusAnim} onPress={onPress} />
        ) : (
          <PlainCard entry={entry} focusAnim={focusAnim} onPress={onPress} />
        )}
      </View>
    </View>
  );
}

function RowDot({
  state,
  isHero,
  typeColor,
}: {
  state: FlowState;
  isHero: boolean;
  typeColor: string;
}) {
  // HERO 가 in_progress 인 케이스: warning(주황) 대신 primary 로 통일 — 카드 chrome 과 일관.
  if (isHero) {
    const dotColor =
      state === 'in_progress' ? COLORS.primary500 : typeColor;
    return (
      <View
        style={{
          width: s(14),
          height: s(14),
          borderRadius: s(7),
          backgroundColor: dotColor,
          borderWidth: 3,
          borderColor: COLORS.white,
        }}
      />
    );
  }
  // 비-HERO in_progress (드물게 동시 다발 진행) 는 status signal 로 warning 유지
  if (state === 'in_progress') {
    return (
      <View
        style={{
          width: s(14),
          height: s(14),
          borderRadius: s(7),
          backgroundColor: COLORS.warning,
          borderWidth: 3,
          borderColor: COLORS.white,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: s(10),
        height: s(10),
        borderRadius: s(5),
        backgroundColor:
          state === 'past' ? COLORS.gray[300] : COLORS.gray[400],
        borderWidth: 2,
        borderColor: COLORS.white,
      }}
    />
  );
}

/* ─────────────────────── Cards ─────────────────────── */

/**
 * 카드 포커싱 애니메이션 — shadow / elevation / translateY 를 focusAnim(0~1) 으로 보간.
 *
 * IMPORTANT — past 라고 baseline shadow 를 0 으로 떨어뜨리지 말 것.
 * 카드 배경은 gray-50(#F7F8F8) 이고 페이지는 white(#FFFFFF) 라 명도차가 거의 없다.
 * shadow 가 0 이면 카드 경계가 시각적으로 완전히 사라져 "카드가 안 보이는" 버그가 난다.
 * dim 처리는 row 레벨 opacity(rowOpacity) 가 담당. 카드 chrome(shadow + bg) 은 항상 살아있어야 한다.
 */
function useCardAnim(focusAnim: Animated.Value) {
  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });
  const shadowRadius = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 14],
  });
  const elevation = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 5],
  });
  const translateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });
  return { shadowOpacity, shadowRadius, elevation, translateY };
}

function HeroCard({
  entry,
  now,
  focusAnim,
  onPress,
}: {
  entry: FlowEntry;
  now: Date;
  focusAnim: Animated.Value;
  onPress: () => void;
}) {
  const { shadowOpacity, shadowRadius, elevation, translateY } =
    useCardAnim(focusAnim);
  const type = entry.item.schedule_type;
  const accent = TYPE_COLOR[type].solid;
  const accentBg = TYPE_COLOR[type].light;

  const isInProgress = entry.state === 'in_progress';
  const deltaMin = Math.max(0, entry.startMin - toMinutes(now));

  return (
    <Animated.View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.xl),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
        // 모든 카드 좌우 16px inset 통일 — 비포커싱·포커싱 차이 없이 균일
        marginLeft: s(16),
        marginRight: s(16),
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: s(RADIUS.xl),
          flexDirection: 'row',
          overflow: 'hidden',
          opacity: pressed ? 0.96 : 1,
        })}
        accessibilityRole="button"
      >
        {/* 좌측 6px 강조 라인 — HERO 는 상태와 무관하게 primary 톤으로 통일.
         *  in_progress 신호는 카드 내부 "진행 중" pill 텍스트로만 전달. */}
        <View
          style={{
            width: s(6),
            backgroundColor: COLORS.primary500,
          }}
        />

        <View style={{ flex: 1, padding: s(GAP.related) }}>
          {/* 상단: 카운트다운/진행 중 + 카테고리 */}
          <View className="flex-row items-center justify-between">
            {/* 상단 pill — HERO 카드는 primary 톤으로 통일.
             *  in_progress 는 텍스트만 "진행 중" 으로 바뀌고 색은 primary 유지. */}
            <View
              className="flex-row items-center"
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(4),
                borderRadius: s(RADIUS.full),
                backgroundColor: COLORS.primary500,
                gap: s(4),
              }}
            >
              {isInProgress ? (
                <View
                  style={{
                    width: s(6),
                    height: s(6),
                    borderRadius: s(3),
                    backgroundColor: COLORS.white,
                  }}
                />
              ) : (
                <Ionicons name="time" size={12} color={COLORS.white} />
              )}
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                {isInProgress
                  ? '진행 중'
                  : deltaMin === 0
                    ? '곧 시작'
                    : `${deltaMin}분 뒤 시작`}
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(4),
                borderRadius: s(RADIUS.sm),
                backgroundColor: accentBg,
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: accent }}
              >
                {entry.typeLabel}
              </Typography>
            </View>
          </View>

          {/* 내담자명 + 메타 */}
          <View
            className="flex-row items-baseline"
            style={{ marginTop: s(GAP.card), gap: s(8), flexWrap: 'wrap' }}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-title-default"
            >
              {entry.clientName}
            </Typography>
            {entry.meta ? (
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: COLORS.text.label.default }}
              >
                {entry.meta}
              </Typography>
            ) : null}
          </View>

          {/* 보조 메타 — 상담실 / 프로그램 */}
          {(entry.item.room_name || entry.item.program_name) && (
            <View
              style={{ marginTop: s(GAP.intra + 2), gap: s(GAP.intra) }}
            >
              {entry.item.room_name && (
                <MetaRow
                  iconName="location-20"
                  text={entry.item.room_name}
                />
              )}
              {entry.item.program_name && (
                <MetaRow
                  iconName="document-20"
                  text={entry.item.program_name}
                />
              )}
            </View>
          )}

          {/* 액션 pill — HERO 카드의 풀컬러 CTA. 상태 무관하게 primary 톤으로 통일. */}
          {entry.action && (
            <View
              className="flex-row items-center"
              style={{
                alignSelf: 'flex-start',
                marginTop: s(GAP.related),
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: s(RADIUS.full),
                backgroundColor: COLORS.primary500,
                gap: s(6),
              }}
            >
              <Ionicons
                name={entry.action.iconName}
                size={14}
                color={COLORS.white}
              />
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                {entry.action.label}
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.white}
              />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function InProgressCard({
  entry,
  focusAnim,
  onPress,
}: {
  entry: FlowEntry;
  focusAnim: Animated.Value;
  onPress: () => void;
}) {
  const { shadowOpacity, shadowRadius, elevation, translateY } =
    useCardAnim(focusAnim);
  const type = entry.item.schedule_type;
  const accent = TYPE_COLOR[type].solid;
  const accentBg = TYPE_COLOR[type].light;

  return (
    <Animated.View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
        marginLeft: s(16),
        marginRight: s(16),
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          overflow: 'hidden',
          borderRadius: s(RADIUS.lg),
          opacity: pressed ? 0.96 : 1,
        })}
        accessibilityRole="button"
      >
        <View
          style={{
            width: s(4),
            backgroundColor: COLORS.warning,
          }}
        />
        <View
          style={{
            flex: 1,
            paddingVertical: s(GAP.related),
            paddingHorizontal: s(GAP.related),
          }}
        >
          <View className="flex-row items-baseline justify-between">
            <View
              className="flex-row items-baseline"
              style={{ gap: s(8), flexShrink: 1 }}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-title-default"
                numberOfLines={1}
              >
                {entry.clientName}
              </Typography>
              {entry.meta ? (
                <Typography
                  variant="label-01"
                  weight="regular"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {entry.meta}
                </Typography>
              ) : null}
            </View>
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(2),
                borderRadius: s(RADIUS.sm),
                backgroundColor: accentBg,
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: accent }}
              >
                {entry.typeLabel}
              </Typography>
            </View>
          </View>
          <View
            className="flex-row items-center"
            style={{
              alignSelf: 'flex-start',
              marginTop: s(GAP.card),
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              borderRadius: s(RADIUS.sm),
              backgroundColor: 'rgba(255,146,0,0.12)',
              gap: s(6),
            }}
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: COLORS.warning,
              }}
            />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.warning }}
            >
              진행 중
            </Typography>
          </View>
          {(entry.item.room_name || entry.item.program_name) && (
            <View style={{ marginTop: s(GAP.intra + 2), gap: s(GAP.intra) }}>
              {entry.item.room_name && (
                <MetaRow iconName="location-20" text={entry.item.room_name} />
              )}
              {entry.item.program_name && (
                <MetaRow
                  iconName="document-20"
                  text={entry.item.program_name}
                />
              )}
            </View>
          )}

          {/* 액션 chip — 진행 중 카드의 보조 액션 */}
          {entry.action && (
            <ActionChip action={entry.action} variant="default" />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PlainCard({
  entry,
  focusAnim,
  onPress,
}: {
  entry: FlowEntry;
  focusAnim: Animated.Value;
  onPress: () => void;
}) {
  const { shadowOpacity, shadowRadius, elevation, translateY } =
    useCardAnim(focusAnim);
  const type = entry.item.schedule_type;
  const accent = TYPE_COLOR[type].solid;
  const accentBg = TYPE_COLOR[type].light;

  // past 상태 세분화 — 시각적으로 구분되도록 분기
  const status = entry.status;
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';
  const isNoShow = status === 'no_show';
  const isPast = isCancelled || isCompleted || isNoShow;

  // 카드 배경
  //  - cancelled: gray-100 (한 단계 진하게 — "지워진 느낌")
  //  - completed/no_show: gray-50 (정상 카드 톤, 일정 자체는 살아있음)
  const cardBg = isCancelled ? COLORS.gray[100] : COLORS.gray[50];

  // 내담자명 스타일 — line-through 는 cancelled 만, 그 외 past 는 굵기·색만 약화
  const nameWeight = isCancelled
    ? 'regular'
    : isPast
      ? 'medium'
      : 'semibold';
  const nameColor = isCancelled
    ? COLORS.text.body.subtle
    : isCompleted
      ? COLORS.text.body.strong
      : COLORS.text.title.default;
  const nameDecoration = isCancelled ? 'line-through' : 'none';

  return (
    <Animated.View
      style={{
        backgroundColor: cardBg,
        borderRadius: s(RADIUS.lg),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
        marginLeft: s(16),
        marginRight: s(16),
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: s(RADIUS.lg),
          paddingVertical: s(GAP.related),
          paddingHorizontal: s(GAP.related),
          opacity: pressed ? 0.92 : 1,
        })}
        accessibilityRole="button"
      >
        {/* Row 1: 이름 + 메타 + 상태/타입 뱃지 */}
        <View className="flex-row items-baseline justify-between">
          <View
            className="flex-row items-baseline"
            style={{ gap: s(8), flexShrink: 1 }}
          >
            <Typography
              variant="body-01"
              weight={nameWeight}
              style={{
                color: nameColor,
                textDecorationLine: nameDecoration,
              }}
              numberOfLines={1}
            >
              {entry.clientName}
            </Typography>
            {entry.meta ? (
              <Typography
                variant="label-01"
                weight="regular"
                style={{ color: COLORS.text.body.subtle }}
                numberOfLines={1}
              >
                {entry.meta}
              </Typography>
            ) : null}
          </View>
          {/* past 는 상태 뱃지, 그 외는 타입 뱃지 */}
          {isPast ? (
            <StatusBadge status={status} />
          ) : (
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(2),
                borderRadius: s(RADIUS.sm),
                backgroundColor: accentBg,
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: accent }}
              >
                {entry.typeLabel}
              </Typography>
            </View>
          )}
        </View>

        {/* Row 2+: 상담실 / 프로그램 — 다른 카드와 동일한 정보 노출 */}
        {(entry.item.room_name || entry.item.program_name) && (
          <View style={{ marginTop: s(GAP.card), gap: s(GAP.intra) }}>
            {entry.item.room_name && (
              <MetaRow iconName="location-20" text={entry.item.room_name} />
            )}
            {entry.item.program_name && (
              <MetaRow iconName="document-20" text={entry.item.program_name} />
            )}
          </View>
        )}

        {/* 액션 chip — past(completed/cancelled) 면 노출 안 함.
         *   noShow 인 경우만 "리마인드 보내기" 액션이 entry.action 으로 들어옴 → 표시 */}
        {entry.action && !isCompleted && !isCancelled && (
          <ActionChip action={entry.action} variant="default" />
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ─────────── ActionChip — 일반 카드용 작은 액션 칩 (lab schedule-now-flow 패턴) ─────────── */
function ActionChip({
  action,
  variant,
}: {
  action: FlowAction;
  variant: 'default' | 'on-warning';
}) {
  // default: gray-100 배경, fg.primary 텍스트 — 진행/예정 카드
  // on-warning: warning tint 배경 — 진행 중 카드처럼 warning 톤 영역에 얹힐 때
  const bg =
    variant === 'on-warning' ? 'rgba(255,146,0,0.12)' : COLORS.gray[100];
  return (
    <View
      className="flex-row items-center"
      style={{
        alignSelf: 'flex-start',
        marginTop: s(GAP.card),
        paddingHorizontal: s(12),
        paddingVertical: s(6),
        borderRadius: s(RADIUS.full),
        backgroundColor: bg,
        gap: s(4),
      }}
    >
      <Ionicons name={action.iconName} size={12} color={COLORS.gray[700]} />
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {action.label}
      </Typography>
      <Ionicons name="chevron-forward" size={12} color={COLORS.gray[600]} />
    </View>
  );
}

/* ─────────── StatusBadge — past 상태 (completed/cancelled/no_show) 시각 차별화 ─────────── */
function StatusBadge({ status }: { status: ScheduleStatus }) {
  // 완료 — checkmark 아이콘 포함이라 공용 컴포넌트로 못 바꿈.
  // 인라인 컨테이너만 BadgeRound 규격(높이28/최소폭50/좌우패딩10/pill/label-01 medium)에 맞추고 색 유지.
  if (status === 'completed') {
    return (
      <View
        className="flex-row items-center"
        style={{
          height: s(28),
          minWidth: s(50),
          paddingHorizontal: s(10),
          borderRadius: 9999,
          backgroundColor: COLORS.gray[200],
          gap: s(4),
        }}
      >
        <Ionicons name="checkmark" size={12} color={COLORS.text.body.strong} />
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.text.body.strong }}
        >
          완료
        </Typography>
      </View>
    );
  }
  if (status === 'cancelled') {
    return (
      <BadgeRound bg="rgba(255,66,66,0.10)" color={COLORS.negative}>
        취소
      </BadgeRound>
    );
  }
  // no_show
  return (
    <BadgeRound bg="rgba(255,146,0,0.12)" color={COLORS.warning}>
      노쇼
    </BadgeRound>
  );
}

function MetaRow({
  iconName,
  text,
}: {
  iconName: React.ComponentProps<typeof Icon>['name'];
  text: string;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}
    >
      <Icon name={iconName} size={s(16)} color={COLORS.gray[400]} />
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}
