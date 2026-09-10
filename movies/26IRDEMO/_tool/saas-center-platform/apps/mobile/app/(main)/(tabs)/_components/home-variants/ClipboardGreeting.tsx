import { useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { differenceInMinutes, format } from "date-fns";
import { COLORS, LAYOUT, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { parseDate } from "@/shared/utils/date";
import type { ScheduleListItem } from "@/features/schedule";
import { getAge, deriveStatus } from "../utils";
import type { HomeVariantProps } from "./types";

/**
 * 홈 시안 — 클립보드 인사 (Light)
 *
 * 톤: 옅은 primary tint(#f4f8ff) 페이지 + 흰 카드 + 보라 그라디언트 필드노트 CTA.
 * 구조: 헤더 → 날짜·2줄 인사·클립보드 일러스트 → 다음 상담 카운트다운 카드
 *       → 오늘 일정 컴팩트 불릿 카드 → 필드노트 녹음 CTA.
 *
 * Lab `home-clipboard-greeting.tsx`의 Variant A를 실데이터(HomeVariantProps)로
 * 옮긴 것 — 디자인 결정·매핑 근거는 동일 문서 참조.
 */
export function ClipboardGreeting(props: HomeVariantProps) {
  const insets = useSafeAreaInsets();
  const {
    centerName,
    personName,
    today,
    nextSession,
    todaySchedules,
    unreadCount,
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

  // 날짜 텍스트는 부모(HomeScreen)에서 한글 locale로 포맷한 값을 그대로 사용
  const dateText = props.dateStr;

  const counts = useMemo(() => {
    let counseling = 0;
    let assessment = 0;
    for (const sch of todaySchedules) {
      if (sch.schedule_type === "counseling") counseling += 1;
      else if (sch.schedule_type === "assessment") assessment += 1;
    }
    return { counseling, assessment };
  }, [todaySchedules]);

  // 페이지 배경
  const pageBg = COLORS.bg.selected;

  return (
    <View className="flex-1" style={{ backgroundColor: pageBg }}>
      <ScrollView
        // 하단 floating CTA가 콘텐츠를 가리지 않도록 충분한 padding 확보
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(120) }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.primary500}
          />
        }
      >
        <SafeAreaView edges={["top"]}>
          <HomeHeader
            centerName={centerName}
            unreadCount={unreadCount}
            onPressMyCenters={onPressMyCenters}
            onPressNotifications={onPressNotifications}
          />

          <HeroBlock
            personName={personName}
            dateText={dateText}
            today={today}
            counselingCount={counts.counseling}
            assessmentCount={counts.assessment}
          />
        </SafeAreaView>

        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            gap: s(12),
          }}
        >
          {isLoading ? (
            <View
              style={{
                paddingVertical: s(40),
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={COLORS.primary500} />
            </View>
          ) : isError ? (
            <ErrorBlock onRetry={onRetry} />
          ) : (
            <>
              {todaySchedules.length === 0 ? (
                // 오늘 일정이 아예 없으면 빈 상태 카드 하나로 통합
                // ("다음 일정 없음" + "오늘 일정 없음"이 중복되므로)
                <NoNextSessionCard variant="no-today" />
              ) : (
                <>
                  {nextSession ? (
                    <NextSessionCard
                      schedule={nextSession}
                      today={today}
                      onPress={onPressNextSession}
                    />
                  ) : (
                    // 오늘 일정은 있지만 다음 예정은 없음 = 모두 완료
                    <NoNextSessionCard variant="all-done" />
                  )}
                  <TodayBulletsCard
                    schedules={todaySchedules}
                    onPressAll={onPressSchedulesAll}
                    onPressItem={onPressSchedule}
                  />
                </>
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* 노치 영역 — 스크롤·바운스 무관하게 항상 페이지 톤 유지 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: pageBg,
        }}
      />

      {/* 플로팅 필드노트 CTA — 페이지 하단 고정, 최상위 depth.
          pointerEvents box-none → 좌우 padding 영역은 아래 ScrollView로 터치 통과 */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(12),
          paddingBottom: s(16),
        }}
      >
        <FieldnoteCta
          clientName={nextSession?.clients?.[0]?.name ?? null}
          onPress={
            nextSession ? onPressNextSessionRecord : onPressFieldNoteList
          }
        />
      </View>
    </View>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function HomeHeader({
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
        height: s(56),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity
        onPress={onPressMyCenters}
        hitSlop={8}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(8),
          flex: 1,
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.primary75,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={14}
            color={COLORS.primary700}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default, flexShrink: 1 }}
          numberOfLines={1}
        >
          {centerName ?? "센터 선택"}
        </Typography>
        <Ionicons name="chevron-down" size={16} color={COLORS.gray[500]} />
      </TouchableOpacity>

      <Pressable
        onPress={onPressNotifications}
        hitSlop={6}
        style={{ padding: s(4) }}
      >
        <View>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.gray[800]}
          />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: s(8),
                height: s(8),
                borderRadius: s(4),
                backgroundColor: COLORS.negative,
                borderWidth: 1.5,
                borderColor: COLORS.bg.selected,
              }}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function getTimeGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 6) return "조용한 새벽이에요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "활기찬 오후예요";
  if (h < 22) return "편안한 저녁이에요";
  return "포근한 밤이에요";
}

