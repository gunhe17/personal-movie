import { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 · 월간 통계 배치 비교 lab.
 *
 * 일정 탭에 그 달의 상담/검사/노쇼 카운트를 어디에 끼워 넣을지 5가지 안을 비교한다.
 * 화면이 이미 빽빽한 상태이므로 '추가 공간 최소화' 또는 '모드 분기' 방향을 우선.
 *
 *   A — 현재(대조군): 통계 없음
 *   B — 한 줄 칩: 월 네비 아래 36px 한 줄에 상담·검사·노쇼 칩
 *   C — 헤더 미니: '3월' 옆에 작은 숫자 3개 (공간 0 추가)
 *   D — 스탯 모드: 뷰모드 세그먼트에 Stats 추가, 캘린더 자리 대체
 *   E — 플로팅 칩: 캘린더와 선택일 사이 절취선 위에 떠 있는 칩
 */

type Variant = "current" | "row" | "header" | "mode" | "float";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "row", label: "한 줄 칩" },
  { key: "header", label: "헤더 미니" },
  { key: "mode", label: "스탯 모드" },
  { key: "float", label: "플로팅" },
];

// 월간 통계 — 디자인 비교용 mock
const MONTH_STATS = {
  counseling: 12,
  assessment: 4,
  noShow: 2,
};

const STAT_COLOR = {
  counseling: COLORS.counseling,
  assessment: COLORS.assessment,
  noShow: COLORS.negative,
} as const;

const STAT_BG = {
  counseling: COLORS.counselingLight,
  assessment: COLORS.assessmentLight,
  noShow: COLORS.paletteBg.red,
} as const;

type ScheduleType = "counseling" | "assessment";

interface MockSchedule {
  id: string;
  date: string;
  startHHmm: string;
  endHHmm: string;
  type: ScheduleType;
  isNoShow?: boolean;
  clientName: string;
  program?: string;
}

