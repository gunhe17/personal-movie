import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isSameWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
} from "date-fns";
import { COLORS, LAYOUT, GAP } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { parseDate } from "@/shared/utils/date";
import {
  getScheduleColorByIndex,
  useScheduleRange,
  type ScheduleListItem,
} from "@/features/schedule";
import { useCenterStore } from "@/features/center";
import { deriveStatus, getAge, type ScheduleStatus } from "../utils";
import type { HomeVariantProps } from "./types";

type CardState = ScheduleStatus;
type ScheduleView = "week" | "month";

// Monday-first 주: 디자인 시안 기준 (월~일 순서)
const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const SUNDAY_INDEX = 6; // Monday-first 배열에서 일요일 위치

/**
 * 시간대별 인사 — 디자인 톤(친근·재미)에 맞춘 부드러운 표현.
 * 자정 0~5 새벽 / 6~11 아침 / 12~17 오후 / 18~21 저녁 / 22~23 밤
 */
function getTimeGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 6) return "조용한 새벽이에요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "활기찬 오후예요";
  if (h < 22) return "편안한 저녁이에요";
  return "포근한 밤이에요";
}

interface StatusBadgeConfig {
  bg: string;
  text: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"] | null;
}

const STATUS_CONFIG: Record<CardState, StatusBadgeConfig> = {
  upcoming: {
    bg: COLORS.statusBadge.scheduled.bg,
    text: COLORS.statusBadge.scheduled.text,
    label: "예정",
    icon: null,
  },
  in_progress: {
    bg: COLORS.statusBadge.inProgress.bg,
    text: COLORS.statusBadge.inProgress.text,
    label: "진행 중",
    icon: "ellipse",
  },
  completed: {
    bg: "#84B5221A",
    text: "#84B522",
    label: "완료",
    icon: "checkmark",
  },
  cancelled: {
    bg: "#FFE8E8",
    text: COLORS.negative,
    label: "취소",
    icon: "close",
  },
  no_show: {
    // 노쇼는 취소와 다름 — orange 팔레트로 의미 차별 (안 온 일정)
    bg: "rgba(244,117,0,0.08)",
    text: "#F47500",
    label: "노쇼",
    icon: null,
  },
};

/**
 * 홈 — Brand Hero + 오늘 일정/통계 탭
 *
 * 메인 컬러: 웹 동기화 primary 블루 (#256ef4)
 * 상단: 다크 톤이 아닌 브랜드 컬러 풀블리드 히어로 + 핑크 버블
 * 하단: 오늘 일정(주/월 캘린더 전환) / 통계(이번주/이번달/직접선택) 텍스트 탭
 */
