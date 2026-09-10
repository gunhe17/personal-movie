import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { buildHomeMock, formatHHmm } from "./_mocks/home-mock";

type CardState = "upcoming" | "in_progress" | "completed" | "cancelled";
type ViewTab = "schedule" | "stats";
type ScheduleView = "week" | "month";
type StatsPeriod = "week" | "month" | "custom";

interface StatusBadgeConfig {
  bg: string;
  text: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"] | null;
}

const STATUS_CONFIG: Record<CardState, StatusBadgeConfig> = {
  upcoming: {
    bg: COLORS.statusBadge.scheduled.bg, // gray-100
    text: COLORS.statusBadge.scheduled.text, // gray-600
    label: "예정",
    icon: null,
  },
  in_progress: {
    bg: COLORS.statusBadge.inProgress.bg, // notice @12%
    text: COLORS.statusBadge.inProgress.text, // notice
    label: "진행 중",
    icon: "ellipse",
  },
  completed: {
    bg: "#84B5221A", // 웹 etc-green-yellow @ 10%
    text: "#84B522", // 웹 etc-green-yellow
    label: "완료",
    icon: "checkmark",
  },
  cancelled: {
    bg: "#FFE8E8",
    text: COLORS.negative,
    label: "취소",
    icon: "close",
  },
};

/**
 * 홈 시안 — 상태 카드 (브랜드 컬러 히어로 + 4상태 일정 카드)
 *
 * 메인 컬러: 웹 동기화 primary 블루 (#256ef4)
 * 하단 일정 리스트: 카드 전체 분위기로 4상태(예정/진행 중/완료/취소) 구분
 *  - 진행 중: primary 보더 + 노란 점 뱃지
 *  - 완료: 콘텐츠 70% 투명도 + 체크 뱃지
 *  - 취소: sunken bg + 제목 취소선 + 55% 투명도 + 빨간 X 뱃지
 *  - 예정: 깔끔한 흰 카드 (기본)
 */
export default function HomeDarkChecklistLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mock = useMemo(() => buildHomeMock(), []);
  const today = useMemo(() => new Date(), []);

  // 상단 탭 — schedule(오늘 일정) / stats(통계)
  const [viewTab, setViewTab] = useState<ViewTab>("schedule");
  // 일정 탭 — 주/월 뷰
  const [scheduleView, setScheduleView] = useState<ScheduleView>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  // 통계 기간 — 이번주 / 이번달 / 직접선택
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("week");

  // 4상태를 모두 보여주기 위한 데모 카드 — mock 3건 + 취소 데모 1건
  const demoCards = useMemo(() => {
    const base = mock.todaySchedules;
    const cancelledStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      18,
      30,
    ).toISOString();
    const cancelledEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      19,
      20,
    ).toISOString();

    return [
      { schedule: base[0], state: "in_progress" as CardState },
      { schedule: base[1], state: "completed" as CardState },
      { schedule: base[2], state: "upcoming" as CardState },
      {
        schedule: {
          ...base[0],
          id: "demo-cancelled",
          start: cancelledStart,
          end: cancelledEnd,
          schedule_type: "counseling" as const,
          program_name: "정서지지치료",
          room_name: "3번 상담실",
          clients: [
            {
              id: "c4",
              name: "박지민",
              gender: "male" as const,
              birth_date: "2018-03-15",
            },
          ],
          client_names: ["박지민"],
        },
        state: "cancelled" as CardState,
      },
    ];
  }, [mock.todaySchedules, today]);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: COLORS.bg.base }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(120) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 브랜드 히어로 ─── */}
        <View style={{ backgroundColor: COLORS.primary500 }}>
          <SafeAreaView edges={["top"]}>
            <BrandTopBar
              centerName={mock.centerName}
              unreadCount={mock.unreadCount}
              onBack={() => router.back()}
            />
            <BrandHeroBody
              personName={mock.personName}
              scheduleCount={mock.todaySchedules.length}
            />
          </SafeAreaView>
        </View>

        {/* ─── 흰 라운드 시트 ─── */}
        <View
          className="flex-1"
          style={{
            backgroundColor: COLORS.bg.base,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            marginTop: s(-16),
            paddingHorizontal: s(16),
            paddingTop: s(20),
          }}
        >
          {/* 상단 뷰 탭 — 오늘 일정 / 통계 */}
          <ViewTabSwitcher value={viewTab} onChange={setViewTab} />

          {viewTab === "schedule" ? (
            <>
              <View style={{ marginTop: s(20) }}>
                <ScheduleCalendar
                  today={today}
                  view={scheduleView}
                  onViewChange={setScheduleView}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </View>

              {/* 일정 카드 — 섹션 헤더 없이 캘린더 바로 아래 */}
              <View style={{ marginTop: s(24) }}>
                {isSameDay(selectedDate, today) ? (
                  <View style={{ gap: s(16) }}>
                    {demoCards.map(({ schedule, state }) => (
                      <ScheduleStatusCard
                        key={schedule.id}
                        schedule={schedule}
                        state={state}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyDay />
                )}
              </View>
            </>
          ) : (
            <StatsView
              today={today}
              period={statsPeriod}
              onChangePeriod={setStatsPeriod}
            />
          )}
        </View>
      </ScrollView>

      {/* 노치 영역 — 스크롤과 무관하게 항상 브랜드 블루 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: COLORS.primary500,
        }}
      />

      {/* FAB — 일정 추가 */}
      <Pressable
        style={({ pressed }) => ({
          position: "absolute",
          right: s(20),
          bottom: s(40),
          width: s(56),
          height: s(56),
          borderRadius: s(28),
          backgroundColor: COLORS.primary500,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: pressed ? 0.95 : 1 }],
          ...SHADOWS.card,
        })}
        accessibilityRole="button"
        accessibilityLabel="일정 추가"
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </Pressable>
    </View>
  );
}

