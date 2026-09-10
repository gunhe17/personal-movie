import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  Easing,
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
import { useCenterStore } from "@/features/center";
import { CounselingNoteSheet } from "@/features/counseling/note";

/**
 * 홈 시안 — 부드러운 톤 + 태스크 (production)
 *
 * Lab `home-soft-tasks.tsx` 의 variant A(캐러셀)을 실데이터(HomeVariantProps)로 옮긴 것.
 * - 상단 40%만 mint→primary tint→cream 그라데이션, 그 아래는 흰색으로 fade.
 * - 날짜 + 2줄 인사 + 카테고리 dot 통계 hero.
 * - 다음 상담 카드 가로 캐러셀(다음 카드 살짝 피크) + 첫 카드 위 primary tooltip pill.
 * - 카드 내부 "지난 일지 검토" 누르면 같은 자리에서 이전 회기 일지로 cross-fade 전환.
 * - 카드 하단 흰 그림자 태스크 카드 3장(일지 검토 / 일지 작성 / 필드노트 연결).
 *
 * 디자인 매핑은 lab 파일 헤더 주석 참조.
 */
export function SoftTasksHome(props: HomeVariantProps) {
  const insets = useSafeAreaInsets();
  const {
    personName,
    today,
    dateStr,
    nextSession,
    todaySchedules,
    unreadCount,
    unlinkedCount,
    isLoading,
    isError,
    isRefetching,
    onRefresh,
    onPressNotifications,
    onPressNextSession,
    onPressNextSessionNote,
    onPressNextSessionRecord,
    onPressSchedule,
    onPressFieldNoteList,
    onRetry,
    noteSheet,
    onCloseNoteSheet,
  } = props;
  const centerId = useCenterStore((st) => st.centerId);

  const counts = useMemo(() => {
    let counseling = 0;
    let assessment = 0;
    for (const sch of todaySchedules) {
      if (sch.schedule_type === "counseling") counseling += 1;
      else if (sch.schedule_type === "assessment") assessment += 1;
    }
    return { counseling, assessment };
  }, [todaySchedules]);

  // 캐러셀에 노출할 일정: 모든 오늘 일정. 첫 카드(=nextSession)에만 tooltip.
  const nextSessionId = nextSession?.id ?? null;

  /* ─── Expand-to-page / Expand-to-sheet 인터랙션 ────────────────────
   * 태스크 카드 탭 시:
   *  1) `measureInWindow`로 카드의 화면 좌표·크기 측정
   *  2) 흰 Animated.View를 카드 자리에서 → 최종 모양으로 자라남
   *       - page  : 풀스크린 (라우팅이 일반 페이지로 이어질 때)
   *       - sheet : 상단 라운드 + 위쪽 여백 (도착 즉시 일지 바텀시트가 슬라이드업)
   *  3) 애니메이션 완료 시점에 실제 라우팅 호출
   *  4) 다음 진입에 대비해 상태 reset (페이지 슬라이드와 겹치지 않게 약간의 딜레이)
   * 동시 탭 방지를 위해 ref guard 사용. */
  const SCREEN = useMemo(() => Dimensions.get("window"), []);
  // 바텀시트 형태 expand 시 화면 상단에 남기는 여백 — CounselingNoteSheet의 top(insets.top + s(8))과 동일
  const SHEET_TOP_INSET = insets.top + s(8);
  const [expandRect, setExpandRect] = useState<ExpandRect | null>(null);
  const expandProgress = useRef(new Animated.Value(0)).current;
  const isExpandingRef = useRef(false);
  // sheet 모드일 때 noteSheet.visible 이 true 가 되면 cleanup — 그 전까지 overlay 유지
  const pendingSheetCleanupRef = useRef(false);
  const sheetSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const cleanupOverlay = useCallback(() => {
    setExpandRect(null);
    expandProgress.setValue(0);
    isExpandingRef.current = false;
    pendingSheetCleanupRef.current = false;
    if (sheetSafetyTimerRef.current) {
      clearTimeout(sheetSafetyTimerRef.current);
      sheetSafetyTimerRef.current = null;
    }
  }, [expandProgress]);

  const handleExpand = useCallback(
    (rect: ExpandRect, onComplete: () => void) => {
      if (isExpandingRef.current) return;
      isExpandingRef.current = true;
      setExpandRect(rect);
      expandProgress.setValue(0);
      // sheet로 확장될 때는 살짝 더 긴 모션 — 도착 후 시트 슬라이드업과 자연스럽게 연결
      const duration = rect.expandAs === "sheet" ? 440 : 380;
      Animated.timing(expandProgress, {
        toValue: 1,
        duration,
        easing: Easing.bezier(0.32, 0.72, 0.34, 1),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) {
          isExpandingRef.current = false;
          return;
        }
        onComplete();
        if (rect.expandAs === "sheet") {
          // sheet 모드: detail fetch 가 변동적이라 일률 setTimeout cleanup 하면 home flash 발생.
          // → noteSheet.visible 이 true 가 될 때까지 overlay 유지 (아래 useEffect 에서 정리).
          //   안전 fallback — 시트가 끝내 안 뜨면 3s 후 강제 정리.
          pendingSheetCleanupRef.current = true;
          sheetSafetyTimerRef.current = setTimeout(cleanupOverlay, 3000);
        } else {
          // page 모드: 페이지 슬라이드 인(≈250ms) 이후 짧게 페이드 정리
          setTimeout(cleanupOverlay, 280);
        }
      });
    },
    [expandProgress, cleanupOverlay],
  );

  // 시트가 실제로 visible 이 되는 순간 overlay 정리 (modal 슬라이드업이 살짝 보이도록 120ms 여유)
  useEffect(() => {
    if (!pendingSheetCleanupRef.current) return;
    if (noteSheet?.visible) {
      const t = setTimeout(cleanupOverlay, 120);
      return () => clearTimeout(t);
    }
  }, [noteSheet?.visible, cleanupOverlay]);

  // 언마운트 시 안전 timer 정리
  useEffect(() => {
    return () => {
      if (sheetSafetyTimerRef.current) {
        clearTimeout(sheetSafetyTimerRef.current);
      }
    };
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      {/* 상단 그라데이션 배경 — 상단 40%만 컬러, 하단은 흰색 페이드 */}
      <LinearGradient
        colors={["#DFF6F2", "#E6F0FF", "#FFF8EE", "#FFFFFF"]}
        locations={[0, 0.18, 0.4, 0.6]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: s(560),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          // 하단 floating 필드노트 CTA 영역만큼 여유 확보 (CTA + 패딩)
          paddingBottom: s(120),
        }}
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
            unreadCount={unreadCount}
            onPressNotifications={onPressNotifications}
          />
          <HeroBlock
            personName={personName}
            dateText={dateStr}
            today={today}
            counselingCount={counts.counseling}
            assessmentCount={counts.assessment}
          />
        </SafeAreaView>

        {isLoading ? (
          <View style={{ paddingVertical: s(40), alignItems: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary500} />
          </View>
        ) : isError ? (
          <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
            <ErrorBlock onRetry={onRetry} />
          </View>
        ) : todaySchedules.length === 0 ? (
          <View
            style={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingTop: s(12),
            }}
          >
            <EmptyTodayCard variant="no-today" />
          </View>
        ) : (
          <View style={{ marginTop: s(12) }}>
            <NextSessionCarousel
              schedules={todaySchedules}
              nextSessionId={nextSessionId}
              today={today}
              onPressItem={onPressSchedule}
              onPressNextSession={onPressNextSession}
            />
          </View>
        )}

        <TaskList
          nextSession={nextSession}
          unlinkedCount={unlinkedCount}
          onPressNextSession={onPressNextSession}
          onPressNextSessionNote={onPressNextSessionNote}
          onPressFieldNoteList={onPressFieldNoteList}
          onExpand={handleExpand}
        />
      </ScrollView>

      {/* 노치 영역 — 스크롤·바운스 무관하게 페이지 톤 유지 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: "#DFF6F2",
        }}
      />

      {/* 플로팅 필드노트 CTA — 페이지 하단 고정 (탭바 바로 위) */}
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

      {/* Expand 오버레이 — 카드 자리에서 → 최종 모양(page 또는 sheet)으로 자라남
       *  page : 풀스크린 정착 (라우팅이 일반 페이지로 이어질 때)
       *  sheet: 상단 라운드 + 위쪽 여백 (도착 후 일지 바텀시트 슬라이드업과 매칭) */}
      {expandRect &&
        (() => {
          const isSheet = expandRect.expandAs === "sheet";
          const endTop = isSheet ? SHEET_TOP_INSET : 0;
          const endHeight = SCREEN.height - endTop;
          // sheet 모양은 마지막까지 상단 라운드 유지 / page는 점차 사라짐
          const endRadius = isSheet ? s(20) : 0;
          // sheet 모양은 카드 그림자 톤을 좀 더 길게 유지해 부유감을 살림
          const endShadowOpacity = isSheet ? 0.16 : 0;
          return (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [expandRect.y, endTop],
                }),
                left: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [expandRect.x, 0],
                }),
                width: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [expandRect.w, SCREEN.width],
                }),
                height: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [expandRect.h, endHeight],
                }),
                borderTopLeftRadius: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [s(16), endRadius],
                }),
                borderTopRightRadius: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [s(16), endRadius],
                }),
                borderBottomLeftRadius: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [s(16), isSheet ? 0 : 0],
                }),
                borderBottomRightRadius: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [s(16), isSheet ? 0 : 0],
                }),
                backgroundColor: COLORS.white,
                zIndex: 9999,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: isSheet ? -4 : 6 },
                shadowOpacity: expandProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, endShadowOpacity],
                }),
                shadowRadius: isSheet ? 20 : 14,
              }}
            />
          );
        })()}

      {/* 일지 시트 — 카드의 expand 모션이 끝난 뒤 같은 영역에서 슬라이드업
       *   페이지 이동 없이 홈 위에서 직접 일지를 확인할 수 있도록 마운트 */}
      <CounselingNoteSheet
        visible={!!noteSheet?.visible}
        onClose={() => onCloseNoteSheet?.()}
        centerId={centerId}
        sessionId={noteSheet?.sessionId ?? null}
        clientId={noteSheet?.clientId ?? null}
        clientName={noteSheet?.clientName ?? undefined}
        sessionStart={noteSheet?.sessionStart ?? undefined}
      />
    </View>
  );
}

