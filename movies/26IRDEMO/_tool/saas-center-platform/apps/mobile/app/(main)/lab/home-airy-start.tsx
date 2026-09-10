import { useId, useState } from "react";
import { View, Pressable, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 · 여백 시작 페이지 lab.
 *
 * 기존 홈 시안들이 콘텐츠로 화면을 빽빽이 채우는 방향이라면, 이 시안은
 * "시작 페이지" 톤으로 여백을 확보하고 한 가지 핵심 정보(다음 상담)와
 * 한 가지 핵심 액션(필드노트)에만 집중한다. 참고 이미지(Botzy /
 * Smooth sailing 등)의 상단 큰 여백 + 큰 hero + 하단 알약 CTA 구조 차용.
 *
 * 시안 2개 (탭 전환):
 *   A 화이트     — 단정한 흰 배경 (가장 보수적 톤)
 *   B 그라디언트 — primary-75 → primary-50 → white 옅은 그라디언트 (참고 이미지 톤)
 *
 * 구성:
 *   상단 status pill (현재 시각) + 알림
 *   Hero 큰 문구 (다음 상담까지 N분)
 *   부제 한 줄
 *   ↓ 큰 여백
 *   다음 일정 카드 1건 (white 카드, 옅은 그림자)
 *   우측 하단 필드노트 FAB (fieldnote purple)
 *   하단 가상 탭바 (시각 참고)
 */

type Variant = "white" | "gradient" | "brand";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "white", label: "A 화이트" },
  { key: "gradient", label: "B 그라디언트" },
  { key: "brand", label: "C 풀톤" },
];

const MOCK_NEXT = {
  start: "14:00",
  end: "16:00",
  clientName: "박서연",
  program: "놀이치료",
  room: "상담실 A",
  minutesUntil: 30,
};

const MOCK_TODAY = {
  counselingCount: 3,
  assessmentCount: 2,
};

const TAB_ITEMS = ["홈", "일정", "내담자", "필드노트", "내정보"];

export default function HomeAiryStartLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("gradient");

  return (
    <View className="flex-1 bg-base">
      {/* 헤더 + 탭 — lab chrome */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              홈 시안 · 여백 시작
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? "semibold" : "medium"}
                    style={{
                      color: active ? COLORS.text.title.default : COLORS.gray[500],
                    }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* 미리보기 영역 */}
      <View style={{ flex: 1 }}>
        <Preview variant={variant} />
      </View>
    </View>
  );
}

/* ───────── Preview ───────── */