/* ─────────── Sub Components ─────────── */

function BrandTopBar({
  centerName,
  unreadCount,
  onBack,
}: {
  centerName: string;
  unreadCount: number;
  onBack: () => void;
}) {
  return (
    <View
      style={{ height: s(52), paddingHorizontal: s(20) }}
      className="flex-row items-center justify-between"
    >
      <TouchableOpacity
        onPress={onBack}
        hitSlop={8}
        className="flex-row items-center"
        style={{ gap: s(8) }}
      >
        <Icon
          name="arrow-left"
          size={20}
          color="rgba(255,255,255,0.7)"
        />
        <Typography
          variant="title-01"
          weight="bold"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {centerName}
        </Typography>
      </TouchableOpacity>

      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <TouchableOpacity
          hitSlop={6}
          style={{ width: s(36), height: s(36) }}
          className="items-center justify-center"
        >
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={COLORS.white}
          />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={6}
          style={{ width: s(36), height: s(36) }}
          className="items-center justify-center"
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.white}
          />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                right: s(6),
                top: s(6),
                width: s(8),
                height: s(8),
                borderRadius: s(4),
                backgroundColor: "#FDCA01", // 노란 액센트 (웹 etc-yellow)
                borderWidth: 1.5,
                borderColor: COLORS.primary500,
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BrandHeroBody({
  personName,
  scheduleCount,
}: {
  personName: string;
  scheduleCount: number;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(16),
        paddingBottom: s(40),
      }}
      className="flex-row"
    >
      {/* 좌측: 인사 + 알약 */}
      <View className="flex-1" style={{ gap: s(20) }}>
        <Typography
          weight="bold"
          style={{
            color: COLORS.white,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -1,
          }}
        >
          {personName}님,{"\n"}오늘도 좋은 하루예요
        </Typography>

        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: s(16),
            paddingVertical: s(10),
            borderRadius: s(12),
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            오늘 {scheduleCount}건 예정이에요
          </Typography>
        </View>
      </View>

      <BubbleIllustration />
    </View>
  );
}