function HeroBlock({
  personName,
  dateText,
  today,
  counselingCount,
  assessmentCount,
}: {
  personName: string | null;
  dateText: string;
  today: Date;
  counselingCount: number;
  assessmentCount: number;
}) {
  const greeting = getTimeGreeting(today);
  const showStats = counselingCount > 0 || assessmentCount > 0;

  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(8),
        paddingBottom: s(20),
        flexDirection: "row",
      }}
    >
      <View style={{ flex: 1, gap: s(8) }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.gray[500] }}
        >
          {dateText}
        </Typography>
        <Typography
          weight="bold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(26),
            lineHeight: s(36),
            letterSpacing: -0.8,
          }}
        >
          {personName ?? "선생"}님,{"\n"}
          {greeting}
        </Typography>

        {showStats && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(12),
              marginTop: s(8),
            }}
          >
            {counselingCount > 0 && (
              <StatDot
                color={COLORS.counseling}
                label={`상담 ${counselingCount}건`}
              />
            )}
            {assessmentCount > 0 && (
              <StatDot
                color={COLORS.assessment}
                label={`검사 ${assessmentCount}건`}
              />
            )}
          </View>
        )}
      </View>

      <ClipboardIllustration />
    </View>
  );
}

function StatDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
      <View
        style={{
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: color,
        }}
      />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        {label}
      </Typography>
    </View>
  );
}

function ClipboardIllustration() {
  return (
    <View style={{ width: s(100), height: s(110), marginLeft: s(4) }}>
      <View
        style={{
          position: "absolute",
          right: s(4),
          top: s(14),
          width: s(86),
          height: s(86),
          borderRadius: s(43),
          backgroundColor: COLORS.primary75,
        }}
      />

      <View
        style={{
          position: "absolute",
          right: s(10),
          top: s(20),
          width: s(72),
          height: s(86),
          borderRadius: s(10),
          backgroundColor: COLORS.white,
          ...SHADOWS.card,
          padding: s(10),
          paddingTop: s(18),
          gap: s(6),
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: s(-8),
            left: s(20),
            width: s(32),
            height: s(12),
            borderRadius: s(4),
            backgroundColor: COLORS.primary75,
          }}
        />
        <View
          style={{
            width: "80%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.primary100,
          }}
        />
        <View
          style={{
            width: "60%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.primary100,
          }}
        />
        <View
          style={{
            width: "70%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.primary100,
          }}
        />
        <View
          style={{
            position: "absolute",
            right: s(8),
            bottom: s(8),
            width: s(20),
            height: s(20),
            borderRadius: s(10),
            backgroundColor: COLORS.primary500,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={12} color={COLORS.white} />
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          right: s(2),
          top: s(64),
          width: s(36),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: COLORS.primary400,
          transform: [{ rotate: "28deg" }],
        }}
      />
      <Ionicons
        name="sparkles"
        size={14}
        color={COLORS.primary500}
        style={{ position: "absolute", right: s(0), top: s(8) }}
      />
    </View>
  );
}

/* ───────────────────────── Next Session Card ───────────────────────── */