export function BrandHome(props: HomeVariantProps) {
  const insets = useSafeAreaInsets();
  const {
    centerName,
    personName,
    today,
    nextSession,
    todaySchedules,
    unreadCount,
    isLoading,
    isError,
    isRefetching,
    onRefresh,
    onPressMyCenters,
    onPressNotifications,
    onPressNextSessionRecord,
    onPressSchedule,
    onPressFieldNoteList,
    onRetry,
  } = props;

  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  // 캘린더가 보여줄 기준 날짜 (네비게이션용) — `today`(실제 오늘)와 분리해
  // 좌우 화살표로 ±주/±월 이동 가능.
  const [viewAnchor, setViewAnchor] = useState<Date>(today);

  const handlePrev = () => {
    setViewAnchor((prev) =>
      scheduleView === "week" ? subWeeks(prev, 1) : subMonths(prev, 1),
    );
  };
  const handleNext = () => {
    setViewAnchor((prev) =>
      scheduleView === "week" ? addWeeks(prev, 1) : addMonths(prev, 1),
    );
  };
  const handleGoToday = () => {
    setViewAnchor(today);
    setSelectedDate(today);
  };

  const isOnCurrent =
    scheduleView === "week"
      ? isSameWeek(viewAnchor, today, { weekStartsOn: 1 })
      : isSameMonth(viewAnchor, today);

  // 캘린더가 표시하는 날짜 범위 — DayCalendar/MonthCalendar의 grid 생성 로직과 동일
  const centerId = useCenterStore((s) => s.centerId);
  const visibleRange = useMemo(() => {
    if (scheduleView === "week") {
      return {
        start: startOfWeek(viewAnchor, { weekStartsOn: 1 }),
        end: endOfWeek(viewAnchor, { weekStartsOn: 1 }),
      };
    }
    const monthStart = startOfMonth(viewAnchor);
    const monthEnd = endOfMonth(viewAnchor);
    return {
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    };
  }, [viewAnchor, scheduleView]);

  const { data: rangeSchedules, isLoading: isRangeLoading } = useScheduleRange(
    centerId,
    visibleRange.start,
    visibleRange.end,
  );

  // 선택일의 일정 카드 — 오늘은 props의 todaySchedules(정렬·필터 기준), 그 외는 range 데이터에서 필터링
  const dayCards = useMemo(() => {
    if (isSameDay(selectedDate, today)) {
      return todaySchedules
        .filter((sch) => sch.schedule_type !== "block")
        .map((schedule) => ({
          schedule,
          state: deriveStatus(schedule) as CardState,
        }));
    }
    const items = (rangeSchedules ?? [])
      .filter(
        (sch) =>
          sch.schedule_type !== "block" &&
          isSameDay(parseDate(sch.start), selectedDate),
      )
      .sort(
        (a, b) =>
          parseDate(a.start).getTime() - parseDate(b.start).getTime(),
      );
    return items.map((schedule) => ({
      schedule,
      state: deriveStatus(schedule) as CardState,
    }));
  }, [selectedDate, today, todaySchedules, rangeSchedules]);

  // "지금 집중할 일정" 1건 — in_progress 우선, 없으면 가장 가까운 예정.
  // 시간 흐름에 따라 자연스럽게 다음 카드로 보더 포커스가 이동.
  const activeCardId = useMemo(() => {
    if (dayCards.length === 0) return null;
    const inProgress = dayCards.find((c) => c.state === "in_progress");
    if (inProgress) return inProgress.schedule.id;
    const upcoming = dayCards.find((c) => c.state === "upcoming");
    return upcoming?.schedule.id ?? null;
  }, [dayCards]);

  // 캘린더 날짜별 dot 표시용 — visibleRange + todaySchedules 합쳐서 날짜별 그룹화
  // (오늘이 visibleRange 밖에 있을 수 있어 todaySchedules도 함께 포함)
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleListItem[]>();
    const seen = new Set<string>();
    const all: ScheduleListItem[] = [];
    for (const sch of rangeSchedules ?? []) {
      if (sch.schedule_type === "block") continue;
      if (seen.has(sch.id)) continue;
      seen.add(sch.id);
      all.push(sch);
    }
    for (const sch of todaySchedules) {
      if (sch.schedule_type === "block") continue;
      if (seen.has(sch.id)) continue;
      seen.add(sch.id);
      all.push(sch);
    }
    for (const sch of all) {
      const key = format(parseDate(sch.start), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(sch);
      map.set(key, arr);
    }
    return map;
  }, [rangeSchedules, todaySchedules]);

  // 캘린더 view(week/month)에 맞춰 동적으로 계산되는 상담·검사·노쇼 카운트.
  // 주간 모드: 보이는 주의 실제 주(일~토) 범위.
  // 월간 모드: 보이는 달의 실제 1일~말일 범위 (캘린더 grid가 인접 달까지 포함하므로 필터링 필요).
  const periodStats = useMemo(() => {
    const list = rangeSchedules ?? [];
    const periodStart =
      scheduleView === "week"
        ? startOfWeek(viewAnchor, { weekStartsOn: 1 })
        : startOfMonth(viewAnchor);
    const periodEnd =
      scheduleView === "week"
        ? endOfWeek(viewAnchor, { weekStartsOn: 1 })
        : endOfMonth(viewAnchor);
    let counseling = 0;
    let assessment = 0;
    let noShow = 0;
    for (const sch of list) {
      if (sch.schedule_type === "block") continue;
      const d = parseDate(sch.start);
      if (d < periodStart || d > periodEnd) continue;
      if (deriveStatus(sch) === "no_show") noShow++;
      if (sch.schedule_type === "counseling") counseling++;
      else if (sch.schedule_type === "assessment") assessment++;
    }
    return { counseling, assessment, noShow };
  }, [rangeSchedules, scheduleView, viewAnchor]);

  const periodLabel = scheduleView === "week" ? "이번주" : "이번달";

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <ScrollView
        // 하단 floating CTA가 콘텐츠를 가리지 않도록 충분한 padding 확보
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(120) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary500}
          />
        }
      >
        {/* ─── 브랜드 히어로 — 옅은 톤(P75) + 다크 텍스트 ─── */}
        <View style={{ backgroundColor: COLORS.primary75 }}>
          <SafeAreaView edges={["top"]}>
            <BrandTopBar
              centerName={centerName}
              unreadCount={unreadCount}
              onPressMyCenters={onPressMyCenters}
              onPressNotifications={onPressNotifications}
            />
            <BrandHeroBody personName={personName} today={today} />

            {/* 기간 요약 — 히어로 문구 바로 아래. 캘린더 view(주/월)에 따라 자동 전환 */}
            <View
              style={{
                paddingHorizontal: s(LAYOUT.screenPaddingX),
                paddingBottom: s(28),
              }}
            >
              <PeriodSummary
                label={periodLabel}
                counseling={periodStats.counseling}
                assessment={periodStats.assessment}
                noShow={periodStats.noShow}
              />
            </View>
          </SafeAreaView>
        </View>

        {/* ─── 흰 라운드 시트 ─── */}
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            marginTop: s(-16),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(8),
          }}
        >
          {/* 캘린더 */}
          <View style={{ marginTop: s(28) }}>
            <ScheduleCalendar
              today={today}
              viewAnchor={viewAnchor}
              view={scheduleView}
              onViewChange={setScheduleView}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              schedulesByDate={schedulesByDate}
              onPrev={handlePrev}
              onNext={handleNext}
              onGoToday={handleGoToday}
              isOnCurrent={isOnCurrent}
            />
          </View>

          {/* 캘린더와 일정 카드 사이 — 32px 큰 섹션 간격으로 그룹 분리 명확화 */}
          <View style={{ marginTop: s(32) }}>
            {(isSameDay(selectedDate, today) ? isLoading : isRangeLoading) ? (
              <View
                style={{
                  paddingVertical: s(40),
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color={COLORS.primary500} />
              </View>
            ) : isError ? (
              <ErrorBlock onRetry={onRetry} />
            ) : dayCards.length === 0 ? (
              <EmptyDay />
            ) : (
              <>
                {/* 카운트 라벨 — 카드 그룹의 메타 정보. */}
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{
                    color: COLORS.text.body.subtle,
                    marginBottom: s(GAP.intra),
                  }}
                >
                  {dayCards.length}개의 일정
                </Typography>
                <View style={{ gap: s(GAP.card) }}>
                  {dayCards.map(({ schedule, state }, eventIndex) => (
                    <ScheduleStatusCard
                      key={schedule.id}
                      schedule={schedule}
                      state={state}
                      eventIndex={eventIndex}
                      isActive={schedule.id === activeCardId}
                      onPress={() => onPressSchedule(schedule.id)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 노치 영역 — 스크롤·바운스 무관하게 항상 히어로 톤(P75) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: COLORS.primary75,
        }}
      />

      {/* 플로팅 필드노트 CTA — 페이지 하단 고정, 최상위 depth.
          pointerEvents box-none → 좌우 padding 영역은 아래 ScrollView로 터치 통과 */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(12),
          paddingBottom: s(16),
        }}
      >
        <FieldnoteCta
          clientName={nextSession?.clients?.[0]?.name ?? null}
          onPress={
            nextSession ? onPressNextSessionRecord : onPressFieldNoteList
          }
        />
      </View>
    </View>
  );
}

/* ─────────── Sub Components ─────────── */

function BrandTopBar({
  centerName,
  unreadCount,
  onPressMyCenters,
  onPressNotifications,
}: {
  centerName: string | null;
  unreadCount: number;
  onPressMyCenters: () => void;
  onPressNotifications: () => void;
}) {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity
        onPress={onPressMyCenters}
        hitSlop={8}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(8),
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.primary100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="business" size={14} color={COLORS.primary700} />
        </View>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {centerName ?? "센터 선택"}
        </Typography>
        <Icon name="arrow-down" size={20} color={COLORS.gray[700]} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressNotifications}
        hitSlop={6}
        activeOpacity={0.7}
        style={{
          width: s(36),
          height: s(36),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="alarm-24" size={24} color={COLORS.gray[700]} />
        {unreadCount > 0 && (
          <View
            style={{
              position: "absolute",
              right: s(6),
              top: s(6),
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: "#FDCA01",
              borderWidth: 1.5,
              borderColor: COLORS.primary75,
            }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

function BrandHeroBody({
  personName,
  today,
}: {
  personName: string | null;
  today: Date;
}) {
  const greeting = getTimeGreeting(today);
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(8),
        paddingBottom: s(4),
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingTop: s(8) }}>
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -1,
          }}
        >
          {personName ?? "선생"}님,{"\n"}
          {greeting}
        </Typography>
      </View>

      <GoodDayIllustration />
    </View>
  );
}

/**
 * "좋은 하루" 일러스트 — 해 + 구름 모티프 (View shape 조합)
 * 디자인 톤 §0 "친근·재미": 하드한 일러스트 대신 부드러운 도형 컴포지션.
 */
function GoodDayIllustration() {
  const SIZE = s(108);
  return (
    <View style={{ width: SIZE, height: SIZE, position: "relative" }}>
      {/* Sun rays */}
      {[
        { top: 2, left: SIZE / 2 - 1, w: 2, h: 8, deg: 0 },
        { top: 10, left: SIZE - 18, w: 2, h: 7, deg: 45 },
        { top: SIZE / 2 - 16, left: SIZE - 6, w: 8, h: 2, deg: 0 },
        { top: 10, left: 10, w: 2, h: 7, deg: -45 },
        { top: SIZE / 2 - 16, left: -2, w: 8, h: 2, deg: 0 },
      ].map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.top,
            left: r.left,
            width: r.w,
            height: r.h,
            borderRadius: 2,
            backgroundColor: "rgba(37,110,244,0.55)",
            transform: [{ rotate: `${r.deg}deg` }],
          }}
        />
      ))}

      {/* Sun outer halo */}
      <View
        style={{
          position: "absolute",
          top: s(14),
          left: SIZE / 2 - s(34),
          width: s(68),
          height: s(68),
          borderRadius: s(34),
          backgroundColor: "rgba(255,216,107,0.6)",
        }}
      />
      {/* Sun body */}
      <View
        style={{
          position: "absolute",
          top: s(22),
          left: SIZE / 2 - s(26),
          width: s(52),
          height: s(52),
          borderRadius: s(26),
          backgroundColor: "#FFD86B",
        }}
      />
      {/* Sun highlight */}
      <View
        style={{
          position: "absolute",
          top: s(28),
          left: SIZE / 2 - s(20),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "#FFE699",
          opacity: 0.9,
        }}
      />

      {/* Cloud — 3 puffs + base */}
      <View
        style={{
          position: "absolute",
          bottom: s(10),
          left: s(6),
          width: s(38),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.white,
          opacity: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(18),
          left: s(20),
          width: s(34),
          height: s(34),
          borderRadius: s(17),
          backgroundColor: COLORS.white,
          opacity: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(14),
          left: s(46),
          width: s(40),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.white,
          opacity: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(10),
          left: s(12),
          width: s(74),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: COLORS.white,
          opacity: 1,
        }}
      />

      {/* Sparkle */}
      <View
        style={{
          position: "absolute",
          top: s(4),
          left: s(14),
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: COLORS.primary500,
        }}
      />
    </View>
  );
}

