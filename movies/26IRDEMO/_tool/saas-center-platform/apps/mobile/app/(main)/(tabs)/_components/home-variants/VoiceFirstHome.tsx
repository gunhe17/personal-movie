import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { s } from "@/shared/utils/scale";
import { useFieldNoteFabBehavior } from "@/features/field-note/useFieldNoteFabBehavior";
import { useCenterStore } from "@/features/center";
import { CounselingNoteSheet } from "@/features/counseling/note";
import type { HomeVariantProps } from "./types";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/**
 * 홈 — 음성 우선 (Voice-First, Dark)
 *
 * 기획 변경 — 각 메뉴의 첫 페이지가 도메인 메인이 되므로 홈은
 * 음성으로 진입하는 에이전트 메인 화면 역할만 한다.
 *
 * Lab 시안 [home-voice-first.tsx] 변종 C(다크)를 실데이터에 연결한 production 버전.
 * 이전 메인(SoftTasksHome)은 lab [home-soft-tasks.tsx] 에 백업되어 있다.
 *
 * 데이터 연결
 *  - centerName / personName : 상단 칩 + 인사
 *  - unreadCount             : (현재 표시 안 함, 추후 bell 추가 시 사용)
 *  - 그 외 스케줄 데이터는 현재 화면에서 사용하지 않음 (음성으로 진입)
 */

type SuggestionKey =
  | "fieldnote"
  | "today-schedule"
  | "next-session"
  | "unwritten-notes"
  | "week-stats";

type Suggestion = { key: SuggestionKey; title: string; subtitle: string };

// 필드노트는 서비스 핵심 기능 — 디자인은 다른 prompt 와 동일하되 순서를 맨 앞에 고정
const SUGGESTIONS: Suggestion[] = [
  { key: "fieldnote", title: "필드노트", subtitle: "녹음 시작" },
  { key: "today-schedule", title: "오늘 일정", subtitle: "알려줘" },
  { key: "next-session", title: "다음 회기", subtitle: "준비해줘" },
  { key: "unwritten-notes", title: "미작성 일지", subtitle: "초안 보여줘" },
  { key: "week-stats", title: "이번 주 통계", subtitle: "요약해줘" },
];

type ExpandRect = { x: number; y: number; w: number; h: number };

const SCREEN = Dimensions.get("window");

// AGENTIC 신호 4종 — INFORMATION_SPEC §4 (mock 시안)
// 색은 Extended Palette OpacityBG + Solid 쌍으로 신호별 식별.
// 실제 신호 감지·집계는 별도 백엔드/로직 작업.
const AGENTIC_SIGNALS = [
  {
    iconName: "calendar-outline" as const,
    label: "오늘 예정 세션",
    count: "4건",
    tone: { fg: COLORS.palette.blue, bg: COLORS.paletteBg.blue },
  },
  {
    iconName: "document-text-outline" as const,
    label: "상담일지 미작성",
    count: "2건",
    tone: { fg: COLORS.palette.yellow, bg: COLORS.paletteBg.yellow },
  },
  {
    iconName: "time-outline" as const,
    label: "종결·연장 결정",
    count: "1건",
    tone: { fg: COLORS.palette.mint, bg: COLORS.paletteBg.mint },
  },
  {
    iconName: "analytics-outline" as const,
    label: "검사 결과 미공유",
    count: "1건",
    tone: { fg: COLORS.palette.coral, bg: COLORS.paletteBg.coral },
  },
];

