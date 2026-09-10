import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { differenceInMinutes } from "date-fns";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { parseDate } from "@/shared/utils/date";
import type { ScheduleListItem } from "@/features/schedule";
import { deriveStatus, getAge } from "../utils";
import type { HomeVariantProps } from "./types";

// 컬러는 theme COLORS.primary* 토큰 사용 (apps/web 팔레트와 동기화)
// 노란 액센트는 시안 한정 로컬 상수 (도장 토큰화 전)
const ACCENT_YELLOW = "#FDCA01";

function formatHHmm(iso: string): string {
  const d = parseDate(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatCountdown(minutes: number) {
  if (minutes < 0) return { headline: "지금", sub: "진행 중" };
  if (minutes < 60) return { headline: String(minutes), sub: "분 뒤 시작" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { headline: String(h), sub: `시간 ${m}분 뒤` };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "활기찬 아침이에요";
  if (h >= 12 && h < 18) return "활기찬 오후예요";
  if (h >= 18 && h < 22) return "고생 많으셨어요";
  return "수고하시네요";
}

/**
 * 시안: 컬러 히어로 (web blue 팔레트)
 *
 * - 풀블리드 LinearGradient + 카운트다운 큰 카피 + 시계 일러스트
 * - 전체 페이지 스크롤 (Hero도 함께 흐른다)
 * - 일정 카드: 좌측 라인 없이 6px 컬러 원으로 상담/검사 구분
 */
export function ColorHero(props: HomeVariantProps) {
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
    onPressNextSessionRecord,
    onPressSchedule,
    onPressSchedulesAll,
    onPressFieldNoteList,
    onRetry,
  } = props;

  const weekNoShowCount = useMemo(
    () => weekSchedules.filter((sch) => deriveStatus(sch) === "no_show").length,
    [weekSchedules],
  );

  const countdown = useMemo(() => {
    if (!nextSession) return null;
    const start = parseDate(nextSession.start);
    return formatCountdown(differenceInMinutes(start, today));
  }, [nextSession, today]);

  const isStarted = countdown?.sub === "진행 중";
  const primaryClient = nextSession?.clients?.[0];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary500}
          />
        }
      >
        {/* ───── 상단 컬러 헤더 ───── */}
        <LinearGradient
          colors={[COLORS.primary600, COLORS.primary500, COLORS.primary400]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={["top"]}>
            <HomeTopBar
              centerName={centerName}
              unreadCount={unreadCount}
              onPressMyCenters={onPressMyCenters}
              onPressNotifications={onPressNotifications}
            />

            {nextSession && countdown ? (
              <HeroBody
                personName={personName}
                countHeadline={countdown.headline}
                countSub={countdown.sub}
                primaryClient={primaryClient}
                session={nextSession}
                isStarted={isStarted}
                onPress={
                  isStarted ? onPressNextSessionRecord : onPressNextSession
                }
              />
            ) : (
              <HeroEmpty personName={personName} />
            )}
          </SafeAreaView>
        </LinearGradient>

        {/* ───── 이번주 통계 ───── */}
        <View
          style={{
            paddingHorizontal: s(16),
            paddingTop: s(16),
            paddingBottom: s(8),
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
          style={{ paddingHorizontal: s(16), gap: s(12) }}
          className="flex-row"
        >
          <MiniStatColored
            accent={COLORS.counseling}
            accentBg={COLORS.counselingLight}
            value={weekStats.counseling}
            label="이번주 상담"
            iconName="counseling-20"
          />
          <MiniStatColored
            accent={COLORS.assessment}
            accentBg={COLORS.assessmentLight}
            value={weekStats.assessment}
            label="이번주 검사"
            iconName="assessment-20"
          />
          <MiniStatColored
            accent={COLORS.error}
            accentBg="#FFE8E8"
            value={weekNoShowCount}
            label="노쇼"
            ioniconsName="close-circle-outline"
          />
        </View>

        {/* 미작성 일지 CTA */}
        {unlinkedCount > 0 && (
          <UnlinkedCta
            count={unlinkedCount}
            onPress={onPressFieldNoteList}
          />
        )}

        {/* ───── 오늘 일정 ───── */}
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
            <Typography variant="label-01" className="mt-0.5 text-body-subtle">
              총 {todaySchedules.length}건
            </Typography>
          </View>
          <TouchableOpacity
            onPress={onPressSchedulesAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center" style={{ gap: s(2) }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.primary500 }}
              >
                전체보기
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.primary500}
              />
            </View>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color={COLORS.primary500} />
          </View>
        ) : isError ? (
          <ErrorBlock onRetry={onRetry} />
        ) : todaySchedules.length === 0 ? (
          <EmptyToday />
        ) : (
          <View style={{ paddingHorizontal: s(16), gap: s(12) }}>
            {todaySchedules.map((sch) => (
              <SimpleScheduleCard
                key={sch.id}
                schedule={sch}
                isNext={nextSession?.id === sch.id}
                onPress={() => onPressSchedule(sch.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Sub Components ─── */

function HomeTopBar({
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
      style={{ height: s(52), paddingHorizontal: s(16) }}
      className="flex-row items-center justify-between"
    >
      <TouchableOpacity
        onPress={onPressMyCenters}
        activeOpacity={0.7}
        hitSlop={8}
        className="flex-row items-center"
        style={{ gap: s(8) }}
        accessibilityRole="button"
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: "rgba(255,255,255,0.22)",
          }}
          className="items-center justify-center"
        >
          <Ionicons name="business" size={14} color={COLORS.white} />
        </View>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          {centerName ?? "센터 선택"}
        </Typography>
        <Icon name="arrow-down" size={20} color={COLORS.white} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressNotifications}
        activeOpacity={0.7}
        style={{ width: s(40), height: s(40) }}
        className="items-center justify-center"
        hitSlop={4}
        accessibilityRole="button"
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
              right: s(8),
              top: s(8),
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: ACCENT_YELLOW,
              borderWidth: 1.5,
              borderColor: COLORS.primary500,
            }}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

function HeroBody({
  personName,
  countHeadline,
  countSub,
  primaryClient,
  session,
  isStarted,
  onPress,
}: {
  personName: string | null;
  countHeadline: string;
  countSub: string;
  primaryClient?: ScheduleListItem["clients"][number];
  session: ScheduleListItem;
  isStarted: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: s(16), paddingBottom: s(28) }}>
      <View className="flex-row">
        {/* 좌측 텍스트 */}
        <View className="flex-1" style={{ paddingTop: s(12) }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {personName ?? "선생"}님, {getGreeting()}
          </Typography>

          <View style={{ marginTop: s(8) }}>
            <View className="flex-row items-baseline flex-wrap">
              <Typography
                weight="semibold"
                style={{
                  color: ACCENT_YELLOW,
                  fontSize: s(48),
                  lineHeight: s(54),
                  letterSpacing: -1.2,
                }}
              >
                {countHeadline}
              </Typography>
              <Typography
                variant="headline-02"
                weight="medium"
                style={{ color: COLORS.white, marginLeft: s(6) }}
              >
                {countSub}
              </Typography>
            </View>
            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.white, marginTop: s(2) }}
            >
              {primaryClient
                ? `${primaryClient.name}님과 만나요`
                : (session.title ?? "다음 일정")}
            </Typography>
          </View>
        </View>

        <ClockIllustration />
      </View>

      {/* 빠른 정보 chip — 시간/상담실/프로그램 */}
      <View
        style={{ marginTop: s(20), gap: s(8) }}
        className="flex-row flex-wrap"
      >
        <InfoChip
          icon={
            <Ionicons name="time-outline" size={14} color={COLORS.white} />
          }
          label={`${formatHHmm(session.start)} ~ ${formatHHmm(session.end)}`}
        />
        {session.room_name && (
          <InfoChip
            icon={
              <Ionicons
                name="location-outline"
                size={14}
                color={COLORS.white}
              />
            }
            label={session.room_name}
          />
        )}
        {session.program_name && (
          <InfoChip
            icon={
              <Ionicons
                name="document-text-outline"
                size={14}
                color={COLORS.white}
              />
            }
            label={session.program_name}
          />
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          marginTop: s(20),
          height: s(48),
          borderRadius: s(12),
          backgroundColor: COLORS.white,
          ...SHADOWS.card,
        }}
        className="flex-row items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={isStarted ? "녹음 시작" : "상담 상세보기"}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.primary500 }}
        >
          {isStarted ? "녹음 시작하기" : "상담 상세보기"}
        </Typography>
        <Ionicons
          name={isStarted ? "mic" : "arrow-forward"}
          size={s(18)}
          color={COLORS.primary500}
          style={{ marginLeft: s(6) }}
        />
      </TouchableOpacity>
    </View>
  );
}

function HeroEmpty({ personName }: { personName: string | null }) {
  return (
    <View style={{ paddingHorizontal: s(16), paddingBottom: s(32) }}>
      <View className="flex-row">
        <View className="flex-1" style={{ paddingTop: s(12) }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {personName ?? "선생"}님, {getGreeting()}
          </Typography>
          <Typography
            weight="semibold"
            style={{
              color: COLORS.white,
              fontSize: s(28),
              lineHeight: s(36),
              letterSpacing: -0.8,
              marginTop: s(8),
            }}
          >
            오늘 예정된{"\n"}상담이 없어요
          </Typography>
          <Typography
            variant="body-02"
            weight="regular"
            style={{ color: "rgba(255,255,255,0.85)", marginTop: s(8) }}
          >
            여유로운 하루 보내세요
          </Typography>
        </View>
        <ClockIllustration />
      </View>
    </View>
  );
}

function ClockIllustration() {
  return (
    <View
      style={{ width: s(108), height: s(108), marginLeft: s(8) }}
      className="items-center justify-center"
    >
      {/* 데코 큰 원 */}
      <View
        style={{
          position: "absolute",
          width: s(108),
          height: s(108),
          borderRadius: s(54),
          backgroundColor: "rgba(255,255,255,0.15)",
        }}
      />
      {/* 데코 작은 원 */}
      <View
        style={{
          position: "absolute",
          right: s(0),
          top: s(8),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "rgba(255,255,255,0.30)",
        }}
      />
      {/* 시계 본체 */}
      <View
        style={{
          width: s(76),
          height: s(76),
          borderRadius: s(38),
          backgroundColor: COLORS.white,
          ...SHADOWS.card,
        }}
        className="items-center justify-center"
      >
        <Ionicons name="time" size={s(40)} color={COLORS.primary500} />
      </View>
      {/* 스파클 액센트 */}
      <View style={{ position: "absolute", bottom: s(2), left: s(0) }}>
        <Ionicons name="sparkles" size={s(16)} color={ACCENT_YELLOW} />
      </View>
    </View>
  );
}

function InfoChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View
      style={{
        height: s(28),
        paddingHorizontal: s(10),
        borderRadius: s(14),
        backgroundColor: "rgba(255,255,255,0.18)",
        gap: s(4),
      }}
      className="flex-row items-center"
    >
      {icon}
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.white }}
      >
        {label}
      </Typography>
    </View>
  );
}