/* ───────────────────────── Floating Fieldnote CTA ───────────────────────── */

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

/* ───────────────────────── Header ───────────────────────── */

function HomeHeader({
  unreadCount,
  onPressNotifications,
}: {
  unreadCount: number;
  onPressNotifications: () => void;
}) {
  return (
    <View
      style={{
        height: s(48),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
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
                borderColor: "#E6F0FF",
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
        paddingBottom: s(4),
        gap: s(8),
      }}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        {dateText}
      </Typography>
      <Typography
        weight="bold"
        style={{
          color: COLORS.text.title.default,
          fontSize: s(28),
          lineHeight: s(38),
          letterSpacing: -0.8,
        }}
      >
        {personName ?? "선생"}님, {greeting}
      </Typography>

      {showStats && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(14),
            marginTop: s(4),
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
  );
}

function StatDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
      <View
        style={{
          width: s(7),
          height: s(7),
          borderRadius: s(4),
          backgroundColor: color,
        }}
      />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[700] }}
      >
        {label}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Carousel ───────────────────────── */

const SCREEN_WIDTH = Dimensions.get("window").width;

function NextSessionCarousel({
  schedules,
  nextSessionId,
  today,
  onPressItem,
  onPressNextSession,
}: {
  schedules: ScheduleListItem[];
  nextSessionId: string | null;
  today: Date;
  onPressItem: (id: string) => void;
  onPressNextSession: () => void;
}) {
  const cardWidth = Math.round(SCREEN_WIDTH * 0.78);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + s(12)}
      snapToAlignment="start"
      contentContainerStyle={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(44),
        // 카드 하단 그림자가 잘리지 않도록 여유 확보
        paddingBottom: s(16),
      }}
    >
      {schedules.map((sch, i) => {
        const isNext = sch.id === nextSessionId;
        const goDetail = () => {
          if (isNext) onPressNextSession();
          else onPressItem(sch.id);
        };
        return (
          <View
            key={sch.id}
            style={{
              width: cardWidth,
              marginRight: i < schedules.length - 1 ? s(12) : 0,
            }}
          >
            <NextSessionCard
              schedule={sch}
              today={today}
              withTooltip={isNext}
              onPressDetail={goDetail}
              // 지난 일지 검토는 일정 상세(이전 회기 기록 포함)로 라우팅.
              // TODO: 전용 회기 노트 라우트가 생기면 그쪽으로 교체.
              onPressPrevJournal={goDetail}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

/* ───────────────────────── Next Session Card ───────────────────────── */

function NextSessionCard({
  schedule,
  today,
  withTooltip,
  onPressDetail,
  onPressPrevJournal,
}: {
  schedule: ScheduleListItem;
  today: Date;
  withTooltip?: boolean;
  onPressDetail: () => void;
  onPressPrevJournal: () => void;
}) {
  const start = parseDate(schedule.start);
  const status = deriveStatus(schedule);
  const minutes = differenceInMinutes(start, today);

  return (
    <View>
      {withTooltip && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -s(36),
            left: 0,
            zIndex: 10,
          }}
        >
          <CountdownTooltip minutes={minutes} status={status} />
        </View>
      )}

      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(24),
          padding: s(20),
          ...SHADOWS.card,
        }}
      >
        <PreviewBody
          schedule={schedule}
          onPressDetail={onPressDetail}
          onPressPrevJournal={onPressPrevJournal}
        />
      </View>
    </View>
  );
}

