import { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 · Brief + 신호 + Voice chips
 *
 * 사용자 시점 — 각 도메인 메뉴가 이미 "그 도메인 안의 선별 정보"를 보여주므로,
 * 홈은 **여러 도메인을 가로지르는** 시점을 가져야 차별성이 생긴다.
 *
 * 골격:
 *  1) 인사 — 가볍게 (자기 자랑 X)
 *  2) Hero 신호 — 오늘 가장 시급한 1건 (도메인 라벨·색 구분 X, 결국 다 "처리할 일")
 *  3) 보조 신호 — 나머지 신호 1~2건 짧은 줄글
 *  4) Voice chips + mic — 신호에서 파생된 prompt + fallback 진입
 *
 * 탭:
 *  - current  : Voice-First (현재 production) 미니어처
 *  - final    : 최종 시안 (brief + signals + chips)
 */

type Variant =
  | "current"
  | "final-loose"
  | "final-cards"
  | "final-stack"
  | "final-stack-ui";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "Voice (현재)" },
  { key: "final-loose", label: "최종 시안 1" },
  { key: "final-cards", label: "최종 시안 2" },
  { key: "final-stack", label: "최종 시안 3" },
  { key: "final-stack-ui", label: "최종 시안 4" },
];

export default function HomeBriefSignalsLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("final-stack-ui");

  return (
    <View className="flex-1 bg-base">
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
              홈 · Brief + 신호 + Voice
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

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

      {variant === "current" ? (
        <CurrentMini />
      ) : variant === "final-loose" ? (
        <FinalDesign />
      ) : variant === "final-cards" ? (
        <FinalDesignCards />
      ) : variant === "final-stack" ? (
        <FinalDesignStack />
      ) : (
        <FinalDesignStackUi />
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 최종 시안 — Brief + Hero 신호 + 보조 + Chips
 * ──────────────────────────────────────────── */

const FINAL_HERO = {
  /** 카드 위 라벨 — 도메인 명이 아닌 "오늘의 의미" 라벨 */
  context: "오늘 첫 만남",
  /** 가장 중요한 한 문장 */
  headline: "박지훈님과\n처음 만나실 날이에요",
  time: "14:00",
  meta: "높이세곳 그룹 세션",
};

const FINAL_SUB_SIGNALS = [
  "어제까지 일지 3건이 비어 있어요",
  "이수연님 종결, 이번 주 안에 결정해 보세요",
];

/**
 * agentic 신호 처리 액션 chips.
 * 카드의 신호(brief)에 대응하는 후속 액션을 제시.
 *  - "상담 전 박지훈님 알아보기"  ↔ §4-1 오늘 예정 세션
 *  - "미작성 일지 3건 작성하기"       ↔ §4-2 상담일지 미작성
 *  - "이수연님 종결 여부 정하기"  ↔ §4-3 상담 종결/연장 결정 필요
 */
const FINAL_CHIPS = [
  "상담 전 박지훈님 알아보기",
  "미작성 일지 3건 작성하기",
  "이수연님 종결 여부 정하기",
];

function FinalDesign() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      contentContainerStyle={{ paddingBottom: s(60) }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1) 인사 영역 — 가볍게 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
        }}
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          className="text-gray-900"
        >
          안녕하세요, 김민준님
        </Typography>
        <Typography
          variant="body-03"
          className="text-gray-500"
          style={{ marginTop: s(4) }}
        >
          5월 21일 목요일
        </Typography>
      </View>

      {/* 2) Hero 신호 카드 — 도메인 라벨·색 구분 없이 */}
      <View
        style={{
          marginTop: s(24),
          marginHorizontal: s(LAYOUT.screenPaddingX),
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          paddingVertical: s(20),
          paddingHorizontal: s(20),
        }}
      >
        <Typography
          variant="label-01"
          weight="medium"
          className="text-gray-500"
        >
          {FINAL_HERO.context}
        </Typography>
        <Typography
          variant="headline-02"
          weight="semibold"
          className="text-gray-900"
          style={{ marginTop: s(8) }}
        >
          {FINAL_HERO.headline}
        </Typography>

        <View
          style={{
            marginTop: s(16),
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
          >
            {FINAL_HERO.time}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(12),
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography variant="body-02" className="text-gray-600">
            {FINAL_HERO.meta}
          </Typography>
        </View>
      </View>

      {/* 3) 보조 신호 — 짧은 줄글 (TO DO 나열 회피) */}
      <View
        style={{
          marginTop: s(24),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          gap: s(12),
        }}
      >
        {FINAL_SUB_SIGNALS.map((text) => (
          <View
            key={text}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: s(10),
            }}
          >
            <View
              style={{
                marginTop: s(9),
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: COLORS.gray[400],
              }}
            />
            <Typography
              variant="body-02"
              className="text-gray-700"
              style={{ flex: 1 }}
            >
              {text}
            </Typography>
          </View>
        ))}
      </View>

      {/* 4) Voice — chips + mic. mic은 chip 라인 끝의 작은 버튼.
       *    화면 내 primary는 mic 한 곳만(강조 1곳 규칙). */}
      <View
        style={{
          marginTop: s(40),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: s(8),
            alignItems: "center",
          }}
        >
          {FINAL_CHIPS.map((chip) => (
            <View
              key={chip}
              style={{
                paddingVertical: s(8),
                paddingHorizontal: s(14),
                backgroundColor: COLORS.gray[100],
                borderRadius: 999,
              }}
            >
              <Typography
                variant="body-03"
                weight="medium"
                className="text-gray-700"
              >
                {chip}
              </Typography>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => ({
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.primary500,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              marginLeft: s(2),
            })}
            accessibilityRole="button"
            accessibilityLabel="음성으로 묻기"
          >
            <Ionicons name="mic-outline" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────
 * Voice-First (현재) 미니어처
 *  - production 다크 컨셉의 핵심 시각만 모방
 *  - 다크 배경, 인사, 4개 prompt 그리드, 중앙 mic
 * ──────────────────────────────────────────── */

const CURRENT_PROMPTS = [
  // "필드노트" prompt 는 일단 제거(나중에 재검토). production 시안 1 미니어처에선 잠시 빠진 상태.
  { title: "오늘 일정", subtitle: "알려줘" },
  { title: "다음 회기", subtitle: "준비해줘" },
  { title: "미작성 일지", subtitle: "초안 보여줘" },
];

function CurrentMini() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0E1118" }}
      contentContainerStyle={{ paddingBottom: s(80), flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(40),
        }}
      >
        <Typography
          variant="body-03"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          마음숲 상담센터
        </Typography>
        <Typography
          weight="semibold"
          style={{
            fontSize: s(28),
            lineHeight: s(38),
            color: COLORS.white,
            marginTop: s(12),
          }}
        >
          안녕하세요,{"\n"}김민준님
        </Typography>
      </View>

      <View
        style={{
          marginTop: s(40),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          flexDirection: "row",
          flexWrap: "wrap",
          gap: s(12),
        }}
      >
        {CURRENT_PROMPTS.map((p) => (
          <View
            key={p.title}
            style={{
              width: "48%",
              paddingVertical: s(16),
              paddingHorizontal: s(16),
              borderRadius: s(16),
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              {p.title}
            </Typography>
            <Typography
              variant="body-03"
              style={{
                color: "rgba(255,255,255,0.55)",
                marginTop: s(4),
              }}
            >
              {p.subtitle}
            </Typography>
          </View>
        ))}
      </View>

      <View style={{ alignItems: "center", marginTop: s(56) }}>
        <View
          style={{
            width: s(76),
            height: s(76),
            borderRadius: s(38),
            backgroundColor: COLORS.primary500,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="mic" size={32} color={COLORS.white} />
        </View>
        <Typography
          variant="body-03"
          style={{ color: "rgba(255,255,255,0.55)", marginTop: s(12) }}
        >
          말씀해 주세요
        </Typography>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────
 * 최종 시안 2 — 도메인 라벨 카드 (Hero 1 + 보조 2)
 *
 * 탭 2(최종 시안 1)와의 차이:
 *  - 보조 신호가 줄글 → 카드로 승격
 *  - 카드 좌상단에 도메인 라벨 명시 (일정 / 일지 / 종결)
 *  - 색·아이콘 분류 없이 텍스트 라벨만으로 도메인 표시
 *  - 시각 위계는 카드 크기·내부 텍스트 크기로 처리 (Hero 1 + 작은 카드 2)
 * ──────────────────────────────────────────── */

function FinalDesignCards() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      contentContainerStyle={{ paddingBottom: s(60) }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1) 인사 영역 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
        }}
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          className="text-gray-900"
        >
          안녕하세요, 김민준님
        </Typography>
        <Typography
          variant="body-03"
          className="text-gray-500"
          style={{ marginTop: s(4) }}
        >
          5월 21일 목요일
        </Typography>
      </View>

      {/* 2) 도메인 카드 — Hero 1 + 보조 2 */}
      <View
        style={{
          marginTop: s(24),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          gap: s(12),
        }}
      >
        {/* Hero 카드 — 일정 (가장 시급한 도메인) */}
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(16),
            paddingVertical: s(20),
            paddingHorizontal: s(20),
          }}
        >
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            일정
          </Typography>
          <Typography
            variant="headline-02"
            weight="semibold"
            className="text-gray-900"
            style={{ marginTop: s(8) }}
          >
            박지훈님과{"\n"}처음 만나실 날이에요
          </Typography>
          <View
            style={{
              marginTop: s(16),
              flexDirection: "row",
              alignItems: "center",
              gap: s(12),
            }}
          >
            <Typography
              variant="body-01"
              weight="semibold"
              className="text-gray-900"
            >
              14:00
            </Typography>
            <View
              style={{
                width: 1,
                height: s(12),
                backgroundColor: COLORS.gray[300],
              }}
            />
            <Typography variant="body-02" className="text-gray-600">
              높이세곳 그룹 세션
            </Typography>
          </View>
        </View>

        {/* 작은 카드 — 일지 */}
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(16),
            paddingVertical: s(16),
            paddingHorizontal: s(20),
          }}
        >
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            일지
          </Typography>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            style={{ marginTop: s(6) }}
          >
            어제까지 일지 3건이 비어 있어요
          </Typography>
        </View>

        {/* 작은 카드 — 종결 */}
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(16),
            paddingVertical: s(16),
            paddingHorizontal: s(20),
          }}
        >
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            종결
          </Typography>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            style={{ marginTop: s(6) }}
          >
            이수연님 종결, 이번 주에 결정해 보세요
          </Typography>
        </View>
      </View>

      {/* 3) Voice — chips + mic (탭 2와 동일) */}
      <View
        style={{
          marginTop: s(32),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: s(8),
            alignItems: "center",
          }}
        >
          {FINAL_CHIPS.map((chip) => (
            <View
              key={chip}
              style={{
                paddingVertical: s(8),
                paddingHorizontal: s(14),
                backgroundColor: COLORS.gray[100],
                borderRadius: 999,
              }}
            >
              <Typography
                variant="body-03"
                weight="medium"
                className="text-gray-700"
              >
                {chip}
              </Typography>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => ({
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.primary500,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              marginLeft: s(2),
            })}
            accessibilityRole="button"
            accessibilityLabel="음성으로 묻기"
          >
            <Ionicons name="mic-outline" size={18} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────
 * 최종 시안 3 — 깔끔 + 여백의 미 + agent 추천 검색어 stack
 *
 * 컨셉:
 *  - 메인 히어로 문구 + 예정된 일정 카드가 상단에서 중심을 잡음
 *  - 그 아래에 처리할 액션(agentic 신호)이 stack 으로 쌓임
 *  - agent 서비스 메인의 추천 검색어 UI 패턴 — 텍스트 좌측, ↗ 우측, divider 없이 spacing 만
 *  - mic 없음 — voice 진입은 이 컨셉의 메인 동선이 아님
 * ──────────────────────────────────────────── */

const FINAL_STACK_ACTIONS = [
  { label: "상담 전 박지훈님 알아보기", icon: "document-text-outline" as const },
  { label: "미작성 일지 3건 작성하기", icon: "create-outline" as const },
  { label: "이수연님 종결 여부 정하기", icon: "flag-outline" as const },
];

function FinalDesignStack() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.white }}
      contentContainerStyle={{ paddingBottom: s(80) }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1) 메인 히어로 문구 — 인사 + 날짜. 여백을 크게 둬서 중심 잡기 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
        }}
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          className="text-gray-900"
        >
          안녕하세요, 김민준님
        </Typography>
        <Typography
          variant="body-03"
          className="text-gray-500"
          style={{ marginTop: s(6) }}
        >
          5월 21일 목요일
        </Typography>
      </View>

      {/* 2) 예정된 일정 카드 — §3-1 일정 정보 스펙 충실 + 상단 컨텍스트 라벨.
       *    정보 구성: 컨텍스트 라벨 · 내담자명 · 시간 · 장소 · 프로그램 · (상태 뱃지)
       *    statement 톤은 라벨로 흡수 — 카드 본문은 표준 정보 카드 패턴 유지. */}
      <View
        style={{
          marginTop: s(32),
          marginHorizontal: s(LAYOUT.screenPaddingX),
          backgroundColor: COLORS.gray[50],
          borderRadius: s(20),
          paddingVertical: s(24),
          paddingHorizontal: s(20),
        }}
      >
        {/* 컨텍스트 라벨 — agentic brief (신호 있을 때 변동, default는 "예정된 일정") */}
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.gray[600] }}
        >
          오늘 첫 만남
        </Typography>

        {/* 메인 타이틀 — 내담자명. 그룹이면 "외 N명" 표기 (§3-1) */}
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-gray-900"
          style={{ marginTop: s(8) }}
        >
          박지훈님 외 4명
        </Typography>

        {/* 메타 — 시간(범위 §12.7) · divider · 장소·프로그램 */}
        <View
          style={{
            marginTop: s(12),
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
          >
            14:00 ~ 15:00
          </Typography>
          <View
            style={{
              width: 1,
              height: s(12),
              backgroundColor: COLORS.gray[300],
              marginHorizontal: s(12),
            }}
          />
          <Typography variant="body-02" className="text-gray-600">
            높이세곳 · 놀이치료-그룹
          </Typography>
        </View>
      </View>

      {/* 3) 액션 stack — pill chip 컨테이너 세로 stack.
       *    텍스트가 길어 가로 wrap 대신 hug 폭으로 아래로 쌓고, 화면 가운데 정렬.
       *    page=white 위에 chip=white + 미묘한 shadow 로 떠 보이게.
       *    lab 시안이라 onPress 동작 불필요 → Pressable 대신 View 로 단순화. */}
      <View
        style={{
          marginTop: s(40),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          alignItems: "center",
        }}
      >
        {FINAL_STACK_ACTIONS.map((item, idx) => (
          <View
            key={item.label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: s(12),
              paddingHorizontal: s(16),
              backgroundColor: COLORS.white,
              borderRadius: 999,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 6,
              elevation: 2,
              marginTop: idx === 0 ? 0 : s(12),
            }}
          >
            <Ionicons
              name={item.icon}
              size={16}
              color={COLORS.gray[500]}
              style={{ marginRight: s(8) }}
            />
            <Typography
              variant="body-02"
              weight="medium"
              className="text-gray-800"
            >
              {item.label}
            </Typography>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────
 * 최종 시안 4 — UI design 적용본
 *
 * 톤앤매너 키워드 매핑:
 *  - 소프트 그라데이션 액센트 → 하단 primary-300 점진 (cyan tint)
 *  - 떠있는 흰 카드 → 페이지 gray-50, 카드·chip 모두 white + soft shadow (§4.2 ✓)
 *  - 작은 컬러 아이콘 포인트 → Extended Palette Blue / Violet / Mint
 *  - 큰 친근 헤드라인 → Headline-01 + 여백 확대
 *  - 여백·호흡 → 카드 ↔ stack 간격 확대 (56)
 *  - AI assistant 톤 → 그라데이션이 분위기로 처리 (별도 pill 라벨 X)
 * ──────────────────────────────────────────── */

const FINAL_STACK_ACTIONS_UI = [
  {
    label: "상담 전 박지훈님 알아보기",
    icon: "document-text-outline" as const,
    color: "#0E91ED", // §1 Extended Palette · Blue
  },
  {
    label: "미작성 일지 3건 작성하기",
    icon: "create-outline" as const,
    color: "#7B4FFF", // §1 Extended Palette · Violet
  },
  {
    label: "이수연님 종결 여부 정하기",
    icon: "flag-outline" as const,
    color: "#009BA9", // §1 Extended Palette · Mint
  },
];

function FinalDesignStackUi() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
      {/* 반원 그라데이션 액센트 — 원의 중심을 화면 하단 가장자리(cy 100%)에 두어
       *  원의 위쪽 절반만 화면 안에 보이도록 자름 → 반원 효과.
       *  rx 85% / ry 75% — 적당히 큰 원. primary-300 톤 유지. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgRadialGradient
              id="halfCircleGradient"
              cx="50%"
              cy="100%"
              rx="85%"
              ry="75%"
              fx="50%"
              fy="100%"
            >
              <Stop offset="0%" stopColor="#97E3FF" stopOpacity="0.6" />
              <Stop offset="50%" stopColor="#97E3FF" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#97E3FF" stopOpacity="0" />
            </SvgRadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#halfCircleGradient)" />
        </Svg>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1) 메인 히어로 문구 — 인사 + 날짜 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(24),
          }}
        >
          <Typography
            variant="headline-01"
            weight="semibold"
            className="text-gray-900"
          >
            안녕하세요, 김민준님
          </Typography>
          <Typography
            variant="body-03"
            className="text-gray-500"
            style={{ marginTop: s(6) }}
          >
            5월 21일 목요일
          </Typography>
        </View>

        {/* 2) 예정된 일정 카드 — 카드 자체가 row 컨테이너.
         *    카드 안 좌측 시간 영역(56px) + 세로 divider + 본문 영역.
         *    상담/검사 구분은 타이틀 "{name}님의 {상담|검사}" + dot accent 로 시각화. */}
        <View
          style={{
            marginTop: s(48),
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
          {/* Tooltip — 카드 위에 floating. 좌측 시간 영역을 caret 으로 가리킴 (임박 신호). */}
          <View
            style={{
              position: "absolute",
              top: -s(32),
              left: s(16),
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.gray[800],
                paddingVertical: s(5),
                paddingHorizontal: s(10),
                borderRadius: s(8),
              }}
            >
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                30분 뒤에 만나요!
              </Typography>
            </View>
            {/* Caret — 아래 방향 삼각형. 시간 영역 중심 부근 정렬 */}
            <View
              style={{
                marginLeft: s(18),
                width: 0,
                height: 0,
                borderLeftWidth: 5,
                borderRightWidth: 5,
                borderTopWidth: 5,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: COLORS.gray[800],
              }}
            />
          </View>

          {/* 좌측 시간 영역 — 카드 안 56px. 시작 / divider / 종료 세로 배치 */}
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
              14:00
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
              15:00
            </Typography>
          </View>

          {/* 세로 divider — 시간 영역과 본문 영역 분리 (alignSelf: stretch 로 카드 padding 전체 높이) */}
          <View
            style={{
              width: 1,
              alignSelf: "stretch",
              backgroundColor: COLORS.gray[200],
              marginHorizontal: s(14),
            }}
          />

          {/* 본문 영역 — 컨텍스트 라벨 / dot+이름·카테고리 / 장소·프로그램 메타 */}
          <View style={{ flex: 1 }}>
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: COLORS.gray[600] }}
            >
              오늘 첫 만남
            </Typography>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: s(8),
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
                박지훈님 외 4명의 상담
              </Typography>
            </View>

            {/* 2행: 성별·나이 — 대표 내담자(박지훈) 기준. dot(6) + gap(8) 만큼 들여서 타이틀과 정렬 (ScheduleItem 패턴) */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: s(2),
                marginLeft: 6 + s(8),
              }}
            >
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: COLORS.gray[600] }}
              >
                남
              </Typography>
              <View
                style={{
                  width: 1,
                  height: s(10),
                  backgroundColor: COLORS.gray[300],
                  marginHorizontal: s(6),
                }}
              />
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: COLORS.gray[600] }}
              >
                만 7세
              </Typography>
            </View>

            <View style={{ marginTop: s(12) }}>
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
                  높이세곳
                </Typography>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: s(4),
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
                  놀이치료-그룹
                </Typography>
              </View>
            </View>
          </View>
        </View>

        {/* spacer — stack 과 voice bar 를 페이지 하단으로 밀어냄 (flexGrow: 1 contentContainer 활용) */}
        <View style={{ flex: 1, minHeight: s(40) }} />

        {/* 3) 액션 stack — chip white + soft shadow, 가운데 정렬, 컬러 아이콘 포인트.
         *    하단 정렬 — voice bar 살짝 위에 위치. */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            alignItems: "center",
          }}
        >
          {FINAL_STACK_ACTIONS_UI.map((item, idx) => (
            <View
              key={item.label}
              style={{
                marginTop: idx === 0 ? 0 : s(12),
                borderRadius: 999,
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowOffset: { width: 0, height: 3 },
                shadowRadius: 10,
                elevation: 2,
              }}
            >
              {/* Frosted glass — shadow 는 외부, blur·radius·border·content 는 내부 (iOS shadow + overflow:hidden 충돌 회피) */}
              <View
                style={{
                  borderRadius: 999,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: COLORS.white,
                }}
              >
                <BlurView
                  intensity={20}
                  tint="light"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: s(12),
                    paddingHorizontal: s(16),
                    backgroundColor: "rgba(255, 255, 255, 0.55)",
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.color}
                    style={{ marginRight: s(8) }}
                  />
                  <Typography
                    variant="body-02"
                    weight="medium"
                    className="text-gray-800"
                  >
                    {item.label}
                  </Typography>
                </BlurView>
              </View>
            </View>
          ))}
        </View>

        {/* 4) Voice input bar — AI assistant 진입. 페이지 하단 정렬.
         *    참고 이미지 1·2의 하단 input pill 패턴. stack(할일 리스트)이 살짝 위.
         *    Primary mic 버튼은 화면 내 강조 1곳 (§0 ✓). */}
        <View
          style={{
            marginTop: s(20),
            marginHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.white,
            borderRadius: 999,
            paddingVertical: s(10),
            paddingLeft: s(20),
            paddingRight: s(8),
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <Typography
            variant="body-02"
            className="text-gray-500"
            style={{ flex: 1 }}
          >
            무엇이든 물어보세요
          </Typography>
          {/* Send 버튼 — 텍스트 메시지 보내기 (gray-800, 보조 액션) */}
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.gray[800],
              alignItems: "center",
              justifyContent: "center",
              marginRight: s(8),
            }}
          >
            <Ionicons name="arrow-up" size={18} color={COLORS.white} />
          </View>
          {/* Mic 버튼 — 음성 입력 (primary, 메인 voice 진입) */}
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.primary500,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mic" size={18} color={COLORS.white} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
