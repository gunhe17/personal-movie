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
 * 홈 시안 3 — 일러스트 임팩트 (Illustrated)
 *
 * 강조 전략: 핵심 카드 1개에 큰 일러스트 도장 → 화면 중심을 시각 요소가 잡음.
 * 추가로 미작성 일지 카드도 컬러 풀 배경(fieldnote-purple)으로 강한 대비 만듦.
 * 통계는 작게 절제 → 시각 1순위가 명확.
 *
 * 참고: wannalist 공유 카드 — 강한 컬러 카드 + 캐릭터 일러스트 + 솔리드 CTA
 */
export default function HomeIllustratedLab() {
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
            5월 14일 목요일
          </Typography>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-1 text-title-default"
          >
            {mock.personName}님, 활기찬 오후예요
          </Typography>
        </View>

        {/* Hero — 일러스트 임팩트 카드 */}
        <View
          style={{
            marginTop: s(16),
            marginHorizontal: s(16),
            borderRadius: s(20),
            overflow: "hidden",
            backgroundColor: COLORS.primary50,
            ...SHADOWS.card,
          }}
        >
          {/* 데코 큰 원들 — 우상단/좌하단 */}
          <View
            style={{
              position: "absolute",
              top: -s(40),
              right: -s(30),
              width: s(160),
              height: s(160),
              borderRadius: s(80),
              backgroundColor: COLORS.primary100,
              opacity: 0.7,
            }}
          />
          <View
            style={{
              position: "absolute",
              top: s(40),
              right: s(20),
              width: s(64),
              height: s(64),
              borderRadius: s(32),
              backgroundColor: COLORS.primary200,
              opacity: 0.5,
            }}
          />

          <View style={{ padding: s(20) }}>
            <View className="flex-row">
              {/* 좌측 텍스트 */}
              <View className="flex-1">
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.primary700 }}
                >
                  다음 일정
                </Typography>
                <View
                  style={{ marginTop: s(8) }}
                  className="flex-row items-baseline"
                >
                  <Typography
                    weight="semibold"
                    style={{
                      color: COLORS.primary700,
                      fontSize: s(48),
                      lineHeight: s(52),
                      letterSpacing: -1.2,
                    }}
                  >
                    {countHeadline}
                  </Typography>
                  <Typography
                    variant="body-01"
                    weight="medium"
                    style={{ color: COLORS.primary800, marginLeft: s(4) }}
                  >
                    {countSub}
                  </Typography>
                </View>
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  style={{ color: COLORS.primary900, marginTop: s(4) }}
                >
                  {primaryClient?.name}님과
                </Typography>
              </View>

              {/* 우측 큰 일러스트 — 캐릭터/마스코트 느낌 */}
              <HeroCharacterIllustration />
            </View>

            {/* 메타 정보 */}
            <View
              style={{
                marginTop: s(16),
                paddingTop: s(12),
                borderTopWidth: 1,
                borderTopColor: "rgba(0,144,197,0.15)",
                gap: s(6),
              }}
            >
              <MetaRow
                icon="time-outline"
                text={`${formatHHmm(mock.nextSession.start)} ~ ${formatHHmm(mock.nextSession.end)}`}
              />
              {mock.nextSession.room_name && (
                <MetaRow
                  icon="location-outline"
                  text={mock.nextSession.room_name}
                />
              )}
              {mock.nextSession.program_name && (
                <MetaRow
                  icon="document-text-outline"
                  text={mock.nextSession.program_name}
                />
              )}
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
        </View>

        {/* 이번주 통계 — 컴팩트, 절제 */}
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
          <CompactStat
            value={mock.weekStats.counseling}
            label="이번주 상담"
            accent={COLORS.counseling}
            accentBg={COLORS.counselingLight}
            iconName="counseling-20"
          />
          <CompactStat
            value={mock.weekStats.assessment}
            label="이번주 검사"
            accent={COLORS.assessment}
            accentBg={COLORS.assessmentLight}
            iconName="assessment-20"
          />
          <CompactStat
            value={mock.weekStats.noShow}
            label="노쇼"
            accent={COLORS.error}
            accentBg="#FFE8E8"
            ioniconsName="close-circle-outline"
          />
        </View>

        {/* 미작성 일지 — 강렬한 풀컬러 카드 (wannalist 참고) */}
        <UnlinkedCtaFullColor count={mock.unlinkedCount} />

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
            <SoftScheduleCard
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

