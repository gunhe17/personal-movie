import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 · 음성 우선 (Voice-First Agent)
 *
 * Gemini 메인 화면을 레퍼런스로 한 미니멀 음성 에이전트 홈.
 * 각 메뉴의 첫 페이지가 도메인 메인이 되므로 홈은 음성으로 진입하는
 * 에이전트 메인 화면 역할만 한다.
 *
 * 레이아웃 (모든 시안 공통)
 *   - 상단: 센터·사용자 chip (작게)
 *   - 중앙: 작은 AI 액센트 + 큰 2줄 인사 + 슬림 TODO chip
 *   - 하단 고정: 가로 스크롤 prompt pill 카드 5개 + 입력 바
 *
 * 시안 3개 — AI 액센트·톤 비교
 *   A 브랜드 오브  — 흰 배경 + 작은 primary 그라데이션 오브(56pt, sparkle inside)
 *   B 스파클+halo — 흰 배경 + sparkle 아이콘(36pt) + 옅은 halo 2겹
 *   C 다크        — gray-900 배경 + 흰 sparkle + primary glow halo
 */

type Variant = "orb" | "sparkle" | "dark";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "orb", label: "A 브랜드 오브" },
  { key: "sparkle", label: "B 스파클" },
  { key: "dark", label: "C 다크" },
];

type Suggestion = { title: string; subtitle: string };

const SUGGESTIONS: Suggestion[] = [
  { title: "오늘 일정", subtitle: "알려줘" },
  { title: "박서연 회기", subtitle: "준비해줘" },
  { title: "박지훈 일지", subtitle: "초안 보여줘" },
  { title: "이번 주 통계", subtitle: "요약해줘" },
];

const PENDING_TODOS = [
  { title: "박지훈 5/14 일지", meta: "어제부터" },
  { title: "최서아 보호자 답장", meta: "3일째" },
];

const USER_LABEL = "김민준 · 서울어린이미래활짝";

export default function HomeVoiceFirstLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("orb");

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
              홈 · 음성 우선
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

      <VoiceMainScreen variant={variant} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  메인 스크린 — 3시안 공유
 * ════════════════════════════════════════════════════════════ */

