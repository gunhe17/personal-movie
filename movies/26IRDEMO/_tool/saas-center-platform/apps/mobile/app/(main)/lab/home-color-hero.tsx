import { useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
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
 * 홈 시안 1 — 컬러 헤더 (Color Hero)
 *
 * 강조 전략: 상단 영역을 saturated blue 그라데이션으로 도장 → 시선의 닻 역할.
 * 흰 카드들이 그 아래로 흘러내려도 시각적 무게 중심이 위쪽에 잡힘.
 *
 * 컬러: 웹 앱 팔레트 활용 (primary #256ef4 / accent yellow #FDCA01)
 *   - 모바일 cyan보다 채도 높은 blue로 가시성 확보
 *   - warm yellow 강조 숫자로 따뜻함 + 대비 동시 충족
 *
 * 참고: 냉장고 관리 앱(우리집 냉장고) — 상단 블루 영역 + 큰 카피 + 일러스트
 */

// 컬러는 theme COLORS.primary* 토큰 사용 (apps/web 팔레트와 동기화)
// 노란 액센트는 시안 한정 로컬 상수 (도장 토큰화 전)
const ACCENT_YELLOW = "#FDCA01"; // etc-yellow

export default function HomeColorHeroLab() {
  const router = useRouter();
  const mock = useMemo(() => buildHomeMock(), []);
  const { headline: countHeadline, sub: countSub } = formatCountdown(47);
  const primaryClient = mock.nextSession.clients[0];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
      {/* ───── 상단 컬러 헤더 ───── */}
      <LinearGradient
        colors={[COLORS.primary600, COLORS.primary500, COLORS.primary400]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={["top"]}>
          {/* 헤더 — 뒤로 가기 + 센터명 + 알림 */}
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
              <Icon name="arrow-left" size={24} color={COLORS.white} />
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: "rgba(255,255,255,0.9)" }}
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
                  backgroundColor: "rgba(255,255,255,0.25)",
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
            </View>

            <TouchableOpacity
              style={{ width: s(40), height: s(40) }}
              className="items-center justify-center"
              hitSlop={4}
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

          {/* Hero 본문 — 인사 + 큰 카피 + 일러스트 */}
          <View style={{ paddingHorizontal: s(16), paddingBottom: s(28) }}>
            <View className="flex-row">
              {/* 좌측 텍스트 영역 */}
              <View className="flex-1" style={{ paddingTop: s(12) }}>
                <Typography
                  variant="label-01"
                  weight="medium"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {mock.personName}님, 활기찬 오후예요
                </Typography>

                {/* 큰 강조 카피 — "{N}분 뒤 첫 상담이에요" */}
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
                      style={{
                        color: COLORS.white,
                        marginLeft: s(6),
                      }}
                    >
                      {countSub}
                    </Typography>
                  </View>
                  <Typography
                    variant="headline-02"
                    weight="semibold"
                    style={{ color: COLORS.white, marginTop: s(2) }}
                  >
                    {primaryClient?.name ?? "다음 일정"}님과 만나요
                  </Typography>
                </View>
              </View>

              {/* 우측 일러스트 — 시계 + 스파클 */}
              <ClockIllustration />
            </View>

            {/* 빠른 정보 chip — 시간/상담실/프로그램 */}
            <View
              style={{ marginTop: s(20), gap: s(8) }}
              className="flex-row flex-wrap"
            >
              <InfoChip
                icon={
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={COLORS.white}
                  />
                }
                label={`${formatHHmm(mock.nextSession.start)} ~ ${formatHHmm(mock.nextSession.end)}`}
              />
              {mock.nextSession.room_name && (
                <InfoChip
                  icon={
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={COLORS.white}
                    />
                  }
                  label={mock.nextSession.room_name}
                />
              )}
              {mock.nextSession.program_name && (
                <InfoChip
                  icon={
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color={COLORS.white}
                    />
                  }
                  label={mock.nextSession.program_name}
                />
              )}
            </View>

            {/* CTA — 흰 버튼 (컬러 hero와 강한 대비) */}
            <TouchableOpacity
              activeOpacity={0.9}
              style={{
                marginTop: s(20),
                height: s(48),
                borderRadius: s(12),
                backgroundColor: COLORS.white,
                ...SHADOWS.card,
              }}
              className="flex-row items-center justify-center"
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.primary500 }}
              >
                상담 상세보기
              </Typography>
              <Ionicons
                name="arrow-forward"
                size={s(18)}
                color={COLORS.primary500}
                style={{ marginLeft: s(6) }}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ───── 본문 (흰 영역) ───── */}
        {/* 이번주 통계 */}
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
            이번주 · {mock.weekStats.range}
          </Typography>
        </View>
        <View
          style={{ paddingHorizontal: s(16), gap: s(12) }}
          className="flex-row"
        >
          <MiniStatColored
            accent={COLORS.counseling}
            accentBg={COLORS.counselingLight}
            value={mock.weekStats.counseling}
            label="이번주 상담"
            iconName="counseling-20"
          />
          <MiniStatColored
            accent={COLORS.assessment}
            accentBg={COLORS.assessmentLight}
            value={mock.weekStats.assessment}
            label="이번주 검사"
            iconName="assessment-20"
          />
          <MiniStatColored
            accent={COLORS.error}
            accentBg="#FFE8E8"
            value={mock.weekStats.noShow}
            label="노쇼"
            ioniconsName="close-circle-outline"
          />
        </View>

        {/* 미작성 일지 CTA */}
        <UnlinkedCta count={mock.unlinkedCount} />

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
        </View>
        <View style={{ paddingHorizontal: s(16), gap: s(12) }}>
          {mock.todaySchedules.map((sch, i) => (
            <SimpleScheduleCard
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

/* ─── Sub Components ─── */

function ClockIllustration() {
  return (
    <View
      style={{
        width: s(108),
        height: s(108),
        marginLeft: s(8),
      }}
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
      <View
        style={{
          position: "absolute",
          bottom: s(2),
          left: s(0),
        }}
      >
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
    // 회색 배경 위 카드 → border 없이 shadow만으로 elevation
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

function UnlinkedCta({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    // 회색 배경 위 카드 → border 없이 shadow만
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
          <View
            style={{ position: "absolute", top: s(4), right: s(4) }}
          >
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
    // 회색 배경 위 카드 → 기본은 border 없이 shadow만.
    // "곧 시작"(isNext) 카드만 시각 강조용으로 primary 보더 유지.
    <View
      style={{
        borderRadius: s(16),
        padding: s(12),
        backgroundColor: COLORS.bg.surface,
        borderWidth: isNext ? 1.5 : 0,
        borderColor: isNext ? COLORS.primary500 : "transparent",
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
    </View>
  );
}