function BubbleIllustration() {
  return (
    <View style={{ width: s(132), height: s(168), marginLeft: s(-4) }}>
      {/* 데코 작은 점 (왼쪽 상단) */}
      <View
        style={{
          position: "absolute",
          top: s(6),
          left: s(6),
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: "rgba(255,255,255,0.5)",
        }}
      />
      {/* 메인 핑크 버블 */}
      <View
        style={{
          position: "absolute",
          top: s(16),
          left: s(8),
          width: s(120),
          height: s(120),
          borderRadius: s(60),
          backgroundColor: "#FF8FA3",
          opacity: 0.95,
        }}
      />
      {/* 안쪽 그라데이션 느낌 */}
      <View
        style={{
          position: "absolute",
          top: s(32),
          left: s(24),
          width: s(68),
          height: s(68),
          borderRadius: s(34),
          backgroundColor: "#FFCCD3",
          opacity: 0.7,
        }}
      />
      {/* 작은 하이라이트 */}
      <View
        style={{
          position: "absolute",
          top: s(42),
          left: s(38),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "rgba(255,255,255,0.9)",
        }}
      />
      {/* 하단 silhouette (어두운 navy로 브랜드 블루 위에서 살짝 보임) */}
      <View
        style={{
          position: "absolute",
          bottom: s(6),
          left: s(40),
          width: s(52),
          height: s(60),
          borderTopLeftRadius: s(26),
          borderTopRightRadius: s(26),
          backgroundColor: COLORS.primary900,
        }}
      />
    </View>
  );
}

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function ScheduleCalendar({
  today,
  view,
  onViewChange,
  selectedDate,
  onSelectDate,
}: {
  today: Date;
  view: ScheduleView;
  onViewChange: (v: ScheduleView) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) {
  return (
    <View>
      {/* 헤더: 년월 + 주/월 토글 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: s(12),
        }}
      >
        <Typography
          variant="headline-02"
          weight="bold"
          className="text-title-default"
        >
          {format(today, "yyyy년 M월")}
        </Typography>
        <ScheduleViewToggle value={view} onChange={onViewChange} />
      </View>

      <DowRow />

      {view === "week" ? (
        <WeekRow
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />
      ) : (
        <MonthCalendar
          today={today}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />
      )}
    </View>
  );
}

function DowRow() {
  return (
    <View style={{ flexDirection: "row", paddingBottom: s(8) }}>
      {DOW_LABELS.map((d, i) => (
        <View
          key={d}
          style={{
            flex: 1,
            alignItems: "center",
            paddingVertical: s(4),
          }}
        >
          <Typography
            variant="body-03"
            weight="medium"
            style={{
              color: i === 0 ? COLORS.negative : COLORS.gray[400],
            }}
          >
            {d}
          </Typography>
        </View>
      ))}
    </View>
  );
}

function DayCell({
  day,
  isCurrentMonth,
  today,
  selectedDate,
  onSelect,
}: {
  day: Date;
  isCurrentMonth: boolean;
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
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

  // DowRow 셀과 동일한 외곽 래퍼(flex:1 + alignItems:center + paddingVertical s(4))
  // → 가로 정렬을 강제로 일치시킴
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
      </Pressable>
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
  const tabs: { key: ScheduleView; label: string }[] = [
    { key: "week", label: "주" },
    { key: "month", label: "월" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.gray[100],
        borderRadius: s(12),
        padding: s(4),
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              minWidth: s(48),
              paddingHorizontal: s(14),
              paddingVertical: s(7),
              borderRadius: s(8),
              backgroundColor: isActive ? COLORS.bg.surface : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              ...(isActive
                ? {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    elevation: 1,
                  }
                : {}),
            })}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{
                color: isActive ? COLORS.text.title.default : COLORS.gray[500],
              }}
            >
              {t.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function WeekRow({
  today,
  selectedDate,
  onSelect,
}: {
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
}) {
  // 오늘이 속한 주(일요일 시작)의 7일
  const days = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [today]);

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
        />
      ))}
    </View>
  );
}

function MonthCalendar({
  today,
  selectedDate,
  onSelect,
}: {
  today: Date;
  selectedDate: Date;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [today]);

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
        <View
          key={wi}
          style={{ flexDirection: "row" }}
        >
          {week.map((d) => (
            <DayCell
              key={d.toISOString()}
              day={d}
              isCurrentMonth={isSameMonth(d, today)}
              today={today}
              selectedDate={selectedDate}
              onSelect={onSelect}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function EmptyDay() {
  return (
    <View
      style={{
        backgroundColor: COLORS.bg.surface,
        borderRadius: s(16),
        padding: s(24),
        ...SHADOWS.card,
      }}
      className="items-center"
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

function ScheduleStatusCard({
  schedule,
  state,
}: {
  schedule: ReturnType<typeof buildHomeMock>["todaySchedules"][0];
  state: CardState;
}) {
  const primary = schedule.clients[0];
  const isCounseling = schedule.schedule_type === "counseling";
  const accent = isCounseling ? COLORS.counseling : COLORS.assessment;
  const typeLabel = isCounseling ? "상담" : "검사";

  const isCancelled = state === "cancelled";
  const isCompleted = state === "completed";
  const isInProgress = state === "in_progress";

  const contentOpacity = isCancelled ? 0.55 : isCompleted ? 0.7 : 1;

  return (
    <View className="flex-row" style={{ gap: s(8) }}>
      {/* 좌측 시간 라벨 */}
      <View
        style={{
          width: s(54),
          paddingTop: s(16),
          opacity: contentOpacity,
        }}
      >
        <Typography
          variant="body-02"
          weight="medium"
          style={{
            color: isCancelled ? COLORS.gray[400] : COLORS.gray[600],
          }}
        >
          {formatHHmm(schedule.start)}
        </Typography>
      </View>

      {/* 카드 */}
      <View
        style={{
          flex: 1,
          backgroundColor: isCancelled
            ? COLORS.bg["surface-sunken"]
            : COLORS.bg.surface,
          borderRadius: s(16),
          padding: s(16),
          borderWidth: isInProgress ? 1.5 : 0,
          borderColor: isInProgress ? COLORS.primary500 : "transparent",
          ...SHADOWS.card,
        }}
      >
        <View className="flex-row items-start" style={{ gap: s(12) }}>
          <View
            className="flex-1"
            style={{ opacity: contentOpacity }}
          >
            {primary && (
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-title-default"
                numberOfLines={1}
                style={{
                  textDecorationLine: isCancelled
                    ? "line-through"
                    : "none",
                  textDecorationColor: COLORS.gray[400],
                }}
              >
                {primary.name}님과 {typeLabel}
              </Typography>
            )}
            <View
              className="flex-row items-center"
              style={{ marginTop: s(6), gap: s(6) }}
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
                variant="label-01"
                weight="regular"
                className="text-label-default"
                numberOfLines={1}
              >
                {schedule.program_name ?? typeLabel}
                {schedule.room_name ? ` · ${schedule.room_name}` : ""}
              </Typography>
            </View>
          </View>

          <StatusBadge state={state} />
        </View>
      </View>
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

/* ─────────── View Tab + Stats ─────────── */

function ViewTabSwitcher({
  value,
  onChange,
}: {
  value: ViewTab;
  onChange: (v: ViewTab) => void;
}) {
  const tabs: { key: ViewTab; label: string }[] = [
    { key: "schedule", label: "오늘 일정" },
    { key: "stats", label: "통계" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        gap: s(8),
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            hitSlop={6}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Typography
              variant="title-01"
              weight={isActive ? "bold" : "medium"}
              style={{
                color: isActive ? COLORS.text.title.default : COLORS.gray[400],
              }}
            >
              {t.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatsView({
  today,
  period,
  onChangePeriod,
}: {
  today: Date;
  period: StatsPeriod;
  onChangePeriod: (p: StatsPeriod) => void;
}) {
  // 데모 통계 — 이번주 / 이번달 / 직접선택 분기
  const data = useMemo(() => {
    if (period === "week") {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      return {
        rangeLabel: `${format(weekStart, "M월 d일", { locale: ko })} ~ ${format(weekEnd, "d일", { locale: ko })}`,
        counseling: 12,
        assessment: 3,
        noShow: 1,
      };
    }
    if (period === "month") {
      return {
        rangeLabel: format(today, "yyyy년 M월", { locale: ko }),
        counseling: 48,
        assessment: 11,
        noShow: 4,
      };
    }
    // custom — 데모용 하드코딩 범위
    return {
      rangeLabel: "10월 15일 ~ 11월 10일",
      counseling: 86,
      assessment: 19,
      noShow: 7,
    };
  }, [today, period]);

  const totalCompleted = data.counseling + data.assessment;

  return (
    <View style={{ marginTop: s(20) }}>
      {/* 기간 토글 — 이번주 / 이번달 / 직접선택 */}
      <PeriodToggle value={period} onChange={onChangePeriod} />

      {/* 직접선택일 때만 날짜 범위 버튼 노출 */}
      {period === "custom" && (
        <CustomRangeButton label={data.rangeLabel} />
      )}

      {/* 기간 라벨 + 총합 */}
      <View style={{ marginTop: s(24) }}>
        {period !== "custom" && (
          <Typography
            variant="label-01"
            weight="regular"
            className="text-body-subtle"
          >
            {data.rangeLabel}
          </Typography>
        )}
        <View
          className="flex-row items-baseline"
          style={{ marginTop: s(6), gap: s(6) }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.text.title.default,
              fontSize: s(28),
              lineHeight: s(34),
              letterSpacing: -0.6,
            }}
          >
            총 {totalCompleted}회
          </Typography>
          <Typography
            variant="body-02"
            weight="regular"
            className="text-label-default"
          >
            진행했어요
          </Typography>
        </View>
      </View>

      {/* 3 스탯 카드 */}
      <View
        className="flex-row"
        style={{ marginTop: s(20), gap: s(12) }}
      >
        <StatCard
          color={COLORS.counseling}
          bg={COLORS.counselingLight}
          iconName="counseling-20"
          label="진행한 상담"
          value={data.counseling}
        />
        <StatCard
          color={COLORS.assessment}
          bg={COLORS.assessmentLight}
          iconName="assessment-20"
          label="진행한 검사"
          value={data.assessment}
        />
        <StatCard
          color={COLORS.negative}
          bg="#FFE8E8"
          ioniconsName="close-circle-outline"
          label="노쇼"
          value={data.noShow}
        />
      </View>
    </View>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: StatsPeriod;
  onChange: (p: StatsPeriod) => void;
}) {
  const tabs: { key: StatsPeriod; label: string }[] = [
    { key: "week", label: "이번주" },
    { key: "month", label: "이번달" },
    { key: "custom", label: "직접선택" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.bg.surface,
        borderRadius: s(20),
        padding: s(3),
        gap: s(2),
        ...SHADOWS.card,
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: s(8),
              borderRadius: s(18),
              backgroundColor: isActive ? COLORS.primary500 : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{
                color: isActive ? COLORS.white : COLORS.gray[500],
              }}
            >
              {t.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function CustomRangeButton({ label }: { label: string }) {
  return (
    <Pressable
      style={({ pressed }) => ({
        marginTop: s(16),
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.bg.surface,
        borderRadius: s(12),
        borderWidth: 1,
        borderColor: COLORS.border.default,
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        gap: s(10),
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel="기간 직접 선택"
    >
      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.primary600}
      />
      <Typography
        variant="body-02"
        weight="medium"
        className="text-title-default"
        style={{ flex: 1 }}
      >
        {label}
      </Typography>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={COLORS.gray[400]}
      />
    </Pressable>
  );
}

function StatCard({
  color,
  bg,
  iconName,
  ioniconsName,
  label,
  value,
}: {
  color: string;
  bg: string;
  iconName?: React.ComponentProps<typeof Icon>["name"];
  ioniconsName?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bg.surface,
        borderRadius: s(16),
        paddingVertical: s(20),
        paddingHorizontal: s(12),
        alignItems: "center",
        ...SHADOWS.card,
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(10),
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: s(12),
        }}
      >
        {iconName ? (
          <Icon name={iconName} size={s(20)} color={color} />
        ) : ioniconsName ? (
          <Ionicons name={ioniconsName} size={20} color={color} />
        ) : null}
      </View>
      <View
        className="flex-row items-baseline"
        style={{ gap: s(2) }}
      >
        <Typography
          weight="bold"
          style={{
            fontSize: s(24),
            lineHeight: s(28),
            color: COLORS.text.title.default,
            letterSpacing: -0.5,
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          className="text-body-subtle"
        >
          회
        </Typography>
      </View>
      <Typography
        variant="label-01"
        weight="regular"
        className="text-label-default"
        style={{ marginTop: s(4) }}
        numberOfLines={1}
      >
        {label}
      </Typography>
    </View>
  );
}