function NextSessionCard({
  schedule,
  today,
  onPress,
}: {
  schedule: ScheduleListItem;
  today: Date;
  onPress: () => void;
}) {
  const primary = schedule.clients?.[0];
  const start = parseDate(schedule.start);
  const status = deriveStatus(schedule);

  // "now" 기준 카운트다운 — today prop은 컴포넌트 마운트 시점 고정값이므로
  // 분 단위 정확도엔 충분하지만, 정밀도가 필요하면 new Date() 사용 가능
  const minutes = useMemo(() => {
    return differenceInMinutes(start, today);
  }, [start, today]);

  const isCounseling = schedule.schedule_type === "counseling";
  const accent = isCounseling ? COLORS.counseling : COLORS.assessment;
  const accentBg = isCounseling
    ? COLORS.counselingLight
    : COLORS.assessmentLight;
  const typeLabel = isCounseling ? "상담" : "검사";

  const age = primary?.birth_date != null ? getAge(primary.birth_date) : null;
  const genderText =
    primary?.gender === "female"
      ? "여"
      : primary?.gender === "male"
        ? "남"
        : null;

  const countdownLabel =
    status === "in_progress"
      ? "지금 상담이 진행 중이에요"
      : formatCountdownPhrase(minutes, typeLabel);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`다음 ${typeLabel}: ${primary?.name ?? ""}`}
    >
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(20),
          padding: s(20),
          gap: s(12),
        }}
      >
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          {countdownLabel}
        </Typography>

        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}
        >
          <View
            style={{
              width: s(32),
              height: s(32),
              borderRadius: s(10),
              backgroundColor: accentBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={isCounseling ? "counseling-20" : "assessment-20"}
              size={s(18)}
              color={accent}
            />
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default, flex: 1 }}
            numberOfLines={1}
          >
            {primary?.name
              ? `${primary.name}님의 ${typeLabel}`
              : schedule.title ?? typeLabel}
          </Typography>
        </View>

        {(genderText || age !== null) && primary && (
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {genderText ?? ""}
            {genderText && age !== null ? "  |  " : ""}
            {age !== null ? `만 ${age}세` : ""}
          </Typography>
        )}

        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginVertical: s(2),
          }}
        />

        <View style={{ gap: s(8) }}>
          {schedule.room_name && (
            <MetaRow icon="location-20" text={schedule.room_name} />
          )}
          {schedule.program_name && (
            <MetaRow icon="document-20" text={schedule.program_name} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function MetaRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
      <Icon name={icon} size={s(16)} color={COLORS.gray[500]} />
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.strong, flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

function formatCountdownPhrase(minutes: number, typeLabel: string): string {
  if (minutes <= 0) return `지금 ${typeLabel}이 시작됐어요`;
  if (minutes < 60) return `${minutes}분 뒤에 ${typeLabel}이 시작돼요`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 뒤에 ${typeLabel}이 시작돼요`;
  return `${h}시간 ${m}분 뒤에 ${typeLabel}이 시작돼요`;
}

/**
 * 다음 예정된 일정이 없을 때의 빈 상태 카드.
 * - `no-today`: 오늘 일정이 애초에 없는 상태
 * - `all-done`: 오늘 일정이 있었지만 모두 종료된 상태
 * 상단 영역은 "다음 예정된 일정"(상담·검사 모두 포함) 기준이므로 "상담"으로 한정하지 않는다.
 */
function NoNextSessionCard({
  variant,
}: {
  variant: "no-today" | "all-done";
}) {
  const isNoToday = variant === "no-today";
  const title = isNoToday
    ? "오늘은 일정이 없어요"
    : "오늘 일정을 모두 마쳤어요";
  const subtitle = isNoToday
    ? "여유롭게 쉬어가세요"
    : "수고 많으셨어요";

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        alignItems: "center",
        gap: s(6),
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.text.body.strong }}
      >
        {title}
      </Typography>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.body.subtle }}
      >
        {subtitle}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Today Bullets Card ───────────────────────── */

const BULLETS_MAX = 4;

function TodayBulletsCard({
  schedules,
  onPressAll,
  onPressItem,
}: {
  schedules: ScheduleListItem[];
  onPressAll: () => void;
  onPressItem: (id: string) => void;
}) {
  const visible = schedules.slice(0, BULLETS_MAX);
  const hiddenCount = schedules.length - visible.length;

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(14),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          오늘 일정
        </Typography>
        <Pressable onPress={onPressAll} hitSlop={6}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            전체보기
          </Typography>
        </Pressable>
      </View>

      <View>
        {visible.map((sch, i) => (
          <View key={sch.id}>
            <BulletRow
              schedule={sch}
              index={i}
              onPress={() => onPressItem(sch.id)}
            />
            {i < visible.length - 1 && <BulletConnector />}
          </View>
        ))}
        {hiddenCount > 0 && (
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle, marginTop: s(10) }}
          >
            외 {hiddenCount}건
          </Typography>
        )}
      </View>
    </View>
  );
}

/**
 * 오늘 일정 타임라인 dot 색상 — index 회전.
 * 일정 유형(counseling/assessment) 매핑이 아니라 시각적 단조로움 완화를 위한 다양화.
 * §Extended Palette Solid 색상에서 부드러운 톤 4색 선정.
 */
const TIMELINE_DOT_PALETTE = [
  COLORS.palette.orange,
  COLORS.palette.mint,
  COLORS.palette.violet,
  COLORS.palette.coral,
] as const;

const TIMELINE_DOT_SIZE = 12;

/** dot 사이를 잇는 1px 세로 라인 — dot 중심(x = s(12)/2)에 정렬 */
function BulletConnector() {
  return (
    <View
      style={{
        width: 1,
        height: s(10),
        marginLeft: s(TIMELINE_DOT_SIZE) / 2 - 0.5,
        backgroundColor: COLORS.gray[200],
      }}
    />
  );
}

function BulletRow({
  schedule,
  index,
  onPress,
}: {
  schedule: ScheduleListItem;
  index: number;
  onPress: () => void;
}) {
  const isCounseling = schedule.schedule_type === "counseling";
  const dotColor =
    TIMELINE_DOT_PALETTE[index % TIMELINE_DOT_PALETTE.length];
  const typeLabel = isCounseling ? "상담" : schedule.program_name ?? "검사";
  const primary = schedule.clients?.[0];
  const status = deriveStatus(schedule);
  const isCancelled = status === "cancelled";

  // 백엔드 ScheduleListItem 타입엔 아직 cancel_reason 미노출 — 안전 캐스트로 읽음.
  // SessionSummary에는 존재(apps/api .../counseling_session/schemas.py)하므로
  // list 응답에 필드 노출되면 자동 반영.
  const cancelReason = isCancelled
    ? (schedule as unknown as { cancel_reason?: string | null })
        .cancel_reason ?? null
    : null;
  const showReason = isCancelled && !!cancelReason;

  const startText = format(parseDate(schedule.start), "HH:mm");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(12),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {/* dot — 첫 줄 텍스트 중심에 정렬 (line-height 22 → marginTop 5) */}
      <View
        style={{
          width: s(TIMELINE_DOT_SIZE),
          height: s(TIMELINE_DOT_SIZE),
          borderRadius: s(TIMELINE_DOT_SIZE / 2),
          backgroundColor: dotColor,
          marginTop: s(5),
          opacity: isCancelled ? 0.55 : 1,
        }}
      />
      <View style={{ flex: 1, gap: s(4) }}>
        {/* 1행: 시간 + 이름 — 취소 시 dim */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
            opacity: isCancelled ? 0.55 : 1,
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{
              color: COLORS.text.title.default,
              fontVariant: ["tabular-nums"],
              minWidth: s(52),
            }}
          >
            {startText}
          </Typography>
          <Typography
            variant="body-02"
            weight="regular"
            style={{
              color: COLORS.text.body.strong,
              flex: 1,
              textDecorationLine: isCancelled ? "line-through" : "none",
              textDecorationColor: COLORS.gray[400],
            }}
            numberOfLines={1}
          >
            {primary?.name ?? schedule.title ?? ""} {typeLabel}
          </Typography>
        </View>
        {/* 2행: 취소 사유 — dim 적용 안 함(가독성) */}
        {showReason && (
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
            numberOfLines={2}
          >
            취소 · {cancelReason}
          </Typography>
        )}
      </View>
    </Pressable>
  );
}

/* ───────────────────────── Fieldnote CTA ───────────────────────── */

function FieldnoteCta({
  clientName,
  onPress,
}: {
  clientName: string | null;
  onPress: () => void;
}) {
  const title = clientName
    ? `${clientName}님의 상담을 기록해보세요`
    : "필드노트로 기록해보세요";

  return (
    <View
      style={{
        borderRadius: s(20),
        shadowColor: "#7B79FF",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="필드노트 녹음 시작"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
      >
        <LinearGradient
          colors={["#A56EFF", "#7B79FF", "#219EFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: s(20),
            paddingVertical: s(16),
            paddingHorizontal: s(20),
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
          }}
        >
          <View style={{ flex: 1, gap: s(2) }}>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.white }}
              numberOfLines={1}
            >
              {title}
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: "rgba(255,255,255,0.85)" }}
              numberOfLines={1}
            >
              필드노트가 대화를 정리해드려요
            </Typography>
          </View>
          <RecordPill />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function RecordPill() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        backgroundColor: COLORS.white,
        paddingHorizontal: s(14),
        paddingVertical: s(10),
        borderRadius: s(999),
      }}
    >
      <View
        style={{
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: COLORS.negative,
        }}
      />
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

/* ───────────────────────── Error ───────────────────────── */

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(24),
        alignItems: "center",
      }}
    >
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.label.default }}
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.text.body.strong }}
        >
          다시 시도
        </Typography>
      </TouchableOpacity>
    </View>
  );
}
