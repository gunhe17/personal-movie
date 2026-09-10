import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
 * 홈 시안 2 — 큰 숫자/타이포 강조 (Bold Emphasis)
 *
 * 강조 전략: 흰 배경 유지하되 핵심 숫자를 시각적 무게 중심으로 키움.
 * 카운트다운(48~64pt), 통계 숫자(headline-01), 일지 카운트 → 시선이 자연스럽게 숫자에 머묾.
 * 색은 절제하고 타이포 크기·굵기의 대비로 리듬 만듦.
 *
 * 참고: 강조 1순위는 페이지당 1~2곳(§0) — 카운트다운 숫자 1, 미작성 일지 N 1, 두 곳에만.
 */
export default function HomeBoldEmphasisLab() {
  const router = useRouter();
  const mock = useMemo(() => buildHomeMock(), []);
  const { headline: countHeadline, sub: countSub } = formatCountdown(47);
  const primaryClient = mock.nextSession.clients[0];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 헤더 */}
      <View
        style={{ height: s(52), paddingHorizontal: s(16) }}
        className="flex-row items-center justify-between"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          className="flex-row items-center"
          style={{ gap: s(6) }}
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          <Typography
            variant="body-02"
            weight="medium"
            className="text-label-default"
          >
            실험실
          </Typography>
        </TouchableOpacity>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
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
            {mock.centerName}
          </Typography>
        </View>
        <TouchableOpacity
          style={{ width: s(40), height: s(40) }}
          className="items-center justify-center"
          hitSlop={4}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.gray[800]}
          />
          {mock.unreadCount > 0 && (
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 인사 */}
        <View style={{ paddingHorizontal: s(16), paddingTop: s(8) }}>
          <Typography
            variant="label-01"
            weight="medium"
            className="text-body-subtle"
          >
            5월 14일 목요일 · 활기찬 오후예요
          </Typography>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-1 text-title-default"
          >
            {mock.personName}님,
          </Typography>
        </View>

        {/* Hero — BIG countdown + 단순 카드 */}
        <View
          style={{
            marginTop: s(16),
            marginHorizontal: s(16),
            padding: s(20),
            borderRadius: s(20),
            backgroundColor: COLORS.bg.surface,
            borderWidth: 1,
            borderColor: COLORS.border.default,
            ...SHADOWS.card,
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-state-brand"
          >
            다음 일정
          </Typography>

          {/* MEGA countdown — 화면에서 가장 무거운 시각 요소 */}
          <View
            style={{ marginTop: s(8) }}
            className="flex-row items-baseline"
          >
            <Typography
              weight="semibold"
              style={{
                color: COLORS.primary,
                fontSize: s(64),
                lineHeight: s(68),
                letterSpacing: -2,
              }}
            >
              {countHeadline}
            </Typography>
            <View style={{ marginLeft: s(8) }}>
              <Typography
                variant="body-02"
                weight="medium"
                className="text-body-subtle"
              >
                {countSub}
              </Typography>
              <Typography
                variant="body-03"
                weight="regular"
                className="text-placeholder"
              >
                {formatHHmm(mock.nextSession.start)} 시작
              </Typography>
            </View>
          </View>

          {/* 내담자 정보 */}
          <View
            style={{
              marginTop: s(16),
              paddingTop: s(16),
              borderTopWidth: 1,
              borderTopColor: COLORS.border.default,
            }}
          >
            <View
              className="flex-row items-center"
              style={{ gap: s(12) }}
            >
              <View
                style={{
                  width: s(40),
                  height: s(40),
                  borderRadius: s(20),
                  backgroundColor: COLORS.counselingLight,
                }}
                className="items-center justify-center"
              >
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: COLORS.counseling }}
                >
                  {primaryClient?.name.charAt(0)}
                </Typography>
              </View>
              <View className="flex-1">
                <Typography
                  variant="body-01"
                  weight="semibold"
                  className="text-title-default"
                >
                  {primaryClient?.name}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="regular"
                  className="text-body-subtle"
                >
                  {primaryClient?.gender === "female" ? "여" : "남"} · 만{" "}
                  {primaryClient ? getAgeFromBirth(primaryClient.birth_date!) : 0}세 ·{" "}
                  {mock.nextSession.program_name}
                </Typography>
              </View>
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => ({
              marginTop: s(16),
              height: s(48),
              borderRadius: s(12),
              backgroundColor: COLORS.primary,
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
              상담 상세보기
            </Typography>
            <Ionicons
              name="arrow-forward"
              size={s(18)}
              color={COLORS.white}
              style={{ marginLeft: s(6) }}
            />
          </Pressable>
        </View>

        {/* 이번주 통계 — 숫자를 headline-01으로 시각 무게 부여 */}
        <View
          style={{
            marginTop: s(24),
            paddingHorizontal: s(16),
            paddingBottom: s(8),
          }}
        >
          <Typography
            variant="label-01"
            weight="regular"
            className="text-body-subtle"
          >
            이번주 · {mock.weekStats.range}
          </Typography>
        </View>
        <View
          style={{ paddingHorizontal: s(16), gap: s(12) }}
          className="flex-row"
        >
          <BigNumberStat
            value={mock.weekStats.counseling}
            label="이번주 상담"
            accent={COLORS.counseling}
            accentBg={COLORS.counselingLight}
            iconName="counseling-20"
          />
          <BigNumberStat
            value={mock.weekStats.assessment}
            label="이번주 검사"
            accent={COLORS.assessment}
            accentBg={COLORS.assessmentLight}
            iconName="assessment-20"
          />
          <BigNumberStat
            value={mock.weekStats.noShow}
            label="노쇼"
            accent={COLORS.error}
            accentBg="#FFE8E8"
            ioniconsName="close-circle-outline"
          />
        </View>

        {/* 미작성 일지 — 큰 N 강조 */}
        <UnlinkedCtaBoldN count={mock.unlinkedCount} />

        {/* 오늘 일정 */}
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
            <BoldTimeScheduleCard
              key={sch.id}
              schedule={sch}
              isNext={i === 0}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Sub Components ─── */

function BigNumberStat({
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
          width: s(28),
          height: s(28),
          borderRadius: s(8),
          backgroundColor: accentBg,
          marginBottom: s(12),
        }}
        className="items-center justify-center"
      >
        {iconName ? (
          <Icon name={iconName} size={s(16)} color={accent} />
        ) : ioniconsName ? (
          <Ionicons name={ioniconsName} size={s(16)} color={accent} />
        ) : null}
      </View>
      {/* 숫자가 시각 무게 중심 */}
      <Typography
        weight="semibold"
        style={{
          color: COLORS.text.title.default,
          fontSize: s(32),
          lineHeight: s(36),
          letterSpacing: -1,
        }}
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

function UnlinkedCtaBoldN({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View
      style={{
        marginTop: s(24),
        marginHorizontal: s(16),
        padding: s(20),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(16) }}>
        {/* 큰 N 강조 — 일러스트 대신 타이포 비주얼 */}
        <View
          style={{
            width: s(72),
            height: s(72),
            borderRadius: s(16),
            backgroundColor: COLORS.fieldnote,
            opacity: 1,
          }}
          className="items-center justify-center"
        >
          <Typography
            weight="semibold"
            style={{
              color: COLORS.white,
              fontSize: s(36),
              lineHeight: s(40),
              letterSpacing: -1,
            }}
          >
            {count}
          </Typography>
          <Typography
            variant="caption-01"
            weight="medium"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            건
          </Typography>
        </View>

        <View className="flex-1" style={{ gap: s(2) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
          >
            미작성 일지가 있어요
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

function BoldTimeScheduleCard({
  schedule,
  isNext,
}: {
  schedule: ReturnType<typeof buildHomeMock>["todaySchedules"][0];
  isNext: boolean;
}) {
  const primary = schedule.clients[0];
  const accent =
    schedule.schedule_type === "counseling"
      ? COLORS.counseling
      : schedule.schedule_type === "assessment"
        ? COLORS.assessment
        : COLORS.gray[400];

  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: isNext ? COLORS.primary : COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="flex-row items-center"
    >
      {/* 큰 시간 강조 — body-01 → headline-02로 시각 비중 키움 */}
      <View style={{ width: s(72) }}>
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(22),
            lineHeight: s(26),
            letterSpacing: -0.5,
          }}
        >
          {formatHHmm(schedule.start)}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          className="text-placeholder"
          style={{ marginTop: s(2) }}
        >
          ~ {formatHHmm(schedule.end)}
        </Typography>
      </View>
      <View
        className="flex-1"
        style={{
          paddingLeft: s(12),
          borderLeftWidth: 2,
          borderLeftColor: accent,
        }}
      >
        {isNext && (
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-state-brand"
            style={{ marginBottom: s(2) }}
          >
            곧 시작
          </Typography>
        )}
        {primary && (
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
            numberOfLines={1}
          >
            {primary.name}
            <Typography
              variant="label-01"
              weight="regular"
              className="text-body-subtle"
            >
              {"  "}
              {primary.gender === "female" ? "여" : "남"} ·{" "}
              {primary.birth_date ? getAgeFromBirth(primary.birth_date) : 0}세
            </Typography>
          </Typography>
        )}
        <Typography
          variant="label-01"
          weight="regular"
          className="text-label-default"
          numberOfLines={1}
          style={{ marginTop: s(2) }}
        >
          {schedule.schedule_type === "counseling" ? "상담" : "검사"}
          {schedule.program_name ? ` · ${schedule.program_name}` : ""}
          {schedule.room_name ? ` · ${schedule.room_name}` : ""}
        </Typography>
      </View>
    </View>
  );
}