function buildMonthMock(refDate: Date): MockSchedule[] {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, "0");
  const d = (day: number) => `${y}-${m}-${String(day).padStart(2, "0")}`;
  const today = refDate.getDate();
  return [
    { id: "t1", date: d(today), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "김은서", program: "놀이치료" },
    { id: "t2", date: d(today), startHHmm: "11:00", endHHmm: "12:00", type: "assessment", clientName: "이도윤", program: "K-WISC-V" },
    { id: "t3", date: d(today), startHHmm: "15:00", endHHmm: "15:50", type: "counseling", clientName: "최서연", program: "인지행동치료" },
    { id: "p1", date: d(Math.max(1, today - 5)), startHHmm: "14:00", endHHmm: "14:50", type: "counseling", clientName: "박지민" },
    { id: "p2", date: d(Math.max(1, today - 3)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "정하늘", isNoShow: true },
    { id: "p3", date: d(Math.max(1, today - 1)), startHHmm: "16:00", endHHmm: "16:50", type: "assessment", clientName: "강민호" },
    { id: "n1", date: d(Math.min(28, today + 2)), startHHmm: "13:00", endHHmm: "13:50", type: "counseling", clientName: "김은서" },
    { id: "n2", date: d(Math.min(28, today + 4)), startHHmm: "11:00", endHHmm: "11:50", type: "assessment", clientName: "이도윤" },
    { id: "n3", date: d(Math.min(28, today + 6)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "최서연" },
    { id: "n4", date: d(Math.min(28, today + 9)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "김은서" },
    { id: "n5", date: d(Math.min(28, today + 12)), startHHmm: "15:00", endHHmm: "15:50", type: "counseling", clientName: "정하늘", isNoShow: true },
  ];
}

export default function ScheduleMonthlyStatsLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const schedules = useMemo(() => buildMonthMock(today), [today]);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, ScheduleType[]>();
    for (const sc of schedules) {
      const cur = map.get(sc.date) ?? [];
      cur.push(sc.type);
      map.set(sc.date, cur);
    }
    return map;
  }, [schedules]);

  const selectedSchedules = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return schedules
      .filter((sc) => sc.date === key)
      .sort((a, b) => a.startHHmm.localeCompare(b.startHHmm));
  }, [schedules, selectedDate]);

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        {/* Lab 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(16),
            flexDirection: "row",
            alignItems: "center",
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
          <View style={{ flex: 1, alignItems: "center" }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              일정 · 월간 통계 배치
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(16),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? "semibold" : "medium"}
                    style={{
                      color: active ? COLORS.text.title.default : COLORS.gray[500],
                    }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* 프리뷰 — 실제 일정 화면 흉내 */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        <PreviewScreen
          variant={variant}
          month={today}
          selectedDate={selectedDate}
          dotsByDate={dotsByDate}
          onSelectDate={setSelectedDate}
          schedules={selectedSchedules}
        />

        {/* 시안 메모 */}
        <View
          style={{
            paddingHorizontal: s(16),
            paddingTop: s(24),
          }}
        >
          <VariantMemo variant={variant} />
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────── 프리뷰 (variant별로 통계 위치 변경) ─────────── */

interface PreviewScreenProps {
  variant: Variant;
  month: Date;
  selectedDate: Date;
  dotsByDate: Map<string, ScheduleType[]>;
  onSelectDate: (d: Date) => void;
  schedules: MockSchedule[];
}

function PreviewScreen({
  variant,
  month,
  selectedDate,
  dotsByDate,
  onSelectDate,
  schedules,
}: PreviewScreenProps) {
  return (
    <View>
      {/* ─── (1) 화면 헤더 — '일정' 타이틀 + 뷰모드 세그먼트 ─── */}
      <ScreenHeader variant={variant} />

      {/* ─── (2) 월 네비 영역 ─── */}
      <MonthNav variant={variant} month={month} />

      {/* ─── (C: 한 줄 칩) — 월 네비 바로 아래 한 줄 ─── */}
      {variant === "row" && <RowChips />}

      {/* ─── (3) 캘린더 또는 스탯 패널 ─── */}
      {variant === "mode" ? (
        <StatsPanel />
      ) : (
        <CompactCalendar
          month={month}
          selectedDate={selectedDate}
          dotsByDate={dotsByDate}
          onSelectDate={onSelectDate}
        />
      )}

      {/* ─── (E: 플로팅 칩) — 캘린더 끝선 위에 떠 있는 칩 ─── */}
      {variant === "float" && <FloatChips />}

      {/* ─── (4) 선택일 라벨 + 일정 리스트 ─── */}
      {variant !== "mode" && (
        <SelectedDaySection
          selectedDate={selectedDate}
          schedules={schedules}
        />
      )}
    </View>
  );
}

function ScreenHeader({ variant: _variant }: { variant: Variant }) {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(20),
      }}
      className="flex-row items-center justify-between bg-surface"
    >
      <Typography variant="title-01" weight="semibold" className="text-gray-900">
        일정
      </Typography>
      <ViewModeSegment variant={_variant} />
    </View>
  );
}

function ViewModeSegment({ variant }: { variant: Variant }) {
  // D 시안: Grid / List / Stats 3-모드, Stats 활성
  const items: { icon: "grid-outline" | "list-outline" | "stats-chart-outline"; active: boolean }[] =
    variant === "mode"
      ? [
          { icon: "grid-outline", active: false },
          { icon: "list-outline", active: false },
          { icon: "stats-chart-outline", active: true },
        ]
      : [
          { icon: "grid-outline", active: true },
          { icon: "list-outline", active: false },
        ];

  return (
    <View
      style={{ height: s(28), padding: s(2), gap: s(3) }}
      className="flex-row items-center rounded-lg bg-gray-50"
    >
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            width: s(40),
            height: s(24),
            ...(it.active
              ? {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  elevation: 1,
                }
              : null),
            backgroundColor: it.active ? COLORS.white : "transparent",
          }}
          className="items-center justify-center rounded-md"
        >
          <Ionicons
            name={it.icon}
            size={s(16)}
            color={it.active ? COLORS.gray[900] : COLORS.gray[400]}
          />
        </View>
      ))}
    </View>
  );
}