export function VoiceFirstHome(props: HomeVariantProps) {
  const {
    centerName,
    personName,
    onPressSchedulesAll,
    onPressNextSession,
    onPressNextSessionNote,
    noteSheet,
    onCloseNoteSheet,
  } = props;
  const insets = useSafeAreaInsets();
  const centerId = useCenterStore((st) => st.centerId);
  const breathe = useRef(new Animated.Value(0)).current;
  // 필드노트 카드 — 녹음 미활성 시 녹음 시작 / 활성 시 시트 복원
  const fieldNoteFab = useFieldNoteFabBehavior();

  /* ─── Suggestion pill → bottom-sheet 확장 인터랙션 ─────────────────
   * pill 탭 시:
   *  1) 카드 화면 좌표 측정(measureInWindow → SuggestionPill 가 호출)
   *  2) 시트 흰 컨테이너가 카드 자리에서 → 상단 라운드 시트로 자라남
   *     (top: insets.top+8, full width, height: 화면 나머지)
   *  3) 진행도 0.5 이후 내부 콘텐츠 fade-in (요약 mock + "자세히 보기" CTA)
   *  4) 닫기: 백 아이콘 또는 dim 탭 → 역방향 → unmount
   * 필드노트는 sheet 거치지 않고 곧장 필드노트 화면으로 라우팅. */
  const [expand, setExpand] = useState<{
    suggestion: Suggestion;
    rect: ExpandRect;
  } | null>(null);
  const expandProgress = useRef(new Animated.Value(0)).current;
  // 자세히 보기 → 페이지 슬라이드 동시에 모달이 살짝 물러나는 fade+scale 용
  const dismissProgress = useRef(new Animated.Value(0)).current;
  const isExpandingRef = useRef(false);

  const navigateForSuggestion = useCallback(
    (key: SuggestionKey) => {
      switch (key) {
        case "today-schedule":
          onPressSchedulesAll();
          return;
        case "next-session":
          onPressNextSession();
          return;
        case "unwritten-notes":
          onPressSchedulesAll();
          return;
        case "week-stats":
          onPressSchedulesAll();
          return;
        case "fieldnote":
          // 페이지 이동 X — 즉시 녹음 시작 (권한 체크 + createFieldNote + Recorder.start)
          // 이미 녹음 중이면 녹음 시트만 복원
          if (fieldNoteFab.isActive) fieldNoteFab.openSheet();
          else void fieldNoteFab.start();
          return;
      }
    },
    [
      onPressSchedulesAll,
      onPressNextSession,
      fieldNoteFab,
    ],
  );

  const handlePillPress = useCallback(
    (suggestion: Suggestion, rect: ExpandRect) => {
      if (isExpandingRef.current) return;
      // 필드노트는 시트 거치지 않고 바로 녹음 화면으로
      if (suggestion.key === "fieldnote") {
        navigateForSuggestion("fieldnote");
        return;
      }
      isExpandingRef.current = true;
      setExpand({ suggestion, rect });
      expandProgress.setValue(0);
      // 카드 → 모달 모핑 — Figma Slow 기반에서 살짝만 빠르게(stiffness 110)
      Animated.spring(expandProgress, {
        toValue: 1,
        stiffness: 110,
        damping: 22,
        mass: 1,
        useNativeDriver: false,
      }).start(() => {
        isExpandingRef.current = false;
      });
    },
    [expandProgress, navigateForSuggestion],
  );

  const closeSheet = useCallback(() => {
    if (isExpandingRef.current) return;
    isExpandingRef.current = true;
    // 닫기도 동일한 Slow 프리셋 — 열기와 같은 리듬으로 균형
    Animated.spring(expandProgress, {
      toValue: 0,
      stiffness: 150,
      damping: 25,
      mass: 1,
      useNativeDriver: false,
    }).start(() => {
      setExpand(null);
      isExpandingRef.current = false;
    });
  }, [expandProgress]);

  // 공통 dismiss 모션 — 모달이 아래로 슬라이드 다운 + fade. 페이지 전환(스택/탭/시트)
  // 어느 쪽이든 "모달이 화면을 떠나는" 시각 신호를 분명히 줘서 자연스럽게 연결됨.
  const runDismiss = useCallback(
    (after?: () => void) => {
      Animated.timing(dismissProgress, {
        toValue: 1,
        duration: 360,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start();
      // 모달이 충분히 내려간 시점(약 절반)에 destination 트리거
      if (after) setTimeout(after, 60);
      setTimeout(() => {
        setExpand(null);
        isExpandingRef.current = false;
        dismissProgress.setValue(0);
      }, 420);
    },
    [dismissProgress],
  );

  const onDetail = useCallback(() => {
    if (!expand) return;
    const key = expand.suggestion.key;
    runDismiss(() => navigateForSuggestion(key));
  }, [expand, navigateForSuggestion, runDismiss]);

  // 행별 액션(작성하기 / 초안 작성하기) — 페이지 이동 대신 일지 작성 시트 오픈
  const onLineAction = useCallback(() => {
    if (!expand) return;
    runDismiss(() => onPressNextSessionNote?.());
  }, [expand, onPressNextSessionNote, runDismiss]);

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

  const userLabel = [personName, centerName].filter(Boolean).join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[900] }}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: s(16),
            paddingBottom: s(200),
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
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="business"
                  size={s(12)}
                  color={COLORS.white}
                />
              </View>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {userLabel || "센터를 선택하세요"}
              </Typography>
            </View>
            <Pressable hitSlop={8}>
              <Ionicons
                name="ellipsis-horizontal"
                size={s(20)}
                color="rgba(255,255,255,0.65)"
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

            <Typography
              weight="semibold"
              style={{
                fontSize: s(24),
                lineHeight: s(34),
                letterSpacing: -0.6,
                color: COLORS.white,
                textAlign: "center",
              }}
            >
              {personName ? `${personName}님, ` : ""}오늘 무엇을{"\n"}
              도와드릴까요?
            </Typography>

            <TodoMiniChip />
          </View>
        </ScrollView>

        {/* 고정 하단: prompt pill 가로 스크롤 + 입력 바 */}
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: s(12),
            gap: s(12),
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              gap: s(8),
            }}
          >
            {SUGGESTIONS.map((sug) => (
              <SuggestionPill
                key={sug.key}
                suggestion={sug}
                hidden={expand?.suggestion.key === sug.key}
                onPress={(rect) => handlePillPress(sug, rect)}
              />
            ))}
          </ScrollView>

          <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
            <InputBar />
          </View>
        </View>
      </SafeAreaView>

      {/* 추천 액션 카드 → 카드 자리에서 floating modal 로 확장 */}
      {expand && (
        <ExpandedSuggestionSheet
          suggestion={expand.suggestion}
          rect={expand.rect}
          progress={expandProgress}
          dismissProgress={dismissProgress}
          insetsBottom={insets.bottom}
          onClose={closeSheet}
          onDetail={onDetail}
          onLineAction={onLineAction}
        />
      )}

      {/* 일지 작성 시트 — 행별 "작성하기 / 초안 작성하기" 누르면 그 자리에서 떠오름 */}
      {noteSheet && (
        <CounselingNoteSheet
          visible={noteSheet.visible}
          onClose={() => onCloseNoteSheet?.()}
          centerId={centerId}
          sessionId={noteSheet.sessionId}
          clientId={noteSheet.clientId}
          clientName={noteSheet.clientName ?? undefined}
          sessionStart={noteSheet.sessionStart ?? undefined}
        />
      )}
    </View>
  );
}