/* ─── View Tab Switcher (텍스트) ─── */

/* ─── Period Summary (이번주/이번달 요약) ─── */

function PeriodSummary({
  label,
  counseling,
  assessment,
  noShow,
}: {
  label: string;
  counseling: number;
  assessment: number;
  noShow: number;
}) {
  return (
    <View style={{ gap: s(10) }}>
      {/* 타이틀 — Lable_01/Semibold, fg/tertiary */}
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.text.body.subtle }}
      >
        {label}
      </Typography>

      {/* 3개 라운드 컨테이너 — 각각 영역 확보 */}
      <View style={{ flexDirection: "row", gap: s(8) }}>
        <StatBox
          dotColor={COLORS.counseling}
          label="상담"
          value={counseling}
        />
        <StatBox
          dotColor={COLORS.assessment}
          label="검사"
          value={assessment}
        />
        <StatBox
          dotColor={COLORS.negative}
          label="노쇼"
          value={noShow}
        />
      </View>
    </View>
  );
}

function StatBox({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingVertical: s(14),
        paddingHorizontal: s(14),
        gap: s(6),
      }}
    >
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {value}
      </Typography>
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: dotColor }}
      >
        {label}
      </Typography>
    </View>
  );
}

/* ─── Schedule Calendar (주/월 전환) ─── */

