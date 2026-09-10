import { useMemo, useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";
import { buildHomeMock, formatHHmm, getAgeFromBirth } from "./_mocks/home-mock";

/**
 * 홈 시안 — 클립보드 인사 + 컴팩트 일정 불릿
 *
 * 시안 비교:
 *  A · 연한    : 옅은 primary tint(#f4f8ff) 페이지 위에 흰 카드 + 보라 그라디언트 필드노트 CTA
 *  B · 블루    : primary500 풀 배경 + 흰 카드 + 다크 블루 솔리드 필드노트 CTA
 *  C · 다크    : gray-900 페이지 + 3명 컬러 아바타 + 다크 pill CTA + 하단 raised 흰 시트 (bankcow 톤)
 *
 * A/B 공통 특징
 *  - 날짜 + 2줄 인사말 + 클립보드 일러스트로 도장찍는 히어로
 *  - "다음 상담까지 N분 뒤" 카운트다운을 카드 상단 한 줄로 컴팩트하게
 *  - 오늘 일정은 풀카드 리스트 대신 시간·dot·이름·유형 한 줄짜리 불릿
 *  - 하단 필드노트 CTA에 "녹음 시작" 알약 버튼 (말풍선 톤의 카피)
 *
 * C 특징
 *  - 다크 풀배경 — 내담자 중심의 "오늘 만날 N명" 카피
 *  - 3명을 컬러 아바타(palette violet/coral/mint)로 미리 보여주고 인격화
 *  - 하단부터 흰 시트가 떠오르며 다음 상담 + 오늘 일정 + 필드노트 CTA 묶음
 *
 * 디자인 시스템 매핑
 *  - 일정 dot 색: counseling=#05B17A, assessment=#3495F5 (category 토큰)
 *  - A의 보라 그라디언트 CTA: home-agent-style.tsx와 동일한 ["#A56EFF","#7B79FF","#219EFF"]
 *  - B의 블루 솔리드 CTA: primary700 (#1758cc)
 *  - C의 아바타 컬러: palette.violet · palette.coral · palette.mint (Extended Palette)
 *  - C의 다크 배경: gray-900 (Primitive) — 다크 테마는 시스템에 정식 명세 없으나 lab 비교 용도
 */
type Variant = "light" | "blue" | "dark";

export default function HomeClipboardGreetingLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("light");
  const mock = useMemo(() => buildHomeMock({ minutesUntilNext: 70 }), []);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <LabTopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />
        <Intro variant={variant} />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: s(20) }}
          showsVerticalScrollIndicator={false}
        >
          {variant === "dark" ? (
            <DarkVariantFrame mock={mock} />
          ) : (
            <VariantFrame variant={variant} mock={mock} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ───────────────────────── Lab Chrome ───────────────────────── */

function LabTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(16),
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Pressable onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </Pressable>
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default, marginLeft: s(8) }}
      >
        홈 시안 · 클립보드 인사
      </Typography>
    </View>
  );
}

function VariantTabs({
  value,
  onChange,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
}) {
  const tabs: { key: Variant; label: string }[] = [
    { key: "light", label: "A · 연한" },
    { key: "blue", label: "B · 블루" },
    { key: "dark", label: "C · 다크" },
  ];
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginBottom: s(8),
        flexDirection: "row",
        backgroundColor: COLORS.gray[100],
        borderRadius: s(10),
        padding: s(3),
      }}
    >
      {tabs.map((t) => {
        const isActive = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: s(8),
              borderRadius: s(8),
              backgroundColor: isActive ? COLORS.white : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{
                color: isActive ? COLORS.text.title.default : COLORS.gray[500],
              }}
            >
              {t.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function Intro({ variant }: { variant: Variant }) {
  const txt =
    variant === "light"
      ? "옅은 블루 tint 위에 흰 카드. 강조는 보라 그라디언트 CTA 한 곳 — 따뜻한 톤."
      : variant === "blue"
        ? "Primary 풀 배경으로 브랜드 도장. 흰 카드가 떠 있고 CTA는 다크 블루 솔리드."
        : "다크 톤(gray-900) 위에 컬러 아바타 3명 + 하단에서 떠오르는 흰 시트. bankcow 톤 차용.";
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginBottom: s(8),
        padding: s(12),
        borderRadius: s(12),
        backgroundColor: COLORS.bg.selected,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(6),
      }}
    >
      <Ionicons
        name="sparkles"
        size={14}
        color={COLORS.primary700}
        style={{ marginTop: 2 }}
      />
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, flex: 1 }}
      >
        {txt}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Variant Frame ───────────────────────── */