/* ─── Suggestion Pill ─── */

function SuggestionPill({
  suggestion,
  hidden,
  onPress,
}: {
  suggestion: Suggestion;
  hidden?: boolean;
  onPress: (rect: ExpandRect) => void;
}) {
  // 필드노트는 서비스 핵심 기능 — 같은 pill 형태 유지하되 컬러로 차별화
  // (fieldnote → primary 그라데이션 + 보라 글로우)
  const isFieldnote = suggestion.key === "fieldnote";
  const ref = useRef<View>(null);

  const handlePress = () => {
    const node = ref.current;
    if (!node) {
      onPress({ x: 0, y: 0, w: 0, h: 0 });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      onPress({ x, y, w, h });
    });
  };

  if (isFieldnote) {
    return (
      <View
        ref={ref}
        style={{
          borderRadius: s(20),
          minWidth: s(110),
          overflow: "hidden",
          opacity: hidden ? 0 : 1,
          shadowColor: COLORS.fieldnote,
          shadowOffset: { width: 0, height: s(6) },
          shadowOpacity: 0.32,
          shadowRadius: s(14),
          elevation: 6,
        }}
      >
        <Pressable
          onPress={handlePress}
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          accessibilityRole="button"
          accessibilityLabel={`${suggestion.title} ${suggestion.subtitle}`}
        >
          <LinearGradient
            colors={[COLORS.fieldnote, "#7B79FF", COLORS.primary500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: s(16),
              paddingVertical: s(12),
            }}
          >
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: COLORS.white, lineHeight: s(20) }}
            >
              {suggestion.title}
            </Typography>
            <Typography
              variant="body-03"
              style={{
                color: "rgba(255,255,255,0.9)",
                marginTop: s(2),
                lineHeight: s(20),
              }}
            >
              {suggestion.subtitle}
            </Typography>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  // 일반 prompt — 다크 페이지 위에서 컨테이너 인지될 정도의 흰 반투명
  return (
    <View
      ref={ref}
      style={{
        backgroundColor: "rgba(255,255,255,0.16)",
        borderRadius: s(20),
        minWidth: s(110),
        overflow: "hidden",
        opacity: hidden ? 0 : 1,
      }}
    >
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: "rgba(255,255,255,0.12)" }}
        style={{
          paddingHorizontal: s(16),
          paddingVertical: s(12),
        }}
      >
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.white, lineHeight: s(20) }}
        >
          {suggestion.title}
        </Typography>
        <Typography
          variant="body-03"
          style={{
            color: "rgba(255,255,255,0.65)",
            marginTop: s(2),
            lineHeight: s(20),
          }}
        >
          {suggestion.subtitle}
        </Typography>
      </Pressable>
    </View>
  );
}

