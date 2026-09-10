import { useMemo, useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useCenterStore } from "@/features/center";
import { useAuthStore } from "@/features/auth";
import {
  useScheduleList,
  useScheduleRange,
  useScheduleDetail,
  openScheduleDetail,
  type ScheduleListItem,
} from "@/features/schedule";
import { useQueryClient } from "@tanstack/react-query";
import { useUnreadCount } from "@/features/notification";
import { useUnlinkedFieldNotes } from "@/features/field-note";
import { useHomeSignals, usePrepSignals, type PrepSignalItem } from "@/features/home";
import { parseDate } from "@/shared/utils/date";
import { useDoubleBackExit } from "@/shared/hooks/useDoubleBackExit";
import { isBefore, format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { deriveStatus } from "./_components/utils";
import { withTabTransition } from "./_components/TabTransition";
import { BriefStackHome } from "./_components/home-variants/BriefStackHome";
import type { HomeVariantProps } from "./_components/home-variants/types";

/**
 * 홈 — 음성 우선 (Voice-First Agent, Dark) 시안 적용.
 *
 * 기획 변경 — 각 메뉴의 첫 페이지가 도메인 메인이 되므로, 홈은
 * 음성으로 진입하는 에이전트 메인 화면 역할만 한다.
 *
 * 이전 메인(SoftTasksHome) 은 `app/(main)/lab/home-soft-tasks.tsx` 에,
 * 그 이전 4변종 비교 홈은 `app/(main)/lab/home-previous.tsx` 에 보존되어 있다.
 *
 * 데이터 hook(스케줄·통계·일지 시트)들은 아직 그대로 유지 — 추후 음성 명령
 * 라우팅 구현 시 일부 재사용 가능. 정리는 별도 작업.
 */
export default withTabTransition(HomeScreen);

function HomeScreen() {
  // 홈은 백 누르면 앱이 종료되는 지점 — "한 번 더 누르면 종료" 가드(안드로이드).
  // 다른 탭은 backBehavior=firstRoute 로 먼저 홈으로 돌아오므로, 홈에만 걸면 충분.
  useDoubleBackExit();
  const router = useRouter();
  const queryClient = useQueryClient();
  const centerId = useCenterStore((s) => s.centerId);
  const centerName = useCenterStore((s) => s.centerName);
  const person = useAuthStore((s) => s.person);
  const centers = useAuthStore((s) => s.centers);
  const hasMultipleCenters = (centers?.length ?? 0) > 1;
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

  // 다음 일정 카드 탭 → /(main)/schedule/[id] 는 상세를 fetch 후 회기·케이스 상세로 replace 하는
  // 리다이렉트 라우트다. 콜드 캐시(첫 진입)면 그 화면이 스피너로 한 박자 떴다 넘어가 '페이지가
  // 두 번 넘어가는' 것처럼 느껴진다. 같은 쿼리를 미리 데워 두면 탭 시 즉시 replace 돼 한 번에 넘어간다.
  useScheduleDetail(centerId, nextSession?.id ?? null);

  // 다가오는 일정(오늘 이후 미래) — 오늘 일정이 없을 때 "다음 일정" 카드 + 빈 상태 분기에 사용.
  const upcomingRange = useMemo(
    () => ({ start: addDays(today, 1), end: addDays(today, 60) }),
    [today],
  );
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    refetch: refetchUpcoming,
  } = useScheduleRange(centerId, upcomingRange.start, upcomingRange.end);
  const upcomingSession = useMemo<ScheduleListItem | null>(() => {
    const items = upcomingData ?? [];
    let best: ScheduleListItem | null = null;
    for (const s of items) {
      if (s.schedule_type === "block") continue;
      const status = deriveStatus(s);
      if (status === "cancelled") continue;
      if (!best || isBefore(parseDate(s.start), parseDate(best.start))) best = s;
    }
    return best;
  }, [upcomingData]);

  // 오늘 일정이 없을 때 노출되는 '다음 일정'(upcomingSession) 카드도 탭 시 바로 넘어가도록
  // 일정 상세를 미리 데운다. (nextSession 만 데우면 upcomingSession 은 콜드 → 2단 점프)
  useScheduleDetail(centerId, upcomingSession?.id ?? null);

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
    refetchUpcoming();
  }, [refetch, refetchUnlinked, refetchWeek, refetchUpcoming]);

  const dateStr = format(today, "yyyy년 M월 d일 EEEE", { locale: ko });

  const { data: prepSignalsData } = usePrepSignals(centerId, nextSession?.id ?? null);
  // 횡단 신호(§4) — 일지 미작성·연장 결정·결과 미공유·미수금. 다음 일정 prep-signals와 병합해 표시
  const { data: homeSignalsData } = useHomeSignals(centerId);
  const mergedSignals = useMemo(() => {
    const merged = [
      ...(homeSignalsData?.signals ?? []),
      ...(prepSignalsData?.signals ?? []),
    ];
    return merged.length > 0
      ? merged.sort((a, b) => a.priority - b.priority)
      : null;
  }, [homeSignalsData, prepSignalsData]);

  /* ─── 홈 직접 오픈 일지 시트 (페이지 이동 없이 카드 → 시트로 확장) ───
   * 카드 탭 시점에 scheduleId를 set → useScheduleDetail이 enabled되어 fetch 시작.
   * detail의 sessions[0]에서 session_id를, nextSession.clients[0]에서 client 정보를
   * 조합해 시트 props로 넘긴다. 상담 일정이고 데이터가 모두 준비된 경우에만 visible. */
  const [noteSheetScheduleId, setNoteSheetScheduleId] = useState<string | null>(
    null,
  );
  const { data: noteSheetSchedule } = useScheduleDetail(
    centerId,
    noteSheetScheduleId,
  );
  const noteSheet = useMemo(() => {
    if (!noteSheetScheduleId) return null;
    const sourceSession =
      noteSheetScheduleId === nextSession?.id ? nextSession : null;
    const firstClient = sourceSession?.clients?.[0] ?? null;
    const sessionInfo = noteSheetSchedule?.sessions?.[0] ?? null;
    const sessionId = sessionInfo?.session_id ?? null;
    const isCounseling =
      (noteSheetSchedule?.schedule_type ?? sourceSession?.schedule_type) ===
      "counseling";
    // 페치 중에도 카드의 expand 모션과 끊김 없이 보이도록 partial 상태도 허용.
    // 데이터 준비 전엔 시트가 loading 모드로 떠 있도록 sessionId가 없으면 visible=false.
    return {
      visible: !!isCounseling && !!sessionId,
      sessionId,
      clientId: firstClient?.id ?? null,
      clientName: firstClient?.name ?? null,
      sessionStart: noteSheetSchedule?.start ?? sourceSession?.start ?? null,
    };
  }, [noteSheetScheduleId, noteSheetSchedule, nextSession]);

  const handlePressSignal = useCallback(
    (signal: PrepSignalItem) => {
      const meta = signal.metadata ?? {};
      switch (signal.signal_type) {
        case "unwritten_journals":
          // 미작성 일지는 N건(여러 회기·내담자)일 수 있어 단일 시트가 아닌
          // 상담일지 리스트의 '미작성' 탭으로 이동해 모아 처리한다 (§3-5-1).
          router.push({
            pathname: "/(main)/counseling/notes",
            params: { status: "missing" },
          });
          break;
        case "unreviewed_assessment": {
          const caseId = (meta.case_ids as string[])?.[0];
          if (caseId) router.push(`/(main)/assessment/${caseId}`);
          break;
        }
        case "previous_note_summary": {
          if (nextSession) setNoteSheetScheduleId(nextSession.id);
          break;
        }
        case "attendance_warning": {
          const clientId = (meta.client_ids as string[])?.[0];
          if (clientId) router.push(`/(main)/clients/${clientId}`);
          break;
        }
        case "field_note_summary": {
          const scheduleId = meta.schedule_id as string;
          if (scheduleId) router.push(`/(main)/field-note/${scheduleId}`);
          break;
        }
        case "extension_needed":
          // 연장 결정은 케이스 단위 판단 — 상담 현황 리스트에서 대상 케이스(연장필요 라벨) 확인
          router.push("/(main)/counseling");
          break;
        case "unpaid_billing":
          router.push("/(main)/billing");
          break;
        case "retest":
        case "first_meeting":
        case "group_member_change":
          if (nextSession)
            openScheduleDetail(router, queryClient, centerId, nextSession.id, {
              listItem: nextSession,
            });
          break;
      }
    },
    [nextSession, router, queryClient, centerId],
  );

  // 본문(오늘 일정 카드 영역)의 로딩 — 오늘 목록 로딩 중이거나, 오늘 일정이 없어
  // '다음 일정/빈 상태'를 가르려면 다가오는 일정(upcoming)까지 도착해야 한다.
  // 이게 끝나기 전에는 빈 상태(커피 일러스트)를 먼저 깜빡이지 않고 스켈레톤을 보여준다.
  const bodyLoading = isLoading || (!nextSession && upcomingLoading);

  const variantProps: HomeVariantProps = {
    centerName,
    hasMultipleCenters,
    personName: person?.name ?? null,
    dateStr,
    today,
    nextSession,
    upcomingSession,
    todaySchedules,
    weekSchedules: weekScheduleData ?? [],
    weekStats,
    unreadCount,
    unlinkedCount,
    isLoading: bodyLoading,
    isError,
    isRefetching,
    onRefresh: handleRefresh,
    onPressMyCenters: () => router.push("/(main)/my-centers"),
    onPressNotifications: () => router.push("/(main)/notifications"),
    onPressNextSession: () =>
      nextSession &&
      openScheduleDetail(router, queryClient, centerId, nextSession.id, {
        listItem: nextSession,
      }),
    onPressNextSessionNote: () => {
      // 페이지 이동 없이 홈 위에서 직접 일지 시트 오픈.
      // detail은 useScheduleDetail(아래 noteSheetScheduleId 기반)로 lazy fetch.
      if (!nextSession) return;
      setNoteSheetScheduleId(nextSession.id);
    },
    onCloseNoteSheet: () => setNoteSheetScheduleId(null),
    noteSheet,
    onPressNextSessionRecord: () =>
      nextSession && router.push(`/(main)/field-note/${nextSession.id}`),
    onPressSchedule: (id) =>
      openScheduleDetail(router, queryClient, centerId, id, {
        listItem:
          (upcomingSession?.id === id ? upcomingSession : undefined) ??
          todaySchedules.find((s) => s.id === id) ??
          (weekScheduleData ?? []).find((s) => s.id === id),
      }),
    onPressSchedulesAll: () =>
      router.push({
        pathname: "/(main)/(tabs)/schedule",
        params: { focusToday: Date.now().toString() },
      }),
    onPressFieldNoteList: () => router.push("/(main)/field-note/list"),
    onRetry: () => refetch(),
    prepSignals: mergedSignals,
    onPressSignal: handlePressSignal,
  };

  return (
    <View className="flex-1">
      <BriefStackHome {...variantProps} />
    </View>
  );
}