function ScheduleCalendar({
  today,
  viewAnchor,
  view,
  onViewChange,
  selectedDate,
  onSelectDate,
  schedulesByDate,
  onPrev,
  onNext,
  onGoToday,
  isOnCurrent,
}: {
  /** 실제 오늘 — 셀 isToday 체크용 */
  today: Date;
  /** 캘린더가 보여줄 기준일 — 네비게이션으로 변경 가능 */
  viewAnchor: Date;
  view: ScheduleView;
  onViewChange: (v: ScheduleView) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  schedulesByDate: Map<string, ScheduleListItem[]>;
  onPrev: () => void;
  onNext: () => void;
  onGoToday: () => void;
  /** viewAnchor가 현재 주(주간 뷰) 또는 현재 달(월간 뷰)에 속하는지 */
  isOnCurrent: boolean;
}) {
  // 타이틀: 주간은 범위(M월 d일 ~ d일), 월간은 yyyy년 M월
  const title = (() => {
    if (view === "week") {
      const ws = startOfWeek(viewAnchor, { weekStartsOn: 1 });
      const we = endOfWeek(viewAnchor, { weekStartsOn: 1 });
      if (isSameMonth(ws, we)) {
        return `${format(ws, "M월 d일")} ~ ${format(we, "d일")}`;
      }
      return `${format(ws, "M월 d일")} ~ ${format(we, "M월 d일")}`;
    }
    return format(viewAnchor, "yyyy년 M월");
  })();

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: s(12),
        }}
      >
        {/* 좌측: < 타이틀 > + (필요 시) 오늘 버튼 */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: s(4) }}>
          <Pressable
            onPress={onPrev}
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: s(4),
            })}
            accessibilityRole="button"
            accessibilityLabel={view === "week" ? "이전 주" : "이전 달"}
          >
            <Ionicons
              name="chevron-back"
              size={s(20)}
              color={COLORS.text.title.default}
            />
          </Pressable>

          <Typography
            variant="title-01"
            weight="semibold"
            className="text-title-default"
          >
            {title}
          </Typography>

          <Pressable
            onPress={onNext}
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: s(4),
            })}
            accessibilityRole="button"
            accessibilityLabel={view === "week" ? "다음 주" : "다음 달"}
          >
            <Ionicons
              name="chevron-forward"
              size={s(20)}
              color={COLORS.text.title.default}
            />
          </Pressable>

          {!isOnCurrent && (
            <Pressable
              onPress={onGoToday}
              hitSlop={6}
              style={({ pressed }) => ({
                marginLeft: s(4),
                paddingHorizontal: s(12),
                paddingVertical: s(5),
                borderRadius: s(999),
                backgroundColor: COLORS.gray[50],
                borderWidth: 1,
                borderColor: COLORS.border.default,
                opacity: pressed ? 0.7 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="오늘로 이동"
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.gray[700] }}
              >
                오늘
              </Typography>
            </Pressable>
          )}
        </View>

        <ScheduleViewToggle value={view} onChange={onViewChange} />
      </View>

      <DowRow />

      {view === "week" ? (
        <WeekRow
          anchor={viewAnchor}
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
          schedulesByDate={schedulesByDate}
        />
      ) : (
        <MonthCalendar
          anchor={viewAnchor}
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
          schedulesByDate={schedulesByDate}
        />
      )}
    </View>
  );
}