function VoiceMainScreen({ variant }: { variant: Variant }) {
  const insets = useSafeAreaInsets();
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [breathe]);

  const scale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const haloScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const haloOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.7],
  });

  const isDark = variant === "dark";
  const bgColor = isDark ? COLORS.gray[900] : COLORS.white;
  const textPrimary = isDark ? COLORS.white : COLORS.gray[900];
  const textSecondary = isDark
    ? "rgba(255,255,255,0.65)"
    : COLORS.gray[500];

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: s(16),
          paddingBottom: insets.bottom + s(200),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 상단 칩 — 센터·사용자 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(8),
            }}
          >
            <View
              style={{
                width: s(22),
                height: s(22),
                borderRadius: s(11),
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : COLORS.gray[100],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="business"
                size={s(12)}
                color={isDark ? COLORS.white : COLORS.gray[600]}
              />
            </View>
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: textSecondary }}
            >
              {USER_LABEL}
            </Typography>
          </View>
          <Pressable hitSlop={8}>
            <Ionicons
              name="ellipsis-horizontal"
              size={s(20)}
              color={textSecondary}
            />
          </Pressable>
        </View>

        {/* 중앙: AI 액센트 + 인사 + TODO */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            minHeight: s(340),
            gap: s(24),
          }}
        >
          <AIAccent
            variant={variant}
            scale={scale}
            haloScale={haloScale}
            haloOpacity={haloOpacity}
          />

          <Typography
            weight="semibold"
            style={{
              fontSize: s(24),
              lineHeight: s(34),
              letterSpacing: -0.6,
              color: textPrimary,
              textAlign: "center",
            }}
          >
            오늘 무엇을{"\n"}도와드릴까요?
          </Typography>

          <TodoMiniChip variant={variant} />
        </View>
      </ScrollView>

      {/* 고정 하단: 필드노트 CTA + prompt pill 가로 스크롤 + 입력 바 */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + s(16),
          gap: s(12),
        }}
      >
        {/* 핵심 기능 — 필드노트 녹음 CTA (다른 prompt 보다 위계 한 단계 위) */}
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
          <FieldnoteFocusCta />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            gap: s(8),
          }}
        >
          {SUGGESTIONS.map((sug, i) => (
            <SuggestionPill key={i} suggestion={sug} variant={variant} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
          <InputBar variant={variant} />
        </View>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  AI 액센트 — 시안별 분기
 * ════════════════════════════════════════════════════════════ */

function AIAccent({
  variant,
  scale,
  haloScale,
  haloOpacity,
}: {
  variant: Variant;
  scale: Animated.AnimatedInterpolation<number>;
  haloScale: Animated.AnimatedInterpolation<number>;
  haloOpacity: Animated.AnimatedInterpolation<number>;
}) {
  if (variant === "orb") {
    // A — 작은 primary 그라데이션 오브 (56pt) + 안에 sparkle
    return (
      <Animated.View
        style={{
          transform: [{ scale }],
          shadowColor: COLORS.primary500,
          shadowOffset: { width: 0, height: s(6) },
          shadowOpacity: 0.35,
          shadowRadius: s(14),
          elevation: 8,
        }}
      >
        <View
          style={{
            width: s(56),
            height: s(56),
            borderRadius: s(28),
          }}
        >
          <LinearGradient
            colors={[COLORS.primary400, COLORS.primary600]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              flex: 1,
              borderRadius: s(28),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="sparkles" size={s(22)} color={COLORS.white} />
          </LinearGradient>
        </View>
      </Animated.View>
    );
  }

  if (variant === "sparkle") {
    // B — sparkle 아이콘 (36pt) + halo 2겹
    return (
      <View
        style={{
          width: s(96),
          height: s(96),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            width: s(96),
            height: s(96),
            borderRadius: s(48),
            backgroundColor: COLORS.primary100,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        />
        <Animated.View
          style={{
            position: "absolute",
            width: s(64),
            height: s(64),
            borderRadius: s(32),
            backgroundColor: COLORS.primary200,
            opacity: 0.55,
            transform: [{ scale }],
          }}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons
            name="sparkles"
            size={s(36)}
            color={COLORS.primary600}
          />
        </Animated.View>
      </View>
    );
  }

  // C — 다크: 흰 sparkle + primary glow halo
  return (
    <View
      style={{
        width: s(96),
        height: s(96),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: s(96),
          height: s(96),
          borderRadius: s(48),
          backgroundColor: COLORS.primary500,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: s(60),
          height: s(60),
          borderRadius: s(30),
          backgroundColor: COLORS.primary400,
          opacity: 0.45,
          transform: [{ scale }],
        }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="sparkles" size={s(36)} color={COLORS.white} />
      </Animated.View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  Suggestion Pill — 2줄 텍스트 pill 카드 (가로 스크롤)
 * ════════════════════════════════════════════════════════════ */

function SuggestionPill({
  suggestion,
  variant,
}: {
  suggestion: Suggestion;
  variant: Variant;
}) {
  const isDark = variant === "dark";
  // 다크 모드는 페이지가 어두워 8% 흰색은 거의 안 보임 → 더 진하게
  const bg = isDark ? "rgba(255,255,255,0.16)" : COLORS.gray[100];
  const titleColor = isDark ? COLORS.white : COLORS.gray[900];
  const subColor = isDark ? "rgba(255,255,255,0.65)" : COLORS.gray[500];

  return (
    <Pressable
      android_ripple={{
        color: isDark ? "rgba(255,255,255,0.12)" : COLORS.gray[200],
      }}
      style={{
        paddingHorizontal: s(16),
        paddingVertical: s(12),
        backgroundColor: bg,
        borderRadius: s(20),
        minWidth: s(110),
        overflow: "hidden",
      }}
    >
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: titleColor, lineHeight: s(20) }}
      >
        {suggestion.title}
      </Typography>
      <Typography
        variant="body-03"
        style={{
          color: subColor,
          marginTop: s(2),
          lineHeight: s(20),
        }}
      >
        {suggestion.subtitle}
      </Typography>
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════
 *  TODO Mini Chip — 슬림 한 줄 + 탭 시 펼침
 * ════════════════════════════════════════════════════════════ */

function TodoMiniChip({ variant }: { variant: Variant }) {
  const [open, setOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const isDark = variant === "dark";
  const bg = isDark ? "rgba(255,255,255,0.16)" : COLORS.gray[100];
  const titleColor = isDark ? COLORS.white : COLORS.gray[800];
  const metaColor = isDark ? "rgba(255,255,255,0.65)" : COLORS.gray[500];
  const itemTitleColor = isDark ? COLORS.white : COLORS.gray[900];
  const dividerColor = isDark ? "rgba(255,255,255,0.1)" : COLORS.gray[200];

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.spring(progress, {
      toValue: next ? 1 : 0,
      damping: 16,
      stiffness: 160,
      mass: 1,
      useNativeDriver: false, // layout props (height/padding/radius)
    }).start();
  };

  // 모핑 interpolations — pill(0) ↔ card(1)
  const radius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [s(16), s(20)],
  });
  const padH = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [s(14), s(18)],
  });
  const padV = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [s(8), s(14)],
  });
  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isDark ? 0.35 : 0.1],
  });
  // chevron 회전 — down(0deg) → up(180deg) 자연스럽게
  const chevronRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  // 본문 height — 측정된 bodyHeight 까지 자라남
  const bodyAnimatedHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, bodyHeight],
  });
  // 본문 opacity — 컨테이너가 충분히 자란 뒤 fade-in (progress 0.4 부터)
  const bodyOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const handleMeasure = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - bodyHeight) > 0.5) setBodyHeight(h);
  };

  // 본문 콘텐츠 — 측정 사본 / 노출 사본 양쪽에서 동일하게 사용
  const renderBody = () => (
    <View style={{ paddingTop: s(12) }}>
      <View
        style={{
          height: 1,
          backgroundColor: dividerColor,
          marginBottom: s(10),
        }}
      />
      <View style={{ gap: s(8) }}>
        {PENDING_TODOS.map((t, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: itemTitleColor }}
            >
              {t.title}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: metaColor, marginLeft: s(6) }}
            >
              · {t.meta}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ alignSelf: "center" }}>
      {/* 측정용 hidden copy — 본문의 자연 height 를 잰다 */}
      <View
        style={{
          position: "absolute",
          left: -9999,
          opacity: 0,
        }}
        pointerEvents="none"
        onLayout={handleMeasure}
      >
        {renderBody()}
      </View>

      <Animated.View
        style={{
          backgroundColor: bg,
          borderRadius: radius,
          paddingHorizontal: padH,
          paddingVertical: padV,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: s(6) },
          shadowOpacity,
          shadowRadius: s(14),
        }}
      >
        <Pressable
          onPress={toggle}
          android_ripple={{
            color: isDark ? "rgba(255,255,255,0.08)" : COLORS.gray[200],
          }}
        >
          {/* 헤더 row — 항상 노출 (가운데 정렬) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "center",
            }}
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: COLORS.primary500,
                marginRight: s(8),
              }}
            />
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: titleColor, marginRight: s(8) }}
            >
              오늘 챙길 일 {PENDING_TODOS.length}건
            </Typography>
            <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
              <Ionicons
                name="chevron-down"
                size={s(14)}
                color={metaColor}
              />
            </Animated.View>
          </View>

          {/* 본문 — height/opacity 가 progress 따라 자라남. overflow 로 clip */}
          <Animated.View
            style={{
              height: bodyAnimatedHeight,
              opacity: bodyOpacity,
              overflow: "hidden",
            }}
          >
            {renderBody()}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  Fieldnote Focus CTA — 핵심 기능 강조
 *
 * 다른 prompt(SuggestionPill)는 단순 한 줄 텍스트 알약. 필드노트는 서비스의
 * 핵심 기능이므로 한 위계 위로 끌어올림:
 *  - 풀너비에 가까운 가로 카드(가운데 정렬 콘텐츠)
 *  - fieldnote → primary 그라데이션 배경 + 외곽 보라 글로우 그림자
 *  - 좌측에 빨간 녹음 dot pulse + 마이크 아이콘 원
 *  - 우측 흰 "녹음 시작" pill
 *  - 다크 시안에서도 동일 톤(어두운 배경 위에서도 잘 보임)
 * ════════════════════════════════════════════════════════════ */