function PreviewBody({
  schedule,
  onPressDetail,
  onPressPrevJournal,
}: {
  schedule: ScheduleListItem;
  onPressDetail: () => void;
  onPressPrevJournal: () => void;
}) {
  const primary = schedule.clients?.[0];
  const age = primary?.birth_date != null ? getAge(primary.birth_date) : null;
  const isCounseling = schedule.schedule_type === "counseling";
  const typeLabel = isCounseling ? "상담" : "검사";
  const dotColor = isCounseling ? COLORS.counseling : COLORS.assessment;

  const genderText =
    primary?.gender === "female"
      ? "여"
      : primary?.gender === "male"
        ? "남"
        : null;

  return (
    <Pressable
      onPress={onPressDetail}
      style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
    >
      <View style={{ gap: s(14) }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
        >
          <View
            style={{
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: dotColor,
            }}
          />
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
          {/* 우상단 시작 시간 — tabular-nums 로 자릿수 정렬 */}
          <Typography
            variant="body-02"
            weight="semibold"
            style={{
              color: COLORS.primary700,
              fontVariant: ["tabular-nums"],
            }}
          >
            {format(parseDate(schedule.start), "HH:mm")}
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

        {schedule.room_name && (
          <MetaRow icon="location-20" text={schedule.room_name} />
        )}
        {schedule.program_name && (
          <MetaRow icon="document-20" text={schedule.program_name} />
        )}

        {/* 지난 일지 검토 — 일정 상세(지난 회기 기록 포함)로 페이지 전환 */}
        <View
          style={{
            marginTop: s(4),
            height: s(44),
            width: "100%",
            borderRadius: s(12),
            backgroundColor: COLORS.gray[100],
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onPressPrevJournal();
            }}
            android_ripple={{ color: COLORS.gray[200] }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="body-02"
              weight="semibold"
              style={{
                color: COLORS.text.body.strong,
                fontSize: s(14),
                lineHeight: s(20),
              }}
            >
              지난 일지 검토
            </Typography>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/* ───────────────────────── Tooltip ───────────────────────── */

function CountdownTooltip({
  minutes,
  status,
}: {
  minutes: number;
  status: ReturnType<typeof deriveStatus>;
}) {
  const label =
    status === "in_progress"
      ? "지금 상담이 진행 중이에요"
      : formatTooltip(minutes);
  return (
    <View style={{ alignSelf: "flex-start", marginLeft: s(20) }}>
      <View
        style={{
          backgroundColor: COLORS.primary500,
          paddingHorizontal: s(12),
          paddingVertical: s(7),
          borderRadius: s(8),
          shadowColor: COLORS.primary500,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          {label}
        </Typography>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: -s(4),
          left: s(20),
          width: s(10),
          height: s(10),
          backgroundColor: COLORS.primary500,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function formatTooltip(minutes: number): string {
  if (minutes <= 0) return "지금 상담이 시작됐어요!";
  if (minutes < 60) return `${minutes}분 뒤에 상담이 시작돼요!`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 뒤에 상담이 시작돼요!`;
  return `${h}시간 ${m}분 뒤에 상담이 시작돼요!`;
}

/* ───────────────────────── Meta Row ───────────────────────── */

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

/* ───────────────────────── Task List ───────────────────────── */

type ExpandTarget = "page" | "sheet";
type ExpandRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 확장 종료 시점의 모양 — page=풀스크린, sheet=상단 라운드 + 위 여백 */
  expandAs?: ExpandTarget;
};

function TaskList({
  nextSession,
  unlinkedCount,
  onPressNextSession,
  onPressNextSessionNote,
  onPressFieldNoteList,
  onExpand,
}: {
  nextSession: ScheduleListItem | null;
  unlinkedCount: number;
  onPressNextSession: () => void;
  onPressNextSessionNote?: () => void;
  onPressFieldNoteList: () => void;
  onExpand: (rect: ExpandRect, onComplete: () => void) => void;
}) {
  const tasks: {
    id: string;
    label: string;
    onPress: () => void;
    /** expand 종료 시점에 sheet UI(상단 라운드 + 위쪽 여백)로 정착할지 여부 */
    expandAs?: "page" | "sheet";
  }[] = [];

  if (nextSession) {
    const name = nextSession.clients?.[0]?.name ?? "내담자";
    tasks.push({
      id: "review-prev",
      label: `상담 전 ${name}님 일지 검토하기`,
      // 일지 시트를 자동 오픈하는 핸들러가 주입돼 있으면 그것 우선
      onPress: onPressNextSessionNote ?? onPressNextSession,
      expandAs: "sheet",
    });
  }
  if (unlinkedCount > 0) {
    tasks.push({
      id: "link-fieldnote",
      label: `필드노트 ${unlinkedCount}건 연결하기`,
      onPress: onPressFieldNoteList,
      expandAs: "page",
    });
  }

  if (tasks.length === 0) return null;

  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        marginTop: s(28),
        gap: s(10),
      }}
    >
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          label={t.label}
          onPress={t.onPress}
          // sheet 모드는 데이터 fetch가 필요하므로 카드 탭 즉시 onPress 호출 (expand와 병렬).
          // page 모드는 expand 모션 완료 후 onPress 호출 (페이지 전환과 모션 동기화).
          pressMode={t.expandAs === "sheet" ? "instant" : "after-expand"}
          onExpand={(rect, done) =>
            onExpand({ ...rect, expandAs: t.expandAs ?? "page" }, done)
          }
        />
      ))}
    </View>
  );
}

function TaskCard({
  label,
  onPress,
  onExpand,
  pressMode = "after-expand",
}: {
  label: string;
  onPress: () => void;
  onExpand: (rect: ExpandRect, onComplete: () => void) => void;
  pressMode?: "instant" | "after-expand";
}) {
  // measureInWindow 로 카드의 화면 좌표 측정 → 부모 expand 핸들러에 전달
  const wrapperRef = useRef<View>(null);

  const handlePress = () => {
    const node = wrapperRef.current;
    if (!node) {
      onPress();
      return;
    }
    if (pressMode === "instant") {
      // 데이터 fetch가 필요한 sheet 모드: expand 시작과 동시에 onPress 호출.
      // expand 완료 콜백은 NOOP — 시트는 데이터 도착 시 자체 visible 트리거로 등장.
      onPress();
      node.measureInWindow((x, y, w, h) => {
        onExpand({ x, y, w, h }, () => {});
      });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      onExpand({ x, y, w, h }, onPress);
    });
  };

  return (
    <View
      ref={wrapperRef}
      style={{
        height: s(56),
        width: "100%",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: COLORS.gray[100] }}
        style={{
          flex: 1,
          paddingHorizontal: s(16),
          flexDirection: "row",
          alignItems: "center",
          gap: s(12),
          borderRadius: s(16),
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.paletteBg.yellow,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="document-text"
            size={16}
            color={COLORS.palette.yellow}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default, flex: 1 }}
          numberOfLines={1}
        >
          {label}
        </Typography>
        <Ionicons
          name="arrow-forward"
          size={20}
          color={COLORS.gray[400]}
        />
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Empty / Error ───────────────────────── */

function EmptyTodayCard({ variant }: { variant: "no-today" | "all-done" }) {
  const isNoToday = variant === "no-today";
  const title = isNoToday ? "오늘은 일정이 없어요" : "오늘 일정을 모두 마쳤어요";
  const subtitle = isNoToday ? "여유롭게 쉬어가세요" : "수고 많으셨어요";

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        alignItems: "center",
        gap: s(6),
        ...SHADOWS.card,
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

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(24),
        alignItems: "center",
        ...SHADOWS.card,
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
