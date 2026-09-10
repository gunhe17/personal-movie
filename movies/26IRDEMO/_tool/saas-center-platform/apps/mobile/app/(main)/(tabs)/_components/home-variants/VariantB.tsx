import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, differenceInMinutes, getDay } from "date-fns";
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from "@/features/schedule";
import { parseDate, formatTimeRange } from "@/shared/utils/date";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { deriveStatus, getAge } from "../utils";
import type { HomeVariantProps } from "./types";

/**
 * 시안 B(파일) → 탭 'C' 재미 (Vibrant) 톤
 *
 * 디자인 톤 & 매너(§0):
 * - 시각 리듬·데이터 풍부·컬러 액센트
 * - KPI 4분할로 정보 밀도 높이되 정돈된 그리드 유지
 * - 카테고리 컬러(상담 그린, 검사 블루, 필드노트 퍼플) 적극 활용
 * - 차트·타임라인·막대 그래프 등 비텍스트 요소 다수
 * - 작은 dot·라인 액센트로 단조로움 방지
 *
 * 구성:
 * - 컴팩트 인사
 * - KPI 4분할 (예약/진행중/완료/미작성)
 * - 다음 상담 미디엄 카드
 * - 오늘 타임라인 (09–19시 가로 progress + 마커 + 현재 시각 핀)
 * - 이번주 요일별 막대 차트
 */
export function VariantB(props: HomeVariantProps) {
  const {
    centerName,
    personName,
    dateStr,
    today,
    nextSession,
    todaySchedules,
    weekSchedules,
    weekStats,
    unreadCount,
    unlinkedCount,
    isLoading,
    isError,
    isRefetching,
    onRefresh,
    onPressMyCenters,
    onPressNotifications,
    onPressNextSession,
    onPressSchedule,
    onPressSchedulesAll,
    onPressFieldNoteList,
    onRetry,
  } = props;

  // KPI 계산 (표시용)
  const kpis = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    for (const sch of todaySchedules) {
      const st = deriveStatus(sch);
      if (st === "in_progress") inProgress += 1;
      else if (st === "completed") completed += 1;
    }
    return {
      reserved: todaySchedules.length,
      inProgress,
      completed,
      unlinked: unlinkedCount,
    };
  }, [todaySchedules, unlinkedCount]);

  // 요일별 막대 데이터 (월–일)
  const weekBars = useMemo(() => {
    const days = ["월", "화", "수", "목", "금", "토", "일"];
    const counts = days.map(() => ({ counseling: 0, assessment: 0 }));
    for (const sch of weekSchedules) {
      const d = getDay(parseDate(sch.start)); // 0=일, 1=월...
      const idx = d === 0 ? 6 : d - 1;
      if (sch.schedule_type === "counseling") counts[idx].counseling += 1;
      else if (sch.schedule_type === "assessment") counts[idx].assessment += 1;
    }
    const max = Math.max(
      1,
      ...counts.map((c) => c.counseling + c.assessment),
    );
    const todayIdx = (() => {
      const d = getDay(today);
      return d === 0 ? 6 : d - 1;
    })();
    return { days, counts, max, todayIdx };
  }, [weekSchedules, today]);

  return (
    <View className="flex-1 bg-background">
      <TopBar
        centerName={centerName}
        unreadCount={unreadCount}
        onPressMyCenters={onPressMyCenters}
        onPressNotifications={onPressNotifications}
      />

      <ScrollView
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 컴팩트 인사 */}
        <View className="px-4 pt-2 pb-3">
          <View className="flex-row items-baseline gap-2">
            <Typography variant="title-01" weight="semibold" className="text-title-default">
              {personName ?? "선생"}
            </Typography>
            <Typography variant="body-02" className="text-body-subtle">
              상담사
            </Typography>
          </View>
          <Typography variant="label-01" className="mt-0.5 text-body-subtle">
            {dateStr}
          </Typography>
        </View>

        {/* KPI 4분할 (gap/card = 12px) */}
        <View style={{ gap: s(12) }} className="flex-row px-4">
          <KpiCard
            value={kpis.reserved}
            label="오늘 예약"
            unit="건"
            accent={COLORS.counseling}
          />
          <KpiCard
            value={kpis.inProgress}
            label="진행중"
            unit="건"
            accent={COLORS.notice}
            pulse={kpis.inProgress > 0}
          />
          <KpiCard
            value={kpis.completed}
            label="완료"
            unit="건"
            accent={COLORS.success}
          />
          <KpiCard
            value={kpis.unlinked}
            label="미작성"
            unit="건"
            accent={COLORS.error}
            onPress={
              kpis.unlinked > 0 ? onPressFieldNoteList : undefined
            }
          />
        </View>

        {/* 다음 상담 (중간 카드) */}
        <View className="mt-6 px-4">
          <SectionHeader title="다음 상담" hint="가장 가까운 일정" />
          {nextSession ? (
            <NextSessionMedium
              session={nextSession}
              now={today}
              onPress={onPressNextSession}
            />
          ) : (
            <EmptyBox text="예정된 상담이 없어요" />
          )}
        </View>

        {/* 오늘 타임라인 */}
        <View className="mt-6 px-4">
          <SectionHeader
            title="오늘 타임라인"
            hint={`${kpis.completed}/${kpis.reserved} 완료`}
            actionText="전체보기"
            onAction={onPressSchedulesAll}
          />
          <TimelineCard
            schedules={todaySchedules}
            now={today}
            isLoading={isLoading}
            isError={isError}
            onRetry={onRetry}
            onPressItem={onPressSchedule}
          />
        </View>

        {/* 이번주 막대 차트 */}
        <View className="mt-6 px-4">
          <SectionHeader
            title="이번주 분포"
            hint={weekStats.range}
          />
          <WeeklyBarsCard data={weekBars} stats={weekStats} />
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- Sub Components ---------------- */