function MonthNav({ variant, month }: { variant: Variant; month: Date }) {
  return (
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
        <Ionicons name="chevron-back" size={s(16)} color={COLORS.gray[800]} />
        {variant === "header" ? (
          <HeaderMiniStats month={month} />
        ) : (
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            {format(month, "M월")}
          </Typography>
        )}
        <Ionicons
          name="chevron-forward"
          size={s(16)}
          color={COLORS.gray[800]}
        />
      </View>
      <View
        style={{
          height: s(28),
          paddingHorizontal: s(12),
        }}
        className="items-center justify-center rounded-md border border-gray-200"
      >
        <Typography
          variant="label-01"
          weight="medium"
          className="text-gray-700"
        >
          오늘
        </Typography>
      </View>
    </View>
  );
}

/* ─────────── B: 한 줄 칩 ─────────── */

function RowChips() {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingBottom: s(12),
        flexDirection: "row",
        gap: s(8),
      }}
    >
      <ChipPill
        kind="counseling"
        label="상담"
        count={MONTH_STATS.counseling}
      />
      <ChipPill
        kind="assessment"
        label="검사"
        count={MONTH_STATS.assessment}
      />
      <ChipPill kind="noShow" label="노쇼" count={MONTH_STATS.noShow} />
    </View>
  );
}

function ChipPill({
  kind,
  label,
  count,
}: {
  kind: "counseling" | "assessment" | "noShow";
  label: string;
  count: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: s(32),
        paddingHorizontal: s(10),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: STAT_BG[kind],
        borderRadius: s(8),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <View
          style={{
            width: s(6),
            height: s(6),
            borderRadius: s(3),
            backgroundColor: STAT_COLOR[kind],
          }}
        />
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: STAT_COLOR[kind] }}
        >
          {label}
        </Typography>
      </View>
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: STAT_COLOR[kind] }}
      >
        {count}
      </Typography>
    </View>
  );
}

/* ─────────── C: 헤더 미니 메트릭 ─────────── */

function HeaderMiniStats({ month }: { month: Date }) {
  return (
    <View className="items-center" style={{ gap: s(2) }}>
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-gray-900"
      >
        {format(month, "M월")}
      </Typography>
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <MiniDotCount kind="counseling" count={MONTH_STATS.counseling} />
        <MiniDotCount kind="assessment" count={MONTH_STATS.assessment} />
        <MiniDotCount kind="noShow" count={MONTH_STATS.noShow} />
      </View>
    </View>
  );
}

function MiniDotCount({
  kind,
  count,
}: {
  kind: "counseling" | "assessment" | "noShow";
  count: number;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: s(3) }}>
      <View
        style={{
          width: s(5),
          height: s(5),
          borderRadius: s(2.5),
          backgroundColor: STAT_COLOR[kind],
        }}
      />
      <Typography
        variant="caption-01"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        {count}
      </Typography>
    </View>
  );
}

/* ─────────── D: 스탯 뷰 모드 ─────────── */

