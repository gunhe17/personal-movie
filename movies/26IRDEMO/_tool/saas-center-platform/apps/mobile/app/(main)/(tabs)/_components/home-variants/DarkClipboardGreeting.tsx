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
import { format } from "date-fns";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { s } from "@/shared/utils/scale";
import { parseDate } from "@/shared/utils/date";
import type { ScheduleListItem } from "@/features/schedule";
import { getAge, deriveStatus } from "../utils";
import type { HomeVariantProps } from "./types";

/** 시간대별 인사말 — 텍스트 결정용 helper. */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "좋은 아침이에요";
  if (h < 18) return "활기찬 오후예요";
  if (h < 22) return "좋은 저녁이에요";
  return "고요한 밤이에요";
}

/**
 * 홈 시안 — 다크 톤 (Dark · bankcow reference)
 *
 * 구조: 다크 페이지(gray-900) → 흰 헤드라인 + 내담자 3명 컬러 아바타 → 다크 pill CTA
 *       → 하단 raised 흰 시트 (다음 상담 큰 시간 + 오늘 일정 불릿 + 필드노트 CTA)
 *
 * Lab `home-clipboard-greeting.tsx` Variant C를 실데이터(HomeVariantProps)로 이식.
 * 디자인 결정·매핑 근거는 동일 문서 참조.
 */
export function DarkClipboardGreeting(props: HomeVariantProps) {
  const insets = useSafeAreaInsets();
  const {
    centerName,
    personName,
    dateStr,
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
    onPressFieldNoteList,
    onRetry,
  } = props;

  const counts = useMemo(() => {
    let counseling = 0;
    let assessment = 0;
    for (const sch of todaySchedules) {
      if (sch.schedule_type === "counseling") counseling += 1;
      else if (sch.schedule_type === "assessment") assessment += 1;
    }
    return { counseling, assessment };
  }, [todaySchedules]);

  const pageBg = COLORS.gray[900];

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <ScrollView
        // 하단 floating CTA가 콘텐츠를 가리지 않도록 충분한 padding 확보
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(120) }}
        style={{ backgroundColor: COLORS.white }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.white}
          />
        }
      >
        {/* 다크 박스 — 헤더 + Hero만 다크. 흰 시트 아래는 페이지 white 배경이 자연스럽게 이어짐 */}
        <View style={{ backgroundColor: pageBg }}>
          <SafeAreaView edges={["top"]}>
            <DarkHeader
              centerName={centerName}
              unreadCount={unreadCount}
              onPressMyCenters={onPressMyCenters}
              onPressNotifications={onPressNotifications}
            />

            <DarkHero
              personName={personName}
              dateText={dateStr}
              counselingCount={counts.counseling}
              assessmentCount={counts.assessment}
            />
          </SafeAreaView>
        </View>

        {/* 하단 raised 흰 시트 — flexGrow:1 로 화면 끝까지 흰 영역 채움 */}
        <RaisedWhiteSheet
          isLoading={isLoading}
          isError={isError}
          nextSession={nextSession}
          schedules={todaySchedules}
          onPressNext={onPressNextSession}
          onPressItem={onPressSchedule}
          onRetry={onRetry}
        />
      </ScrollView>

      {/* 노치 영역 — 스크롤 무관하게 항상 다크 톤 유지 */}
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
        <DarkFieldnoteCta
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

