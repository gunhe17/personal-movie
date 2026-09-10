import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 시안 — 월 캘린더 + 일자 상세
 *
 * 홈은 "오늘" 집중, 일정 탭은 "월 시야" 담당. 캘린더에서 날짜 dot로
 * 일정 분포(상담/검사/필드노트)를 한눈에, 탭한 날짜의 상세는 하단 펼침.
 *
 * 인터랙션 (display-only state)
 *  - 월 < > : viewMonth 이동
 *  - 월 라벨 탭 : 오늘 월로 점프
 *  - 날짜 탭 : selectedDate 변경
 */

type ScheduleType = "counseling" | "assessment" | "fieldnote";

interface MockSchedule {
  id: string;
  date: string; // YYYY-MM-DD
  startHHmm: string;
  endHHmm: string;
  type: ScheduleType;
  clientName: string;
  clientAge: number;
  clientGender: "male" | "female";
  program?: string;
  room?: string;
}

const TYPE_COLOR: Record<ScheduleType, string> = {
  counseling: COLORS.counseling,
  assessment: COLORS.assessment,
  fieldnote: COLORS.fieldnote,
};

const TYPE_LABEL: Record<ScheduleType, string> = {
  counseling: "상담",
  assessment: "검사",
  fieldnote: "필드노트",
};

