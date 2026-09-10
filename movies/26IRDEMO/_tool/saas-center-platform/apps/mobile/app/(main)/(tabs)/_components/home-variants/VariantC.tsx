import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import {
  SCHEDULE_TYPE_LABELS,
  type ScheduleListItem,
} from "@/features/schedule";
import { parseDate, formatTimeRange } from "@/shared/utils/date";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { getAge } from "../utils";
import type { HomeVariantProps } from "./types";

/**
 * 시안 C(파일) → 탭 'B' 친근 (Friendly) 톤
 *
 * 디자인 톤 & 매너(§0):
 * - 따뜻함·사람 중심·대화체
 * - 시간대별 mood 반영(아침/점심/저녁/밤) — 색감과 메시지 모두 변주
 * - 사용자 이름 적극 호명, 개인화된 감성
 * - 파스텔 그라데이션·이모지로 캐릭터성 부여
 * - 명언 카드로 따뜻한 한 마디
 *
 * 구성:
 * - 큰 그라데이션 hero (블러 원형 데코 + mood 이모지)
 * - 오늘의 한 마디 응원 카드
 * - 다음 상담: 부드러운 파스텔 카드 + 시그니처 그라데이션 액센트
 * - 오늘 일정 가로 스와이프 카드
 * - 이번주 무드 도넛 차트
 */
