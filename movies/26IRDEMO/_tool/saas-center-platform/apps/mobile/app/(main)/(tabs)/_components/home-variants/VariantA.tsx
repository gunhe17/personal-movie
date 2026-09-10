import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, differenceInMinutes } from "date-fns";
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from "@/features/schedule";
import { parseDate, formatTimeRange } from "@/shared/utils/date";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { deriveStatus, getAge, type ScheduleStatus } from "../utils";
import type { HomeVariantProps } from "./types";

/**
 * 시안 A — 친절 (Helpful) 톤
 *
 * 디자인 톤 & 매너(§0):
 * - 사용자가 다음 행동을 항상 알 수 있도록 명확한 안내
 * - 단일·명확한 1순위 CTA, 강조는 페이지당 1~2곳
 * - 차분한 gray + Primary cyan은 CTA에만 제한적 사용
 * - 정보 밀도 낮음, 여백 풍부
 * - 타이틀에 아이콘 결합 금지 (§0 메모리)
 */
export function VariantA(props: HomeVariantProps) {
  const {
    centerName,
    personName,
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

  const greeting = useMemo(() => getTimeBasedGreeting(today), [today]);
  const todayCount = todaySchedules.length;
  const previewSchedules = todaySchedules.slice(0, 3);
  const weekNoShowCount = useMemo(
    () => weekSchedules.filter((s) => deriveStatus(s) === "no_show").length,
    [weekSchedules],
  );
  const dateLineKR = useMemo(() => {
    const yoil = ["일", "월", "화", "수", "목", "금", "토"][today.getDay()];
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${yoil}요일`;
  }, [today]);

  return (
    <View className="flex-1 bg-background">
      <TopBar
        centerName={centerName}
        unreadCount={unreadCount}
        onPressMyCenters={onPressMyCenters}
        onPressNotifications={onPressNotifications}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero 인사 */}
        <View style={{ paddingHorizontal: s(16), paddingTop: s(8) }}>
          <Typography variant="body-03" weight="medium" className="text-body-subtle">
            {dateLineKR}
          </Typography>
          <View style={{ marginTop: s(4) }} className="flex-row flex-wrap items-baseline">
            <Typography
              variant="headline-01"
              weight="semibold"
              className="text-title-default"
            >
              {personName ?? "선생"}님,{" "}
            </Typography>
            {greeting.prefix && (
              <Typography
                variant="headline-01"
                weight="semibold"
                className="text-title-default"
              >
                {greeting.prefix}{" "}
              </Typography>
            )}
            <Typography
              variant="headline-01"
              weight="semibold"
              className="text-title-default"
            >
              {greeting.accent}
            </Typography>
            <Typography
              variant="headline-01"
              weight="semibold"
              className="text-title-default"
            >
              {greeting.suffix}
            </Typography>
          </View>
        </View>

        {/* 다음 상담 — Hero 카드 (gap/related = 16px 위) */}
        {nextSession ? (
          <NextSessionHero
            session={nextSession}
            now={today}
            onPress={onPressNextSession}
            onPressRecord={props.onPressNextSessionRecord}
          />
        ) : (
          <EmptyNextSession />
        )}

        {/* 이번주 통계 — 상담 / 검사 / 노쇼 (gap/related 16px 위) */}
        <View
          style={{
            marginTop: s(16),
            paddingHorizontal: s(16),
            paddingBottom: s(4),
          }}
        >
          <Typography
            variant="label-01"
            weight="regular"
            className="text-body-subtle"
          >
            이번주 · {weekStats.range}
          </Typography>
        </View>
        <View
          style={{
            paddingHorizontal: s(16),
            gap: s(12),
          }}
          className="flex-row"
        >
          <MiniStat
            value={weekStats.counseling}
            label="이번주 상담"
            accent={COLORS.counseling}
            accentBg={COLORS.counselingLight}
            valueColor={COLORS.gray[900]}
            iconName="counseling-20"
          />
          <MiniStat
            value={weekStats.assessment}
            label="이번주 검사"
            accent={COLORS.assessment}
            accentBg={COLORS.assessmentLight}
            valueColor={COLORS.gray[900]}
            iconName="assessment-20"
          />
          <MiniStat
            value={weekNoShowCount}
            label="노쇼"
            accent={COLORS.error}
            accentBg="#FFE8E8"
            ioniconsName="close-circle-outline"
          />
        </View>

        {/* 미작성 일지 CTA — 일러스트 + 작성 유도 (unlinked > 0일 때만) */}
        {unlinkedCount > 0 && (
          <UnlinkedNotesCta
            count={unlinkedCount}
            onPress={onPressFieldNoteList}
          />
        )}

        {/* 오늘 일정 섹션 (gap/section = 24px 위) */}
        <View
          style={{
            marginTop: s(24),
            paddingHorizontal: s(16),
            paddingBottom: s(16),
          }}
          className="flex-row items-end justify-between"
        >
          <View>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-title-default"
            >
              오늘 일정
            </Typography>
            <Typography
              variant="label-01"
              className="mt-0.5 text-body-subtle"
            >
              총 {todayCount}건
            </Typography>
          </View>
          <TouchableOpacity
            onPress={onPressSchedulesAll}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View className="flex-row items-center" style={{ gap: s(2) }}>
              <Typography
                variant="body-03"
                weight="medium"
                className="text-state-brand"
              >
                전체보기
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.text.state.brand}
              />
            </View>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : isError ? (
          <ErrorBlock onRetry={onRetry} />
        ) : todaySchedules.length === 0 ? (
          <EmptyToday />
        ) : (
          <View
            style={{ paddingHorizontal: s(16), gap: s(12) }}
          >
            {previewSchedules.map((item) => (
              <TodayScheduleCard
                key={item.id}
                schedule={item}
                isNext={nextSession?.id === item.id}
                onPress={() => onPressSchedule(item.id)}
              />
            ))}
          </View>
        )}

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
      style={{
        height: s(52),
        paddingHorizontal: s(16),
      }}
      className="flex-row items-center justify-between"
    >
      <TouchableOpacity
        onPress={onPressMyCenters}
        activeOpacity={0.7}
        className="flex-row items-center"
        style={{ gap: s(8) }}
        accessibilityRole="button"
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.primary,
          }}
          className="items-center justify-center"
        >
          <Ionicons name="business" size={14} color={COLORS.white} />
        </View>
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-title-default"
        >
          {centerName ?? "센터 선택"}
        </Typography>
        <Icon name="arrow-down" size={20} color={COLORS.gray[500]} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressNotifications}
        activeOpacity={0.7}
        style={{ width: s(40), height: s(40) }}
        className="items-center justify-center"
        accessibilityRole="button"
      >
        <Ionicons
          name="notifications-outline"
          size={24}
          color={COLORS.gray[800]}
        />
        {unreadCount > 0 && (
          <View
            style={{
              position: "absolute",
              right: s(8),
              top: s(8),
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: COLORS.error,
              borderWidth: 1.5,
              borderColor: COLORS.background,
            }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

function NextSessionHero({
  session,
  now,
  onPress,
  onPressRecord,
}: {
  session: ScheduleListItem;
  now: Date;
  onPress: () => void;
  onPressRecord: () => void;
}) {
  const primary = session.clients?.[0];
  const typeLabel =
    SCHEDULE_TYPE_LABELS[session.schedule_type] ?? session.schedule_type;
  const start = parseDate(session.start);
  const minutesUntil = differenceInMinutes(start, now);
  const isStarted = minutesUntil < 0;

  const { headline, sub } = (() => {
    if (isStarted) return { headline: "지금", sub: "진행 중" };
    if (minutesUntil < 60)
      return { headline: `${minutesUntil}`, sub: "분 뒤 시작" };
    const h = Math.floor(minutesUntil / 60);
    const m = minutesUntil % 60;
    return { headline: `${h}`, sub: `시간 ${m}분 뒤` };
  })();

  return (
    <View
      style={{
        marginTop: s(16),
        marginHorizontal: s(16),
        borderRadius: s(20),
        padding: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      {/* 헤더 + 카운트다운 */}
      <View className="flex-row items-start justify-between">
        <View>
          {/* 섹션 레이블 — Lable_01/Semibold + text/brand */}
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-state-brand"
          >
            {isStarted ? "진행 중" : "다음 일정"}
          </Typography>
          {/* 이름 + 정보 (gap/related 16px 위) */}
          <View style={{ marginTop: s(8) }}>
            {primary ? (
              <>
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  className="text-title-default"
                >
                  {primary.name}
                </Typography>
                {primary.birth_date && (
                  <Typography
                    variant="body-02"
                    weight="regular"
                    style={{ marginTop: s(2) }}
                    className="text-body-subtle"
                  >
                    {primary.gender === "female" ? "여" : "남"} · 만{" "}
                    {getAge(primary.birth_date)}세
                  </Typography>
                )}
              </>
            ) : (
              <Typography
                variant="headline-02"
                weight="semibold"
                className="text-title-default"
              >
                {session.title ?? typeLabel}
              </Typography>
            )}
          </View>
        </View>

        {/* 카운트다운 큰 시각화 */}
        <View className="items-end">
          <Typography
            weight="semibold"
            style={{
              color: COLORS.primary,
              fontSize: s(44),
              lineHeight: s(44),
              letterSpacing: -1,
            }}
          >
            {headline}
          </Typography>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ marginTop: s(4) }}
            className="text-body-subtle"
          >
            {sub}
          </Typography>
        </View>
      </View>

      {/* 메타 (gap/related = 16px 위) */}
      <View style={{ marginTop: s(16), gap: s(4) }}>
        <HeroMetaLine
          icon={<Icon name="time" size={s(20)} />}
          text={formatTimeRange(session.start, session.end)}
        />
        {session.room_name && (
          <HeroMetaLine
            icon={<Icon name="location" size={s(20)} />}
            text={session.room_name}
          />
        )}
        <HeroMetaLine
          icon={<Icon name="document" size={s(20)} />}
          text={`${typeLabel}${session.program_name ? ` · ${session.program_name}` : ""}`}
        />
      </View>

      {/* CTA — Primary Button: 48pt, radius-md, Body_01/Semibold */}
      <TouchableOpacity
        onPress={isStarted ? onPressRecord : onPress}
        activeOpacity={0.9}
        style={{
          marginTop: s(16),
          height: s(48),
          borderRadius: s(12),
        }}
        className="flex-row items-center justify-center bg-primary"
        accessibilityRole="button"
        accessibilityLabel={isStarted ? "녹음 시작" : "상담 상세보기"}
      >
        <Typography variant="body-01" weight="semibold" className="text-state-inverse">
          {isStarted ? "녹음 시작하기" : "상담 상세보기"}
        </Typography>
        <Ionicons
          name={isStarted ? "mic" : "arrow-forward"}
          size={s(18)}
          color={COLORS.white}
          style={{ marginLeft: s(6) }}
        />
      </TouchableOpacity>
    </View>
  );
}

function HeroMetaLine({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <View style={{ gap: s(6) }} className="flex-row items-center">
      {icon}
      <Typography variant="body-02" weight="regular" className="text-body-strong">
        {text}
      </Typography>
    </View>
  );
}

function EmptyNextSession() {
  return (
    <View
      style={{
        marginTop: s(16),
        marginHorizontal: s(16),
        padding: s(16),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <Typography variant="title-01" weight="semibold" className="text-title-default">
        오늘은 예정된 상담이 없어요
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        className="mt-1 text-body-subtle"
      >
        여유로운 하루 보내세요
      </Typography>
    </View>
  );
}

/* ─────────── 미작성 일지 CTA — 일러스트 + 작성 유도 ─────────── */

function UnlinkedNotesCta({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        marginTop: s(24),
        marginHorizontal: s(16),
        padding: s(16),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(16) }}>
        <NoteIllustration />
        <View className="flex-1" style={{ gap: s(2) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
          >
            미작성 일지 {count}건이 있어요
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            className="text-body-subtle"
          >
            필드노트로 빠르고 편하게 작성해보세요
          </Typography>
        </View>
      </View>

      {/* CTA Primary Button — fieldnote 컬러로 작성 액션 강조 */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          marginTop: s(16),
          height: s(48),
          borderRadius: s(12),
          backgroundColor: COLORS.fieldnote,
        }}
        className="flex-row items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="필드노트로 일지 작성하러 가기"
      >
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-state-inverse"
        >
          필드노트로 작성하기
        </Typography>
        <Ionicons
          name="arrow-forward"
          size={s(18)}
          color={COLORS.white}
          style={{ marginLeft: s(6) }}
        />
      </TouchableOpacity>
    </View>
  );
}

/**
 * 미작성 일지 일러스트 — 작성(연필) + AI 스파클 + 데코 원
 *
 * 메인 액션: 일지 작성 → 연필 아이콘(`create-outline`)을 중앙에 배치
 * 보조: 스파클(AI/빠른 작성) + 액센트 dot
 * 컬러: fieldnote-purple (#9B5DFF) — 필드노트 feature 시그니처
 *
 * (마이크 아이콘은 의도적으로 배제 — 녹음으로 작성하는 건 예외적 경로이므로
 *  필드노트 feature 자체의 활용 가능성만 컬러로 암시하고, 일러스트는
 *  "일지 작성"이라는 보편 행동에 집중)
 */
function NoteIllustration() {
  return (
    <View
      style={{ width: s(72), height: s(72) }}
      className="items-center justify-center"
    >
      {/* 외곽 soft 원 */}
      <View
        style={{
          position: "absolute",
          width: s(72),
          height: s(72),
          borderRadius: s(36),
          backgroundColor: COLORS.fieldnote,
          opacity: 0.08,
        }}
      />
      {/* 내곽 강조 원 */}
      <View
        style={{
          position: "absolute",
          width: s(52),
          height: s(52),
          borderRadius: s(26),
          backgroundColor: COLORS.fieldnote,
          opacity: 0.16,
        }}
      />
      {/* 중앙 작성 아이콘 (연필 + 페이퍼) */}
      <Ionicons name="create-outline" size={s(28)} color={COLORS.fieldnote} />
      {/* AI 스파클 — 우상단 */}
      <View
        style={{
          position: "absolute",
          top: s(2),
          right: s(2),
        }}
      >
        <Ionicons name="sparkles" size={s(14)} color={COLORS.fieldnote} />
      </View>
      {/* 작은 액센트 dot — 좌하단 */}
      <View
        style={{
          position: "absolute",
          bottom: s(6),
          left: s(4),
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: COLORS.fieldnote,
          opacity: 0.6,
        }}
      />
    </View>
  );
}

/* ---------------- 새 오늘 일정 카드 ---------------- */

const TYPE_STYLE: Record<string, { tint: string; bg: string; label: string }> =
  {
    counseling: {
      tint: COLORS.counseling,
      bg: COLORS.counselingLight,
      label: "상담",
    },
    assessment: {
      tint: COLORS.assessment,
      bg: COLORS.assessmentLight,
      label: "검사",
    },
    block: { tint: COLORS.gray[500], bg: COLORS.gray[50], label: "차단" },
  };

// 디자인 시스템 status badge 토큰 적용
// - completed: gray-200 + gray-600
// - in_progress: notice@12% + notice (스펙대로 orange 사용)
// - no_show/cancelled: 디자인 시스템에 명시 없음 → negative subtle 적용
const STATUS_CHIP: Partial<
  Record<ScheduleStatus, { tint: string; bg: string; label: string }>
> = {
  in_progress: {
    tint: COLORS.statusBadge.inProgress.text,
    bg: COLORS.statusBadge.inProgress.bg,
    label: "진행중",
  },
  completed: {
    tint: COLORS.statusBadge.completed.text,
    bg: COLORS.statusBadge.completed.bg,
    label: "완료",
  },
  no_show: { tint: COLORS.error, bg: "#FFE8E8", label: "취소" },
  cancelled: { tint: COLORS.error, bg: "#FFE8E8", label: "취소" },
};

export function TodayScheduleCard({
  schedule,
  onPress,
  isNext,
}: {
  schedule: ScheduleListItem;
  onPress: () => void;
  isNext?: boolean;
}) {
  const primary = schedule.clients?.[0];
  const typeLabel =
    SCHEDULE_TYPE_LABELS[schedule.schedule_type] ?? schedule.schedule_type;
  const typeStyle =
    TYPE_STYLE[schedule.schedule_type] ?? TYPE_STYLE.counseling;
  const status = deriveStatus(schedule);
  const statusChip = STATUS_CHIP[status];
  const startTime = format(parseDate(schedule.start), "HH:mm");
  const endTime = format(parseDate(schedule.end), "HH:mm");

  const isInactive = status === "cancelled" || status === "no_show";
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  // 상태별 시간 박스 톤 (상담/검사 구분 X — 단일 회색 톤)
  // - 곧 시작(isNext): primary 채움 + 흰 텍스트
  // - 완료: 회색 가라앉음
  // - 예정(upcoming): gray-100 + gray-700
  let timeBoxBg: string = COLORS.gray[100];
  let timeBoxFg: string = COLORS.gray[700];
  let timeBoxDivider: string = COLORS.gray[700];
  let timeBoxDividerOpacity = 0.35;
  if (isNext) {
    timeBoxBg = COLORS.primary;
    timeBoxFg = COLORS.white;
    timeBoxDivider = "rgba(255,255,255,0.55)";
    timeBoxDividerOpacity = 1;
  } else if (isCompleted) {
    timeBoxBg = COLORS.gray[100];
    timeBoxFg = COLORS.gray[400];
    timeBoxDivider = COLORS.gray[400];
    timeBoxDividerOpacity = 0.55;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: s(16),
        padding: s(12),
        paddingLeft: s(12),
        backgroundColor: COLORS.bg.surface,
        opacity: isInactive ? 0.55 : 1,
        // 카드 디자인 시스템: 기본은 border/subtle 1px, 진행 중/곧 시작은 primary 아웃라인 강조
        borderWidth: 1,
        borderColor: isInProgress || isNext ? COLORS.primary : COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="flex-row items-center"
      accessibilityRole="button"
      accessibilityLabel={
        isNext
          ? "곧 시작될 다음 상담"
          : isInactive
            ? `${statusChip?.label ?? ""} 상담`
            : undefined
      }
    >
      {/* 좌측 시간 박스 — radius-md (12px) */}
      <View
        style={{
          width: s(64),
          paddingVertical: s(10),
          borderRadius: s(12),
          backgroundColor: timeBoxBg,
        }}
        className="items-center"
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: timeBoxFg }}
        >
          {startTime}
        </Typography>
        <View
          style={{
            width: 1,
            height: s(6),
            backgroundColor: timeBoxDivider,
            opacity: timeBoxDividerOpacity,
            marginVertical: s(2),
          }}
        />
        <Typography
          variant="label-02"
          weight="medium"
          style={{ color: timeBoxFg, opacity: isNext ? 0.85 : 0.7 }}
        >
          {endTime}
        </Typography>
      </View>

      {/* 가운데 정보 */}
      <View style={{ paddingLeft: s(12) }} className="flex-1">
        {/* 곧 시작 — 오늘 일정에서 가장 중요한 강조 라인 */}
        {isNext && status !== "in_progress" && (
          <Typography
            variant="body-03"
            weight="semibold"
            className="text-state-brand"
            style={{ marginBottom: s(2) }}
          >
            곧 시작
          </Typography>
        )}
        <View className="flex-row items-baseline" style={{ gap: s(6) }}>
          {primary ? (
            <>
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-title-default"
                numberOfLines={1}
              >
                {primary.name}
              </Typography>
              {primary.birth_date && (
                <Typography variant="label-01" weight="regular" className="text-body-subtle">
                  {primary.gender === "female" ? "여" : "남"} · 만{" "}
                  {getAge(primary.birth_date)}세
                </Typography>
              )}
            </>
          ) : (
            <Typography
              variant="body-01"
              weight="semibold"
              className="text-title-default"
              numberOfLines={1}
            >
              {schedule.title ?? typeLabel}
            </Typography>
          )}
        </View>
        <View
          style={{ marginTop: s(4), gap: s(6) }}
          className="flex-row items-center"
        >
          {/* 타입 dot */}
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: typeStyle.tint,
            }}
          />
          <Typography
            variant="label-01"
            weight="regular"
            className="text-label-default"
            numberOfLines={1}
          >
            {typeLabel}
            {schedule.program_name ? ` · ${schedule.program_name}` : ""}
            {schedule.room_name ? ` · ${schedule.room_name}` : ""}
          </Typography>
        </View>
      </View>

      {/* 우측 상태 chip — 디자인 시스템 Badge 규격 (h-24, radius-sm, label-02) */}
      {statusChip && (
        <View
          style={{
            height: s(24),
            paddingHorizontal: s(8),
            borderRadius: s(8),
            backgroundColor: statusChip.bg,
            marginLeft: s(8),
          }}
          className="items-center justify-center"
        >
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: statusChip.tint }}
          >
            {statusChip.label}
          </Typography>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MiniStat({
  value,
  label,
  accent,
  accentBg,
  valueColor,
  iconName,
  ioniconsName,
  onPress,
}: {
  value: number;
  label: string;
  accent: string;
  accentBg: string;
  valueColor?: string;
  iconName?: React.ComponentProps<typeof Icon>["name"];
  ioniconsName?: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        paddingVertical: s(16),
        paddingHorizontal: s(12),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(8),
          backgroundColor: accentBg,
          marginBottom: s(8),
        }}
        className="items-center justify-center"
      >
        {iconName ? (
          <Icon name={iconName} size={s(18)} color={accent} />
        ) : ioniconsName ? (
          <Ionicons name={ioniconsName} size={s(18)} color={accent} />
        ) : null}
      </View>
      <Typography
        variant="headline-01"
        weight="semibold"
        style={{ color: valueColor ?? accent }}
      >
        {value}
      </Typography>
      <Typography
        variant="label-01"
        weight="regular"
        className="mt-0.5 text-label-default"
      >
        {label}
      </Typography>
    </Wrapper>
  );
}

function EmptyToday() {
  return (
    <View
      style={{
        marginHorizontal: s(16),
        padding: s(24),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography variant="body-01" weight="semibold" className="text-body-strong">
        오늘은 일정이 없어요
      </Typography>
      <Typography
        variant="body-03"
        weight="regular"
        className="mt-1 text-body-subtle"
      >
        여유로운 하루 되세요
      </Typography>
    </View>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        marginHorizontal: s(16),
        padding: s(24),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="items-center"
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

/* ---------------- Helpers (display only) ---------------- */

function getTimeBasedGreeting(date: Date): {
  prefix: string;
  accent: string;
  suffix: string;
} {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return { prefix: "", accent: "좋은 아침", suffix: "이에요" };
  }
  if (hour >= 12 && hour < 18) {
    return { prefix: "", accent: "활기찬 오후", suffix: "예요" };
  }
  if (hour >= 18 && hour < 22) {
    return { prefix: "오늘도", accent: "고생 많으셨어요", suffix: "" };
  }
  return { prefix: "늦은 시간까지", accent: "수고하시네요", suffix: "" };
}