function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: ScheduleView;
  onChange: (v: ScheduleView) => void;
}) {
  // Grid icon → 월(month) 보기, List icon → 주(week) 보기
  const tabs: {
    key: ScheduleView;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
  }[] = [
    { key: "month", icon: "grid-outline", label: "월간 보기" },
    { key: "week", icon: "list-outline", label: "주간 보기" },
  ];
  const activeIndex = tabs.findIndex((t) => t.key === value);
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;
  const thumbAnim = useRef(new Animated.Value(safeIndex)).current;

  useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue: safeIndex,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [safeIndex, thumbAnim]);

  // 버튼 40 + gap 3 = 다음 버튼까지 43px translateX
  const thumbTranslateX = thumbAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 43],
  });

  return (
    // 전체 91x32: p-1(4) + 버튼 24 + p-1(4) (height), 4 + 40 + 3 + 40 + 4 = 91 (width)
    <View className="h-[32px] w-[91px] shrink-0 flex-row items-center justify-between rounded-[8px] bg-gray-100 p-1">
      {/* 슬라이딩 thumb — 활성 탭 위치로 translateX 애니메이션 (220ms) */}
      <Animated.View
        pointerEvents="none"
        className="absolute h-[24px] w-[40px] rounded-[6px] border border-gray-100 bg-white"
        style={{
          left: 4,
          top: 4,
          transform: [{ translateX: thumbTranslateX }],
        }}
      />
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: isActive }}
            hitSlop={6}
            className="h-[24px] w-[40px] items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={isActive ? COLORS.text.title.default : COLORS.gray[500]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function DowRow() {
  return (
    <View style={{ flexDirection: "row", paddingBottom: s(2) }}>
      {DOW_LABELS.map((d, i) => (
        <View
          key={d}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: s(2),
          }}
        >
          <Typography
            variant="body-03"
            weight="medium"
            style={{
              // 일요일(index 6 in Monday-first): negative red — 디자인 doc §12.7
              color: i === SUNDAY_INDEX ? COLORS.negative : COLORS.gray[500],
            }}
          >
            {d}
          </Typography>
        </View>
      ))}
    </View>
  );
}

/** 캘린더 날짜 셀에 표시 가능한 최대 dot 개수 (한 줄 시각 정돈) */
const CALENDAR_MAX_DOTS = 3;