export function VariantC(props: HomeVariantProps) {
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

  const dailyQuote = useMemo(() => pickQuoteForDate(today), [today]);
  const greetingMood = useMemo(() => getMood(today), [today]);

  return (
    <View className="flex-1 bg-background">
      <TopBar
        centerName={centerName}
        unreadCount={unreadCount}
        onPressMyCenters={onPressMyCenters}
        onPressNotifications={onPressNotifications}
      />

      <ScrollView
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <HeroBlock
          personName={personName}
          today={today}
          mood={greetingMood}
        />

        {/* 오늘의 한 마디 */}
        <View style={{ marginTop: s(20), marginHorizontal: s(16) }}>
          <DailyQuoteCard text={dailyQuote.text} author={dailyQuote.author} />
        </View>

        {/* 잠시 후 만나실 분 */}
        <View style={{ marginTop: s(24), marginHorizontal: s(16) }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Typography variant="title-01" weight="semibold" className="text-title-default">
              잠시 후 만나실 분
            </Typography>
            <View
              style={{
                width: s(16),
                height: s(6),
                borderRadius: s(3),
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={["#a40ef4", "#45c9ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
          {nextSession ? (
            <NextSessionSoft session={nextSession} onPress={onPressNextSession} />
          ) : (
            <SoftEmpty
              emoji="🌷"
              title="예정된 상담이 없어요"
              subtitle="여유로운 하루 보내세요"
            />
          )}
        </View>

        {/* 오늘 만나실 분들 (가로 스와이프) */}
        <View style={{ marginTop: s(28) }}>
          <View
            style={{ marginHorizontal: s(16) }}
            className="mb-3 flex-row items-end justify-between"
          >
            <View className="flex-row items-baseline gap-2">
              <Typography variant="title-01" weight="semibold" className="text-title-default">
                오늘 만나실 분들
              </Typography>
              <Typography variant="label-01" className="text-body-subtle">
                {todaySchedules.length}명
              </Typography>
            </View>
            <TouchableOpacity onPress={onPressSchedulesAll} activeOpacity={0.7}>
              <View className="flex-row items-center gap-1">
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="text-state-brand"
                >
                  전체보기
                </Typography>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : isError ? (
            <View style={{ marginHorizontal: s(16) }}>
              <SoftEmpty
                emoji="🌥️"
                title="일정을 불러올 수 없어요"
                subtitle="다시 시도해주세요"
                action={{ text: "다시 시도", onPress: onRetry }}
              />
            </View>
          ) : todaySchedules.length === 0 ? (
            <View style={{ marginHorizontal: s(16) }}>
              <SoftEmpty
                emoji="☀️"
                title="오늘은 일정이 없어요"
                subtitle="충분히 쉬어가세요"
              />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: s(16),
                gap: s(12),
              }}
            >
              {todaySchedules.map((sch, idx) => (
                <SoftScheduleCard
                  key={sch.id}
                  schedule={sch}
                  accent={SOFT_PALETTE[idx % SOFT_PALETTE.length]}
                  onPress={() => onPressSchedule(sch.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* 이번주 무드 (도넛 + 합계) */}
        <View style={{ marginTop: s(28), marginHorizontal: s(16) }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Typography variant="title-01" weight="semibold" className="text-title-default">
              이번주 무드
            </Typography>
            <Typography variant="label-01" className="text-body-subtle">
              {weekStats.range}
            </Typography>
          </View>
          <WeekMoodCard
            counseling={weekStats.counseling}
            assessment={weekStats.assessment}
            unlinked={unlinkedCount}
            onPressUnlinked={
              unlinkedCount > 0 ? onPressFieldNoteList : undefined
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------------- Sub Components ---------------- */

// 웹 시그니처 4색 라이트 톤 (cyan / blue / mint / purple)
const SOFT_PALETTE = [
  { bg: "#E8F8FE", tint: COLORS.counseling, emoji: "🌊" },
  { bg: "#E8F0FF", tint: COLORS.assessment, emoji: "✨" },
  { bg: "#E0F6F4", tint: "#12C2B8", emoji: "🌿" },
  { bg: "#F3E5FF", tint: "#a40ef4", emoji: "🌷" },
];

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

function HeroBlock({
  personName,
  today,
  mood,
}: {
  personName: string | null;
  today: Date;
  mood: { emoji: string; gradient: [string, string, string]; line: string };
}) {
  return (
    <View
      style={{
        marginTop: s(12),
        marginHorizontal: s(16),
        borderRadius: s(28),
        overflow: "hidden",
        height: s(220),
      }}
    >
      <LinearGradient
        colors={mood.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, padding: s(24) }}
      >
        {/* 데코 블러 원 */}
        <View
          style={{
            position: "absolute",
            top: -s(50),
            right: -s(30),
            width: s(160),
            height: s(160),
            borderRadius: s(80),
            backgroundColor: "rgba(255,255,255,0.30)",
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -s(40),
            left: s(-20),
            width: s(120),
            height: s(120),
            borderRadius: s(60),
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: s(80),
            right: s(40),
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />

        {/* 큰 이모지 */}
        <View
          style={{
            position: "absolute",
            top: s(20),
            right: s(24),
          }}
        >
          <Typography style={{ fontSize: s(64), lineHeight: s(64) }}>
            {mood.emoji}
          </Typography>
        </View>

        {/* 텍스트 */}
        <View className="mt-auto">
          <Typography variant="label-01" weight="medium" className="text-body-strong">
            {format(today, "M월 d일 EEEE")}
          </Typography>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-1 text-title-default"
            style={{ fontSize: s(28), lineHeight: s(36) }}
          >
            {mood.line}
          </Typography>
          <Typography
            variant="body-01"
            weight="medium"
            className="mt-0.5 text-body-strong"
          >
            {personName ?? "선생"}님 🌱
          </Typography>
        </View>
      </LinearGradient>
    </View>
  );
}

function DailyQuoteCard({ text, author }: { text: string; author: string }) {
  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(16),
        paddingLeft: s(20),
        overflow: "hidden",
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      {/* 시그니처 그라데이션 accent bar (보라 → 시안) */}
      <LinearGradient
        colors={["#a40ef4", "#45c9ff"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          left: 0,
          top: s(18),
          bottom: s(18),
          width: s(4),
          borderRadius: s(2),
        }}
      />
      <View className="flex-row items-center gap-1.5">
        <View style={{ width: s(14), height: s(14) }} className="items-center justify-center">
          <Ionicons name="sparkles" size={s(14)} color={COLORS.assessment} />
        </View>
        <Typography variant="label-01" weight="semibold" className="text-body-subtle">
          오늘의 한 마디
        </Typography>
      </View>
      <Typography
        variant="body-01-reading"
        weight="regular"
        className="mt-2 text-body-strong"
      >
        "{text}"
      </Typography>
      <Typography variant="label-01" weight="regular" className="mt-2 text-body-subtle">
        — {author}
      </Typography>
    </View>
  );
}

function NextSessionSoft({
  session,
  onPress,
}: {
  session: ScheduleListItem;
  onPress: () => void;
}) {
  const primary = session.clients?.[0];
  const typeLabel =
    SCHEDULE_TYPE_LABELS[session.schedule_type] ?? session.schedule_type;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: s(20),
        overflow: "hidden",
        ...SHADOWS.card,
      }}
    >
      <LinearGradient
        colors={["#E8F8FE", "#F3E5FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: s(16) }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            {primary ? (
              <>
                <Typography
                  variant="headline-01"
                  weight="semibold"
                  className="text-title-default"
                >
                  {primary.name}
                </Typography>
                {primary.birth_date && (
                  <Typography
                    variant="body-02"
                    weight="medium"
                    className="mt-0.5 text-label-default"
                  >
                    만 {getAge(primary.birth_date)}세 ·{" "}
                    {primary.gender === "female" ? "여자아이" : "남자아이"}
                  </Typography>
                )}
              </>
            ) : (
              <Typography
                variant="headline-01"
                weight="semibold"
                className="text-title-default"
              >
                {session.title ?? typeLabel}
              </Typography>
            )}
          </View>
          {/* 시그니처 그라데이션 원형 액센트 */}
          <View
            style={{
              width: s(56),
              height: s(56),
              borderRadius: s(28),
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={["#a40ef4", "#45c9ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
              className="items-center justify-center"
            >
              <Ionicons name="heart" size={s(24)} color={COLORS.white} />
            </LinearGradient>
          </View>
        </View>

        <View
          style={{
            marginTop: s(16),
            padding: s(12),
            borderRadius: s(12),
            gap: s(6),
          }}
          className="bg-white/55"
        >
          <SoftMetaRow
            icon="time-outline"
            text={formatTimeRange(session.start, session.end)}
          />
          {session.room_name && (
            <SoftMetaRow icon="location-outline" text={session.room_name} />
          )}
          <SoftMetaRow
            icon="document-text-outline"
            text={`${typeLabel}${session.program_name ? ` · ${session.program_name}` : ""}`}
          />
        </View>

        <View
          style={{ marginTop: s(14) }}
          className="flex-row items-center justify-end gap-1"
        >
          <Typography variant="body-03" weight="semibold" className="text-body-strong">
            상담 준비하기
          </Typography>
          <Ionicons name="arrow-forward" size={s(16)} color={COLORS.gray[700]} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SoftMetaRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={{ gap: s(8) }} className="flex-row items-center">
      <Ionicons name={icon} size={s(15)} color={COLORS.gray[600]} />
      <Typography variant="body-03" weight="medium" className="text-body-strong">
        {text}
      </Typography>
    </View>
  );
}

function SoftScheduleCard({
  schedule,
  accent,
  onPress,
}: {
  schedule: ScheduleListItem;
  accent: (typeof SOFT_PALETTE)[number];
  onPress: () => void;
}) {
  const primary = schedule.clients?.[0];
  const typeLabel =
    SCHEDULE_TYPE_LABELS[schedule.schedule_type] ?? schedule.schedule_type;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: s(220),
        height: s(180),
        borderRadius: s(16),
        padding: s(16),
        backgroundColor: accent.bg,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View
          style={{
            paddingHorizontal: s(10),
            paddingVertical: s(4),
            borderRadius: s(999),
            backgroundColor: "rgba(255,255,255,0.65)",
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: accent.tint }}
          >
            {format(parseDate(schedule.start), "HH:mm")}
          </Typography>
        </View>
        <Typography style={{ fontSize: s(28) }}>{accent.emoji}</Typography>
      </View>

      <View className="mt-auto">
        {primary ? (
          <Typography variant="title-01" weight="semibold" className="text-title-default">
            {primary.name}
          </Typography>
        ) : (
          <Typography variant="title-01" weight="semibold" className="text-title-default">
            {schedule.title ?? typeLabel}
          </Typography>
        )}
        <Typography
          variant="label-01"
          weight="medium"
          className="mt-1 text-body-strong"
          numberOfLines={1}
        >
          {typeLabel}
          {schedule.program_name ? ` · ${schedule.program_name}` : ""}
        </Typography>
        {schedule.room_name && (
          <Typography
            variant="label-02"
            className="mt-0.5 text-label-default"
            numberOfLines={1}
          >
            📍 {schedule.room_name}
          </Typography>
        )}
      </View>
    </TouchableOpacity>
  );
}

function WeekMoodCard({
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
  const total = counseling + assessment;

  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(16),
        gap: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="flex-row items-center"
    >
      <DonutChart counseling={counseling} assessment={assessment} />

      <View className="flex-1" style={{ gap: s(10) }}>
        <MoodLegendRow
          color={COLORS.counseling}
          label="상담"
          value={counseling}
          ratio={total > 0 ? counseling / total : 0}
        />
        <MoodLegendRow
          color={COLORS.assessment}
          label="검사"
          value={assessment}
          ratio={total > 0 ? assessment / total : 0}
        />
        {unlinked > 0 && (
          <TouchableOpacity
            onPress={onPressUnlinked}
            activeOpacity={0.7}
            style={{
              marginTop: s(6),
              paddingHorizontal: s(10),
              paddingVertical: s(6),
              borderRadius: s(10),
            }}
            className="flex-row items-center gap-1.5 bg-red-50"
          >
            <Typography style={{ fontSize: s(13) }}>📝</Typography>
            <Typography variant="label-01" weight="semibold" className="text-status-danger">
              미작성 일지 {unlinked}건
            </Typography>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MoodLegendRow({
  color,
  label,
  value,
  ratio,
}: {
  color: string;
  label: string;
  value: number;
  ratio: number;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View
            style={{
              width: s(10),
              height: s(10),
              borderRadius: s(5),
              backgroundColor: color,
            }}
          />
          <Typography variant="body-03" weight="medium" className="text-body-strong">
            {label}
          </Typography>
        </View>
        <Typography variant="body-03" weight="semibold" className="text-title-default">
          {value}건
        </Typography>
      </View>
      <View
        style={{
          marginTop: s(4),
          height: s(4),
          borderRadius: s(2),
        }}
        className="bg-gray-100 overflow-hidden"
      >
        <View
          style={{
            width: `${Math.max(2, ratio * 100)}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: s(2),
          }}
        />
      </View>
    </View>
  );
}

function DonutChart({
  counseling,
  assessment,
}: {
  counseling: number;
  assessment: number;
}) {
  const size = s(100);
  const stroke = s(14);
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = counseling + assessment;
  const counselingArc = total > 0 ? (counseling / total) * circumference : 0;
  const assessmentArc = total > 0 ? (assessment / total) * circumference : 0;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke="#EEF1F2"
            strokeWidth={stroke}
            fill="none"
          />
          {total > 0 && (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={COLORS.counseling}  
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${counselingArc} ${circumference}`}
                strokeLinecap="round"
              />
              <Circle
                cx={cx}
                cy={cy}
                r={radius}
                stroke={COLORS.assessment}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${assessmentArc} ${circumference}`}
                strokeDashoffset={-counselingArc}
                strokeLinecap="round"
              />
            </>
          )}
        </G>
      </Svg>
      <View style={{ position: "absolute" }} className="items-center">
        <Typography variant="headline-02" weight="semibold" className="text-title-default">
          {total}
        </Typography>
        <Typography variant="label-02" className="text-body-subtle">
          이번주
        </Typography>
      </View>
    </View>
  );
}

function SoftEmpty({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  action?: { text: string; onPress: () => void };
}) {
  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(24),
        gap: s(8),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography style={{ fontSize: s(36) }}>{emoji}</Typography>
      <Typography variant="body-01" weight="semibold" className="text-body-strong">
        {title}
      </Typography>
      <Typography variant="body-03" weight="regular" className="text-body-subtle">
        {subtitle}
      </Typography>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          activeOpacity={0.7}
          style={{
            marginTop: s(8),
            height: s(48),
            paddingHorizontal: s(24),
            borderRadius: s(12),
          }}
          className="bg-primary items-center justify-center"
        >
          <Typography variant="body-01" weight="semibold" className="text-state-inverse">
            {action.text}
          </Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------------- Helpers (display only) ---------------- */

function getMood(date: Date): {
  emoji: string;
  gradient: [string, string, string];
  line: string;
} {
  const hour = date.getHours();
  // 시그니처 라이트 톤: 보라(#a40ef4)·시안(#45c9ff)·블루(#4C87F6)·민트(#12C2B8) 계열
  if (hour >= 5 && hour < 12) {
    return {
      emoji: "🌤️",
      gradient: ["#F3E5FF", "#E8F4FF", "#E8F8FE"],
      line: "오늘도 따뜻하게",
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      emoji: "🌿",
      gradient: ["#E8F8FE", "#E0F6F4", "#E8F0FF"],
      line: "활기찬 오후예요",
    };
  }
  if (hour >= 18 && hour < 22) {
    return {
      emoji: "🌙",
      gradient: ["#F3E5FF", "#E8F0FF", "#E8F4FF"],
      line: "고생 많으셨어요",
    };
  }
  return {
    emoji: "✨",
    gradient: ["#1D2227", "#2D333B", "#3D2F58"],
    line: "조용한 밤이에요",
  };
}

const QUOTES = [
  { text: "들어주는 것만으로도 큰 위로가 됩니다.", author: "칼 로저스" },
  { text: "공감은 가장 강력한 치료 도구입니다.", author: "어빈 얄롬" },
  { text: "변화는 안전한 관계에서 시작됩니다.", author: "다니엘 시겔" },
  { text: "당신이 느끼는 모든 감정은 정당합니다.", author: "—" },
  { text: "함께 있어주는 것, 그것이 출발점입니다.", author: "—" },
  { text: "오늘 한 사람의 이야기는 그 사람의 전부입니다.", author: "—" },
  { text: "작은 호기심이 큰 통찰로 이어집니다.", author: "—" },
];

function pickQuoteForDate(date: Date) {
  // 날짜 기반 deterministic 선택 (날마다 다른 명언)
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return QUOTES[dayOfYear % QUOTES.length];
}