function TopBar({
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
      style={{ height: s(48) }}
      className="flex-row items-center justify-between px-4 py-2.5"
    >
      <TouchableOpacity
        onPress={onPressMyCenters}
        activeOpacity={0.7}
        className="flex-row items-center gap-2"
        accessibilityRole="button"
      >
        <View className="h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Ionicons name="business" size={14} color={COLORS.white} />
        </View>
        <Typography variant="title-01" weight="semibold" className="text-title-default">
          {centerName ?? "센터 선택"}
        </Typography>
        <Icon name="arrow-down" size={20} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressNotifications}
        activeOpacity={0.7}
        className="h-10 w-10 items-center justify-center"
        accessibilityRole="button"
      >
        <Ionicons name="notifications-outline" size={24} color={COLORS.gray[700]} />
        {unreadCount > 0 && (
          <View className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error" />
        )}
      </TouchableOpacity>
    </View>
  );
}

function SectionHeader({
  title,
  hint,
  actionText,
  onAction,
}: {
  title: string;
  hint?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-row items-end justify-between pb-3">
      <View className="flex-row items-baseline gap-2">
        <Typography variant="title-01" weight="semibold" className="text-title-default">
          {title}
        </Typography>
        {hint && (
          <Typography variant="label-01" className="text-body-subtle">
            {hint}
          </Typography>
        )}
      </View>
      {actionText && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <View className="flex-row items-center gap-1">
            <Typography variant="body-03" weight="medium" className="text-state-brand">
              {actionText}
            </Typography>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function KpiCard({
  value,
  label,
  unit,
  accent,
  pulse,
  onPress,
}: {
  value: number;
  label: string;
  unit?: string;
  accent: string;
  pulse?: boolean;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        paddingVertical: s(12),
        paddingHorizontal: s(12),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center gap-1.5">
        <View
          style={{
            width: s(6),
            height: s(6),
            borderRadius: s(3),
            backgroundColor: accent,
          }}
        />
        <Typography variant="label-01" weight="medium" className="text-body-subtle">
          {label}
        </Typography>
        {pulse && (
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: accent,
              marginLeft: s(2),
            }}
          />
        )}
      </View>
      <View style={{ marginTop: s(8) }} className="flex-row items-baseline gap-0.5">
        <Typography variant="headline-01" weight="semibold" style={{ color: accent }}>
          {value}
        </Typography>
        {unit && (
          <Typography variant="label-01" weight="medium" className="text-body-subtle">
            {unit}
          </Typography>
        )}
      </View>
    </Wrapper>
  );
}

function NextSessionMedium({
  session,
  now,
  onPress,
}: {
  session: ScheduleListItem;
  now: Date;
  onPress: () => void;
}) {
  const primary = session.clients?.[0];
  const typeLabel = SCHEDULE_TYPE_LABELS[session.schedule_type] ?? session.schedule_type;
  const start = parseDate(session.start);
  const minutesUntil = differenceInMinutes(start, now);
  const countdown =
    minutesUntil < 0
      ? "진행 중"
      : minutesUntil < 60
        ? `${minutesUntil}분 뒤`
        : `${Math.floor(minutesUntil / 60)}시간 ${minutesUntil % 60}분 뒤`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        borderRadius: s(16),
        padding: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {primary ? (
            <View className="flex-row items-baseline">
              <Typography variant="headline-02" weight="semibold" className="text-title-default">
                {primary.name}
              </Typography>
              {primary.birth_date && (
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ marginLeft: s(6) }}
                  className="text-body-subtle"
                >
                  {primary.gender === "female" ? "여" : "남"} · 만 {getAge(primary.birth_date)}세
                </Typography>
              )}
            </View>
          ) : (
            <Typography variant="headline-02" weight="semibold" className="text-title-default">
              {session.title ?? typeLabel}
            </Typography>
          )}
        </View>
        <View
          style={{
            paddingHorizontal: s(10),
            paddingVertical: s(4),
            borderRadius: s(999),
          }}
          className="bg-primary-50"
        >
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-state-brand"
          >
            {countdown}
          </Typography>
        </View>
      </View>

      <View style={{ marginTop: s(12), gap: s(6) }}>
        <MetaRow
          icon={<Ionicons name="time-outline" size={s(15)} color={COLORS.gray[500]} />}
          text={formatTimeRange(session.start, session.end)}
        />
        {session.room_name && (
          <MetaRow
            icon={<Ionicons name="location-outline" size={s(15)} color={COLORS.gray[500]} />}
            text={session.room_name}
          />
        )}
        <MetaRow
          icon={<Ionicons name="document-text-outline" size={s(15)} color={COLORS.gray[500]} />}
          text={`${typeLabel}${session.program_name ? ` · ${session.program_name}` : ""}`}
        />
      </View>
    </TouchableOpacity>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ gap: s(6) }} className="flex-row items-center">
      {icon}
      <Typography variant="body-03" className="text-label-default">
        {text}
      </Typography>
    </View>
  );
}