function StatsPanel() {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(8),
        gap: s(12),
      }}
    >
      {/* 큰 통계 카드 3개 */}
      <View style={{ flexDirection: "row", gap: s(10) }}>
        <BigStatCard kind="counseling" label="상담" count={MONTH_STATS.counseling} />
        <BigStatCard kind="assessment" label="검사" count={MONTH_STATS.assessment} />
        <BigStatCard kind="noShow" label="노쇼" count={MONTH_STATS.noShow} />
      </View>

      {/* 요일별 분포 — 간단한 막대 */}
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
        <View style={{ flexDirection: "row", gap: s(6), alignItems: "flex-end", height: s(80) }}>
          {[3, 5, 2, 4, 6, 1, 0].map((n, i) => (
            <View key={i} style={{ flex: 1, gap: s(6), alignItems: "center" }}>
              <View
                style={{
                  width: "100%",
                  height: s(Math.max(4, n * 12)),
                  backgroundColor:
                    i === 0 ? COLORS.gray[200] : COLORS.counseling,
                  borderRadius: s(4),
                  opacity: 0.85,
                }}
              />
              <Typography
                variant="caption-01"
                style={{ color: i === 0 ? COLORS.negative : COLORS.gray[500] }}
              >
                {["일", "월", "화", "수", "목", "금", "토"][i]}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      {/* 노쇼 상세 — 미니 리스트 */}
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
            {MONTH_STATS.noShow}건
          </Typography>
        </View>
        {[
          { name: "정하늘", date: "3월 3일" },
          { name: "정하늘", date: "3월 17일" },
        ].map((it, i) => (
          <View
            key={i}
            className="flex-row items-center justify-between"
            style={{
              paddingVertical: s(4),
            }}
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
              <Typography variant="body-03" className="text-gray-900">
                {it.name}
              </Typography>
            </View>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              {it.date}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
}

function BigStatCard({
  kind,
  label,
  count,
}: {
  kind: "counseling" | "assessment" | "noShow";
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
        // 라벨은 상단 끝, 숫자는 하단 끝에 anchor → 라벨이 카드 위쪽에 명확히 붙어 보임
        justifyContent: "space-between",
        minHeight: s(86),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <View
          style={{
            width: s(6),
            height: s(6),
            borderRadius: s(3),
            backgroundColor: STAT_COLOR[kind],
          }}
        />
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: STAT_COLOR[kind] }}
        >
          {label}
        </Typography>
      </View>
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

/* ─────────── E: 플로팅 칩 ─────────── */

function FloatChips() {
  return (
    <View
      style={{
        marginHorizontal: s(20),
        marginTop: s(-14),
        flexDirection: "row",
        justifyContent: "center",
        gap: s(8),
        zIndex: 10,
      }}
    >
      <FloatPill kind="counseling" label="상담" count={MONTH_STATS.counseling} />
      <FloatPill kind="assessment" label="검사" count={MONTH_STATS.assessment} />
      <FloatPill kind="noShow" label="노쇼" count={MONTH_STATS.noShow} />
    </View>
  );
}

function FloatPill({
  kind,
  label,
  count,
}: {
  kind: "counseling" | "assessment" | "noShow";
  label: string;
  count: number;
}) {
  return (
    <View
      style={{
        paddingVertical: s(7),
        paddingHorizontal: s(12),
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        backgroundColor: COLORS.white,
        borderRadius: s(999),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: COLORS.gray[100],
      }}
    >
      <View
        style={{
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: STAT_COLOR[kind],
        }}
      />
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.gray[700] }}
      >
        {label}
      </Typography>
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: STAT_COLOR[kind] }}
      >
        {count}
      </Typography>
    </View>
  );
}

/* ─────────── 캘린더 (모든 시안 공통) ─────────── */

function CompactCalendar({
  month,
  selectedDate,
  dotsByDate,
  onSelectDate,
}: {
  month: Date;
  selectedDate: Date;
  dotsByDate: Map<string, ScheduleType[]>;
  onSelectDate: (d: Date) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const rows = Math.ceil(days.length / 7);
  const DOW = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <View style={{ paddingHorizontal: s(8), paddingBottom: s(12) }}>
      <View className="flex-row">
        {DOW.map((d, i) => (
          <View
            key={d}
            style={{ height: s(28) }}
            className="flex-1 items-center justify-center"
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{
                color: i === 6 ? COLORS.negative : COLORS.gray[500],
              }}
            >
              {d}
            </Typography>
          </View>
        ))}
      </View>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <View key={rowIdx} className="flex-row">
          {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const types = dotsByDate.get(key) ?? [];
            const isCurrentMonth = isSameMonth(d, month);
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDate);
            const isSunday = d.getDay() === 0;

            return (
              <Pressable
                key={key}
                onPress={() => onSelectDate(d)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: s(3),
                  alignItems: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: s(30),
                    height: s(30),
                    borderRadius: s(15),
                    backgroundColor: isSelected
                      ? COLORS.primary500
                      : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: COLORS.primary500,
                  }}
                  className="items-center justify-center"
                >
                  <Typography
                    variant="body-03"
                    weight={isToday || isSelected ? "semibold" : "regular"}
                    style={{
                      color: isSelected
                        ? COLORS.white
                        : !isCurrentMonth
                          ? COLORS.gray[300]
                          : isSunday
                            ? COLORS.negative
                            : COLORS.gray[900],
                    }}
                  >
                    {d.getDate()}
                  </Typography>
                </View>
                <View
                  className="flex-row items-center"
                  style={{ height: s(6), gap: s(2), marginTop: s(2) }}
                >
                  {types.slice(0, 3).map((t, i) => (
                    <View
                      key={i}
                      style={{
                        width: s(3),
                        height: s(3),
                        borderRadius: s(1.5),
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.9)"
                          : t === "counseling"
                            ? COLORS.counseling
                            : COLORS.assessment,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ─────────── 선택일 + 일정 리스트 ─────────── */

function SelectedDaySection({
  selectedDate,
  schedules,
}: {
  selectedDate: Date;
  schedules: MockSchedule[];
}) {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(8) }}>
      <Typography variant="body-02" className="text-gray-700">
        {format(selectedDate, "yyyy년 MM월 dd일", { locale: ko })}
      </Typography>
      <View style={{ gap: s(10), marginTop: s(12) }}>
        {schedules.length === 0 ? (
          <Typography
            variant="body-03"
            style={{
              color: COLORS.gray[500],
              paddingVertical: s(16),
              textAlign: "center",
            }}
          >
            이 날 일정이 없어요
          </Typography>
        ) : (
          schedules.map((sch) => <MiniScheduleRow key={sch.id} schedule={sch} />)
        )}
      </View>
    </View>
  );
}

function MiniScheduleRow({ schedule }: { schedule: MockSchedule }) {
  const accent =
    schedule.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        padding: s(12),
        gap: s(12),
        opacity: schedule.isNoShow ? 0.7 : 1,
      }}
    >
      <View style={{ width: s(48) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
        >
          {schedule.startHHmm}
        </Typography>
        <Typography
          variant="label-02"
          style={{ color: COLORS.gray[500], marginTop: s(2) }}
        >
          ~ {schedule.endHHmm}
        </Typography>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: accent,
            }}
          />
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
          >
            {schedule.clientName}
          </Typography>
          {schedule.isNoShow && (
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(1),
                borderRadius: s(4),
                backgroundColor: COLORS.paletteBg.red,
              }}
            >
              <Typography
                variant="caption-01"
                weight="medium"
                style={{ color: COLORS.negative }}
              >
                노쇼
              </Typography>
            </View>
          )}
        </View>
        {schedule.program && (
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[600], marginTop: s(2) }}
          >
            {schedule.program}
          </Typography>
        )}
      </View>
    </View>
  );
}