function MiniStatColored({
  value,
  label,
  accent,
  accentBg,
  iconName,
  ioniconsName,
}: {
  value: number;
  label: string;
  accent: string;
  accentBg: string;
  iconName?: React.ComponentProps<typeof Icon>["name"];
  ioniconsName?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: s(14),
        paddingHorizontal: s(12),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
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
          <Icon name={iconName} size={s(24)} color={accent} />
        ) : ioniconsName ? (
          <Ionicons name={ioniconsName} size={s(24)} color={accent} />
        ) : null}
      </View>
      <Typography
        variant="headline-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
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
    </View>
  );
}

function UnlinkedCta({
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
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(16) }}>
        <View
          style={{ width: s(64), height: s(64) }}
          className="items-center justify-center"
        >
          <View
            style={{
              position: "absolute",
              width: s(64),
              height: s(64),
              borderRadius: s(32),
              backgroundColor: COLORS.fieldnote,
              opacity: 0.12,
            }}
          />
          <Ionicons
            name="create-outline"
            size={s(28)}
            color={COLORS.fieldnote}
          />
          <View style={{ position: "absolute", top: s(4), right: s(4) }}>
            <Ionicons
              name="sparkles"
              size={s(12)}
              color={COLORS.fieldnote}
            />
          </View>
        </View>
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

      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          marginTop: s(16),
          height: s(48),
          borderRadius: s(12),
          backgroundColor: COLORS.fieldnote,
          opacity: pressed ? 0.92 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        })}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          필드노트로 작성하기
        </Typography>
        <Ionicons
          name="arrow-forward"
          size={s(18)}
          color={COLORS.white}
          style={{ marginLeft: s(6) }}
        />
      </Pressable>
    </View>
  );
}

