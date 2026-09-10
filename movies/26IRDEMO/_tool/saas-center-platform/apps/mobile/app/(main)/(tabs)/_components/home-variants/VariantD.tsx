import { useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { format, differenceInMinutes } from "date-fns";
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from "@/features/schedule";
import { parseDate, formatTimeRange } from "@/shared/utils/date";
import { COLORS, SHADOWS, MOTION } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { deriveStatus, getAge, type ScheduleStatus } from "../utils";
import type { HomeVariantProps } from "./types";

/**
 * 시안 D → 균형 (Balanced) 톤
 *
 * 디자인 톤 & 매너(§0):
 * - 친절·친근·재미 3 톤을 균형 있게 혼합
 *   · 친절: 명확한 위계, 단일 핵심 CTA, 충분한 여백
 *   · 친근: 시간대별 인사·이름 호명·부드러운 표현
 *   · 재미: 카테고리 컬러 좌측 보더, 카운트다운 큰 숫자, 작은 액센트
 *
 * 마이크로 인터랙션(§8.3):
 * - 알림 벨: unread > 0일 때 rotate -15→15→0 1회 (목적: 시선 유도)
 * - 카운트다운 숫자: 진입 시 scale 0.85→1 + opacity 0→1 spring
 * - 카드 press: scale 0.98 + opacity 0.92 (100ms easing-default)
 * - CTA 버튼 press: scale 0.97 (spring back)
 * - 카드 staggered entry: translateY(8) + opacity 0→1 (200ms, 80ms 간격)
 * - 진행중 chip pulse: opacity 1↔0.55 무한 반복 (1.4s)
 * - 전체보기 chevron press: translateX(-2px) 후 복귀
 *
 * 원칙(§8.3): "모든 마이크로 인터랙션은 목적이 있어야 한다 — 장식용 금지"
 */
export function VariantD(props: HomeVariantProps) {
  const {
    centerName,
    personName,
    today,
    nextSession,
    todaySchedules,
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

  const greeting = useMemo(() => getTimeGreeting(today, personName), [today, personName]);
  const previewSchedules = todaySchedules.slice(0, 3);

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
        {/* 인사 — 친근 톤 (시간대 + 이름) */}
        <View style={{ paddingHorizontal: s(16), paddingTop: s(8) }}>
          <Typography variant="label-01" weight="medium" className="text-body-subtle">
            {greeting.dateLine}
          </Typography>
          <View style={{ marginTop: s(4) }} className="flex-row items-baseline flex-wrap">
            <Typography
              variant="headline-01"
              weight="semibold"
              className="text-title-default"
            >
              {greeting.name}님,{" "}
            </Typography>
            <Typography
              variant="headline-01"
              weight="semibold"
              className="text-title-default"
            >
              {greeting.message}
            </Typography>
          </View>
        </View>

        {/* 다음 일정 Hero — 친절 CTA + 재미 카운트다운 */}
        {nextSession ? (
          <HeroNextSession
            session={nextSession}
            now={today}
            onPress={onPressNextSession}
            onPressRecord={props.onPressNextSessionRecord}
          />
        ) : (
          <EmptyHero />
        )}

        {/* 미니 KPI strip — 재미 톤 (카테고리 컬러) */}
        <MiniStatsStrip
          counseling={weekStats.counseling}
          assessment={weekStats.assessment}
          unlinked={unlinkedCount}
          onPressUnlinked={
            unlinkedCount > 0 ? onPressFieldNoteList : undefined
          }
        />

        {/* 오늘 일정 — 친절 위계 + 재미 좌측 컬러 보더 */}
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
              총 {todaySchedules.length}건
            </Typography>
          </View>
          <SeeAllButton onPress={onPressSchedulesAll} />
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
          <View style={{ paddingHorizontal: s(16), gap: s(12) }}>
            {previewSchedules.map((item, idx) => (
              <AnimatedScheduleCard
                key={item.id}
                index={idx}
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

/* ───────────────────────── TopBar (알림 벨 shake) ───────────────────────── */

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
  const shakeRotation = useSharedValue(0);

  useEffect(() => {
    if (unreadCount > 0) {
      // §8.3: 알림 벨 shake — rotate -15→15→-15→0 (400ms 1회)
      shakeRotation.value = withSequence(
        withTiming(-15, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(15, { duration: 100, easing: Easing.inOut(Easing.quad) }),
        withTiming(-10, { duration: 90, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) }),
      );
    }
  }, [unreadCount, shakeRotation]);

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotation.value}deg` }],
  }));

  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(16),
      }}
      className="flex-row items-center justify-between"
    >
      <PressableScale onPress={onPressMyCenters} style={{ gap: s(8) }} className="flex-row items-center">
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
      </PressableScale>

      <Pressable
        onPress={onPressNotifications}
        style={{ width: s(40), height: s(40) }}
        className="items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={`알림${unreadCount > 0 ? `, ${unreadCount}개 읽지 않음` : ""}`}
      >
        <Animated.View style={bellAnimStyle}>
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.gray[800]}
          />
        </Animated.View>
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
      </Pressable>
    </View>
  );
}

/* ─────────────────── Hero Next Session (카운트다운 entry) ─────────────────── */

function HeroNextSession({
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
  const minutesUntil = differenceInMinutes(parseDate(session.start), now);
  const isStarted = minutesUntil < 0;

  const { headline, sub } = (() => {
    if (isStarted) return { headline: "지금", sub: "진행 중" };
    if (minutesUntil < 60)
      return { headline: `${minutesUntil}`, sub: "분 뒤 시작" };
    const h = Math.floor(minutesUntil / 60);
    const m = minutesUntil % 60;
    return { headline: `${h}`, sub: `시간 ${m}분 뒤` };
  })();

  // 카운트다운 entry: scale 0.85 → 1 + opacity 0 → 1 (spring)
  const countScale = useSharedValue(0.85);
  const countOpacity = useSharedValue(0);
  useEffect(() => {
    countScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    countOpacity.value = withTiming(1, { duration: 250 });
  }, [headline, countScale, countOpacity]);

  const countdownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
    opacity: countOpacity.value,
  }));

  return (
    <Animated.View
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
      <View className="flex-row items-start justify-between">
        <View className="flex-1" style={{ paddingRight: s(12) }}>
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-state-brand"
          >
            {isStarted ? "진행 중" : "다음 일정"}
          </Typography>
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

        {/* 카운트다운 큰 시각화 — entry 애니메이션 */}
        <Animated.View style={[{ alignItems: "flex-end" }, countdownStyle]}>
          <Typography
            weight="semibold"
            style={{
              color: COLORS.primary,
              fontSize: s(44),
              lineHeight: s(48),
              letterSpacing: -1,
            }}
          >
            {headline}
          </Typography>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ marginTop: s(2) }}
            className="text-body-subtle"
          >
            {sub}
          </Typography>
        </Animated.View>
      </View>

      {/* 메타 */}
      <View style={{ marginTop: s(16), gap: s(4) }}>
        <MetaLine
          icon={<Icon name="time" size={s(20)} />}
          text={formatTimeRange(session.start, session.end)}
        />
        {session.room_name && (
          <MetaLine
            icon={<Icon name="location" size={s(20)} />}
            text={session.room_name}
          />
        )}
        <MetaLine
          icon={<Icon name="document" size={s(20)} />}
          text={`${typeLabel}${session.program_name ? ` · ${session.program_name}` : ""}`}
        />
      </View>

      {/* CTA Primary Button (press scale 0.97) */}
      <PressableScale
        onPress={isStarted ? onPressRecord : onPress}
        pressedScale={0.97}
        style={{
          marginTop: s(16),
          height: s(48),
          borderRadius: s(12),
          backgroundColor: COLORS.primary,
        }}
        className="flex-row items-center justify-center"
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
      </PressableScale>
    </Animated.View>
  );
}

function MetaLine({
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

function EmptyHero() {
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

/* ────────────────────── Mini Stats Strip (재미 액센트) ────────────────────── */

function MiniStatsStrip({
  counseling,
  assessment,
  unlinked,
  onPressUnlinked,
}: {
  counseling: number;
  assessment: number;
  unlinked: number;
  onPressUnlinked?: () => void;
}) {
  return (
    <View
      style={{
        marginTop: s(16),
        marginHorizontal: s(16),
        flexDirection: "row",
        gap: s(12),
      }}
    >
      <MiniStat
        accent={COLORS.counseling}
        label="이번주 상담"
        value={counseling}
      />
      <MiniStat
        accent={COLORS.assessment}
        label="이번주 검사"
        value={assessment}
      />
      <MiniStat
        accent={unlinked > 0 ? COLORS.fieldnote : COLORS.gray[300]}
        label="미작성 일지"
        value={unlinked}
        onPress={unlinked > 0 ? onPressUnlinked : undefined}
        highlight={unlinked > 0}
      />
    </View>
  );
}

function MiniStat({
  accent,
  label,
  value,
  onPress,
  highlight,
}: {
  accent: string;
  label: string;
  value: number;
  onPress?: () => void;
  highlight?: boolean;
}) {
  const Wrapper = onPress ? PressableScale : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: s(12),
        paddingHorizontal: s(12),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: highlight ? accent : COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(4) }}>
        <View
          style={{
            width: s(6),
            height: s(6),
            borderRadius: s(3),
            backgroundColor: accent,
          }}
        />
        <Typography variant="label-02" weight="medium" className="text-label-default">
          {label}
        </Typography>
      </View>
      <Typography
        variant="headline-02"
        weight="semibold"
        style={{ marginTop: s(8), color: value > 0 ? COLORS.text.title.default : COLORS.text.placeholder }}
      >
        {value}
      </Typography>
    </Wrapper>
  );
}

/* ─────────────── Today Schedule Card (좌측 컬러 보더 + 인터랙션) ─────────────── */

const TYPE_ACCENT: Record<string, string> = {
  counseling: COLORS.counseling,
  assessment: COLORS.assessment,
  block: COLORS.gray[400],
};

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

function AnimatedScheduleCard({
  schedule,
  isNext,
  onPress,
  index,
}: {
  schedule: ScheduleListItem;
  isNext?: boolean;
  onPress: () => void;
  index: number;
}) {
  // staggered entry: translateY(8) + opacity 0→1, index별 80ms 딜레이
  const entryY = useSharedValue(8);
  const entryOpacity = useSharedValue(0);
  useEffect(() => {
    entryY.value = withDelay(
      index * 80,
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
    entryOpacity.value = withDelay(
      index * 80,
      withTiming(1, { duration: 220 }),
    );
  }, [index, entryY, entryOpacity]);

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: entryY.value }],
    opacity: entryOpacity.value,
  }));

  return (
    <Animated.View style={entryStyle}>
      <ScheduleCardInner
        schedule={schedule}
        isNext={isNext}
        onPress={onPress}
      />
    </Animated.View>
  );
}

function ScheduleCardInner({
  schedule,
  isNext,
  onPress,
}: {
  schedule: ScheduleListItem;
  isNext?: boolean;
  onPress: () => void;
}) {
  const primary = schedule.clients?.[0];
  const typeLabel =
    SCHEDULE_TYPE_LABELS[schedule.schedule_type] ?? schedule.schedule_type;
  const status = deriveStatus(schedule);
  const statusChip = STATUS_CHIP[status];
  const startTime = format(parseDate(schedule.start), "HH:mm");
  const endTime = format(parseDate(schedule.end), "HH:mm");
  const accentColor =
    TYPE_ACCENT[schedule.schedule_type] ?? COLORS.gray[400];

  const isInactive = status === "cancelled" || status === "no_show";
  const isInProgress = status === "in_progress";

  // 카드 press: scale 0.98 + opacity 0.92
  const pressScale = useSharedValue(1);
  const pressOpacity = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: pressOpacity.value * (isInactive ? 0.55 : 1),
  }));

  // in-progress chip pulse
  const chipPulse = useSharedValue(1);
  useEffect(() => {
    if (isInProgress) {
      chipPulse.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [isInProgress, chipPulse]);
  const chipAnimStyle = useAnimatedStyle(() => ({ opacity: chipPulse.value }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.98, { duration: 100 });
        pressOpacity.value = withTiming(0.92, { duration: 100 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { damping: 14, stiffness: 220 });
        pressOpacity.value = withTiming(1, { duration: 150 });
      }}
      accessibilityRole="button"
      accessibilityLabel={
        isNext
          ? "곧 시작될 다음 상담"
          : isInactive
            ? `${statusChip?.label ?? ""} 상담`
            : undefined
      }
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            borderRadius: s(16),
            padding: s(12),
            paddingLeft: s(16),
            backgroundColor: COLORS.bg.surface,
            borderWidth: 1,
            borderColor: isInProgress || isNext ? COLORS.primary : COLORS.border.default,
            overflow: "hidden",
            ...SHADOWS.card,
          },
          cardAnimStyle,
        ]}
      >
        {/* 좌측 카테고리 컬러 보더 — §4.2 spec 일정 카드: 3px solid */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: s(8),
            bottom: s(8),
            width: 3,
            borderRadius: 2,
            backgroundColor: accentColor,
          }}
        />

        {/* 시간 */}
        <View style={{ width: s(56) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
          >
            {startTime}
          </Typography>
          <Typography
            variant="label-02"
            weight="regular"
            className="text-body-subtle"
            style={{ marginTop: s(2) }}
          >
            ~ {endTime}
          </Typography>
        </View>

        {/* 가운데 정보 */}
        <View style={{ paddingLeft: s(12), flex: 1 }}>
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
          {primary ? (
            <View className="flex-row items-baseline" style={{ gap: s(6) }}>
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
                  {primary.gender === "female" ? "여" : "남"} · {getAge(primary.birth_date)}세
                </Typography>
              )}
            </View>
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
          <Typography
            variant="label-01"
            weight="regular"
            className="text-label-default"
            numberOfLines={1}
            style={{ marginTop: s(2) }}
          >
            {typeLabel}
            {schedule.program_name ? ` · ${schedule.program_name}` : ""}
            {schedule.room_name ? ` · ${schedule.room_name}` : ""}
          </Typography>
        </View>

        {/* 우측 상태 chip */}
        {statusChip && (
          <Animated.View
            style={[
              {
                height: s(24),
                paddingHorizontal: s(8),
                borderRadius: s(8),
                backgroundColor: statusChip.bg,
                marginLeft: s(8),
                alignItems: "center",
                justifyContent: "center",
              },
              isInProgress ? chipAnimStyle : undefined,
            ]}
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: statusChip.tint }}
            >
              {statusChip.label}
            </Typography>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────── Section Header — See All ───────────────────────── */

function SeeAllButton({ onPress }: { onPress: () => void }) {
  const chevronX = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chevronX.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        // §8.3: 뒤로가기 < 패턴 응용 — 우측 화살표는 약간 우측으로
        chevronX.value = withTiming(2, { duration: 100 });
      }}
      onPressOut={() => {
        chevronX.value = withSpring(0, { damping: 14, stiffness: 220 });
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="전체 일정 보기"
    >
      <View className="flex-row items-center" style={{ gap: s(2) }}>
        <Typography
          variant="body-03"
          weight="medium"
          className="text-state-brand"
        >
          전체보기
        </Typography>
        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.text.state.brand}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/* ───────────────────────── Empty / Error blocks ───────────────────────── */

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
      <Typography variant="body-03" weight="regular" className="mt-1 text-body-subtle">
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
      <PressableScale
        onPress={onRetry}
        pressedScale={0.97}
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
      </PressableScale>
    </View>
  );
}

/* ───────────────── 공통 PressableScale — 카드/버튼 press 피드백 ───────────────── */

interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
  className?: string;
  pressedScale?: number;
  accessibilityRole?: "button" | "link";
  accessibilityLabel?: string;
}

function PressableScale({
  onPress,
  children,
  style,
  className,
  pressedScale = 0.98,
  accessibilityRole = "button",
  accessibilityLabel,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!onPress) {
    return (
      <View style={style} className={className}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(pressedScale, {
          duration: MOTION.duration.fast,
          easing: Easing.out(Easing.quad),
        });
        opacity.value = withTiming(0.92, { duration: MOTION.duration.fast });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
        opacity.value = withTiming(1, { duration: MOTION.duration.normal });
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, animStyle]} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

function getTimeGreeting(
  date: Date,
  name: string | null,
): { dateLine: string; name: string; message: string } {
  const hour = date.getHours();
  const yoil = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const dateLine = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${yoil}요일`;

  let message: string;
  if (hour >= 5 && hour < 12) message = "좋은 아침이에요";
  else if (hour >= 12 && hour < 18) message = "활기찬 오후예요";
  else if (hour >= 18 && hour < 22) message = "오늘도 고생 많으셨어요";
  else message = "조용한 밤이에요";

  return { dateLine, name: name ?? "선생", message };
}