function DarkHeader({
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
            backgroundColor: "rgba(255,255,255,0.10)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={14}
            color={COLORS.white}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.white, flexShrink: 1 }}
          numberOfLines={1}
        >
          {centerName ?? "센터 선택"}
        </Typography>
        <Ionicons
          name="chevron-down"
          size={16}
          color="rgba(255,255,255,0.6)"
        />
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
            color={COLORS.white}
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
                borderColor: COLORS.gray[900],
              }}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function DarkHero({
  personName,
  dateText,
  counselingCount,
  assessmentCount,
}: {
  personName: string | null;
  dateText: string;
  counselingCount: number;
  assessmentCount: number;
}) {
  const name = personName ?? "선생";
  const greeting = getGreeting();
  const showStats = counselingCount > 0 || assessmentCount > 0;

  return (
    <View
      style={{
        paddingTop: s(12),
        // 상담/검사 카운트 텍스트 아래 24px 여백 + 화이트 시트가 위로 28px 끌어올려지므로
        // 다크 영역이 시트의 borderTopRadius(28)를 완전히 감싸도록 24 + 28 = 52
        paddingBottom: s(52),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(12),
      }}
    >
      <View style={{ flex: 1, paddingTop: s(4), gap: s(8) }}>
        {/* 날짜 — 히어로 문구 위 */}
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {dateText}
        </Typography>

        {/* 히어로 문구 */}
        <Typography
          weight="bold"
          style={{
            color: COLORS.white,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -0.8,
          }}
        >
          {name}님,{"\n"}
          <Typography
            weight="bold"
            style={{
              color: COLORS.primary300,
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -0.8,
            }}
          >
            {greeting}
          </Typography>
        </Typography>

        {/* 오늘 상담/검사 개수 — 히어로 문구 아래 */}
        {showStats && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(12),
              marginTop: s(4),
            }}
          >
            {counselingCount > 0 && (
              <DarkStatDot
                color={COLORS.counseling}
                label={`상담 ${counselingCount}건`}
              />
            )}
            {assessmentCount > 0 && (
              <DarkStatDot
                color={COLORS.assessment}
                label={`검사 ${assessmentCount}건`}
              />
            )}
          </View>
        )}
      </View>
      <SunCloudIllustration />
    </View>
  );
}

function DarkStatDot({ color, label }: { color: string; label: string }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
    >
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
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        {label}
      </Typography>
    </View>
  );
}

/** 다크 배경에 어울리는 sun + cloud + sparkle 일러스트. */
function SunCloudIllustration() {
  const SIZE = s(112);
  return (
    <View style={{ width: SIZE, height: SIZE, position: "relative" }}>
      {[
        { top: 2, left: SIZE / 2 - 1, w: 2, h: 8, deg: 0 },
        { top: 12, left: SIZE - 16, w: 2, h: 7, deg: 45 },
        { top: SIZE / 2 - 18, left: SIZE - 4, w: 8, h: 2, deg: 0 },
        { top: 12, left: 10, w: 2, h: 7, deg: -45 },
        { top: SIZE / 2 - 18, left: -2, w: 8, h: 2, deg: 0 },
      ].map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.top,
            left: r.left,
            width: r.w,
            height: r.h,
            borderRadius: 2,
            backgroundColor: "rgba(255,216,107,0.55)",
            transform: [{ rotate: `${r.deg}deg` }],
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          top: s(16),
          left: SIZE / 2 - s(34),
          width: s(68),
          height: s(68),
          borderRadius: s(34),
          backgroundColor: "rgba(255,216,107,0.18)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: s(24),
          left: SIZE / 2 - s(26),
          width: s(52),
          height: s(52),
          borderRadius: s(26),
          backgroundColor: "#FFD86B",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: s(30),
          left: SIZE / 2 - s(20),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "#FFE699",
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(8),
          left: s(4),
          width: s(38),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(16),
          left: s(18),
          width: s(34),
          height: s(34),
          borderRadius: s(17),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(12),
          left: s(44),
          width: s(40),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(8),
          left: s(10),
          width: s(76),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: s(6),
          left: s(14),
          width: s(5),
          height: s(5),
          borderRadius: s(2.5),
          backgroundColor: "rgba(255,255,255,0.85)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: s(18),
          right: s(8),
          width: s(4),
          height: s(4),
          borderRadius: s(2),
          backgroundColor: "rgba(255,255,255,0.7)",
        }}
      />
    </View>
  );
}


/* ───────────────────────── Raised White Sheet ───────────────────────── */