interface FrameProps {
  variant: Variant;
  mock: ReturnType<typeof buildHomeMock>;
}

function VariantFrame({ variant, mock }: FrameProps) {
  const isBlue = variant === "blue";
  const pageBg = isBlue ? COLORS.primary500 : COLORS.bg.selected;

  return (
    <View style={{ backgroundColor: pageBg, paddingBottom: s(8) }}>
      <HomeHeader tone={variant} centerName={mock.centerName} />

      <HeroBlock
        tone={variant}
        personName={mock.personName}
        counselingCount={3}
        assessmentCount={2}
      />

      <View style={{ paddingHorizontal: s(20), gap: s(12), marginTop: s(8) }}>
        <NextSessionCard
          tone={variant}
          schedule={mock.nextSession}
          minutesLeft={70}
        />

        <TodayBulletsCard
          tone={variant}
          schedules={mock.todaySchedules}
        />
      </View>

      <View style={{ paddingHorizontal: s(20), marginTop: s(20) }}>
        <FieldnoteCta tone={variant} clientName={mock.nextSession.clients[0]?.name ?? "내담자"} />
      </View>

      <View style={{ height: s(20) }} />

      <MockTabBar tone={variant} />
    </View>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function HomeHeader({
  tone,
  centerName,
}: {
  tone: Variant;
  centerName: string;
}) {
  const isBlue = tone === "blue";
  const textColor = isBlue ? COLORS.white : COLORS.text.title.default;
  const subColor = isBlue ? "rgba(255,255,255,0.7)" : COLORS.gray[500];

  return (
    <View
      style={{
        height: s(56),
        paddingHorizontal: s(20),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: isBlue
              ? "rgba(255,255,255,0.18)"
              : COLORS.primary75,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={14}
            color={isBlue ? COLORS.white : COLORS.primary700}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: textColor }}
          numberOfLines={1}
        >
          {centerName}
        </Typography>
        <Ionicons name="chevron-down" size={16} color={subColor} />
      </View>

      <Pressable hitSlop={6} style={{ padding: s(4) }}>
        <View>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={isBlue ? COLORS.white : COLORS.gray[800]}
          />
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
              borderColor: isBlue ? COLORS.primary500 : COLORS.bg.selected,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function HeroBlock({
  tone,
  personName,
  counselingCount,
  assessmentCount,
}: {
  tone: Variant;
  personName: string;
  counselingCount: number;
  assessmentCount: number;
}) {
  const isBlue = tone === "blue";
  const headlineColor = isBlue ? COLORS.white : COLORS.text.title.default;
  const dateColor = isBlue ? "rgba(255,255,255,0.75)" : COLORS.gray[500];
  const statColor = isBlue ? "rgba(255,255,255,0.85)" : COLORS.gray[600];

  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(8),
        paddingBottom: s(20),
        flexDirection: "row",
      }}
    >
      <View style={{ flex: 1, gap: s(8) }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: dateColor }}
        >
          2025년 5월 15일 금요일
        </Typography>
        <Typography
          weight="bold"
          style={{
            color: headlineColor,
            fontSize: s(26),
            lineHeight: s(36),
            letterSpacing: -0.8,
          }}
        >
          {personName}님,{"\n"}활기찬 오후예요
        </Typography>

        {/* 통계 dot — 시스템 category 색 사용 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
            marginTop: s(8),
          }}
        >
          <StatDot
            color={COLORS.counseling}
            label={`상담 ${counselingCount}건`}
            textColor={statColor}
          />
          <StatDot
            color={COLORS.assessment}
            label={`검사 ${assessmentCount}건`}
            textColor={statColor}
          />
        </View>
      </View>

      {/* 우측 클립보드 일러스트 */}
      <ClipboardIllustration tone={tone} />
    </View>
  );
}

function StatDot({
  color,
  label,
  textColor,
}: {
  color: string;
  label: string;
  textColor: string;
}) {
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
        style={{ color: textColor }}
      >
        {label}
      </Typography>
    </View>
  );
}