/* ─────────── 시안 메모 ─────────── */

function VariantMemo({ variant }: { variant: Variant }) {
  const memo: Record<Variant, { title: string; desc: string }> = {
    current: {
      title: "현재 — 통계 없음",
      desc: "월 단위 통계가 어디에도 없는 대조군. 사용자는 일정 리스트를 직접 훑어야 월의 분포를 가늠할 수 있다.",
    },
    row: {
      title: "한 줄 칩 — 월 네비 아래 +44px",
      desc: "월 네비 바로 아래에 36px 한 줄. 가장 직관적이지만 그만큼 가장 많은 추가 공간을 차지한다. 캘린더 1행 높이의 ~75% 정도.",
    },
    header: {
      title: "헤더 미니 — 추가 공간 0",
      desc: "'3월' 라벨 아래로 작은 dot+숫자 3개를 끼움. 공간을 거의 안 잡지만 정보 위계가 약하고, 한눈에 들어오지 않을 수 있다.",
    },
    mode: {
      title: "스탯 모드 — 캘린더 자리 대체",
      desc: "뷰모드 세그먼트에 Stats 추가. 평소 화면은 그대로, 통계가 궁금할 때만 모드 전환. 막대·노쇼 내역 등 풍부한 정보 제공 가능.",
    },
    float: {
      title: "플로팅 칩 — 캘린더 하단 경계 위",
      desc: "캘린더와 선택일 사이 경계 위로 떠 있는 알약 칩 3개. 시각적 임팩트가 있고 공간은 거의 안 잡지만, 그림자 사용이 화면에서 유일해 시선이 강하게 쏠림.",
    },
  };
  const { title, desc } = memo[variant];
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        padding: s(16),
        gap: s(8),
      }}
    >
      <Typography variant="body-02" weight="semibold" className="text-gray-900">
        {title}
      </Typography>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[600], lineHeight: s(20) }}
      >
        {desc}
      </Typography>
    </View>
  );
}