/** 현재 월 기준으로 흩어진 데모 일정 생성 (dot 시각화용) */
function buildMonthMock(refDate: Date): MockSchedule[] {
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, "0");
  const d = (day: number) =>
    `${y}-${m}-${String(day).padStart(2, "0")}`;
  const today = refDate.getDate();

  return [
    // 오늘 (3건) — 디테일 영역에서 풍부하게 보이도록
    { id: "today-1", date: d(today), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "김은서", clientAge: 7, clientGender: "female", program: "놀이치료", room: "1번 상담실" },
    { id: "today-2", date: d(today), startHHmm: "11:00", endHHmm: "12:00", type: "assessment", clientName: "이도윤", clientAge: 9, clientGender: "male", program: "K-WISC-V", room: "검사실 A" },
    { id: "today-3", date: d(today), startHHmm: "15:00", endHHmm: "15:50", type: "counseling", clientName: "최서연", clientAge: 14, clientGender: "female", program: "인지행동치료", room: "2번 상담실" },
    // 흩어진 일정 — dot 패턴 다양하게
    { id: "4", date: d(Math.max(1, today - 5)), startHHmm: "14:00", endHHmm: "14:50", type: "counseling", clientName: "박지민", clientAge: 8, clientGender: "male", program: "놀이치료", room: "1번 상담실" },
    { id: "5", date: d(Math.max(1, today - 3)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "정하늘", clientAge: 6, clientGender: "female" },
    { id: "6", date: d(Math.max(1, today - 3)), startHHmm: "11:00", endHHmm: "11:50", type: "assessment", clientName: "윤서아", clientAge: 10, clientGender: "female" },
    { id: "7", date: d(Math.max(1, today - 1)), startHHmm: "16:00", endHHmm: "16:50", type: "assessment", clientName: "강민호", clientAge: 11, clientGender: "male", program: "BGT" },
    { id: "8", date: d(Math.max(1, today - 1)), startHHmm: "17:30", endHHmm: "18:30", type: "fieldnote", clientName: "윤서아", clientAge: 10, clientGender: "female" },
    { id: "9", date: d(Math.min(28, today + 2)), startHHmm: "13:00", endHHmm: "13:50", type: "counseling", clientName: "김은서", clientAge: 7, clientGender: "female", program: "놀이치료" },
    { id: "10", date: d(Math.min(28, today + 2)), startHHmm: "14:00", endHHmm: "14:50", type: "counseling", clientName: "정하늘", clientAge: 6, clientGender: "female" },
    { id: "11", date: d(Math.min(28, today + 4)), startHHmm: "11:00", endHHmm: "11:50", type: "assessment", clientName: "이도윤", clientAge: 9, clientGender: "male", program: "K-WISC-V" },
    { id: "12", date: d(Math.min(28, today + 6)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "최서연", clientAge: 14, clientGender: "female" },
    { id: "13", date: d(Math.min(28, today + 6)), startHHmm: "17:00", endHHmm: "18:00", type: "fieldnote", clientName: "박지민", clientAge: 8, clientGender: "male" },
    { id: "14", date: d(Math.min(28, today + 9)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "김은서", clientAge: 7, clientGender: "female" },
    { id: "15", date: d(Math.min(28, today + 9)), startHHmm: "11:00", endHHmm: "11:50", type: "assessment", clientName: "강민호", clientAge: 11, clientGender: "male" },
    { id: "16", date: d(Math.min(28, today + 9)), startHHmm: "17:00", endHHmm: "18:00", type: "fieldnote", clientName: "윤서아", clientAge: 10, clientGender: "female" },
    { id: "17", date: d(Math.min(28, today + 12)), startHHmm: "15:00", endHHmm: "15:50", type: "counseling", clientName: "정하늘", clientAge: 6, clientGender: "female" },
    { id: "18", date: d(Math.min(28, today + 14)), startHHmm: "10:00", endHHmm: "10:50", type: "counseling", clientName: "최서연", clientAge: 14, clientGender: "female" },
    { id: "19", date: d(Math.min(28, today + 14)), startHHmm: "11:00", endHHmm: "11:50", type: "assessment", clientName: "이도윤", clientAge: 9, clientGender: "male" },
  ];
}

export default function ScheduleMonthlyLab() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  // display-only state for lab preview
  const [viewMonth, setViewMonth] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const allSchedules = useMemo(() => buildMonthMock(today), [today]);

  // 날짜별 type 인덱스 (dot 표시용)
  const dotsByDate = useMemo(() => {
    const map = new Map<string, ScheduleType[]>();
    for (const sc of allSchedules) {
      const cur = map.get(sc.date) ?? [];
      cur.push(sc.type);
      map.set(sc.date, cur);
    }
    return map;
  }, [allSchedules]);

  const selectedSchedules = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return allSchedules
      .filter((sc) => sc.date === key)
      .sort((a, b) => a.startHHmm.localeCompare(b.startHHmm));
  }, [allSchedules, selectedDate]);

  // 6주 (42칸) 캘린더 데이터
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const handlePrev = () => {
    const newMonth = subMonths(viewMonth, 1);
    setViewMonth(newMonth);
    setSelectedDate(
      isSameMonth(newMonth, today) ? today : startOfMonth(newMonth),
    );
  };
  const handleNext = () => {
    const newMonth = addMonths(viewMonth, 1);
    setViewMonth(newMonth);
    setSelectedDate(
      isSameMonth(newMonth, today) ? today : startOfMonth(newMonth),
    );
  };
  const handleResetToToday = () => {
    setViewMonth(today);
    setSelectedDate(today);
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: s(120) }}
        >
          {/* ─── 월 캘린더 ─── */}
          <View
            style={{
              backgroundColor: COLORS.bg.surface,
              marginHorizontal: s(16),
              marginTop: s(8),
              borderRadius: s(20),
              paddingHorizontal: s(12),
              paddingTop: s(8),
              paddingBottom: s(16),
              ...SHADOWS.card,
            }}
          >
            <MonthHeader
              viewMonth={viewMonth}
              onPrev={handlePrev}
              onNext={handleNext}
              onPressMonth={handleResetToToday}
            />
            <DowRow />
            <CalendarGrid
              days={calendarDays}
              viewMonth={viewMonth}
              today={today}
              selectedDate={selectedDate}
              dotsByDate={dotsByDate}
              onSelect={setSelectedDate}
            />
            <Legend />
          </View>

          {/* ─── 선택한 날짜 상세 ─── */}
          <View
            style={{
              marginTop: s(24),
              paddingHorizontal: s(16),
            }}
          >
            <View
              className="flex-row items-end justify-between"
              style={{ paddingBottom: s(16) }}
            >
              <View
                className="flex-row items-end"
                style={{ gap: s(8) }}
              >
                <Typography
                  variant="title-01"
                  weight="semibold"
                  className="text-title-default"
                >
                  {format(selectedDate, "M월 d일", { locale: ko })}
                  <Typography
                    variant="body-02"
                    weight="regular"
                    className="text-body-subtle"
                  >
                    {" "}
                    ({format(selectedDate, "EEE", { locale: ko })})
                  </Typography>
                </Typography>
                {isSameDay(selectedDate, today) && (
                  <View
                    style={{
                      paddingHorizontal: s(8),
                      paddingVertical: s(2),
                      borderRadius: s(6),
                      backgroundColor: COLORS.bg.selected,
                      marginBottom: s(2),
                    }}
                  >
                    <Typography
                      variant="label-02"
                      weight="semibold"
                      style={{ color: COLORS.primary700 }}
                    >
                      오늘
                    </Typography>
                  </View>
                )}
              </View>
              <Typography
                variant="body-03"
                weight="regular"
                className="text-body-subtle"
              >
                총 {selectedSchedules.length}건
              </Typography>
            </View>

            {selectedSchedules.length === 0 ? (
              <EmptyDay />
            ) : (
              <View style={{ gap: s(12) }}>
                {selectedSchedules.map((sch) => (
                  <ScheduleRow key={sch.id} schedule={sch} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

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

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{ height: s(52), paddingHorizontal: s(16) }}
      className="flex-row items-center"
    >
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </TouchableOpacity>
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-title-default"
        style={{ marginLeft: s(8) }}
      >
        일정
      </Typography>
    </View>
  );
}

function MonthHeader({
  viewMonth,
  onPrev,
  onNext,
  onPressMonth,
}: {
  viewMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onPressMonth: () => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingVertical: s(12), paddingHorizontal: s(4) }}
    >
      <TouchableOpacity
        onPress={onPressMonth}
        hitSlop={8}
        activeOpacity={0.7}
        className="flex-row items-center"
        style={{ gap: s(6) }}
      >
        <Typography
          variant="headline-02"
          weight="bold"
          className="text-title-default"
        >
          {format(viewMonth, "yyyy년 M월")}
        </Typography>
        <Icon name="arrow-down" size={20} color={COLORS.gray[500]} />
      </TouchableOpacity>
      <View className="flex-row" style={{ gap: s(16) }}>
        <TouchableOpacity onPress={onPrev} hitSlop={8} activeOpacity={0.7}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={COLORS.gray[600]}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} hitSlop={8} activeOpacity={0.7}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={COLORS.gray[600]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
function DowRow() {
  return (
    <View className="flex-row">
      {DOW_LABELS.map((d, i) => (
        <View
          key={d}
          style={{ height: s(36) }}
          className="flex-1 items-center justify-center"
        >
          <Typography
            variant="body-02"
            weight="medium"
            style={{
              color: i === 0 ? COLORS.negative : COLORS.gray[500],
            }}
          >
            {d}
          </Typography>
        </View>
      ))}
    </View>
  );
}

function CalendarGrid({
  days,
  viewMonth,
  today,
  selectedDate,
  dotsByDate,
  onSelect,
}: {
  days: Date[];
  viewMonth: Date;
  today: Date;
  selectedDate: Date;
  dotsByDate: Map<string, ScheduleType[]>;
  onSelect: (d: Date) => void;
}) {
  const rows = Math.ceil(days.length / 7);
  return (
    <View>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <View key={rowIdx} className="flex-row">
          {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <CalendarCell
                key={key}
                day={d}
                isCurrentMonth={isSameMonth(d, viewMonth)}
                isToday={isSameDay(d, today)}
                isSelected={isSameDay(d, selectedDate)}
                types={dotsByDate.get(key) ?? []}
                onPress={() => onSelect(d)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function CalendarCell({
  day,
  isCurrentMonth,
  isToday,
  isSelected,
  types,
  onPress,
}: {
  day: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  types: ScheduleType[];
  onPress: () => void;
}) {
  const isSunday = day.getDay() === 0;

  const textColor = isSelected
    ? COLORS.white
    : !isCurrentMonth
      ? COLORS.gray[300]
      : isSunday
        ? COLORS.negative
        : COLORS.gray[900];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: s(4),
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: isSelected ? COLORS.primary500 : "transparent",
          borderWidth: isToday && !isSelected ? 1.5 : 0,
          borderColor: COLORS.primary500,
        }}
        className="items-center justify-center"
      >
        <Typography
          variant="body-02"
          weight={isToday || isSelected ? "semibold" : "medium"}
          style={{ color: textColor }}
        >
          {day.getDate()}
        </Typography>
      </View>
      {/* dots */}
      <View
        className="flex-row items-center"
        style={{ height: s(8), gap: s(3), marginTop: s(4) }}
      >
        {types.slice(0, 3).map((t, i) => (
          <View
            key={`${t}-${i}`}
            style={{
              width: s(4),
              height: s(4),
              borderRadius: s(2),
              backgroundColor: isSelected
                ? "rgba(255,255,255,0.85)"
                : TYPE_COLOR[t],
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}

function Legend() {
  return (
    <View
      className="flex-row justify-center"
      style={{ gap: s(16), marginTop: s(8) }}
    >
      <LegendItem color={COLORS.counseling} label="상담" />
      <LegendItem color={COLORS.assessment} label="검사" />
      <LegendItem color={COLORS.fieldnote} label="필드노트" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View
      className="flex-row items-center"
      style={{ gap: s(4) }}
    >
      <View
        style={{
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: color,
        }}
      />
      <Typography
        variant="label-02"
        weight="regular"
        className="text-body-subtle"
      >
        {label}
      </Typography>
    </View>
  );
}

function ScheduleRow({ schedule }: { schedule: MockSchedule }) {
  const accent = TYPE_COLOR[schedule.type];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.bg.surface,
        borderRadius: s(16),
        padding: s(16),
        gap: s(12),
        ...SHADOWS.card,
      }}
    >
      <View style={{ width: s(56) }}>
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-title-default"
        >
          {schedule.startHHmm}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          className="text-body-subtle"
          style={{ marginTop: s(2) }}
        >
          ~ {schedule.endHHmm}
        </Typography>
      </View>

      <View className="flex-1">
        <View className="flex-row items-baseline" style={{ gap: s(6) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
            numberOfLines={1}
          >
            {schedule.clientName}
          </Typography>
          <Typography
            variant="label-01"
            weight="regular"
            className="text-body-subtle"
          >
            {schedule.clientGender === "female" ? "여" : "남"} · 만{" "}
            {schedule.clientAge}세
          </Typography>
        </View>
        <View
          className="flex-row items-center"
          style={{ marginTop: s(4), gap: s(6) }}
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
            {TYPE_LABEL[schedule.type]}
            {schedule.program ? ` · ${schedule.program}` : ""}
            {schedule.room ? ` · ${schedule.room}` : ""}
          </Typography>
        </View>
      </View>
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