/**
 * Hero 캐릭터형 일러스트 — 마이크/문서/스파클 조합으로 "다음 일정" 무드 표현
 */
function HeroCharacterIllustration() {
  return (
    <View
      style={{ width: s(108), height: s(120), marginLeft: s(8) }}
      className="items-center justify-center"
    >
      {/* 메인 캐릭터 본체 (둥근 사각형) */}
      <View
        style={{
          width: s(80),
          height: s(96),
          borderRadius: s(28),
          backgroundColor: COLORS.white,
          ...SHADOWS.card,
        }}
        className="items-center justify-center"
      >
        {/* 캐릭터 얼굴 */}
        <View
          style={{
            width: s(64),
            height: s(64),
            borderRadius: s(32),
            backgroundColor: COLORS.primary100,
          }}
          className="items-center justify-center"
        >
          <Ionicons name="happy" size={s(40)} color={COLORS.primary700} />
        </View>
        {/* 캐릭터 발끝 (시계 아이콘) */}
        <View
          style={{
            position: "absolute",
            bottom: -s(6),
            backgroundColor: COLORS.primary,
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(999),
          }}
        >
          <Typography
            variant="caption-01"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            14:00
          </Typography>
        </View>
      </View>
      {/* 스파클 좌상단 */}
      <View
        style={{
          position: "absolute",
          top: s(4),
          left: s(0),
        }}
      >
        <Ionicons name="sparkles" size={s(18)} color={COLORS.primary} />
      </View>
      {/* 작은 점 우상단 */}
      <View
        style={{
          position: "absolute",
          top: s(20),
          right: s(8),
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: COLORS.primary,
        }}
      />
    </View>
  );
}

function MetaRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={{ gap: s(6) }} className="flex-row items-center">
      <Ionicons name={icon} size={s(14)} color={COLORS.primary700} />
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.primary800 }}
      >
        {text}
      </Typography>
    </View>
  );
}

function CompactStat({
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
        paddingVertical: s(12),
        paddingHorizontal: s(12),
        borderRadius: s(16),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: COLORS.border.default,
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <View
          style={{
            width: s(24),
            height: s(24),
            borderRadius: s(6),
            backgroundColor: accentBg,
          }}
          className="items-center justify-center"
        >
          {iconName ? (
            <Icon name={iconName} size={s(14)} color={accent} />
          ) : ioniconsName ? (
            <Ionicons name={ioniconsName} size={s(14)} color={accent} />
          ) : null}
        </View>
        <Typography
          variant="headline-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {value}
        </Typography>
      </View>
      <Typography
        variant="label-01"
        weight="regular"
        className="mt-1 text-label-default"
      >
        {label}
      </Typography>
    </View>
  );
}

/**
 * 미작성 일지 — fieldnote-purple 풀컬러 카드 (wannalist 참고)
 * - 카드 전체가 강한 컬러로 도장 → 화면에서 두 번째 시각 강조
 * - 일러스트는 White 톤으로 카드 위에 떠 있게
 */
