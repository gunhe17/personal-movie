import { useMemo } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import {
  buildHomeMock,
  formatCountdown,
  formatHHmm,
  getAgeFromBirth,
} from "./_mocks/home-mock";

/**
 * 홈 시안 4 — 강약 리듬 (Bold Rhythm)
 *
 * 컬러 도장된 풀블리드 히어로 → 노란 액션 리본 → 흰 4그리드 카드 → 컬러 임팩트
 * 카드 → 오늘 일정 리스트. 블록 간 색·면적·계층을 의도적으로 어긋나게 두어
 * 단조로움을 깬다.
 *
 * 강조 우선순위 (페이지 내 1순위 = 1곳 원칙)
 *  1순위 : Hero 본문의 큰 카피 (3줄 화이트 헤드라인)
 *  2순위 : 노란 액션 리본 — 다음 상담까지 카운트다운 CTA
 *  3순위 : 컬러 임팩트 카드 — 이번주 요약
 */
export default function HomeRhythmLab() {
  const router = useRouter();
  const mock = useMemo(() => buildHomeMock(), []);
  const { headline: countHeadline, sub: countSub } = formatCountdown(47);
  const primaryClient = mock.nextSession.clients[0];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* ───────── Hero — 풀블리드 컬러 도장 ───────── */}
        <LinearGradient
          colors={[COLORS.primary600, COLORS.primary500, COLORS.primary400]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.2, y: 1 }}
        >
          <SafeAreaView edges={["top"]}>
            {/* 헤더 — 좌: 뒤로 + 센터명 / 우: 알림 + 노란 원형 액션 */}
            <View
              style={{ height: s(52), paddingHorizontal: s(16) }}
              className="flex-row items-center justify-between"
            >
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={8}
                className="flex-row items-center"
                style={{ gap: s(8) }}
              >
                <Icon name="arrow-left" size={24} color={COLORS.white} />
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
                  {mock.centerName}
                </Typography>
              </TouchableOpacity>

              <View className="flex-row items-center" style={{ gap: s(8) }}>
                <TouchableOpacity
                  hitSlop={6}
                  style={{ width: s(40), height: s(40) }}
                  className="items-center justify-center"
                >
                  <Ionicons
                    name="notifications-outline"
                    size={24}
                    color={COLORS.white}
                  />
                  {mock.unreadCount > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        right: s(9),
                        top: s(9),
                        width: s(8),
                        height: s(8),
                        borderRadius: s(4),
                        backgroundColor: "#FFD466",
                        borderWidth: 1.5,
                        borderColor: COLORS.primary500,
                      }}
                    />
                  )}
                </TouchableOpacity>

                {/* 우상단 노란 원형 액션 — 필드노트 빠른 진입 */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={{
                    width: s(40),
                    height: s(40),
                    borderRadius: s(20),
                    backgroundColor: "#FFD466",
                    ...SHADOWS.card,
                  }}
                  className="items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="필드노트 녹음"
                >
                  <Ionicons name="mic" size={18} color={COLORS.gray[900]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Hero 본문 — 큰 카피 3줄 + 일러스트 */}
            <View
              style={{
                paddingHorizontal: s(16),
                paddingTop: s(20),
                paddingBottom: s(28),
              }}
            >
              <View className="flex-row items-start">
                {/* 좌측 큰 카피 — 1순위 강조 */}
                <View className="flex-1">
                  <Typography
                    variant="label-01"
                    weight="medium"
                    style={{
                      color: "rgba(255,255,255,0.85)",
                      marginBottom: s(8),
                    }}
                  >
                    {mock.personName}님, 활기찬 오후예요
                  </Typography>
                  <Typography
                    weight="bold"
                    style={{
                      color: COLORS.white,
                      fontSize: s(30),
                      lineHeight: s(40),
                      letterSpacing: -1.2,
                    }}
                  >
                    오늘도 따뜻한{"\n"}상담,{" "}
                    <Typography
                      weight="bold"
                      style={{
                        color: "#FFD466",
                        fontSize: s(30),
                        lineHeight: s(40),
                        letterSpacing: -1.2,
                      }}
                    >
                      {mock.todaySchedules.length}건
                    </Typography>
                    {"\n"}
                    함께해요
                  </Typography>
                </View>

                {/* 우측 캐릭터 일러스트 */}
                <CharacterIllustration />
              </View>
            </View>

            {/* ───── 노란 액션 리본 — 2순위 강조 ───── */}
            <View
              style={{
                paddingHorizontal: s(16),
                marginBottom: s(-20), // 다음 섹션과 살짝 겹치며 들어옴
              }}
            >
              <Pressable
                style={({ pressed }) => ({
                  height: s(56),
                  borderRadius: s(16),
                  backgroundColor: "#FFD466",
                  paddingHorizontal: s(20),
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.92 : 1,
                  ...SHADOWS.card,
                })}
              >
                <View className="flex-row items-center" style={{ gap: s(10) }}>
                  <View
                    style={{
                      width: s(28),
                      height: s(28),
                      borderRadius: s(14),
                      backgroundColor: COLORS.gray[900],
                    }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="time" size={16} color="#FFD466" />
                  </View>
                  <View>
                    <Typography
                      variant="body-01"
                      weight="bold"
                      style={{ color: COLORS.gray[900] }}
                    >
                      {countHeadline}
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        style={{ color: COLORS.gray[900] }}
                      >
                        {" "}
                        {countSub} · {primaryClient?.name}님
                      </Typography>
                    </Typography>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.gray[900]}
                />
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ───────── Quick Grid — 흰 카드, Hero 위로 살짝 떠있는 위치 ───────── */}
        <View
          style={{
            marginTop: s(32),
            marginHorizontal: s(16),
            backgroundColor: COLORS.bg.surface,
            borderRadius: s(20),
            paddingVertical: s(18),
            paddingHorizontal: s(12),
            borderWidth: 1,
            borderColor: COLORS.border.default,
            ...SHADOWS.card,
          }}
          className="flex-row"
        >
          <QuickAction
            iconName="calendar"
            label="일정"
            tint={COLORS.primary}
            bg={COLORS.primary50}
          />
          <QuickAction
            iconName="client"
            label="내담자"
            tint={COLORS.counseling}
            bg={COLORS.counselingLight}
          />
          <QuickAction
            ionicon="mic-outline"
            label="필드노트"
            tint={COLORS.fieldnote}
            bg={COLORS.trans.purple}
          />
          <QuickAction
            iconName="assessment"
            label="검사"
            tint={COLORS.assessment}
            bg={COLORS.assessmentLight}
          />
        </View>

        {/* ───────── 컬러 임팩트 카드 — 3순위 강조: 이번주 요약 ───────── */}
        <WeekSummaryCard
          counseling={mock.weekStats.counseling}
          assessment={mock.weekStats.assessment}
          noShow={mock.weekStats.noShow}
          unlinked={mock.unlinkedCount}
          range={mock.weekStats.range}
        />

        {/* ───────── 오늘 일정 ───────── */}
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
              총 {mock.todaySchedules.length}건
            </Typography>
          </View>
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
        </View>

        <View style={{ paddingHorizontal: s(16), gap: s(12) }}>
          {mock.todaySchedules.map((sch, i) => (
            <RhythmScheduleCard
              key={sch.id}
              schedule={sch}
              isNext={i === 0}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────── Sub Components ─────────── */

function CharacterIllustration() {
  // 시계 모티프 — 우상단의 액센트 dot 와 함께 블루 위에 떠 있는 느낌
  return (
    <View
      style={{
        width: s(116),
        height: s(120),
        marginLeft: s(8),
      }}
      className="items-center justify-center"
    >
      {/* 배경 큰 원 */}
      <View
        style={{
          position: "absolute",
          width: s(116),
          height: s(116),
          borderRadius: s(58),
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      />
      {/* 중간 원 */}
      <View
        style={{
          position: "absolute",
          width: s(88),
          height: s(88),
          borderRadius: s(44),
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      {/* 시계 본체 */}
      <View
        style={{
          width: s(64),
          height: s(64),
          borderRadius: s(32),
          backgroundColor: COLORS.white,
          ...SHADOWS.card,
        }}
        className="items-center justify-center"
      >
        <Ionicons name="time" size={s(36)} color={COLORS.primary500} />
      </View>
      {/* 노란 액센트 dot */}
      <View
        style={{
          position: "absolute",
          right: s(6),
          top: s(8),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "#FFD466",
        }}
        className="items-center justify-center"
      >
        <Ionicons name="sparkles" size={10} color={COLORS.gray[900]} />
      </View>
      {/* 작은 흰 dot */}
      <View
        style={{
          position: "absolute",
          bottom: s(6),
          left: s(8),
          width: s(10),
          height: s(10),
          borderRadius: s(5),
          backgroundColor: "rgba(255,255,255,0.55)",
        }}
      />
    </View>
  );
}

function QuickAction({
  iconName,
  ionicon,
  label,
  tint,
  bg,
}: {
  iconName?: React.ComponentProps<typeof Icon>["name"];
  ionicon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint: string;
  bg: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ flex: 1 }}
      className="items-center"
    >
      <View
        style={{
          width: s(48),
          height: s(48),
          borderRadius: s(14),
          backgroundColor: bg,
          marginBottom: s(8),
        }}
        className="items-center justify-center"
      >
        {iconName ? (
          <Icon name={iconName} size={s(24)} color={tint} />
        ) : ionicon ? (
          <Ionicons name={ionicon} size={s(22)} color={tint} />
        ) : null}
      </View>
      <Typography
        variant="label-01"
        weight="medium"
        className="text-body-strong"
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

function WeekSummaryCard({
  counseling,
  assessment,
  noShow,
  unlinked,
  range,
}: {
  counseling: number;
  assessment: number;
  noShow: number;
  unlinked: number;
  range: string;
}) {
  return (
    <View
      style={{
        marginTop: s(16),
        marginHorizontal: s(16),
        borderRadius: s(20),
        overflow: "hidden",
        ...SHADOWS.card,
      }}
    >
      <LinearGradient
        colors={[COLORS.primary900, COLORS.primary800]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: s(20) }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              이번주 · {range}
            </Typography>
            <Typography
              weight="bold"
              style={{
                color: COLORS.white,
                fontSize: s(22),
                lineHeight: s(30),
                letterSpacing: -0.6,
                marginTop: s(4),
              }}
            >
              한 주를 가볍게{"\n"}정리해볼까요
            </Typography>

            {/* 통계 숫자 — 가로 나열 */}
            <View
              style={{ marginTop: s(20), gap: s(20) }}
              className="flex-row"
            >
              <SummaryStat value={counseling} label="상담" tint="#A6E9FF" />
              <SummaryStat value={assessment} label="검사" tint="#FFD466" />
              <SummaryStat
                value={unlinked}
                label="미작성"
                tint="#C5A8FF"
              />
            </View>
          </View>

          {/* 우측 데코 일러스트 */}
          <View
            style={{
              width: s(80),
              height: s(80),
              marginLeft: s(8),
              marginTop: s(8),
            }}
            className="items-center justify-center"
          >
            <View
              style={{
                position: "absolute",
                width: s(80),
                height: s(80),
                borderRadius: s(40),
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            />
            <View
              style={{
                width: s(48),
                height: s(48),
                borderRadius: s(24),
                backgroundColor: "#FFD466",
              }}
              className="items-center justify-center"
            >
              <Ionicons
                name="stats-chart"
                size={24}
                color={COLORS.gray[900]}
              />
            </View>
            {noShow > 0 && (
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  paddingHorizontal: s(8),
                  height: s(20),
                  borderRadius: s(10),
                  backgroundColor: COLORS.negative,
                }}
                className="items-center justify-center"
              >
                <Typography
                  variant="label-02"
                  weight="bold"
                  style={{ color: COLORS.white }}
                >
                  노쇼 {noShow}
                </Typography>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function SummaryStat({
  value,
  label,
  tint,
}: {
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <View>
      <Typography
        weight="bold"
        style={{
          color: tint,
          fontSize: s(28),
          lineHeight: s(32),
          letterSpacing: -0.8,
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: "rgba(255,255,255,0.7)", marginTop: s(2) }}
      >
        {label}
      </Typography>
    </View>
  );
}

function RhythmScheduleCard({
  schedule,
  isNext,
}: {
  schedule: ReturnType<typeof buildHomeMock>["todaySchedules"][0];
  isNext: boolean;
}) {
  const primary = schedule.clients[0];
  const isCounseling = schedule.schedule_type === "counseling";
  const accent = isCounseling ? COLORS.counseling : COLORS.assessment;
  const accentBg = isCounseling
    ? COLORS.counselingLight
    : COLORS.assessmentLight;
  const typeLabel = isCounseling ? "상담" : "검사";

  // 첫 카드(곧 시작)는 살짝 키워서 무게 — padding 큰 카드
  const verticalPad = isNext ? s(16) : s(12);

  return (
    <Pressable
      style={({ pressed }) => ({
        borderRadius: s(16),
        paddingVertical: verticalPad,
        paddingHorizontal: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: isNext ? COLORS.primary : COLORS.border.default,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        ...SHADOWS.card,
      })}
    >
      <View className="flex-row items-center">
        {/* 좌측 타입 아이콘 박스 */}
        <View
          style={{
            width: s(44),
            height: s(44),
            borderRadius: s(12),
            backgroundColor: isNext ? COLORS.primary : accentBg,
          }}
          className="items-center justify-center"
        >
          <Icon
            name={isCounseling ? "counseling-20" : "assessment-20"}
            size={s(22)}
            color={isNext ? COLORS.white : accent}
          />
        </View>

        {/* 가운데 정보 */}
        <View className="flex-1" style={{ paddingLeft: s(12) }}>
          {isNext && (
            <Typography
              variant="label-02"
              weight="bold"
              style={{
                color: COLORS.primary700,
                marginBottom: s(2),
                letterSpacing: 0.2,
              }}
            >
              곧 시작
            </Typography>
          )}
          {primary && (
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
                  {primary.gender === "female" ? "여" : "남"} ·{" "}
                  {getAgeFromBirth(primary.birth_date)}세
                </Typography>
              )}
            </View>
          )}
          <View
            className="flex-row items-center"
            style={{ marginTop: s(4), gap: s(6) }}
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: accent,
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

        {/* 우측 시간 */}
        <View className="items-end" style={{ marginLeft: s(8) }}>
          <Typography
            variant="body-01"
            weight="bold"
            style={{
              color: isNext ? COLORS.primary700 : COLORS.text.title.default,
              fontVariant: ["tabular-nums"],
            }}
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
      </View>
    </Pressable>
  );
}