function RaisedWhiteSheet({
  isLoading,
  isError,
  nextSession,
  schedules,
  onPressNext,
  onPressItem,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  nextSession: ScheduleListItem | null;
  schedules: ScheduleListItem[];
  onPressNext: () => void;
  onPressItem: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: s(28),
        borderTopRightRadius: s(28),
        // 다크 영역 위로 28px(=borderTopRadius) 끌어올려 radius 곡선이 다크 배경 안에 완전히 감싸이도록.
        // 다크 영역의 paddingBottom(52) - overlap(28) = 24px 가 stats 텍스트 아래 여백으로 남음.
        marginTop: s(-28),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(24),
        paddingBottom: s(24),
        gap: s(20),
        minHeight: s(360),
      }}
    >
      {isLoading ? (
        <View style={{ paddingVertical: s(40), alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary500} />
        </View>
      ) : isError ? (
        <ErrorBlock onRetry={onRetry} />
      ) : (
        <>
          {nextSession ? (
            <NextSessionSection
              schedule={nextSession}
              onPressMore={onPressNext}
            />
          ) : (
            <NoNextSessionSection />
          )}

          <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

          {schedules.length > 0 ? (
            <TodaySchedulesList
              schedules={schedules}
              onPressItem={onPressItem}
            />
          ) : (
            <EmptyTodayInline />
          )}
        </>
      )}
    </View>
  );
}

function NextSessionSection({
  schedule,
  onPressMore,
}: {
  schedule: ScheduleListItem;
  onPressMore: () => void;
}) {
  const primary = schedule.clients?.[0];
  const age = primary?.birth_date ? getAge(primary.birth_date) : null;
  const genderText =
    primary?.gender === "female"
      ? "여"
      : primary?.gender === "male"
        ? "남"
        : null;
  const typeLabel =
    schedule.schedule_type === "counseling" ? "상담" : "검사";

  const startText = format(parseDate(schedule.start), "HH:mm");
  const endText = format(parseDate(schedule.end), "HH:mm");

  return (
    <View style={{ gap: s(8) }}>
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        다음 상담
      </Typography>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: s(8),
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.text.title.default,
              fontSize: s(36),
              lineHeight: s(40),
              letterSpacing: -1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {startText}
          </Typography>
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            ~ {endText}
          </Typography>
        </View>

        <Pressable
          onPress={onPressMore}
          style={({ pressed }) => ({
            paddingHorizontal: s(14),
            paddingVertical: s(8),
            borderRadius: s(999),
            backgroundColor: COLORS.gray[100],
            opacity: pressed ? 0.85 : 1,
          })}
          accessibilityRole="button"
          accessibilityLabel="다음 상담 상세 보기"
        >
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.text.body.strong }}
          >
            더보기
          </Typography>
        </Pressable>
      </View>

      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default, marginTop: s(4) }}
      >
        {primary?.name
          ? `${primary.name}님의 ${typeLabel}`
          : schedule.title ?? typeLabel}
      </Typography>
      {(genderText || age !== null || schedule.program_name) && (
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
          numberOfLines={1}
        >
          {genderText ?? ""}
          {genderText && age !== null ? " · " : ""}
          {age !== null ? `만 ${age}세` : ""}
          {(genderText || age !== null) && schedule.program_name ? " · " : ""}
          {schedule.program_name ?? ""}
        </Typography>
      )}

      {/* 이전 회기 일지 보기 — 풀폭 CTA, 다음 상담의 핵심 액션. primary tint로 강조 강 */}
      <Pressable
        onPress={onPressMore}
        accessibilityRole="button"
        accessibilityLabel={`${primary?.name ?? ""}님의 이전 회기 일지 보기`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: s(14),
          paddingHorizontal: s(16),
          borderRadius: s(14),
          backgroundColor: COLORS.bg.selected,
          marginTop: s(12),
          gap: s(6),
          overflow: "hidden",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons
          name="document-text"
          size={16}
          color={COLORS.primary700}
        />
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.primary700, flexShrink: 1 }}
          numberOfLines={1}
        >
          이전 회기 일지 보기
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={COLORS.primary700}
        />
      </Pressable>
    </View>
  );
}