function DayCell({
  day,
  isCurrentMonth,
  today,
  selectedDate,
  onSelect,
  schedulesByDate,
}: {
  day: Date;
  isCurrentMonth: boolean;
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  schedulesByDate: Map<string, ScheduleListItem[]>;
}) {
  const isToday = isSameDay(day, today);
  const isSelected = isSameDay(day, selectedDate);
  const isSunday = day.getDay() === 0;

  const textColor = isSelected
    ? COLORS.white
    : !isCurrentMonth
      ? COLORS.gray[300]
      : isSunday
        ? COLORS.negative
        : isToday
          ? COLORS.primary700
          : COLORS.gray[900];

  // 해당 날짜의 일정 — 일정마다 다른 컬러 dot으로 표시 (최대 3개)
  const dayKey = format(day, "yyyy-MM-dd");
  const events = schedulesByDate.get(dayKey) ?? [];
  const dots = events.slice(0, CALENDAR_MAX_DOTS);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: s(4),
      }}
    >
      <Pressable
        onPress={() => onSelect(day)}
        hitSlop={6}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
          alignItems: "center",
        })}
      >
        <View
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: isSelected ? COLORS.primary500 : "transparent",
            borderWidth: isToday && !isSelected ? 1.5 : 0,
            borderColor: COLORS.primary500,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="body-01"
            weight={isToday || isSelected ? "semibold" : "regular"}
            style={{ color: textColor }}
          >
            {day.getDate()}
          </Typography>
        </View>

        {/* 일정 dot — 해당 일자에 일정이 있을 때만 표시.
            getScheduleColorByIndex로 일정마다 다른 컬러 → 갯수 + 종류 동시 인지.
            컨테이너 width를 날짜 원(40)과 동일하게 고정 + justifyContent center 로
            dot 개수와 무관하게 항상 날짜 기준 가운데 정렬. */}
        <View
          style={{
            marginTop: s(4),
            width: s(40),
            height: s(4),
            flexDirection: "row",
            gap: s(3),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {dots.map((_, i) => (
            <View
              key={i}
              style={{
                width: s(4),
                height: s(4),
                borderRadius: s(2),
                backgroundColor: getScheduleColorByIndex(i),
                opacity: !isCurrentMonth ? 0.4 : 1,
              }}
            />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

function WeekRow({
  anchor,
  today,
  selectedDate,
  onSelect,
  schedulesByDate,
}: {
  /** 보여줄 주의 기준일 — anchor가 속한 주(월~일)를 표시 */
  anchor: Date;
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  schedulesByDate: Map<string, ScheduleListItem[]>;
}) {
  const days = useMemo(() => {
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [anchor]);

  return (
    <View style={{ flexDirection: "row" }}>
      {days.map((d) => (
        <DayCell
          key={d.toISOString()}
          day={d}
          isCurrentMonth={true}
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelect}
          schedulesByDate={schedulesByDate}
        />
      ))}
    </View>
  );
}

function MonthCalendar({
  anchor,
  today,
  selectedDate,
  onSelect,
  schedulesByDate,
}: {
  /** 보여줄 달의 기준일 — anchor가 속한 달을 표시 */
  anchor: Date;
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  schedulesByDate: Map<string, ScheduleListItem[]>;
}) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [anchor]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <View>
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: "row" }}>
          {week.map((d) => (
            <DayCell
              key={d.toISOString()}
              day={d}
              isCurrentMonth={isSameMonth(d, anchor)}
              today={today}
              selectedDate={selectedDate}
              onSelect={onSelect}
              schedulesByDate={schedulesByDate}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─── Schedule Card with 5-state visual ─── */

function ScheduleStatusCard({
  schedule,
  state,
  eventIndex,
  isActive,
  onPress,
}: {
  schedule: ScheduleListItem;
  state: CardState;
  /** 같은 날 일정 리스트 안에서의 순번 — 카드별 고유 컬러 dot용 */
  eventIndex: number;
  /** "지금 집중할 일정" — in_progress 우선, 없으면 가장 가까운 예정 1건. 시간 흐름에 따라 자연스럽게 다음 카드로 이동. */
  isActive: boolean;
  onPress: () => void;
}) {
  const primary = schedule.clients?.[0];
  const isCounseling = schedule.schedule_type === "counseling";
  // 일정마다 다른 색으로 구분 (검사/상담 이분법 X) — 캘린더 dot과 컬러 동기
  const accent = getScheduleColorByIndex(eventIndex);
  const typeLabel = isCounseling ? "상담" : "검사";

  // 취소(없어진 일정) vs 노쇼(시간은 점유됐지만 안 온 일정) — 시각 처리 분리
  // 취소만 opacity·취소선·시간 dim 적용, 노쇼는 정상 가시성 유지 (orange 뱃지로만 구분)
  // 완료는 예정과 시각적으로 동일 (뱃지로만 구분)
  const isCancelled = state === "cancelled";
  const isInProgress = state === "in_progress";

  // 백엔드 ScheduleListItem 타입엔 아직 cancel_reason 미노출 — 안전 캐스트로 읽음.
  // SessionSummary에는 존재(apps/api .../counseling_session/schemas.py)하므로
  // list 응답에 필드 노출되면 자동 반영.
  const cancelReason = isCancelled
    ? (schedule as unknown as { cancel_reason?: string | null })
        .cancel_reason ?? null
    : null;

  // 상태별 카드 배경 — 진행중만 brand 톤, 그 외 모두 gray-50 통일
  const cardBg = isInProgress
    ? COLORS.bg.selected // primary-50 — 지금 진행 중 강조
    : COLORS.gray[50]; // 예정·완료·취소·노쇼 동일

  // 콘텐츠 투명도 — 취소만 가라앉히기 (노쇼는 정상 가시성 유지)
  const contentOpacity = isCancelled ? 0.5 : 1;

  // 시간 컬럼 색 — 현재 시간을 포함하는 in_progress에만 brand 컬러
  // 취소만 tertiary로 가라앉히고, 노쇼는 일반 텍스트 컬러로 유지
  const timeStartColor = isInProgress
    ? COLORS.primary700
    : isCancelled
      ? COLORS.text.body.subtle
      : COLORS.text.title.default;
  const timeEndColor = isInProgress
    ? COLORS.primary500
    : isCancelled
      ? COLORS.gray[400]
      : COLORS.text.body.subtle;
  const timeLineColor = isInProgress ? COLORS.primary300 : COLORS.gray[300];

  const start = parseDate(schedule.start);
  const end = parseDate(schedule.end);
  const startText = format(start, "HH:mm");
  const endText = format(end, "HH:mm");

  const genderText =
    primary?.gender === "female"
      ? "여"
      : primary?.gender === "male"
        ? "남"
        : null;
  const ageText =
    primary?.birth_date != null ? `만 ${getAge(primary.birth_date)}세` : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {/* 시간 컬럼 — 카드 좌측, 시작/종료 세로 배치 + 상태별 컬러 */}
        <View
          style={{
            width: s(56),
            marginRight: s(GAP.card),
            paddingVertical: s(12),
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: timeStartColor }}
          >
            {startText}
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
            {endText}
          </Typography>
        </View>

        {/* 카드 본문 — active(지금 집중할 일정)에만 옅은 primary 보더 */}
        <View
          style={{
            flex: 1,
            backgroundColor: cardBg,
            borderRadius: s(16),
            paddingVertical: s(12),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            borderWidth: isActive ? 1.5 : 0,
            borderColor: isActive ? COLORS.primary300 : "transparent",
          }}
        >
          {/* Title + meta — 2줄 고정 구조 (이름 길이 무관 일관성)
            1행: dot + 타이틀 + 뱃지
            2행: 성별 · 나이 (타이틀 시작 위치에 정렬, dot 폭 + gap만큼 들여쓰기) */}
          <View style={{ opacity: contentOpacity }}>
            {/* 1행: 타이틀 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: s(8),
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: accent,
                }}
              />
              <Typography
                variant="body-01"
                weight="semibold"
                style={{
                  flex: 1,
                  color: COLORS.text.title.default,
                  // 취소만 취소선 (노쇼는 "안 온 일"이라 취소선 X)
                  textDecorationLine: isCancelled ? "line-through" : "none",
                  textDecorationColor: COLORS.gray[500],
                }}
                numberOfLines={1}
              >
                {primary
                  ? `${primary.name}님의 ${typeLabel}`
                  : (schedule.title ?? typeLabel)}
              </Typography>
              <StatusBadge state={state} />
            </View>

            {/* 2행: 성별 · 나이 — dot(6) + gap(8)만큼 들여서 타이틀 시작점과 정렬 */}
            {(genderText || ageText) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: s(2),
                  marginLeft: 6 + s(8),
                }}
              >
                {genderText && (
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{ color: COLORS.gray[600] }}
                  >
                    {genderText}
                  </Typography>
                )}
                {genderText && ageText && (
                  <View
                    style={{
                      width: 1,
                      height: s(10),
                      backgroundColor: COLORS.gray[300],
                      marginHorizontal: s(6),
                    }}
                  />
                )}
                {ageText && (
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{ color: COLORS.gray[600] }}
                  >
                    {ageText}
                  </Typography>
                )}
              </View>
            )}
          </View>

          {/* 일정 메타데이터 그룹 — 내담자 정보와 시각적으로 분리
            그룹 간(내담자 ↔ 메타): GAP.card 12px
            그룹 내(메타 행끼리):  GAP.intra 4px
            취소 사유는 inactive dim 적용 X (가독성). 위치·프로그램 행이 dim된 가운데 사유만 또렷이 보이도록 의도. */}
          {(schedule.room_name || schedule.program_name || cancelReason) && (
            <View
              style={{
                marginTop: s(GAP.card),
                gap: s(GAP.intra),
              }}
            >
              {schedule.room_name && (
                <ScheduleMetaRow
                  iconName="location"
                  text={schedule.room_name}
                  inactive={isCancelled}
                />
              )}
              {schedule.program_name && (
                <ScheduleMetaRow
                  iconName="document"
                  text={schedule.program_name}
                  inactive={isCancelled}
                />
              )}
              {cancelReason && (
                <CancelReasonRow reason={cancelReason} />
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ScheduleMetaRow({
  iconName,
  text,
  inactive,
}: {
  iconName: React.ComponentProps<typeof Icon>["name"];
  text: string;
  inactive: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        opacity: inactive ? 0.55 : 1,
      }}
    >
      <Icon name={iconName} size={s(20)} color={COLORS.gray[400]} />
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.gray[800], flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

/** 취소 사유 row — Ionicons close-circle-outline + 사유 텍스트.
 *  ScheduleMetaRow와 같은 슬롯 안에 들어가지만 inactive dim은 적용 안 함(가독성). */
function CancelReasonRow({ reason }: { reason: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(6),
      }}
    >
      <Ionicons
        name="close-circle-outline"
        size={s(18)}
        color={COLORS.text.body.subtle}
        style={{ marginTop: 1 }}
      />
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.label.default, flex: 1 }}
        numberOfLines={2}
      >
        {reason}
      </Typography>
    </View>
  );
}

function StatusBadge({ state }: { state: CardState }) {
  const config = STATUS_CONFIG[state];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: config.bg,
        paddingHorizontal: s(8),
        paddingVertical: s(4),
        borderRadius: s(8),
        gap: s(4),
      }}
    >
      {config.icon && (
        <Ionicons
          name={config.icon}
          size={state === "in_progress" ? 8 : 12}
          color={config.text}
        />
      )}
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: config.text }}
      >
        {config.label}
      </Typography>
    </View>
  );
}

