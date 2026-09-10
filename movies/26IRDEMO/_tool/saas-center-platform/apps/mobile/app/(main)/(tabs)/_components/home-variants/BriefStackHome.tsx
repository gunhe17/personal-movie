import { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Circle,
  Mask,
} from "react-native-svg";
// PNG 에셋은 @assets 별칭이 Metro 에서 해석되지 않아 상대경로로 import (SVG 만 별칭 가능)
import CoffeeClockIcon from "../../../../../assets/CoffeeClockIcon.png";
import MainIcon from "../../../../../assets/CalendarIcon.png";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Skeleton, useDelayedSkeleton } from "@/shared/components/ui/Skeleton";
import { NotificationBell } from "@/shared/components/ui/NotificationBell";
import { Icon, type IconName } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { useTabBarClearance } from "@/shared/hooks/useTabBarClearance";
import type { HomeVariantProps } from "./types";

/**
 * 홈 — 히어로 우선 + 신호(브리프 카드) (UI design 적용본).
 *
 * lab 시안 `home-empty-hero` 의 "브리프 카드" 변형을 production 으로 이전한 컴포넌트.
 *
 * 골격:
 *  1) 히어로 — 일러스트(원형 배경 없음) + 날짜 + 일정량 적응형 인사(여유/보통/바쁨)
 *  2) 다음 일정 — nextSession 있으면 "다음 일정" 카드, 없으면 "다가오는 일정" 카드(upcomingSession)
 *  3) 오늘 살펴볼 것들 — 신호를 흰 카드 하나로 묶고 1순위만 살짝 강조 + 더보기
 *
 * 배경:
 *  - 페이지 white
 *  - 상단 그라데이션 블롭 (radial alpha mask 로 바깥을 투명하게 흐림)
 */

import { useCenterStore } from "@/features/center";
import { formatKstTime, formatKstDate, parseDate } from "@/shared/utils/date";
import type { PrepSignalType, PrepSignalItem } from "@/features/home";
import type { ScheduleListItem } from "@/features/schedule";

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  )
    age--;
  return age;
}

function formatGender(g: "male" | "female" | null): string | null {
  if (g === "male") return "남";
  if (g === "female") return "여";
  return null;
}

function buildClientLabel(item: ScheduleListItem): string {
  // 검사 일정을 "상담"으로 부르면 오표기 — schedule_type 기준으로 도메인 라벨 분기
  const kind = item.schedule_type === "assessment" ? "검사" : "상담";
  const names = item.client_names;
  if (names.length === 0) return item.title ?? "일정";
  if (names.length === 1) return `${names[0]}님의 ${kind}`;
  return `${names[0]}님 외 ${names.length - 1}명의 ${kind}`;
}