function SimpleScheduleCard({
  schedule,
  isNext,
  onPress,
}: {
  schedule: ScheduleListItem;
  isNext: boolean;
  onPress: () => void;
}) {
  const primary = schedule.clients?.[0];
  const accent =
    schedule.schedule_type === "counseling"
      ? COLORS.counseling
      : schedule.schedule_type === "assessment"
        ? COLORS.assessment
        : COLORS.gray[400];

  const status = deriveStatus(schedule);
  const isInactive = status === "cancelled" || status === "no_show";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: s(16),
        padding: s(12),
        backgroundColor: COLORS.bg.surface,
        borderWidth: isNext ? 1.5 : 0,
        borderColor: isNext ? COLORS.primary500 : "transparent",
        opacity: isInactive ? 0.55 : 1,
        ...SHADOWS.card,
      }}
      className="flex-row items-center"
    >
      <View style={{ width: s(56) }}>
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-title-default"
        >
          {formatHHmm(schedule.start)}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          className="text-body-subtle"
          style={{ marginTop: s(2) }}
        >
          ~ {formatHHmm(schedule.end)}
        </Typography>
      </View>
      <View className="flex-1" style={{ paddingLeft: s(12) }}>
        {isNext && (
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.primary500, marginBottom: s(2) }}
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
              <Typography
                variant="label-01"
                weight="regular"
                className="text-body-subtle"
              >
                {primary.gender === "female" ? "여" : "남"} · 만{" "}
                {getAge(primary.birth_date)}세
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
            {schedule.title ??
              (schedule.schedule_type === "counseling" ? "상담" : "검사")}
          </Typography>
        )}
        <View
          className="flex-row items-center"
          style={{ marginTop: s(2), gap: s(6) }}
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
            {schedule.schedule_type === "counseling" ? "상담" : "검사"}
            {schedule.program_name ? ` · ${schedule.program_name}` : ""}
            {schedule.room_name ? ` · ${schedule.room_name}` : ""}
          </Typography>
        </View>
      </View>
    </TouchableOpacity>
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
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography
        variant="body-01"
        weight="semibold"
        className="text-body-strong"
      >
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
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography
        variant="body-02"
        weight="regular"
        className="text-label-default"
      >
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