/** 클립보드 형태를 단순 View 레이어로 근사 */
function ClipboardIllustration({ tone }: { tone: Variant }) {
  const isBlue = tone === "blue";
  // 카드 색: 블루 배경에서는 더 밝은 흰톤, 라이트 배경에서는 primary75
  const boardBg = isBlue ? "rgba(255,255,255,0.95)" : COLORS.white;
  const boardAccent = isBlue ? COLORS.primary100 : COLORS.primary75;
  const lineColor = isBlue ? COLORS.primary200 : COLORS.primary100;

  return (
    <View
      style={{
        width: s(100),
        height: s(110),
        marginLeft: s(4),
      }}
    >
      {/* 배경 글로우 */}
      <View
        style={{
          position: "absolute",
          right: s(4),
          top: s(14),
          width: s(86),
          height: s(86),
          borderRadius: s(43),
          backgroundColor: isBlue
            ? "rgba(255,255,255,0.12)"
            : COLORS.primary75,
        }}
      />

      {/* 클립보드 본체 */}
      <View
        style={{
          position: "absolute",
          right: s(10),
          top: s(20),
          width: s(72),
          height: s(86),
          borderRadius: s(10),
          backgroundColor: boardBg,
          ...SHADOWS.card,
          padding: s(10),
          paddingTop: s(18),
          gap: s(6),
          overflow: "hidden",
        }}
      >
        {/* 클립 헤더 */}
        <View
          style={{
            position: "absolute",
            top: s(-8),
            left: s(20),
            width: s(32),
            height: s(12),
            borderRadius: s(4),
            backgroundColor: boardAccent,
          }}
        />
        {/* 리스트 행 */}
        <View
          style={{
            width: "80%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: lineColor,
          }}
        />
        <View
          style={{
            width: "60%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: lineColor,
          }}
        />
        <View
          style={{
            width: "70%",
            height: s(6),
            borderRadius: s(3),
            backgroundColor: lineColor,
          }}
        />
        {/* 체크 마크 */}
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

      {/* 펜 데코 */}
      <View
        style={{
          position: "absolute",
          right: s(2),
          top: s(64),
          width: s(36),
          height: s(8),
          borderRadius: s(4),
          backgroundColor: isBlue ? COLORS.primary300 : COLORS.primary400,
          transform: [{ rotate: "28deg" }],
        }}
      />
      {/* 스파클 */}
      <Ionicons
        name="sparkles"
        size={14}
        color={isBlue ? COLORS.white : COLORS.primary500}
        style={{ position: "absolute", right: s(0), top: s(8) }}
      />
    </View>
  );
}

/* ───────────────────────── Next Session Card ───────────────────────── */