function TimelineCard({
  schedules,
  now,
  isLoading,
  isError,
  onRetry,
  onPressItem,
}: {
  schedules: ScheduleListItem[];
  now: Date;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onPressItem: (id: string) => void;
}) {
  const RANGE_START = 9;
  const RANGE_END = 19; // 9시–19시
  const RANGE_MIN = (RANGE_END - RANGE_START) * 60;

  // 일정을 [9, 19) 범위로 클램프하고 위치 계산 (block 제외)
  const items = useMemo(
    () =>
      schedules
        .filter((sch) => sch.schedule_type !== "block")
        .map((sch) => {
          const start = parseDate(sch.start);
          const end = parseDate(sch.end);
          const startMin = start.getHours() * 60 + start.getMinutes();
          const endMin = end.getHours() * 60 + end.getMinutes();
          const rangeMin = RANGE_START * 60;
          const left = Math.max(0, Math.min(100, ((startMin - rangeMin) / RANGE_MIN) * 100));
          const right = Math.max(0, Math.min(100, ((endMin - rangeMin) / RANGE_MIN) * 100));
          return { sch, left, width: Math.max(2.5, right - left) };
        }),
    [schedules],
  );

  const nowPercent = (() => {
    const m = now.getHours() * 60 + now.getMinutes();
    const rangeMin = RANGE_START * 60;
    return Math.max(0, Math.min(100, ((m - rangeMin) / RANGE_MIN) * 100));
  })();
  const isNowInRange = (() => {
    const m = now.getHours() * 60 + now.getMinutes();
    return m >= RANGE_START * 60 && m <= RANGE_END * 60;
  })();

  if (isLoading) {
    return (
      <View
        style={{
          borderRadius: s(16),
          padding: s(20),
          backgroundColor: COLORS.bg.surface,
          borderWidth: 1,
          borderColor: COLORS.border.default,
          ...SHADOWS.card,
        }}
        className="items-center"
      >
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (isError) {
    return (
      <View
        style={{
          borderRadius: s(16),
          padding: s(20),
          gap: s(8),
          backgroundColor: COLORS.bg.surface,
          borderWidth: 1,
          borderColor: COLORS.border.default,
          ...SHADOWS.card,
        }}
        className="items-center"
      >
        <Ionicons name="cloud-offline-outline" size={28} color={COLORS.gray[300]} />
        <Typography variant="body-03" weight="regular" className="text-body-subtle">
          일정을 불러올 수 없어요
        </Typography>
        <TouchableOpacity
          onPress={onRetry}
          style={{
            height: s(36),
            paddingHorizontal: s(16),
            borderRadius: s(12),
            backgroundColor: COLORS.gray[100],
          }}
          className="items-center justify-center"
        >
          <Typography variant="body-03" weight="medium" className="text-body-strong">
            다시 시도
          </Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      {/* 시간 눈금 */}
      <View className="flex-row justify-between">
        {[9, 11, 13, 15, 17, 19].map((h) => (
          <Typography key={h} variant="label-02" className="text-placeholder">
            {h}시
          </Typography>
        ))}
      </View>

      {/* 트랙 */}
      <View style={{ marginTop: s(8), height: s(48) }} className="relative">
        {/* 배경 트랙 */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: s(20),
            height: s(8),
            borderRadius: s(4),
          }}
          className="bg-gray-100"
        />
        {/* 일정 마커 */}
        {items.map(({ sch, left, width }) => {
          const type = sch.schedule_type;
          const bg =
            type === "counseling"
              ? COLORS.counseling
              : type === "assessment"
                ? COLORS.assessment
                : COLORS.gray[500];
          return (
            <TouchableOpacity
              key={sch.id}
              onPress={() => onPressItem(sch.id)}
              activeOpacity={0.7}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${width}%`,
                top: s(20),
                height: s(8),
                borderRadius: s(4),
                backgroundColor: bg,
              }}
            />
          );
        })}
        {/* 현재 시각 핀 (디자인 시스템 fieldnote-purple로 통일) */}
        {isNowInRange && (
          <View
            style={{
              position: "absolute",
              left: `${nowPercent}%`,
              top: s(6),
              alignItems: "center",
              transform: [{ translateX: -s(6) }],
            }}
          >
            <View
              style={{
                paddingHorizontal: s(6),
                paddingVertical: s(2),
                borderRadius: s(8),
                backgroundColor: COLORS.fieldnote,
              }}
            >
              <Typography variant="label-02" weight="semibold" className="text-state-inverse">
                {format(now, "HH:mm")}
              </Typography>
            </View>
            <View
              style={{
                width: s(2),
                height: s(36),
                backgroundColor: COLORS.fieldnote,
                marginTop: -s(2),
              }}
            />
          </View>
        )}
      </View>

      {/* 범례 */}
      <View style={{ marginTop: s(12), gap: s(16) }} className="flex-row">
        <LegendDot color={COLORS.counseling} label="상담" />
        <LegendDot color={COLORS.assessment} label="검사" />
        <LegendDot color={COLORS.gray[500]} label="기타" />
      </View>

      {/* 미니 리스트 (최대 3개) */}
      {items.length > 0 && (
        <View
          style={{ marginTop: s(14), paddingTop: s(12), gap: s(8) }}
          className="border-t border-gray-100"
        >
          {items.slice(0, 3).map(({ sch }) => {
            const primary = sch.clients?.[0];
            const status = deriveStatus(sch);
            return (
              <TouchableOpacity
                key={sch.id}
                onPress={() => onPressItem(sch.id)}
                activeOpacity={0.7}
                className="flex-row items-center"
              >
                <Typography
                  variant="body-03"
                  weight="semibold"
                  style={{ width: s(56) }}
                  className="text-body-strong"
                >
                  {format(parseDate(sch.start), "HH:mm")}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="flex-1 text-body-strong"
                  numberOfLines={1}
                >
                  {primary?.name ??
                    sch.title ??
                    (SCHEDULE_TYPE_LABELS[sch.schedule_type] ?? sch.schedule_type)}
                </Typography>
                <StatusDot status={status} />
              </TouchableOpacity>
            );
          })}
          {items.length === 0 && (
            <Typography variant="body-03" className="text-placeholder">
              오늘은 일정이 없어요
            </Typography>
          )}
        </View>
      )}
      {items.length === 0 && (
        <Typography
          variant="body-03"
          className="mt-3 text-center text-placeholder"
        >
          오늘은 일정이 없어요
        </Typography>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: color,
        }}
      />
      <Typography variant="label-02" className="text-body-subtle">
        {label}
      </Typography>
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed"
      ? COLORS.success
      : status === "in_progress"
        ? COLORS.primary
        : status === "no_show" || status === "cancelled"
          ? COLORS.error
          : COLORS.gray[300];
  return (
    <View
      style={{
        width: s(8),
        height: s(8),
        borderRadius: s(4),
        backgroundColor: color,
        marginLeft: s(8),
      }}
    />
  );
}

function WeeklyBarsCard({
  data,
  stats,
}: {
  data: {
    days: string[];
    counts: { counseling: number; assessment: number }[];
    max: number;
    todayIdx: number;
  };
  stats: HomeVariantProps["weekStats"];
}) {
  const { days, counts, max, todayIdx } = data;
  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      {/* 합계 */}
      <View style={{ gap: s(20) }} className="flex-row items-end">
        <View>
          <Typography variant="label-01" className="text-body-subtle">
            상담
          </Typography>
          <Typography variant="headline-02" weight="semibold" className="text-title-default">
            {stats.counseling}
          </Typography>
        </View>
        <View>
          <Typography variant="label-01" className="text-body-subtle">
            검사
          </Typography>
          <Typography variant="headline-02" weight="semibold" className="text-title-default">
            {stats.assessment}
          </Typography>
        </View>
        <View className="flex-1" />
        {stats.unlinked > 0 && (
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(4),
              borderRadius: s(8),
            }}
            className="bg-red-50"
          >
            <Typography variant="label-02" weight="semibold" className="text-status-danger">
              미작성 {stats.unlinked}건
            </Typography>
          </View>
        )}
      </View>

      {/* 막대 */}
      <View
        style={{ marginTop: s(16), height: s(90), gap: s(6) }}
        className="flex-row items-end"
      >
        {counts.map((c, i) => {
          const total = c.counseling + c.assessment;
          const heightPct = (total / max) * 100;
          const counselingPct = total > 0 ? (c.counseling / total) * 100 : 0;
          const isToday = i === todayIdx;
          return (
            <View key={i} className="flex-1 items-center justify-end">
              <Typography
                variant="label-02"
                weight={isToday ? "semibold" : "regular"}
                className={isToday ? "text-title-default" : "text-placeholder"}
                style={{ marginBottom: s(4) }}
              >
                {total > 0 ? total : ""}
              </Typography>
              <View
                style={{
                  width: "75%",
                  height: `${Math.max(4, heightPct)}%`,
                  borderRadius: s(6),
                  overflow: "hidden",
                  backgroundColor: total === 0 ? "#EEF1F2" : undefined,
                }}
                className="flex-col-reverse"
              >
                {total > 0 && (
                  <>
                    <View
                      style={{
                        height: `${counselingPct}%`,
                        backgroundColor: COLORS.counseling,
                      }}
                    />
                    <View
                      style={{
                        height: `${100 - counselingPct}%`,
                        backgroundColor: COLORS.assessment,
                      }}
                    />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* 요일 라벨 */}
      <View style={{ marginTop: s(8), gap: s(6) }} className="flex-row">
        {days.map((d, i) => {
          const isToday = i === todayIdx;
          return (
            <View key={d} className="flex-1 items-center">
              {isToday ? (
                <View
                  style={{
                    paddingHorizontal: s(8),
                    paddingVertical: s(2),
                    borderRadius: s(999),
                  }}
                  className="bg-primary"
                >
                  <Typography variant="label-02" weight="semibold" className="text-state-inverse">
                    {d}
                  </Typography>
                </View>
              ) : (
                <Typography variant="label-02" className="text-body-subtle">
                  {d}
                </Typography>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(20),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography variant="body-02" weight="regular" className="text-body-subtle">
        {text}
      </Typography>
    </View>
  );
}