function NoNextSessionSection() {
  return (
    <View style={{ gap: s(6), paddingVertical: s(4) }}>
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        다음 상담
      </Typography>
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.text.body.strong }}
      >
        예정된 상담이 없어요
      </Typography>
    </View>
  );
}

/* ───────────────────────── Today List ───────────────────────── */

const BULLETS_MAX = 4;

function TodaySchedulesList({
  schedules,
  onPressItem,
}: {
  schedules: ScheduleListItem[];
  onPressItem: (id: string) => void;
}) {
  const visible = schedules.slice(0, BULLETS_MAX);
  const hiddenCount = schedules.length - visible.length;

  return (
    <View style={{ gap: s(12) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          오늘 일정
        </Typography>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          {schedules.length}개
        </Typography>
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
  const cancelReason = isCancelled
    ? (schedule as unknown as { cancel_reason?: string | null })
        .cancel_reason ?? null
    : null;
  const showReason = isCancelled && !!cancelReason;

  const startText = format(parseDate(schedule.start), "HH:mm");

  return (
    <View style={{ gap: s(4) }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${primary?.name ?? ""}님 ${startText} 일정 · 이전 일지 보기`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: s(12),
          opacity: pressed ? 0.6 : 1,
        })}
      >
        {/* dot */}
        <View
          style={{
            width: s(TIMELINE_DOT_SIZE),
            height: s(TIMELINE_DOT_SIZE),
            borderRadius: s(TIMELINE_DOT_SIZE / 2),
            backgroundColor: dotColor,
            opacity: isCancelled ? 0.55 : 1,
          }}
        />

        {/* 시간 */}
        <Typography
          variant="body-02"
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontVariant: ["tabular-nums"],
            opacity: isCancelled ? 0.55 : 1,
          }}
        >
          {startText}
        </Typography>

        {/* 이름 + 유형 — flex:1로 남는 폭을 차지하고 pill을 우측 끝으로 밀어냄 */}
        <Typography
          variant="body-02"
          weight="regular"
          style={{
            color: COLORS.text.body.strong,
            flex: 1,
            textDecorationLine: isCancelled ? "line-through" : "none",
            textDecorationColor: COLORS.gray[400],
            opacity: isCancelled ? 0.55 : 1,
          }}
          numberOfLines={1}
        >
          {primary?.name ?? schedule.title ?? ""} {typeLabel}
        </Typography>

        {/* 이전 일지 pill — 행 우측 끝. flexShrink:0 으로 폭 보장 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: s(5),
            paddingHorizontal: s(9),
            borderRadius: s(999),
            backgroundColor: COLORS.gray[100],
            flexShrink: 0,
            opacity: isCancelled ? 0.4 : 1,
          }}
        >
          <Ionicons
            name="document-text"
            size={11}
            color={COLORS.primary700}
            style={{ marginRight: s(3) }}
          />
          <Typography
            variant="caption-01"
            weight="semibold"
            style={{ color: COLORS.primary700 }}
            numberOfLines={1}
          >
            이전 일지
          </Typography>
        </View>
      </Pressable>

      {/* 취소 사유 — 별도 행, dot + gap 만큼 들여쓰기. dim 적용 안 함(가독성) */}
      {showReason && (
        <Typography
          variant="label-01"
          weight="regular"
          style={{
            color: COLORS.text.body.subtle,
            marginLeft: s(TIMELINE_DOT_SIZE) + s(12),
          }}
          numberOfLines={2}
        >
          취소 · {cancelReason}
        </Typography>
      )}
    </View>
  );
}

function EmptyTodayInline() {
  return (
    <View style={{ gap: s(4), paddingVertical: s(8) }}>
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        오늘 일정
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.subtle }}
      >
        예정된 일정이 없어요
      </Typography>
    </View>
  );
}

/* ───────────────────────── Fieldnote CTA (Dark) ───────────────────────── */

/**
 * 신규(ClipboardGreeting) 변종의 FieldnoteCta와 동일 — 보라 그라디언트 + 흰 RecordPill.
 * 다크 톤 안에서도 동일한 시각 액센트로 통일.
 */
function DarkFieldnoteCta({
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