/* ─── TODO Mini Chip ─── */

function TodoMiniChip() {
  const [open, setOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  // 다크 톤 고정 (production VoiceFirstHome 은 dark variant)
  const bg = "rgba(255,255,255,0.16)";
  const titleColor = COLORS.white;
  const metaColor = "rgba(255,255,255,0.65)";
  const itemTitleColor = COLORS.white;
  const dividerColor = "rgba(255,255,255,0.1)";

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.spring(progress, {
      toValue: next ? 1 : 0,
      damping: 16,
      stiffness: 160,
      mass: 1,
      useNativeDriver: false, // layout props
    }).start();
  };

  // pill(0) ↔ card(1) 모핑 interpolations
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
    outputRange: [0, 0.35],
  });
  const chevronRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const bodyAnimatedHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, bodyHeight],
  });
  const bodyOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const handleMeasure = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - bodyHeight) > 0.5) setBodyHeight(h);
  };

  const renderBody = () => (
    <View style={{ paddingTop: s(12) }}>
      <View
        style={{
          height: 1,
          backgroundColor: dividerColor,
          marginBottom: s(10),
        }}
      />
      <View style={{ gap: s(10) }}>
        {AGENTIC_SIGNALS.map((sig, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}
          >
            <View
              style={{
                width: s(28),
                height: s(28),
                borderRadius: s(8),
                backgroundColor: sig.tone.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={sig.iconName}
                size={s(14)}
                color={sig.tone.fg}
              />
            </View>
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: itemTitleColor, flex: 1 }}
            >
              {sig.label}
            </Typography>
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: sig.tone.fg }}
            >
              {sig.count}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ alignSelf: "center" }}>
      {/* 측정용 hidden copy — 본문의 자연 height 측정 */}
      <View
        style={{ position: "absolute", left: -9999, opacity: 0 }}
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
          android_ripple={{ color: "rgba(255,255,255,0.08)" }}
        >
          {/* 헤더 row — pill 일 때도 카드일 때도 항상 노출 */}
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
              AI가 챙긴 신호 {AGENTIC_SIGNALS.length}건
            </Typography>
            <Animated.View
              style={{ transform: [{ rotate: chevronRotate }] }}
            >
              <Ionicons
                name="chevron-down"
                size={s(14)}
                color={metaColor}
              />
            </Animated.View>
          </View>

          {/* 본문 — height/opacity 가 progress 따라 자라남 */}
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

/* ─── Input Bar (Gemini-style) ─── */