function Preview({ variant }: { variant: Variant }) {
  const isGradient = variant === "gradient";
  const isBrand = variant === "brand";
  // brand: primary 500 → 400 풀톤
  // 그라디언트: 흰색 베이스 (시각 무게는 하단 큰 반원 글로우가 잡음 — BackgroundBlobs 참고)
  // 화이트: 살짝의 primary tint만 위쪽에
  const colors: [string, string, ...string[]] = isBrand
    ? [COLORS.primary500, COLORS.primary400, COLORS.primary400]
    : isGradient
      ? [COLORS.white, COLORS.white, COLORS.white]
      : [COLORS.primary50, COLORS.white, COLORS.white];

  // brand: 반투명 white / 그 외(화이트·그라디언트 모두 흰 베이스): gray-50
  const pillBg = isBrand ? "rgba(255,255,255,0.18)" : COLORS.gray[50];

  // 텍스트 톤 — brand 풀톤이면 white 계열로
  const heroColor = isBrand ? COLORS.white : COLORS.gray[900];
  const heroAccent = isBrand ? COLORS.white : COLORS.primary;
  const subColor = isBrand ? "rgba(255,255,255,0.78)" : COLORS.gray[600];
  const pillDot = isBrand ? COLORS.white : COLORS.palette.green;
  const pillText = isBrand ? COLORS.white : COLORS.gray[700];
  const headerIcon = isBrand ? COLORS.white : COLORS.gray[700];

  return (
    <LinearGradient
      colors={colors}
      locations={
        isBrand
          ? [0, 0.4, 1]
          : isGradient
            ? [0, 0.28, 0.6, 1]
            : [0, 0.35, 1]
      }
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
    >
      {/* 배경 글로우 블롭 — brand 풀톤에선 끔 (깨끗한 단일 톤 유지) */}
      {!isBrand && <BackgroundBlobs variant={variant} />}

      {/* 상단 status row */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(20),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
            paddingHorizontal: s(12),
            paddingVertical: s(6),
            borderRadius: 999,
            backgroundColor: pillBg,
          }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: pillDot,
            }}
          />
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: pillText }}
          >
            오후 1시 30분
          </Typography>
        </View>
        <View
          style={{
            width: s(36),
            height: s(36),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={headerIcon}
          />
        </View>
      </View>

      {/* Hero 영역 — 큰 여백 위에 큰 타이틀 (weight 한 단계 낮춤) */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(64),
        }}
      >
        <Typography
          weight="semibold"
          style={{
            color: heroColor,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -1,
          }}
        >
          김민준님,{"\n"}다음 상담까지
        </Typography>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: s(8),
            marginTop: s(4),
          }}
        >
          <Typography
            weight="semibold"
            style={{
              color: heroAccent,
              fontSize: s(44),
              lineHeight: s(52),
              letterSpacing: -1.4,
            }}
          >
            30분
          </Typography>
          <Typography
            weight="semibold"
            style={{
              color: heroColor,
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -1,
            }}
          >
            남았어요
          </Typography>
        </View>
        <Typography
          variant="body-01"
          weight="regular"
          style={{
            color: subColor,
            marginTop: s(14),
          }}
        >
          잠깐 호흡 한 번 고르고 시작해요
        </Typography>

        {/* 오늘 상담·검사 카운트 칩 — hero 정보 보강 */}
        <View
          style={{
            flexDirection: "row",
            gap: s(8),
            marginTop: s(16),
          }}
        >
          <CountChip
            label="상담"
            count={MOCK_TODAY.counselingCount}
            dotColor={COLORS.counseling}
            bg={isBrand ? "rgba(255,255,255,0.18)" : COLORS.counselingLight}
            textColor={isBrand ? COLORS.white : COLORS.counseling}
          />
          <CountChip
            label="검사"
            count={MOCK_TODAY.assessmentCount}
            dotColor={COLORS.assessment}
            bg={isBrand ? "rgba(255,255,255,0.18)" : COLORS.assessmentLight}
            textColor={isBrand ? COLORS.white : COLORS.assessment}
          />
        </View>
      </View>

      {/* 화면 하단 영역 — 다음 일정 카드 + 메인 홈 동일 필드노트 CTA */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          justifyContent: "flex-end",
          paddingBottom: s(12),
          gap: s(12),
        }}
      >
        {/* 다음 일정 카드 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(20),
            paddingHorizontal: s(20),
            paddingVertical: s(18),
            gap: s(8),
            shadowColor: "#000",
            shadowOpacity: isGradient || isBrand ? 0.08 : 0.04,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: COLORS.counseling,
              }}
            />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.counseling }}
            >
              다음 일정
            </Typography>
          </View>
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
                color: COLORS.gray[900],
                fontSize: s(22),
                lineHeight: s(28),
                letterSpacing: -0.5,
              }}
            >
              {MOCK_NEXT.start}
            </Typography>
            <Typography
              variant="body-02"
              weight="regular"
              style={{ color: COLORS.gray[500] }}
            >
              ~ {MOCK_NEXT.end}
            </Typography>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {MOCK_NEXT.clientName}님 · {MOCK_NEXT.program}
          </Typography>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              marginTop: s(2),
            }}
          >
            <Icon name="location" size={s(14)} color={COLORS.gray[400]} />
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              {MOCK_NEXT.room}
            </Typography>
          </View>
        </View>

        {/* 메인 홈 변종들과 동일한 필드노트 CTA (ClipboardGreeting의 FieldnoteCta) */}
        <FieldnoteCta clientName={MOCK_NEXT.clientName} />
      </View>

      {/* 가상 탭바 (시각 참고용) */}
      <View
        style={{
          paddingHorizontal: s(8),
          paddingTop: s(8),
          paddingBottom: s(14),
          flexDirection: "row",
          justifyContent: "space-around",
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[100],
        }}
      >
        {TAB_ITEMS.map((t, i) => {
          const active = i === 0;
          return (
            <View
              key={t}
              style={{
                alignItems: "center",
                gap: s(4),
                paddingVertical: s(4),
              }}
            >
              <View
                style={{
                  width: s(22),
                  height: s(22),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: s(2),
                    backgroundColor: active ? COLORS.primary : COLORS.gray[400],
                  }}
                />
              </View>
              <Typography
                variant="caption-01"
                weight={active ? "semibold" : "regular"}
                style={{
                  color: active ? COLORS.primary : COLORS.gray[500],
                }}
              >
                {t}
              </Typography>
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

/* ───────── 배경 글로우 블롭 ─────────
 * SVG RadialGradient로 진짜 fade-out 원 — 중심에서 100% → 가장자리 0% 투명도라
 * 배경과 자연스럽게 머지된다.
 *
 * - gradient (B): 화면 하단에 큰 반원 글로우 1개 (원의 중심을 화면 하단에 두고
 *   위쪽 반원만 화면에 노출. ZERO 페이지 톤).
 * - white  (A): 톤 다양화한 4개 블롭 (블루/코랄/바이올렛/민트).
 */
function BackgroundBlobs({ variant }: { variant: Variant }) {
  const isGradient = variant === "gradient";

  if (isGradient) {
    // 하단 반원 글로우 — 원 사이즈 s(800), 중심을 화면 하단(bottom: -size/2)에 위치
    // → 원의 위쪽 반원(s(400))이 화면에 보이고 아래쪽 반원은 잘림
    return (
      <View pointerEvents="none" style={StyleSheetAbs}>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -s(400),
            alignItems: "center",
          }}
        >
          <BlobSVG
            size={s(800)}
            color={COLORS.primary300}
            opacity={0.55}
          />
        </View>
      </View>
    );
  }

  // A 화이트 — 톤 다양화한 4 블롭
  return (
    <View pointerEvents="none" style={StyleSheetAbs}>
      <View style={{ position: "absolute", top: -s(80), right: -s(110) }}>
        <BlobSVG size={s(380)} color={COLORS.primary300} opacity={0.45} />
      </View>
      <View style={{ position: "absolute", top: s(140), left: -s(110) }}>
        <BlobSVG size={s(300)} color={COLORS.palette.coral} opacity={0.22} />
      </View>
      <View style={{ position: "absolute", top: s(360), right: -s(90) }}>
        <BlobSVG size={s(280)} color={COLORS.palette.violet} opacity={0.25} />
      </View>
      <View style={{ position: "absolute", bottom: s(200), left: -s(80) }}>
        <BlobSVG size={s(240)} color={COLORS.palette.mint} opacity={0.2} />
      </View>
    </View>
  );
}

/** RadialGradient로 부드럽게 fade-out 되는 원 — 가장자리가 배경과 머지 */
function BlobSVG({
  size,
  color,
  opacity,
}: {
  size: number;
  color: string;
  opacity: number;
}) {
  const id = useId();
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop offset="60%" stopColor={color} stopOpacity={opacity * 0.4} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2}
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

// 절대 채움 헬퍼 (StyleSheet.absoluteFillObject 동등)
const StyleSheetAbs = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/* ───────── Fieldnote CTA (메인 홈 변종들과 동일) ─────────
 * 출처: app/(main)/(tabs)/_components/home-variants/ClipboardGreeting.tsx
 * 보라 그라디언트 카드 + 우측 RecordPill (흰 알약 + 빨간 dot + "녹음 시작")
 */
function FieldnoteCta({ clientName }: { clientName: string | null }) {
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
      <View
        accessibilityRole="button"
        accessibilityLabel="필드노트 녹음 시작"
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
      </View>
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
        weight="bold"
        style={{ color: COLORS.primary700 }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

/** 카테고리 dot + 라벨 + 카운트로 구성된 알약 칩 */
function CountChip({
  label,
  count,
  dotColor,
  bg,
  textColor,
}: {
  label: string;
  count: number;
  dotColor: string;
  bg: string;
  textColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
        paddingHorizontal: s(12),
        paddingVertical: s(7),
        borderRadius: s(999),
        backgroundColor: bg,
      }}
    >
      <View
        style={{
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: dotColor,
        }}
      />
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: textColor }}
      >
        {label} {count}건
      </Typography>
    </View>
  );
}