function NextSessionCard({
  tone,
  schedule,
  minutesLeft,
}: {
  tone: Variant;
  schedule: ReturnType<typeof buildHomeMock>["nextSession"];
  minutesLeft: number;
}) {
  const primary = schedule.clients[0];
  const countdownLabel = formatCountdownPhrase(minutesLeft);
  const age = primary?.birth_date ? getAgeFromBirth(primary.birth_date) : null;
  const isCounseling = schedule.schedule_type === "counseling";
  const accent = isCounseling ? COLORS.counseling : COLORS.assessment;
  const accentBg = isCounseling
    ? COLORS.counselingLight
    : COLORS.assessmentLight;

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(12),
        ...(tone === "blue" ? SHADOWS.card : {}),
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
          weight="bold"
          style={{ color: COLORS.text.title.default, flex: 1 }}
        >
          {primary?.name ?? "내담자"}님의 {isCounseling ? "상담" : "검사"}
        </Typography>
      </View>

      {age !== null && primary && (
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {primary.gender === "female" ? "여" : "남"}
          {"  |  "}만 {age}세
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
        <MetaRow
          icon="location-20"
          text={schedule.room_name ?? "상담실 미지정"}
        />
        <MetaRow
          icon="document-20"
          text={schedule.program_name ?? "프로그램 미지정"}
        />
      </View>
    </View>
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
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
    >
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

function formatCountdownPhrase(minutes: number): string {
  if (minutes <= 0) return "지금 상담이 시작됐어요";
  if (minutes < 60) return `${minutes}분 뒤에 상담이 시작돼요`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간 뒤에 상담이 시작돼요`;
  return `${h}시간 ${m}분 뒤에 상담이 시작돼요`;
}

/* ───────────────────────── Today Bullets Card ───────────────────────── */

function TodayBulletsCard({
  tone,
  schedules,
}: {
  tone: Variant;
  schedules: ReturnType<typeof buildHomeMock>["todaySchedules"];
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(14),
        ...(tone === "blue" ? SHADOWS.card : {}),
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
          weight="bold"
          style={{ color: COLORS.text.title.default }}
        >
          오늘 일정
        </Typography>
        <Pressable hitSlop={6}>
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
        {schedules.map((sch, i) => (
          <View key={sch.id}>
            <BulletRow schedule={sch} />
            {i < schedules.length - 1 && <BulletConnector />}
          </View>
        ))}
      </View>
    </View>
  );
}

/** 불릿 사이를 잇는 연한 1px 라인 — dot 중심(x = s(8)/2)에 정렬 */
function BulletConnector() {
  return (
    <View
      style={{
        width: 1,
        height: s(10),
        marginLeft: s(8) / 2 - 0.5,
        backgroundColor: COLORS.gray[200],
      }}
    />
  );
}

function BulletRow({
  schedule,
}: {
  schedule: ReturnType<typeof buildHomeMock>["todaySchedules"][0];
}) {
  const isCounseling = schedule.schedule_type === "counseling";
  const dotColor = isCounseling ? COLORS.counseling : COLORS.assessment;
  const typeLabel = isCounseling ? "상담" : schedule.program_name ?? "검사";
  const primary = schedule.clients[0];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
      }}
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
        variant="body-02"
        weight="semibold"
        style={{
          color: COLORS.text.title.default,
          fontVariant: ["tabular-nums"],
          minWidth: s(52),
        }}
      >
        {formatHHmm(schedule.start)}
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.strong, flex: 1 }}
        numberOfLines={1}
      >
        {primary?.name ?? ""} {typeLabel}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Fieldnote CTA ───────────────────────── */

function FieldnoteCta({
  tone,
  clientName,
}: {
  tone: Variant;
  clientName: string;
}) {
  if (tone === "blue") return <FieldnoteCtaSolid clientName={clientName} />;
  return <FieldnoteCtaGradient clientName={clientName} />;
}

function FieldnoteCtaGradient({ clientName }: { clientName: string }) {
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
              weight="bold"
              style={{ color: COLORS.white }}
              numberOfLines={1}
            >
              {clientName}님의 상담을 기록해보세요
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
          <RecordPill tone="onGradient" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function FieldnoteCtaSolid({ clientName }: { clientName: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="필드노트 녹음 시작"
      style={({ pressed }) => ({
        borderRadius: s(20),
        paddingVertical: s(16),
        paddingHorizontal: s(20),
        backgroundColor: COLORS.primary700,
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View style={{ flex: 1, gap: s(2) }}>
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {clientName}님의 상담을 기록해보세요
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
      <RecordPill tone="onDark" />
    </Pressable>
  );
}

function RecordPill({ tone }: { tone: "onGradient" | "onDark" }) {
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
        weight="bold"
        style={{
          color: tone === "onGradient" ? COLORS.primary700 : COLORS.text.title.default,
        }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

/* ───────────────────────── Mock Tab Bar ───────────────────────── */

function MockTabBar({ tone }: { tone: Variant }) {
  const isBlue = tone === "blue";
  const isDark = tone === "dark";
  const bg = isDark ? COLORS.gray[800] : isBlue ? COLORS.primary600 : COLORS.white;
  const border = isDark
    ? "rgba(255,255,255,0.08)"
    : isBlue
      ? "rgba(255,255,255,0.18)"
      : COLORS.border.default;
  const active = isDark ? COLORS.white : isBlue ? COLORS.white : COLORS.primary500;
  const inactive = isDark
    ? "rgba(255,255,255,0.45)"
    : isBlue
      ? "rgba(255,255,255,0.55)"
      : COLORS.gray[400];

  // 활성 탭: 라이트는 홈, 블루는 내정보 (참고 이미지와 동일), 다크는 홈
  const activeKey = isBlue ? "me" : "home";

  const items: {
    key: string;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }[] = [
    { key: "home", label: "홈", icon: "home" },
    { key: "schedule", label: "일정", icon: "calendar-outline" },
    { key: "client", label: "내담자", icon: "people-outline" },
    { key: "field", label: "필드노트", icon: "mic-outline" },
    { key: "me", label: "내정보", icon: "person-circle-outline" },
  ];

  return (
    <View
      style={{
        marginTop: s(8),
        backgroundColor: bg,
        borderTopWidth: 1,
        borderTopColor: border,
        paddingTop: s(8),
        paddingBottom: s(20),
        paddingHorizontal: s(8),
        flexDirection: "row",
        justifyContent: "space-between",
        borderRadius: s(12),
        marginHorizontal: s(0),
      }}
    >
      {items.map((it) => {
        const isActive = it.key === activeKey;
        const color = isActive ? active : inactive;
        return (
          <View
            key={it.key}
            style={{
              flex: 1,
              alignItems: "center",
              gap: s(4),
              paddingVertical: s(4),
            }}
          >
            <Ionicons name={it.icon} size={22} color={color} />
            <Typography
              variant="label-02"
              weight={isActive ? "semibold" : "regular"}
              style={{ color }}
            >
              {it.label}
            </Typography>
          </View>
        );
      })}
    </View>
  );
}

/* ───────────────────────── C · 다크 변종 ─────────────────────────
 *
 * 레퍼런스(bankcow): 다크 풀배경 + 가로 캐릭터 아바타 + 다크 pill CTA + 하단 raised 흰 시트.
 * 우리 앱 맥락: 캐릭터 → 오늘 만날 내담자 3명의 이니셜 아바타, 흰 시트 → 다음 상담 + 일정 + CTA 묶음.
 */

function DarkVariantFrame({ mock }: { mock: ReturnType<typeof buildHomeMock> }) {
  const upcoming = mock.todaySchedules.slice(0, 3);

  return (
    <View style={{ backgroundColor: COLORS.gray[900] }}>
      <DarkHeader centerName={mock.centerName} unreadCount={mock.unreadCount} />

      <DarkHero
        personName={mock.personName}
        upcoming={upcoming}
      />

      <View style={{ paddingHorizontal: s(20), marginTop: s(20) }}>
        <DarkCtaPill label="오늘 일정 모두 보기" />
      </View>

      {/* 하단 raised 흰 시트 — 다음 상담 + 오늘 일정 + 필드노트 CTA */}
      <RaisedWhiteSheet
        nextSession={mock.nextSession}
        schedules={mock.todaySchedules}
      />

      <MockTabBar tone="dark" />
    </View>
  );
}

function DarkHeader({
  centerName,
  unreadCount,
}: {
  centerName: string;
  unreadCount: number;
}) {
  return (
    <View
      style={{
        height: s(56),
        paddingHorizontal: s(20),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
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
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {centerName}
        </Typography>
        <Ionicons
          name="chevron-down"
          size={16}
          color="rgba(255,255,255,0.6)"
        />
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
      >
        <View
          style={{
            width: s(32),
            height: s(32),
            borderRadius: s(16),
            backgroundColor: "rgba(255,255,255,0.10)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="person"
            size={16}
            color="rgba(255,255,255,0.7)"
          />
        </View>
        <Pressable hitSlop={6} style={{ padding: s(4) }}>
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
    </View>
  );
}

function DarkHero({
  personName,
  upcoming,
}: {
  personName: string;
  upcoming: ReturnType<typeof buildHomeMock>["todaySchedules"];
}) {
  const count = upcoming.length;
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(12),
        paddingBottom: s(8),
        gap: s(28),
      }}
    >
      <Typography
        weight="bold"
        style={{
          color: COLORS.white,
          fontSize: s(28),
          lineHeight: s(38),
          letterSpacing: -0.8,
        }}
      >
        {personName}님,{"\n"}오늘 만날{" "}
        <Typography
          weight="bold"
          style={{
            color: COLORS.primary300,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -0.8,
          }}
        >
          {count}명
        </Typography>
        이에요
      </Typography>

      <ClientAvatarsRow upcoming={upcoming} />
    </View>
  );
}

/** 오늘 만날 내담자 3명을 컬러 아바타로 가로 배치 — 이름 이니셜 + palette 컬러 */
const AVATAR_COLORS = [
  { bg: COLORS.palette.violet, fg: COLORS.white },
  { bg: COLORS.palette.coral, fg: COLORS.white },
  { bg: COLORS.palette.mint, fg: COLORS.white },
];

function ClientAvatarsRow({
  upcoming,
}: {
  upcoming: ReturnType<typeof buildHomeMock>["todaySchedules"];
}) {
  // 3명 미만일 때도 가로 균형 유지: 빈 슬롯은 placeholder
  const slots = Array.from({ length: 3 }, (_, i) => upcoming[i] ?? null);

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: s(14),
      }}
    >
      {slots.map((sch, i) => {
        const color = AVATAR_COLORS[i];
        const primary = sch?.clients?.[0];
        const initial = primary?.name?.charAt(0) ?? "·";
        // 가운데 아바타를 약간 크게 — 시선 집중
        const size = i === 1 ? s(116) : s(104);
        return (
          <View key={i} style={{ alignItems: "center", gap: s(10) }}>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: sch ? color.bg : "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Typography
                weight="bold"
                style={{
                  color: sch ? color.fg : "rgba(255,255,255,0.35)",
                  fontSize: s(i === 1 ? 44 : 38),
                  lineHeight: s(i === 1 ? 50 : 44),
                  letterSpacing: -1,
                }}
              >
                {initial}
              </Typography>
            </View>
            {sch && primary && (
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: "rgba(255,255,255,0.85)" }}
                numberOfLines={1}
              >
                {primary.name}
              </Typography>
            )}
          </View>
        );
      })}
    </View>
  );
}

function DarkCtaPill({ label }: { label: string }) {
  return (
    <Pressable
      style={({ pressed }) => ({
        height: s(56),
        borderRadius: s(16),
        backgroundColor: COLORS.gray[800],
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        opacity: pressed ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

function RaisedWhiteSheet({
  nextSession,
  schedules,
}: {
  nextSession: ReturnType<typeof buildHomeMock>["nextSession"];
  schedules: ReturnType<typeof buildHomeMock>["todaySchedules"];
}) {
  const primary = nextSession.clients[0];
  const age = primary?.birth_date ? getAgeFromBirth(primary.birth_date) : null;

  return (
    <View
      style={{
        marginTop: s(28),
        backgroundColor: COLORS.white,
        borderTopLeftRadius: s(28),
        borderTopRightRadius: s(28),
        paddingHorizontal: s(20),
        paddingTop: s(24),
        paddingBottom: s(20),
        gap: s(20),
      }}
    >
      {/* 다음 상담 섹션 — 큰 시간 숫자 + 메타 + 더보기 */}
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
              {formatHHmm(nextSession.start)}
            </Typography>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.body.subtle }}
            >
              ~ {formatHHmm(nextSession.end)}
            </Typography>
          </View>
          <Pressable
            style={({ pressed }) => ({
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(999),
              backgroundColor: COLORS.gray[100],
              opacity: pressed ? 0.85 : 1,
            })}
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
          {primary?.name}님의 {nextSession.schedule_type === "counseling" ? "상담" : "검사"}
        </Typography>
        {primary && age !== null && (
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {primary.gender === "female" ? "여" : "남"} · 만 {age}세 ·{" "}
            {nextSession.program_name ?? ""}
          </Typography>
        )}
      </View>

      {/* divider */}
      <View
        style={{ height: 1, backgroundColor: COLORS.gray[100] }}
      />

      {/* 오늘 일정 — 가벼운 불릿 (양식 통일) */}
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
          {schedules.map((sch, i) => (
            <View key={sch.id}>
              <BulletRow schedule={sch} />
              {i < schedules.length - 1 && <BulletConnector />}
            </View>
          ))}
        </View>
      </View>

      {/* 필드노트 CTA — 다크 톤 일관성을 위해 다크 알약 */}
      <View style={{ marginTop: s(4) }}>
        <DarkFieldnoteCta clientName={primary?.name ?? "내담자"} />
      </View>
    </View>
  );
}

function DarkFieldnoteCta({ clientName }: { clientName: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="필드노트 녹음 시작"
      style={({ pressed }) => ({
        borderRadius: s(20),
        paddingVertical: s(16),
        paddingHorizontal: s(20),
        backgroundColor: COLORS.gray[900],
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View style={{ flex: 1, gap: s(2) }}>
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {clientName}님의 상담을 기록해보세요
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: "rgba(255,255,255,0.65)" }}
          numberOfLines={1}
        >
          필드노트가 대화를 정리해드려요
        </Typography>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          backgroundColor: COLORS.fieldnote,
          paddingHorizontal: s(14),
          paddingVertical: s(10),
          borderRadius: s(999),
        }}
      >
        <Ionicons name="mic" size={14} color={COLORS.white} />
        <Typography
          variant="body-03"
          weight="bold"
          style={{ color: COLORS.white }}
        >
          녹음 시작
        </Typography>
      </View>
    </Pressable>
  );
}