function FieldnoteFocusCta() {
  // 빨간 녹음 dot — 천천히 호흡(pulse)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) loop();
      });
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.55],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  return (
    <View
      style={{
        borderRadius: s(20),
        // 보라 글로우 — 시안 톤 무관하게 핵심 기능임을 알림
        shadowColor: COLORS.fieldnote,
        shadowOffset: { width: 0, height: s(8) },
        shadowOpacity: 0.32,
        shadowRadius: s(18),
        elevation: 10,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="필드노트 녹음 시작"
        android_ripple={{ color: "rgba(255,255,255,0.18)" }}
      >
        <LinearGradient
          colors={[COLORS.fieldnote, "#7B79FF", COLORS.primary500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: s(20),
            paddingVertical: s(14),
            paddingHorizontal: s(16),
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
            overflow: "hidden",
          }}
        >
          {/* 좌측: 마이크 + 녹음 pulse */}
          <View
            style={{
              width: s(40),
              height: s(40),
              borderRadius: s(20),
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 호흡하는 빨간 dot 외곽 */}
            <Animated.View
              style={{
                position: "absolute",
                width: s(40),
                height: s(40),
                borderRadius: s(20),
                backgroundColor: COLORS.negative,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              }}
            />
            <Ionicons name="mic" size={s(20)} color={COLORS.white} />
          </View>

          {/* 가운데: 카피 2줄 */}
          <View style={{ flex: 1 }}>
            <Typography
              variant="body-02"
              weight="bold"
              style={{ color: COLORS.white }}
              numberOfLines={1}
            >
              필드노트 녹음
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: "rgba(255,255,255,0.85)", marginTop: s(2) }}
              numberOfLines={1}
            >
              회기를 시작해보세요
            </Typography>
          </View>

          {/* 우측: 흰 녹음 시작 pill */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              backgroundColor: COLORS.white,
              paddingHorizontal: s(12),
              paddingVertical: s(8),
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
        </LinearGradient>
      </Pressable>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  Input Bar — Gemini 스타일 입력 pill
 * ════════════════════════════════════════════════════════════ */

function InputBar({ variant }: { variant: Variant }) {
  const isDark = variant === "dark";
  const bg = isDark ? "rgba(255,255,255,0.1)" : COLORS.gray[50];
  const placeholderColor = isDark
    ? "rgba(255,255,255,0.45)"
    : COLORS.gray[400];
  const iconColor = isDark ? COLORS.white : COLORS.gray[600];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(4),
        paddingHorizontal: s(6),
        paddingVertical: s(6),
        backgroundColor: bg,
        borderRadius: s(28),
      }}
    >
      <Pressable
        style={({ pressed }) => ({
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
        accessibilityLabel="추가"
      >
        <Ionicons name="add" size={s(24)} color={iconColor} />
      </Pressable>

      <View style={{ flex: 1, paddingHorizontal: s(4) }}>
        <Typography variant="body-02" style={{ color: placeholderColor }}>
          무엇이든 물어보세요
        </Typography>
      </View>

      <Pressable
        style={({ pressed }) => ({
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        })}
        accessibilityLabel="음성 입력"
      >
        <Ionicons name="mic-outline" size={s(22)} color={iconColor} />
      </Pressable>

      <Pressable
        style={({ pressed }) => ({
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: COLORS.primary500,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
        accessibilityLabel="라이브 대화"
      >
        <Ionicons name="pulse" size={s(20)} color={COLORS.white} />
      </Pressable>
    </View>
  );
}
