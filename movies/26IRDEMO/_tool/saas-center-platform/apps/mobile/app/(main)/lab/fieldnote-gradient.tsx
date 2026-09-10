import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 필드노트 CTA 그라디언트 변주 — 탭 비교 lab.
 *
 * 메인 하단 floating 필드노트 컨테이너 기준으로 그라디언트 컬러 5시안을 비교한다.
 * primary cyan(#13BDFA)과 어울리되 명확히 구분되며, AI 기능이라는 인상을 줄 수 있는
 * 자연스러운 컬러 조합을 제안.
 *
 *   A — Current (현재): 보라 → 블루 (#A56EFF → #7B79FF → #219EFF)
 *   B — Cyan Bloom: primary에서 시작 → 블루 → 바이올렛 (브랜드 연결성)
 *   C — Aurora: 바이올렛 → 시안 → 민트 (변환·생성의 흐름)
 *   D — Coral Wave: 핑크 → 바이올렛 → 블루 (따뜻한 AI)
 *   E — Deep Ocean: 인디고 → 블루 → 시안 (차분·전문가 AI)
 */

type Variant =
  | "current"
  | "cyanBloom"
  | "aurora"
  | "coral"
  | "deepOcean"
  | "indigoDrift"
  | "plumSunset"
  | "cyanStream"
  | "lavenderMist"
  | "mintCool";

interface VariantConfig {
  key: Variant;
  label: string;
  hint: string;
  colors: [string, string, string];
  shadow: string;
  description: string;
}

const VARIANTS: VariantConfig[] = [
  {
    key: "current",
    label: "A 현재",
    hint: "보라 → 블루",
    colors: ["#A56EFF", "#7B79FF", "#219EFF"],
    shadow: "#7B79FF",
    description:
      "Production에 적용된 현재 그라디언트. 보라 계열로 시작해 블루로 마감되는 클래식 AI 톤.",
  },
  {
    key: "cyanBloom",
    label: "B 시안 블룸",
    hint: "Primary → 바이올렛",
    colors: ["#13BDFA", "#6A89FF", "#A56EFF"],
    shadow: "#6A89FF",
    description:
      "Primary cyan에서 시작해 블루를 거쳐 바이올렛으로 흘러가는 그라디언트. 브랜드 컬러와 직접 연결돼 화면 상단의 primary 톤과 자연스럽게 이어진다.",
  },
  {
    key: "aurora",
    label: "C 오로라",
    hint: "바이올렛 · 시안 · 민트",
    colors: ["#7B5FFF", "#00C4FF", "#00DDB8"],
    shadow: "#00C4FF",
    description:
      "바이올렛 → 시안 → 민트로 흐르는 오로라 그라디언트. AI가 음성을 텍스트로 변환·생성하는 흐름을 색으로 표현. 다채로움이 가장 큼.",
  },
  {
    key: "coral",
    label: "D 코랄 웨이브",
    hint: "핑크 → 바이올렛 → 블루",
    colors: ["#FF6B9D", "#B361FF", "#4F8FFF"],
    shadow: "#B361FF",
    description:
      "따뜻한 코랄 핑크에서 시작해 블루로 마무리. 차가운 cyan과 보색 관계지만 블루 종착으로 화해한다. 인간적이고 친근한 AI 톤.",
  },
  {
    key: "deepOcean",
    label: "E 딥 오션",
    hint: "인디고 · 블루 · 시안",
    colors: ["#1E3A8A", "#2563D9", "#00B8E8"],
    shadow: "#2563D9",
    description:
      "딥 인디고에서 라이트 시안으로 깊고 차분하게 흘러가는 그라디언트. 신뢰감·전문성이 두드러져 의료·헬스 도메인에 잘 맞는다. cyan으로 종착해 primary와 매끄럽게 이어진다.",
  },
  {
    key: "indigoDrift",
    label: "F 인디고 드리프트",
    hint: "인디고 → 바이올렛 → 라벤더",
    colors: ["#6366F1", "#8B5CF6", "#A78BFA"],
    shadow: "#8B5CF6",
    description:
      "Tailwind 500대의 인디고 → 바이올렛 → 라벤더로 부드럽게 흐르는 톤. 색조 변동이 작아 가장 절제된 AI 느낌. 어떤 화면 컨텍스트에도 잘 묻어든다.",
  },
  {
    key: "plumSunset",
    label: "G 플럼 선셋",
    hint: "핫핑크 → 바이올렛 → 인디고",
    colors: ["#EC4899", "#8B5CF6", "#6366F1"],
    shadow: "#8B5CF6",
    description:
      "핫핑크 → 바이올렛 → 인디고로 흘러가는 SaaS 표준 그라디언트. ChatGPT·Copilot 등 현대 AI 제품에 자주 쓰이는 친숙한 톤이라 \"이건 AI구나\" 라는 신호가 즉시 전달된다.",
  },
  {
    key: "cyanStream",
    label: "H 시안 스트림",
    hint: "시안 → 블루 → 인디고",
    colors: ["#06B6D4", "#3B82F6", "#6366F1"],
    shadow: "#3B82F6",
    description:
      "시안 → 블루 → 인디고로 같은 cool 계열 안에서 점진적으로 깊어진다. brand cyan과 색조 충돌이 없고 가장 일관성 있는 흐름. 안정감과 신뢰감이 가장 크다.",
  },
  {
    key: "lavenderMist",
    label: "I 라벤더 미스트",
    hint: "라벤더 → 인디고 → 블루",
    colors: ["#A78BFA", "#818CF8", "#60A5FA"],
    shadow: "#818CF8",
    description:
      "Tailwind 400대의 옅고 채도가 낮은 톤. 라벤더 → 인디고 → 블루로 가장 부드럽게 흐른다. 강한 강조 없이 \"차분하게 도와주는\" AI 인상에 적합.",
  },
  {
    key: "mintCool",
    label: "J 민트 쿨",
    hint: "민트 · 시안 · 인디고",
    colors: ["#10B981", "#06B6D4", "#6366F1"],
    shadow: "#06B6D4",
    description:
      "민트 그린에서 시작해 시안을 거쳐 인디고로. 다른 시안들과 명확히 구별되는 \"신선한 AI\" 인상. 그린이 들어가 healthcare 톤과도 잘 맞는다.",
  },
];

export default function FieldnoteGradientLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");

  const current = VARIANTS.find((v) => v.key === variant)!;

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
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
              필드노트 그라디언트 변주
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 — 시안이 많아 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
            gap: s(6),
          }}
        >
          {VARIANTS.map((v) => {
            const active = variant === v.key;
            return (
              <Pressable
                key={v.key}
                onPress={() => setVariant(v.key)}
                style={({ pressed }) => ({
                  paddingVertical: s(8),
                  paddingHorizontal: s(14),
                  borderRadius: s(999),
                  backgroundColor: active ? COLORS.gray[900] : COLORS.gray[50],
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Typography
                  variant="label-02"
                  weight={active ? "semibold" : "medium"}
                  style={{
                    color: active ? COLORS.white : COLORS.gray[500],
                  }}
                >
                  {v.label}
                </Typography>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(40),
          gap: s(20),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 시안 메타 */}
        <View style={{ gap: s(6) }}>
          <Typography
            variant="headline-02"
            weight="semibold"
            className="text-gray-900"
          >
            {current.label}
          </Typography>
          <Typography variant="body-03" className="text-gray-500">
            {current.hint}
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            className="text-gray-700"
            style={{ marginTop: s(8), lineHeight: s(20) }}
          >
            {current.description}
          </Typography>
        </View>

        {/* 컬러 칩 */}
        <View style={{ flexDirection: "row", gap: s(8) }}>
          {current.colors.map((hex) => (
            <ColorChip key={hex} hex={hex} />
          ))}
        </View>

        {/* 프리뷰 — 메인 하단 컨테이너 컨텍스트 */}
        <View style={{ gap: s(8) }}>
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-gray-500"
          >
            PREVIEW · 메인 하단 floating CTA
          </Typography>
          <FieldnoteCtaPreview
            colors={current.colors}
            shadow={current.shadow}
            clientName="김민준"
          />
        </View>

        {/* 빈 상태 프리뷰 */}
        <View style={{ gap: s(8) }}>
          <Typography
            variant="label-01"
            weight="semibold"
            className="text-gray-500"
          >
            PREVIEW · 내담자 없을 때
          </Typography>
          <FieldnoteCtaPreview
            colors={current.colors}
            shadow={current.shadow}
            clientName={null}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/* ───────────────────────── 프리뷰 컴포넌트 ───────────────────────── */

function FieldnoteCtaPreview({
  colors,
  shadow,
  clientName,
}: {
  colors: [string, string, string];
  shadow: string;
  clientName: string | null;
}) {
  const title = clientName
    ? `${clientName}님의 상담을 기록해보세요`
    : "필드노트로 기록해보세요";

  return (
    <View
      style={{
        borderRadius: s(20),
        shadowColor: shadow,
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
          colors={colors}
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
          <View style={{ flex: 1, gap: s(4) }}>
            {/* AI 뱃지 — 기능 특성 명시 */}
            <View
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: s(4),
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(999),
                backgroundColor: "rgba(255,255,255,0.22)",
              }}
            >
              <Ionicons name="sparkles" size={10} color={COLORS.white} />
              <Typography
                variant="caption-01"
                weight="semibold"
                style={{ color: COLORS.white, letterSpacing: 0.3 }}
              >
                AI
              </Typography>
            </View>
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
        weight="bold"
        style={{ color: COLORS.primary700 }}
      >
        녹음 시작
      </Typography>
    </View>
  );
}

function ColorChip({ hex }: { hex: string }) {
  return (
    <View style={{ flex: 1, gap: s(4) }}>
      <View
        style={{
          height: s(48),
          borderRadius: s(8),
          backgroundColor: hex,
        }}
      />
      <Typography
        variant="caption-01"
        weight="medium"
        className="text-gray-500"
        style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}
      >
        {hex}
      </Typography>
    </View>
  );
}