function EmptyDay() {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        padding: s(24),
        alignItems: "center",
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        className="text-body-strong"
      >
        일정이 없어요
      </Typography>
      <Typography
        variant="body-03"
        weight="regular"
        className="mt-1 text-body-subtle"
      >
        여유로운 하루 보내세요
      </Typography>
    </View>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        padding: s(24),
        alignItems: "center",
      }}
    >
      <Typography variant="body-02" weight="regular" className="text-label-default">
        일정을 불러올 수 없습니다
      </Typography>
      <TouchableOpacity
        onPress={onRetry}
        style={{
          marginTop: s(16),
          height: s(36),
          paddingHorizontal: s(16),
          borderRadius: s(12),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="body-03"
          weight="medium"
          className="text-body-strong"
        >
          다시 시도
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

/* ─────────── Fieldnote Floating CTA ───────────
 * ClipboardGreeting / DarkClipboardGreeting과 동일한 보라 그라디언트 CTA.
 * 세 변종 공통 액션 비주얼 — 추후 공용 모듈로 추출 후보. */

function FieldnoteCta({
  clientName,
  onPress,
}: {
  clientName: string | null;
  onPress: () => void;
}) {
  const title = clientName
    ? `${clientName}님의 상담을 기록해보세요`
    : "필드노트로 기록해보세요";

  return (
    <View
      style={{
        borderRadius: s(20),
        shadowColor: "#7B79FF",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="필드노트 녹음 시작"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      >
        <LinearGradient
          colors={["#A56EFF", "#7B79FF", "#219EFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: s(20),
            paddingVertical: s(16),
            paddingHorizontal: s(20),
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
          }}
        >
          <View style={{ flex: 1, gap: s(2) }}>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.white }}
              numberOfLines={1}
            >
              {title}
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: "rgba(255,255,255,0.85)" }}
              numberOfLines={1}
            >
              필드노트가 대화를 정리해드려요
            </Typography>
          </View>
          <RecordPill />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function RecordPill() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        backgroundColor: COLORS.white,
        paddingHorizontal: s(14),
        paddingVertical: s(10),
        borderRadius: s(999),
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
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