/** "다음 일정" 표기 — 오늘/내일 HH:mm, 그 이후는 M월 d일 HH:mm */
function formatNextWhen(iso: string, today: Date): string {
  const d = parseDate(iso);
  const time = formatKstTime(iso);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86400000);
  if (diffDays <= 0) return `오늘 ${time}`;
  if (diffDays === 1) return `내일 ${time}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

/** 히어로 인사 — 오늘 일정량에 적응(여유 0건 / 보통 / 바쁨). */
function heroCopy(
  count: number,
  personName: string | null,
  greetingText: string,
): { title: string; sub: string } {
  if (count === 0)
    return {
      title: "오늘은 여유로운 하루예요",
      sub: "밀린 일을 정리하거나, 잠시 쉬어가도 좋아요",
    };
  if (count >= 4)
    return {
      title: "오늘은 바쁜 하루예요",
      sub: `${count}개의 일정이 있어요. 하나씩 차근히 해봐요`,
    };
  return {
    title: personName ? `${personName}님, ${greetingText}` : greetingText,
    sub: `오늘 ${count}개의 일정이 기다리고 있어요`,
  };
}

const SIGNAL_STYLE: Record<
  PrepSignalType,
  { icon: IconName; color: string }
> = {
  unwritten_journals: { icon: "write-journal-20", color: "#7B4FFF" },
  first_meeting: { icon: "people-20", color: "#0E91ED" },
  unreviewed_assessment: { icon: "report-20", color: "#009BA9" },
  previous_note_summary: { icon: "document-20", color: "#0E91ED" },
  retest: { icon: "time-20", color: "#F47500" },
  attendance_warning: { icon: "warning-yellow-circle-20", color: "#D23E46" },
  field_note_summary: { icon: "mike-20", color: "#9B5DFF" },
  group_member_change: { icon: "people-20", color: "#F47500" },
  extension_needed: { icon: "time-20", color: "#F47500" },
  unpaid_billing: { icon: "circle-exclamation-20", color: "#00C3BC" },
};

/**
 * 오늘 일정 카드 영역 스켈레톤 — 데이터 도착 전 빈 상태가 먼저 깜빡이지 않도록
 * 실제 일정 카드와 같은 자리(흰 카드)를 흉내 낸다. (디자인 스펙 §6.2)
 */
function HomeScheduleSkeleton() {
  return (
    <View
      style={{
        marginTop: s(32),
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        paddingVertical: s(16),
        paddingHorizontal: s(16),
        shadowColor: "#000",
        shadowOpacity: 0.07,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 16,
        elevation: 3,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      {/* 좌측 시간 컬럼 */}
      <View style={{ alignItems: "center", marginRight: s(14) }}>
        <Skeleton width={40} height={16} radius={6} />
        <Skeleton width={40} height={12} radius={6} style={{ marginTop: s(8) }} />
      </View>
      <View
        style={{ width: 1, alignSelf: "stretch", backgroundColor: COLORS.gray[100], marginRight: s(14) }}
      />
      {/* 본문 */}
      <View style={{ flex: 1 }}>
        <Skeleton width="55%" height={18} radius={6} />
        <Skeleton width="35%" height={13} radius={6} style={{ marginTop: s(10) }} />
        <Skeleton width="70%" height={15} radius={6} style={{ marginTop: s(14) }} />
      </View>
    </View>
  );
}

/** 오늘 일정 로딩 실패 — 빈 상태 대신 재시도 안내. */
function HomeScheduleError({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: s(40),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.gray[600] }}
      >
        일정을 불러오지 못했어요
      </Typography>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="다시 시도"
        style={{
          marginTop: s(14),
          paddingHorizontal: s(20),
          paddingVertical: s(10),
          borderRadius: s(12),
          backgroundColor: COLORS.gray[100],
        }}
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.gray[700] }}
        >
          다시 시도
        </Typography>
      </Pressable>
    </View>
  );
}

/** 오늘 살펴볼 것들 — 신호를 흰 카드 하나로 묶음. 1순위(idx 0)만 살짝 강조 + 더보기. */
function SignalBriefCard({
  signals,
  showAll,
  onToggle,
  onPress,
}: {
  signals: PrepSignalItem[];
  showAll: boolean;
  onToggle: () => void;
  onPress?: (signal: PrepSignalItem) => void;
}) {
  const shown = showAll ? signals : signals.slice(0, 3);
  const remaining = signals.length - shown.length;
  return (
    <View
      style={{
        marginTop: s(28),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.gray[900], marginBottom: s(12) }}
      >
        오늘 살펴볼 것들
      </Typography>
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(20),
          paddingHorizontal: s(16),
          shadowColor: "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 16,
          elevation: 3,
        }}
      >
        {shown.map((signal, idx) => {
          const style = SIGNAL_STYLE[signal.signal_type] ?? {
            icon: "circle-exclamation-20" as const,
            color: COLORS.gray[500],
          };
          return (
            <Pressable
              key={signal.signal_type}
              onPress={() => onPress?.(signal)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: s(14),
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: COLORS.gray[100],
              }}
              accessibilityRole="button"
              accessibilityLabel={signal.label}
            >
              <View style={{ marginRight: s(10) }}>
                <Icon name={style.icon} size={20} color={style.color} />
              </View>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ flex: 1, color: COLORS.gray[800] }}
              >
                {signal.label}
              </Typography>
              <Icon name="arrow-right-16" size={16} color={COLORS.gray[400]} />
            </Pressable>
          );
        })}
        {(showAll || remaining > 0) && (
          <Pressable
            onPress={onToggle}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: s(12),
            }}
            accessibilityRole="button"
            accessibilityLabel={showAll ? "접기" : "더보기"}
          >
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: COLORS.gray[500] }}
            >
              {showAll ? "접기" : `${remaining}건 더보기`}
            </Typography>
            <View style={{ marginLeft: s(2) }}>
              <Icon
                name={showAll ? "arrow-up-16" : "arrow-down-16"}
                size={16}
                color={COLORS.gray[500]}
              />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function BriefStackHome({
  centerName,
  hasMultipleCenters,
  personName,
  dateStr,
  today,
  nextSession,
  upcomingSession,
  todaySchedules,
  unreadCount,
  isLoading,
  isError,
  onRetry,
  onPressNextSession,
  onPressMyCenters,
  onPressNotifications,
  onPressSchedule,
  prepSignals,
  onPressSignal,
}: HomeVariantProps) {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  // 빠른(캐시) 로딩에선 스켈레톤을 띄우지 않고, 콜드 로딩에만 등장(§6.2 지연 게이트).
  const showScheduleSkeleton = useDelayedSkeleton(isLoading);

  // 플로팅 탭바가 가리는 하단 영역 — 스크롤 콘텐츠 paddingBottom 에 더해 칩이 탭바에 안 깔리게.
  const tabClear = useTabBarClearance();

  // 신호 카드 더보기/접기
  const [showAllSignals, setShowAllSignals] = useState(false);

  // 시간대별 인사말 — 아침/오후/저녁
  const greetingHour = today.getHours();
  const greetingText =
    greetingHour >= 5 && greetingHour < 12
      ? "좋은 아침이에요"
      : greetingHour < 18
        ? "좋은 오후예요"
        : "좋은 저녁이에요";

  // 히어로 인사 — 로딩/에러 중엔 개수 단언 없이 기본 인사만.
  const todayCount = todaySchedules.length;
  const hero =
    isLoading || isError
      ? {
          title: personName ? `${personName}님, ${greetingText}` : greetingText,
          sub: "",
        }
      : heroCopy(todayCount, personName, greetingText);

  // 히어로 아이콘 — 오늘 일정 없는 날(여유)=커피, 일정 있는 날=메인. (로딩/에러 중엔 메인 기본)
  const heroIcon =
    !isLoading && !isError && todayCount === 0 ? CoffeeClockIcon : MainIcon;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* 상단 그라데이션 블롭 — Figma: 838×838, top -348, left -231.17,
          LinearGradient #DFFFF1 → #D9F5FF, Layer blur 97.1.
          경계가 또렷하게 끊기지 않도록 radial alpha mask 로 바깥을 투명하게 흐린다.
          (FeGaussianBlur 필터는 RN 빌드에서 미적용 → 코어 Mask 로 대체) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="blobGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#DFFFF1" />
              <Stop offset="1" stopColor="#D9F5FF" />
            </SvgLinearGradient>
            {/* 중심 불투명 → 바깥 투명. 경계가 사라지며 색이 흐릿하게 풀린다. */}
            <SvgRadialGradient id="blobFade" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </SvgRadialGradient>
            <Mask id="blobMask">
              <Circle
                cx={s(187.83)}
                cy={s(71)}
                r={s(419)}
                fill="url(#blobFade)"
              />
            </Mask>
          </Defs>
          <Circle
            cx={s(187.83)}
            cy={s(71)}
            r={s(419)}
            fill="url(#blobGrad)"
            mask="url(#blobMask)"
          />
        </Svg>
      </View>

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* 헤더 — 센터명 + 알림 벨 (production 표준 home 헤더 패턴) */}
        <View
          style={{
            height: s(52),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* 좌측: 센터 아이콘 + 센터명 + 드롭다운(센터 2개 이상일 때만) */}
          <Pressable
            onPress={hasMultipleCenters ? onPressMyCenters : undefined}
            disabled={!hasMultipleCenters}
            hitSlop={8}
            accessibilityRole={hasMultipleCenters ? "button" : "header"}
            accessibilityLabel={
              hasMultipleCenters ? "센터 전환" : centerName ?? undefined
            }
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <View
              style={{
                width: s(28),
                height: s(28),
                borderRadius: s(8),
                backgroundColor: COLORS.primary500,
                alignItems: "center",
                justifyContent: "center",
                marginRight: s(8),
              }}
            >
              <Ionicons name="business" size={14} color={COLORS.white} />
            </View>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              {centerName ?? "마음숲 상담센터"}
            </Typography>
            {hasMultipleCenters && (
              <View style={{ marginLeft: s(4) }}>
                <Icon name="arrow-down" size={20} color={COLORS.gray[500]} />
              </View>
            )}
          </Pressable>

          {/* 우측: 알림 벨 + unread dot (안 읽은 알림 있으면 종처럼 흔들림) */}
          <NotificationBell
            count={unreadCount}
            onPress={onPressNotifications}
            color={COLORS.gray[800]}
          />
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{ paddingBottom: tabClear }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1) 히어로 — 일러스트(원형 배경 없이 아이콘만) + 날짜 + 적응형 인사 */}
          <View
            style={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingTop: s(40),
              alignItems: "center",
            }}
          >
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                marginBottom: s(20),
              }}
            >
              <Image
                source={heroIcon}
                style={{ width: s(190), height: s(168) }}
                resizeMode="contain"
              />
            </View>

            <Typography
              variant="body-02"
              weight="regular"
              style={{ color: "#464F58" }}
            >
              {dateStr}
            </Typography>
            <Typography
              variant="headline-01"
              weight="semibold"
              style={{ marginTop: s(6), color: "#1D2227", textAlign: "center" }}
            >
              {hero.title}
            </Typography>
            {hero.sub ? (
              <Typography
                variant="body-02"
                weight="regular"
                style={{
                  marginTop: s(8),
                  color: COLORS.gray[500],
                  textAlign: "center",
                }}
              >
                {hero.sub}
              </Typography>
            ) : null}
          </View>

          {/* 2) 다음 일정 — nextSession 있으면 "다음 일정" 카드, 없으면 "다가오는 일정" 카드.
              데이터 도착 전엔 빈 상태를 먼저 보여주지 않는다:
              스켈레톤(콜드 로딩) → delay 창엔 빈 자리 → 에러 → 실제 카드 순. */}
          {showScheduleSkeleton ? (
            <HomeScheduleSkeleton />
          ) : isLoading ? (
            <View style={{ height: s(32) }} />
          ) : isError ? (
            <HomeScheduleError onRetry={onRetry} />
          ) : nextSession ? (() => {
            const startTime = formatKstTime(nextSession.start);
            const endTime = formatKstTime(nextSession.end);
            const clientLabel = buildClientLabel(nextSession);
            const firstClient = nextSession.clients[0];
            const gender = firstClient ? formatGender(firstClient.gender) : null;
            const age = firstClient ? calcAge(firstClient.birth_date) : null;
            const hasFirstMeeting = prepSignals?.some(s => s.signal_type === 'first_meeting');

            return (
              <View
                style={{
                  marginTop: s(32),
                  paddingHorizontal: s(LAYOUT.screenPaddingX),
                }}
              >
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: COLORS.gray[900], marginBottom: s(12) }}
                >
                  다음 일정
                </Typography>
                <Pressable
                  onPress={onPressNextSession}
                  accessibilityRole="button"
                  accessibilityLabel={`${clientLabel} 일정 상세 보기`}
                >
                  <View
                    style={{
                      backgroundColor: COLORS.white,
                      borderRadius: s(20),
                      paddingVertical: s(16),
                      paddingHorizontal: s(16),
                      shadowColor: "#000",
                      shadowOpacity: 0.07,
                      shadowOffset: { width: 0, height: 4 },
                      shadowRadius: 16,
                      elevation: 3,
                      flexDirection: "row",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* 좌측 시간 영역 */}
                    <View
                      style={{
                        width: s(56),
                        alignItems: "center",
                        paddingTop: s(4),
                      }}
                    >
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        className="text-gray-900"
                      >
                        {startTime}
                      </Typography>
                      <View
                        style={{
                          width: 1,
                          height: s(12),
                          backgroundColor: COLORS.gray[300],
                          marginVertical: s(4),
                        }}
                      />
                      <Typography
                        variant="body-01"
                        weight="regular"
                        className="text-gray-500"
                      >
                        {endTime}
                      </Typography>
                    </View>

                    {/* 세로 divider */}
                    <View
                      style={{
                        width: 1,
                        alignSelf: "stretch",
                        backgroundColor: COLORS.gray[200],
                        marginHorizontal: s(14),
                      }}
                    />

                    {/* 본문 영역 */}
                    <View style={{ flex: 1 }}>
                      {hasFirstMeeting && (
                        <Typography
                          variant="label-01"
                          weight="medium"
                          style={{ color: COLORS.primary700 }}
                        >
                          오늘 첫 만남
                        </Typography>
                      )}

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: hasFirstMeeting ? s(8) : 0,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: COLORS.primary500,
                            marginRight: s(8),
                          }}
                        />
                        <Typography
                          variant="body-01"
                          weight="semibold"
                          className="text-gray-900"
                          style={{ flex: 1 }}
                        >
                          {clientLabel}
                        </Typography>
                      </View>

                      {(gender || age !== null) && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: s(2),
                            marginLeft: 6 + s(8),
                          }}
                        >
                          {gender && (
                            <Typography
                              variant="body-03"
                              weight="regular"
                              style={{ color: COLORS.gray[600] }}
                            >
                              {gender}
                            </Typography>
                          )}
                          {gender && age !== null && (
                            <View
                              style={{
                                width: 1,
                                height: s(10),
                                backgroundColor: COLORS.gray[300],
                                marginHorizontal: s(6),
                              }}
                            />
                          )}
                          {age !== null && (
                            <Typography
                              variant="body-03"
                              weight="regular"
                              style={{ color: COLORS.gray[600] }}
                            >
                              만 {age}세
                            </Typography>
                          )}
                        </View>
                      )}

                      <View style={{ marginTop: s(12) }}>
                        {nextSession.room_name && (
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Icon
                              name="location-20"
                              size={s(20)}
                              color={COLORS.gray[400]}
                            />
                            <Typography
                              variant="body-02"
                              weight="medium"
                              style={{ color: COLORS.gray[800], marginLeft: s(6) }}
                            >
                              {nextSession.room_name}
                            </Typography>
                          </View>
                        )}
                        {nextSession.program_name && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: nextSession.room_name ? s(4) : 0,
                            }}
                          >
                            <Icon
                              name="document-20"
                              size={s(20)}
                              color={COLORS.gray[400]}
                            />
                            <Typography
                              variant="body-02"
                              weight="medium"
                              style={{ color: COLORS.gray[800], marginLeft: s(6) }}
                            >
                              {nextSession.program_name}
                            </Typography>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </Pressable>
                {todayCount > 1 && (
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{
                      color: COLORS.gray[500],
                      marginTop: s(10),
                      textAlign: "center",
                    }}
                  >
                    오늘 일정 {todayCount}건 중 다음 일정이에요
                  </Typography>
                )}
              </View>
            );
          })() : upcomingSession ? (
            /* 오늘 일정 없음 — 다가오는(내일 이후) 일정 한 줄 카드 */
            <View
              style={{
                marginTop: s(28),
                paddingHorizontal: s(LAYOUT.screenPaddingX),
              }}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.gray[900], marginBottom: s(12) }}
              >
                다가오는 일정
              </Typography>
              <Pressable
                onPress={() => onPressSchedule(upcomingSession.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: COLORS.white,
                  borderRadius: s(20),
                  paddingVertical: s(16),
                  paddingHorizontal: s(16),
                  shadowColor: "#000",
                  shadowOpacity: 0.07,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 16,
                  elevation: 3,
                }}
                accessibilityRole="button"
                accessibilityLabel="다가오는 일정 보기"
              >
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{ color: COLORS.gray[600] }}
                  >
                    {formatNextWhen(upcomingSession.start, today)}
                  </Typography>
                  <Typography
                    variant="body-02"
                    weight="semibold"
                    style={{ marginLeft: s(8), color: COLORS.gray[900] }}
                  >
                    {buildClientLabel(upcomingSession)}
                  </Typography>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.gray[400]}
                />
              </Pressable>
            </View>
          ) : null}

          {/* 3) 오늘 살펴볼 것들 — 신호 brief 카드.
              실데이터(prepSignals)만 표시, 없으면 섹션 숨김 — 허위 신호(mock)를 사용자에게
              보여주지 않는다. §4 횡단 신호 wiring(별도 작업)이 들어오면 소스가 넓어진다.
              시각 검증용 mock 은 lab(home-empty-hero 등)에서만 쓴다. */}
          {prepSignals && prepSignals.length > 0 && (
            <SignalBriefCard
              signals={prepSignals}
              showAll={showAllSignals}
              onToggle={() => setShowAllSignals((v) => !v)}
              onPress={onPressSignal}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
