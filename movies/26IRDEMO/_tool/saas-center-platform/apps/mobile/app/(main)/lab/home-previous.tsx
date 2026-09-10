import { useMemo, useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCenterStore } from "@/features/center";
import { useAuthStore } from "@/features/auth";
import {
  useScheduleList,
  useScheduleRange,
  type ScheduleListItem,
} from "@/features/schedule";
import { useUnreadCount } from "@/features/notification";
import { useUnlinkedFieldNotes } from "@/features/field-note";
import { parseDate } from "@/shared/utils/date";
import { isBefore, format, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { deriveStatus } from "../(tabs)/_components/utils";
import { AiryStart } from "../(tabs)/_components/home-variants/AiryStart";
import { BrandHome } from "../(tabs)/_components/home-variants/BrandHome";
import { ClipboardGreeting } from "../(tabs)/_components/home-variants/ClipboardGreeting";
import { DarkClipboardGreeting } from "../(tabs)/_components/home-variants/DarkClipboardGreeting";
import type { HomeVariantProps } from "../(tabs)/_components/home-variants/types";

/**
 * 이전 홈 시안 — 4변종 비교 (디자인 아카이브).
 *
 * 메인 홈이 `SoftTasksHome` 캐러셀 시안으로 전환되면서 이전 4변종 비교 화면을
 * 디자인 검토용으로 lab 에 보존. 동작·실데이터 흐름은 production 메인 홈과 동일.
 *
 *  A · new    : 클립보드 인사 (라이트)
 *  B · dark   : 다크 톤 (bankcow reference)
 *  C · airy   : 여백 시작 (primary 풀톤, lab home-airy-start C)
 *  D · legacy : 기존 BrandHome
 */
type HomeCompareKey = "new" | "dark" | "airy" | "legacy";

export default function HomePreviousLab() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const centerName = useCenterStore((s) => s.centerName);
  const person = useAuthStore((s) => s.person);
  const today = useMemo(() => new Date(), []);

  const {
    data: schedules,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useScheduleList(centerId, today);
  const { data: unreadData } = useUnreadCount(centerId);
  const unreadCount = unreadData?.count ?? 0;

  const { data: unlinkedFieldNotes, refetch: refetchUnlinked } =
    useUnlinkedFieldNotes(centerId);
  const unlinkedCount = unlinkedFieldNotes?.length ?? 0;

  const weekRange = useMemo(
    () => ({
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    }),
    [today],
  );
  const { data: weekScheduleData, refetch: refetchWeek } = useScheduleRange(
    centerId,
    weekRange.start,
    weekRange.end,
  );

  const nextSession = useMemo<ScheduleListItem | null>(() => {
    if (!schedules) return null;
    const now = new Date();
    let best: ScheduleListItem | null = null;
    for (const s of schedules) {
      if (s.schedule_type === "block") continue;
      const status = deriveStatus(s);
      if (
        status === "completed" ||
        status === "no_show" ||
        status === "cancelled"
      )
        continue;
      if (status === "in_progress") return s;
      if (!best || isBefore(parseDate(s.start), parseDate(best.start))) {
        const hasStarted = isBefore(parseDate(s.start), now);
        if (!hasStarted) best = s;
      }
    }
    return best;
  }, [schedules]);

  const todaySchedules = useMemo(() => {
    if (!schedules) return [];
    const live: ScheduleListItem[] = [];
    const inactive: ScheduleListItem[] = [];
    for (const sch of schedules) {
      if (sch.schedule_type === "block") continue;
      const st = deriveStatus(sch);
      if (st === "cancelled") inactive.push(sch);
      else live.push(sch);
    }
    const byStart = (a: ScheduleListItem, b: ScheduleListItem) =>
      parseDate(a.start).getTime() - parseDate(b.start).getTime();
    live.sort(byStart);
    inactive.sort(byStart);
    return [...live, ...inactive];
  }, [schedules]);

  const weekStats = useMemo(() => {
    const items = weekScheduleData ?? [];
    let counseling = 0;
    let assessment = 0;
    for (const it of items) {
      if (it.schedule_type === "counseling") counseling += 1;
      else if (it.schedule_type === "assessment") assessment += 1;
    }
    return {
      range: `${format(weekRange.start, "M/d")} - ${format(weekRange.end, "M/d")}`,
      counseling,
      assessment,
      unlinked: unlinkedCount,
    };
  }, [weekScheduleData, weekRange, unlinkedCount]);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchUnlinked();
    refetchWeek();
  }, [refetch, refetchUnlinked, refetchWeek]);

  const dateStr = format(today, "yyyy년 M월 d일 EEEE", { locale: ko });

  const variantProps: HomeVariantProps = {
    centerName,
    hasMultipleCenters: false,
    personName: person?.name ?? null,
    dateStr,
    today,
    nextSession,
    upcomingSession: null,
    todaySchedules,
    weekSchedules: weekScheduleData ?? [],
    weekStats,
    unreadCount,
    unlinkedCount,
    isLoading,
    isError,
    isRefetching,
    onRefresh: handleRefresh,
    onPressMyCenters: () => router.push("/(main)/my-centers"),
    onPressNotifications: () => router.push("/(main)/notifications"),
    onPressNextSession: () =>
      nextSession && router.push(`/(main)/schedule/${nextSession.id}`),
    onPressNextSessionRecord: () =>
      nextSession && router.push(`/(main)/field-note/${nextSession.id}`),
    onPressSchedule: (id) => router.push(`/(main)/schedule/${id}`),
    onPressSchedulesAll: () =>
      router.push({
        pathname: "/(main)/(tabs)/schedule",
        params: { focusToday: Date.now().toString() },
      }),
    onPressFieldNoteList: () => router.push("/(main)/field-note/list"),
    onRetry: () => refetch(),
  };

  const [variant, setVariant] = useState<HomeCompareKey>("new");
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      {variant === "new" ? (
        <ClipboardGreeting {...variantProps} />
      ) : variant === "dark" ? (
        <DarkClipboardGreeting {...variantProps} />
      ) : variant === "airy" ? (
        <AiryStart {...variantProps} />
      ) : (
        <BrandHome {...variantProps} />
      )}

      {/* lab 뒤로가기 — 좌상단 floating 아이콘 (변종 헤더와 충돌 없게 absolute) */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + s(8),
          left: s(12),
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: s(36),
            height: s(36),
            borderRadius: s(999),
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <Icon name="arrow-left" size={20} color={COLORS.white} />
        </Pressable>
      </View>

      {/* A/B/C/D 비교 pill — 화면 최상단 가운데 floating */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: insets.top + s(8),
          alignItems: "center",
        }}
      >
        <CompareTabs value={variant} onChange={setVariant} />
      </View>
    </View>
  );
}

function CompareTabs({
  value,
  onChange,
}: {
  value: HomeCompareKey;
  onChange: (v: HomeCompareKey) => void;
}) {
  const tabs: { key: HomeCompareKey; label: string }[] = [
    { key: "new", label: "A" },
    { key: "dark", label: "B" },
    { key: "airy", label: "C" },
    { key: "legacy", label: "D" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.gray[900],
        borderRadius: s(999),
        padding: s(4),
        gap: s(2),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 8,
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            hitSlop={4}
            style={({ pressed }) => ({
              minWidth: s(36),
              paddingVertical: s(6),
              paddingHorizontal: s(12),
              borderRadius: s(999),
              backgroundColor: isActive ? COLORS.white : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${t.label} 홈 시안`}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{
                color: isActive ? COLORS.text.title.default : "rgba(255,255,255,0.7)",
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