function InputBar() {
  // 음성 hero — mic 버튼 주변 halo 가 천천히 호흡 (2.2s sin loop)
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

  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });

  const MIC_SIZE = s(48);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(4),
        paddingLeft: s(6),
        paddingRight: s(6),
        paddingVertical: s(6),
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: s(28),
      }}
    >
      <Pressable
        accessibilityLabel="추가"
        android_ripple={{
          color: "rgba(255,255,255,0.12)",
          radius: s(20),
          borderless: true,
        }}
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="add" size={s(24)} color={COLORS.white} />
      </Pressable>

      {/* 텍스트 입력 — 음성 안 되는 상황에서 동등한 입력 경로.
          tap → 시스템 키보드 활성 (현재는 placeholder 시안) */}
      <Pressable
        accessibilityLabel="텍스트 입력"
        style={{ flex: 1, paddingHorizontal: s(4), paddingVertical: s(10) }}
      >
        <Typography
          variant="body-02"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          음성으로 말하거나 입력해보세요
        </Typography>
      </Pressable>

      {/* 음성 hero — primary500 큰 원형 버튼 + halo pulse */}
      <View
        style={{
          width: MIC_SIZE,
          height: MIC_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* halo */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: MIC_SIZE,
            height: MIC_SIZE,
            borderRadius: MIC_SIZE / 2,
            backgroundColor: COLORS.primary500,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        />
        <View
          style={{
            width: MIC_SIZE,
            height: MIC_SIZE,
            borderRadius: MIC_SIZE / 2,
            backgroundColor: COLORS.primary500,
            overflow: "hidden",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="음성 입력"
            android_ripple={{ color: "rgba(255,255,255,0.2)" }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mic" size={s(22)} color={COLORS.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
 *  Suggestion Sheet — pill 탭 시 그 자리에서 → bottom sheet 로 확장
 *
 *  구조
 *    - dim 오버레이 (탭하면 닫힘)
 *    - 흰 시트 컨테이너: 카드 rect → sheet 모양(top: insets.top+8, full width)
 *    - 콘텐츠는 progress > 0.5 부터 fade-in
 *      · 드래그 핸들
 *      · 헤더(타이틀 + 부타이틀 + 닫기 X)
 *      · "AI 비서 응답" 라벨 + mock 본문
 *      · "자세히 보기" CTA → 풀 페이지 이동
 * ════════════════════════════════════════════════════════════ */

interface SummaryLine {
  primary: string;
  secondary?: string;
  /** 행별 별도 액션 — 있는 경우만 오른쪽 끝에 버튼이 노출됨 */
  action?: { label: string };
}

interface SuggestionSummary {
  /** AI 응답 톤의 한 줄 헤더 */
  lead: string;
  /** 본문 라인들 — 각 줄이 카드의 한 항목 */
  lines: SummaryLine[];
}

function getSuggestionSummary(key: SuggestionKey): SuggestionSummary {
  switch (key) {
    case "today-schedule":
      return {
        lead: "오늘 4건의 일정이 잡혀 있어요.",
        lines: [
          { primary: "10:00", secondary: "김민준 · 놀이치료 4회기" },
          { primary: "11:30", secondary: "이서연 · 인지치료 6회기" },
          { primary: "14:00", secondary: "박지호 · 학습치료 2회기" },
          { primary: "15:30", secondary: "최아람 · 놀이치료 8회기" },
        ],
      };
    case "next-session":
      return {
        lead: "다음 회기까지 1시간 14분 남았어요.",
        lines: [
          { primary: "김민준 · 놀이치료 4회기" },
          { primary: "지난 회기 키워드", secondary: "분노 · 가족 · 자기표현" },
          { primary: "추천 활동", secondary: "감정 카드 분류 + 그림 그리기" },
        ],
      };
    case "unwritten-notes":
      // 필드노트가 연결된 회기는 AI 초안을 바로 띄울 수 있고,
      // 없으면 빈 작성 화면으로 진입.
      return {
        lead: "최근 7일 중 미작성 일지 2건이에요.",
        lines: [
          {
            primary: "박지훈 · 1회기",
            secondary: "5/14 (어제부터) · 필드노트 있음",
            action: { label: "초안 작성하기" },
          },
          {
            primary: "이서연 · 6회기",
            secondary: "5/13 (이틀 전)",
            action: { label: "작성하기" },
          },
        ],
      };
    case "week-stats":
      return {
        lead: "이번 주(5/19~5/25) 진행 현황이에요.",
        lines: [
          { primary: "상담 12건", secondary: "지난주 대비 +2" },
          { primary: "검사 3건", secondary: "지난주 동일" },
          { primary: "노쇼 0건", secondary: "이번 주 안정적" },
          { primary: "신규 내담자 2명", secondary: "박지호 · 최아람" },
        ],
      };
    case "fieldnote":
      // 필드노트는 시트 거치지 않지만 타입 호환 위해 채워둠
      return { lead: "", lines: [] };
  }
}

function ExpandedSuggestionSheet({
  suggestion,
  rect,
  progress,
  dismissProgress,
  insetsBottom,
  onClose,
  onDetail,
  onLineAction,
}: {
  suggestion: Suggestion;
  rect: ExpandRect;
  progress: Animated.Value;
  dismissProgress: Animated.Value;
  insetsBottom: number;
  onClose: () => void;
  onDetail: () => void;
  onLineAction: () => void;
}) {
  const summary = getSuggestionSummary(suggestion.key);

  // floating modal 타겟 — 입력바 바로 위에 떠 있음
  const MARGIN_H = s(16);
  const BOTTOM_GAP = insetsBottom + s(96);
  const MODAL_HEIGHT = Math.min(s(420), SCREEN.height * 0.5);
  const modalWidth = SCREEN.width - MARGIN_H * 2;
  const modalLeft = MARGIN_H;
  const modalTop = SCREEN.height - BOTTOM_GAP - MODAL_HEIGHT;

  // 카드와 동일한 톤
  const containerBg = "rgba(255,255,255,0.16)";
  const innerPanelBg = "rgba(255,255,255,0.06)";
  const dividerColor = "rgba(255,255,255,0.08)";
  const subTextColor = "rgba(255,255,255,0.65)";
  const closeBtnBg = "rgba(255,255,255,0.16)";

  // 부수적 콘텐츠(닫기·본문·CTA)는 progress 0.5 이후 fade-in
  const contentOpacity = progress.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // BlurView 도 progress 따라 fade-in — 카드 사이즈일 땐 blur 없음(원본 카드와 동일)
  const blurOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* dim — 진행도 따라 들어왔다가 dismiss 시 함께 페이드 아웃 */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: Animated.multiply(
            progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.35],
            }),
            dismissProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          ),
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* 카드 → floating modal 모핑 — 원본 카드 톤·radius 그대로 size 만 자라남
       *   원본 카드는 hidden 처리됐고 이 컨테이너가 카드 rect 에서 시작 →
       *   타이틀/서브타이틀이 같은 자리에 그대로 머무는 것처럼 보임. */}
      <Animated.View
        style={{
          position: "absolute",
          top: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.y, modalTop],
          }),
          left: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.x, modalLeft],
          }),
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.w, modalWidth],
          }),
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.h, MODAL_HEIGHT],
          }),
          borderRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [s(20), s(24)],
          }),
          backgroundColor: containerBg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: s(10) },
          shadowOpacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.35],
          }),
          shadowRadius: s(24),
          elevation: 12,
          overflow: "hidden",
          // 자세히 보기 / 행 액션 → 모달이 아래로 슬라이드 다운 + fade
          // 페이지 슬라이드든 탭 스위치든 노트시트 슬라이드업이든, 어느 destination
          // 이라도 "모달이 떠나는" 명확한 시각 신호를 줘서 자연스럽게 인계됨.
          opacity: dismissProgress.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [1, 0.85, 0],
          }),
          transform: [
            {
              translateY: dismissProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, s(280)],
              }),
            },
          ],
        }}
      >
        {/* BlurView 배경 — 모달이 자라날수록 점차 진해짐 */}
        <AnimatedBlurView
          intensity={80}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { opacity: blurOpacity }]}
        />

        {/* 타이틀/서브타이틀 — 원본 카드와 정확히 동일한 위치·스타일.
         *   카드가 자라나도 텍스트가 이동하지 않음 (paddingHorizontal:16, paddingVertical:12). */}
        <View
          style={{
            paddingHorizontal: s(16),
            paddingVertical: s(12),
          }}
        >
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.white, lineHeight: s(20) }}
          >
            {suggestion.title}
          </Typography>
          <Typography
            variant="body-03"
            style={{
              color: subTextColor,
              marginTop: s(2),
              lineHeight: s(20),
            }}
          >
            {suggestion.subtitle}
          </Typography>
        </View>

        {/* 닫기 X — 우상단, fade-in. 절대 위치라 타이틀 레이아웃에 영향 없음 */}
        <Animated.View
          style={{
            position: "absolute",
            top: s(12),
            right: s(12),
            opacity: contentOpacity,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => ({
              width: s(30),
              height: s(30),
              borderRadius: s(15),
              backgroundColor: closeBtnBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
            accessibilityLabel="닫기"
          >
            <Ionicons name="close" size={s(16)} color={COLORS.white} />
          </Pressable>
        </Animated.View>

        {/* 본문 — fade-in. 타이틀 영역 아래(약 60pt) 부터 시작 */}
        <Animated.View
          style={{
            position: "absolute",
            top: s(60),
            left: 0,
            right: 0,
            bottom: s(72), // 하단 CTA 영역 확보
            opacity: contentOpacity,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: s(16),
              paddingTop: s(8),
              paddingBottom: s(16),
            }}
            showsVerticalScrollIndicator={false}
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{
                color: COLORS.white,
                lineHeight: s(24),
                marginBottom: s(12),
              }}
            >
              {summary.lead}
            </Typography>

            <View
              style={{
                backgroundColor: innerPanelBg,
                borderRadius: s(14),
                padding: s(12),
              }}
            >
              {summary.lines.map((line, i) => (
                <View key={i}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: s(10),
                      paddingVertical: s(10),
                    }}
                  >
                    {/* 좌측: primary(굵게) + secondary(가는글씨) 세로 스택 */}
                    <View style={{ flex: 1 }}>
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        style={{
                          color: COLORS.white,
                          fontVariant: ["tabular-nums"],
                        }}
                        numberOfLines={1}
                      >
                        {line.primary}
                      </Typography>
                      {line.secondary && (
                        <Typography
                          variant="body-03"
                          weight="regular"
                          style={{
                            color: subTextColor,
                            marginTop: s(2),
                          }}
                          numberOfLines={1}
                        >
                          {line.secondary}
                        </Typography>
                      )}
                    </View>

                    {/* 우측: 행별 액션 버튼 (있을 때만) — 일지 작성 시트 오픈 트리거 */}
                    {line.action && (
                      <View
                        style={{
                          borderRadius: s(10),
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.3)",
                          overflow: "hidden",
                        }}
                      >
                        <Pressable
                          onPress={onLineAction}
                          android_ripple={{
                            color: "rgba(255,255,255,0.12)",
                          }}
                          style={{
                            height: s(30),
                            paddingHorizontal: s(12),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={line.action.label}
                        >
                          <Typography
                            variant="body-03"
                            weight="semibold"
                            style={{ color: COLORS.white }}
                          >
                            {line.action.label}
                          </Typography>
                        </Pressable>
                      </View>
                    )}
                  </View>
                  {i < summary.lines.length - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: dividerColor,
                      }}
                    />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>

        {/* 하단 고정 CTA — fade-in */}
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: s(16),
            paddingTop: s(12),
            paddingBottom: s(16),
            borderTopWidth: 1,
            borderTopColor: dividerColor,
            opacity: contentOpacity,
          }}
        >
          <Pressable
            onPress={onDetail}
            style={({ pressed }) => ({
              height: s(44),
              borderRadius: s(12),
              backgroundColor: COLORS.primary500,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: s(6),
              opacity: pressed ? 0.92 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="자세히 보기"
          >
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              자세히 보기
            </Typography>
            <Ionicons
              name="arrow-forward"
              size={s(16)}
              color={COLORS.white}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