function UnlinkedCtaFullColor({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View
      style={{
        marginTop: s(24),
        marginHorizontal: s(16),
        padding: s(20),
        borderRadius: s(20),
        backgroundColor: COLORS.fieldnote,
        overflow: "hidden",
        ...SHADOWS.float,
      }}
    >
      {/* 데코 원 */}
      <View
        style={{
          position: "absolute",
          top: -s(30),
          right: -s(20),
          width: s(100),
          height: s(100),
          borderRadius: s(50),
          backgroundColor: "rgba(255,255,255,0.12)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -s(20),
          left: -s(20),
          width: s(80),
          height: s(80),
          borderRadius: s(40),
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />

      <View className="flex-row items-center" style={{ gap: s(16) }}>
        {/* 일러스트 — 흰 카드 위 연필 + 스파클 */}
        <View
          style={{
            width: s(72),
            height: s(72),
            borderRadius: s(20),
            backgroundColor: COLORS.white,
            ...SHADOWS.card,
          }}
          className="items-center justify-center"
        >
          <Ionicons
            name="create-outline"
            size={s(32)}
            color={COLORS.fieldnote}
          />
          <View
            style={{ position: "absolute", top: s(6), right: s(6) }}
          >
            <Ionicons
              name="sparkles"
              size={s(12)}
              color={COLORS.fieldnote}
            />
          </View>
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline" style={{ gap: s(4) }}>
            <Typography
              weight="semibold"
              style={{
                color: COLORS.white,
                fontSize: s(28),
                lineHeight: s(32),
                letterSpacing: -0.5,
              }}
            >
              {count}
            </Typography>
            <Typography
              variant="body-01"
              weight="medium"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              건의 일지
            </Typography>
          </View>
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: "rgba(255,255,255,0.85)", marginTop: s(2) }}
          >
            필드노트로 빠르고{"\n"}편하게 작성해보세요
          </Typography>
        </View>
      </View>

      {/* CTA — 흰 솔리드 버튼 (wannalist 검은 버튼 영감, 컬러 카드와 강한 대비) */}
      <Pressable
        style={({ pressed }) => ({
          marginTop: s(20),
          height: s(48),
          borderRadius: s(12),
          backgroundColor: COLORS.white,
          opacity: pressed ? 0.95 : 1,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        })}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.fieldnote }}
        >
          필드노트로 작성하기
        </Typography>
        <Ionicons
          name="arrow-forward"
          size={s(18)}
          color={COLORS.fieldnote}
          style={{ marginLeft: s(6) }}
        />
      </Pressable>
    </View>
  );
}

function SoftScheduleCard({
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
  const accentBg =
    schedule.schedule_type === "counseling"
      ? COLORS.counselingLight
      : schedule.schedule_type === "assessment"
        ? COLORS.assessmentLight
        : COLORS.gray[100];

  return (
    <View
      style={{
        borderRadius: s(16),
        padding: s(12),
        backgroundColor: COLORS.bg.surface,
        borderWidth: 1,
        borderColor: isNext ? COLORS.primary : COLORS.border.default,
        ...SHADOWS.card,
      }}
      className="flex-row items-center"
    >
      {/* 카테고리 아바타 */}
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: accentBg,
        }}
        className="items-center justify-center"
      >
        {primary && (
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: accent }}
          >
            {primary.name.charAt(0)}
          </Typography>
        )}
      </View>

      <View className="flex-1" style={{ paddingLeft: s(12) }}>
        {isNext && (
          <Typography
            variant="caption-01"
            weight="semibold"
            className="text-state-brand"
          >
            곧 시작 ·{" "}
            <Typography
              variant="caption-01"
              weight="regular"
              className="text-body-subtle"
            >
              {formatHHmm(schedule.start)}
            </Typography>
          </Typography>
        )}
        {!isNext && (
          <Typography
            variant="caption-01"
            weight="regular"
            className="text-body-subtle"
          >
            {formatHHmm(schedule.start)}
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
          </Typography>
        )}
        <Typography
          variant="label-01"
          weight="regular"
          className="text-label-default"
          numberOfLines={1}
        >
          {schedule.schedule_type === "counseling" ? "상담" : "검사"}
          {schedule.program_name ? ` · ${schedule.program_name}` : ""}
        </Typography>
      </View>

      {/* 우측 카테고리 dot */}
      <View
        style={{
          width: s(8),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: accent,
          marginLeft: s(8),
        }}
      />
    </View>
  );
}
