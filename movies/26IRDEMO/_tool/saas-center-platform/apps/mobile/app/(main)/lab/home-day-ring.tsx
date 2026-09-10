import { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 C — 원형 하루 + 액션 그리드 (Day Ring)
 *
 * 컨셉
 *  - 하루 자체를 큰 원형 게이지로 표현. 각 일정 = 가장자리의 한 segment.
 *  - 중앙 원 안에 현재 일정(시간·내담자·프로그램·회차) + "다음 일정" pill.
 *  - 좌/우 화살표 + dot indicator 로 일정 간 캐러셀. 가운데 콘텐츠는 cross-fade
 *    + 살짝 슬라이드, 게이지는 segment 단위로 자연스럽게 채워짐.
 *  - "완료 처리" 누르면 현재 segment 가 부드럽게 채워지고(spring-ease) 자동으로
 *    다음 일정으로 넘어감. 가장자리가 모두 채워지면 하루가 끝난다는 메타포.
 *  - 하단 액션 그리드(2열): 학대 의심 검토 · 미작성 노트 · 보호자 연락 · 평가
 *    기한 D-3 · 3주 무응답 · 슈퍼비전 준비. 카드 탭 시 그 자리에서 → 바텀시트
 *    형태로 확장(top-rounded) 되며 mock 디테일 화면으로 자연스럽게 전환.
 *
 * 시안 비교
 *  - A · 라이트  : mint→primary tint→cream 옅은 페이지 + 얇은 stroke (참고 이미지)
 *  - B · 진한    : 흰 페이지 + 두꺼운 stroke + primary glow — 강한 시각 무게
 *
 * 디자인 시스템 매핑
 *  - 액션 카드 컬러: Extended Palette OpacityBG + Solid (red·orange·blue·violet·coral)
 *  - 링 색: primary500(채워진) / gray200(빈)
 *  - "다음 일정" pill: bg.brandSubtle + primary700
 */

type Variant = "light" | "bold";

interface Schedule {
  id: string;
  time: string;
  client: string;
  program: string;
  session: number;
}

interface ActionItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  palette:
    | "red"
    | "orange"
    | "blue"
    | "coral"
    | "violet"
    | "yellow"
    | "mint";
  /** sheet 으로 확장됐을 때 보여줄 mock 본문 */
  body: string;
  cta: string;
}

const SCHEDULES: Schedule[] = [
  { id: "s1", time: "10:00", client: "김민준", program: "놀이치료", session: 4 },
  { id: "s2", time: "11:30", client: "이서연", program: "인지치료", session: 6 },
  { id: "s3", time: "14:00", client: "박지호", program: "학습치료", session: 2 },
  { id: "s4", time: "15:30", client: "최아람", program: "놀이치료", session: 8 },
];

const ACTIONS: ActionItem[] = [
  {
    id: "abuse",
    icon: "warning",
    title: "학대 의심 검토",
    subtitle: "최아람 · 확인 필요",
    palette: "red",
    body:
      "최아람 양의 최근 회기 기록에서 학대 의심 징후가 감지됐어요. 보호자 면담 메모, 신체 상흔 기록, 행동 변화 패턴을 함께 검토하고 신고 의무 여부를 확인해 주세요.",
    cta: "기록 검토하기",
  },
  {
    id: "unwritten",
    icon: "reader",
    title: "미작성 노트",
    subtitle: "김민준 · 어제",
    palette: "orange",
    body:
      "어제 진행한 김민준 군 4회기 노트가 아직 비어 있어요. 회기 중 작성한 필드노트 녹음을 활용해 요약·인사이트를 정리해 보세요.",
    cta: "일지 작성하기",
  },
  {
    id: "contact",
    icon: "call",
    title: "보호자 연락",
    subtitle: "박지호 어머니",
    palette: "blue",
    body:
      "박지호 군 보호자에게 다음 회기 일정 변경 안내가 필요해요. 통화 또는 메시지로 변경된 시간을 공유하고 확인 회신을 받아 주세요.",
    cta: "연락하기",
  },
  {
    id: "deadline",
    icon: "time",
    title: "평가 기한 D-3",
    subtitle: "이서연 CBCL",
    palette: "yellow",
    body:
      "이서연 양 CBCL 평가 제출 기한이 3일 남았어요. 보호자 응답 회신을 확인하고 누락된 항목이 있다면 리마인드해 주세요.",
    cta: "평가 진행하기",
  },
  {
    id: "noresponse",
    icon: "person-circle",
    title: "3주 무응답",
    subtitle: "홍지호 · 연락 필요",
    palette: "coral",
    body:
      "홍지호 군 보호자와 마지막 회기 후 3주 동안 연락이 없어요. 종결 의사 확인 또는 회기 재개 안내가 필요한 시점이에요.",
    cta: "안부 연락하기",
  },
  {
    id: "supervision",
    icon: "school",
    title: "슈퍼비전 준비",
    subtitle: "오늘 16:30",
    palette: "violet",
    body:
      "오늘 오후 슈퍼비전이 예정되어 있어요. 다룰 케이스의 회기 요약, 의문점, 시도해 본 개입 기법을 미리 정리해 두면 논의가 풍성해져요.",
    cta: "준비 노트 열기",
  },
];

export default function HomeDayRingLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("light");

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <LabTopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />
        <Intro variant={variant} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: s(20) }}
          showsVerticalScrollIndicator={false}
        >
          <DemoFrame key={variant} variant={variant} />
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
        홈 시안 · 원형 하루 + 액션
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
    { key: "light", label: "A · 라이트" },
    { key: "bold", label: "B · 진한" },
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
      ? "참고 이미지 톤. 옅은 그라데이션 + 얇은 stroke 게이지 + 액션 그리드 6장."
      : "흰 페이지 + 두꺼운 stroke + primary glow — 게이지 진행감을 더 강하게 표현.";
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

/* ───────────────────────── Demo Frame ───────────────────────── */

const SCREEN = Dimensions.get("window");

interface ExpandState {
  action: ActionItem;
  rect: { x: number; y: number; w: number; h: number };
}

function DemoFrame({ variant }: { variant: Variant }) {
  const isBold = variant === "bold";

  // 캐러셀 상태
  const [currentIdx, setCurrentIdx] = useState(0);
  // 완료된 segment 개수 — 가장자리 채움 진행도
  const [completed, setCompleted] = useState(0);
  // 현재 segment 의 진행도(0..1) — "완료 처리" 누를 때 부드럽게 채우는 임시 값
  const segmentFill = useRef(new Animated.Value(0)).current;
  // 중앙 텍스트 cross-fade
  const textFade = useRef(new Animated.Value(1)).current;
  const textSlide = useRef(new Animated.Value(0)).current;
  // 중앙 원 살짝 호흡 — 심심하지 않게 (subtle scale loop)
  const breath = useRef(new Animated.Value(0)).current;

  // breath loop — 컴포넌트 마운트 동안 천천히 scale 1.00↔1.012 (subtle)
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2400,
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
  }, [breath]);

  const isBusyRef = useRef(false);

  // 인덱스 이동 + cross-fade + slide
  const moveTo = (next: number, dir: 1 | -1) => {
    if (isBusyRef.current || next === currentIdx) return;
    isBusyRef.current = true;
    Animated.parallel([
      Animated.timing(textFade, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(textSlide, {
        toValue: dir * -s(20),
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIdx(next);
      textSlide.setValue(dir * s(20));
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isBusyRef.current = false;
      });
    });
  };

  const onLeft = () => {
    const next = (currentIdx - 1 + SCHEDULES.length) % SCHEDULES.length;
    moveTo(next, -1);
  };
  const onRight = () => {
    const next = (currentIdx + 1) % SCHEDULES.length;
    moveTo(next, 1);
  };

  // "완료 처리" — 현재 segment 부드럽게 채우고 다음으로 진행
  const onComplete = () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    // 채우기 (currentIdx === completed 인 경우만 진짜 채워짐, 아니면 시각적으로만)
    Animated.timing(segmentFill, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.32, 0.72, 0.34, 1),
      useNativeDriver: false,
    }).start(() => {
      const nextCompleted = Math.min(completed + 1, SCHEDULES.length);
      setCompleted(nextCompleted);
      segmentFill.setValue(0);
      // 자동으로 다음 일정으로 이동
      const next = Math.min(currentIdx + 1, SCHEDULES.length - 1);
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: -s(20),
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (nextCompleted >= SCHEDULES.length) {
          // 하루 완료 — 마지막 위치 유지
          setCurrentIdx(SCHEDULES.length - 1);
        } else {
          setCurrentIdx(next);
        }
        textSlide.setValue(s(20));
        Animated.parallel([
          Animated.timing(textFade, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textSlide, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          isBusyRef.current = false;
        });
      });
    });
  };

  /* ─── Expand-to-sheet 상태 ─── */
  const [expand, setExpand] = useState<ExpandState | null>(null);
  const expandProgress = useRef(new Animated.Value(0)).current;
  const isExpandingRef = useRef(false);

  const openSheet = (
    action: ActionItem,
    rect: { x: number; y: number; w: number; h: number },
  ) => {
    if (isExpandingRef.current) return;
    isExpandingRef.current = true;
    setExpand({ action, rect });
    expandProgress.setValue(0);
    Animated.timing(expandProgress, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.32, 0.72, 0.34, 1),
      useNativeDriver: false,
    }).start(() => {
      isExpandingRef.current = false;
    });
  };

  const closeSheet = () => {
    if (isExpandingRef.current) return;
    isExpandingRef.current = true;
    Animated.timing(expandProgress, {
      toValue: 0,
      duration: 320,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setExpand(null);
      isExpandingRef.current = false;
    });
  };

  const allDone = completed >= SCHEDULES.length;
  const current = SCHEDULES[currentIdx];

  return (
    <View style={{ position: "relative" }}>
      {/* 배경 그라데이션 — 라이트 변종에서만 */}
      {!isBold && (
        <LinearGradient
          colors={["#DFF6F2", "#E6F0FF", "#FFF8EE", "#FFFFFF"]}
          locations={[0, 0.18, 0.45, 0.65]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}

      <View style={{ paddingBottom: s(8) }}>
        <Header />

        <View style={{ paddingTop: s(8), paddingBottom: s(4) }}>
          <DayRingHero
            current={current}
            currentIdx={currentIdx}
            completed={completed}
            segmentFill={segmentFill}
            textFade={textFade}
            textSlide={textSlide}
            breath={breath}
            isBold={isBold}
            allDone={allDone}
          />
        </View>

        <CarouselControls
          currentIdx={currentIdx}
          total={SCHEDULES.length}
          onLeft={onLeft}
          onRight={onRight}
        />

        <View style={{ alignItems: "center", marginTop: s(8) }}>
          <CompleteButton onPress={onComplete} disabled={allDone} />
        </View>

        <ActionSection actions={ACTIONS} onPressCard={openSheet} />

        <View style={{ height: s(16) }} />

        <MockTabBar />
      </View>

      {/* 액션 카드 expand-to-sheet 오버레이 */}
      {expand && (
        <ExpandedSheet
          action={expand.action}
          rect={expand.rect}
          progress={expandProgress}
          onClose={closeSheet}
        />
      )}
    </View>
  );
}

/* ───────────────────────── Header ───────────────────────── */

function Header() {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(8),
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1, gap: s(4) }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.gray[600] }}
        >
          2026년 5월 19일 화요일
        </Typography>
        <Typography
          weight="bold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(22),
            lineHeight: s(30),
            letterSpacing: -0.6,
          }}
        >
          좋은 아침이에요, 김상담사님 👋
        </Typography>
      </View>
      <Pressable
        hitSlop={6}
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(999),
          backgroundColor: COLORS.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View>
          <Ionicons
            name="notifications-outline"
            size={20}
            color={COLORS.gray[800]}
          />
          <View
            style={{
              position: "absolute",
              right: -1,
              top: -1,
              width: s(8),
              height: s(8),
              borderRadius: s(4),
              backgroundColor: COLORS.negative,
              borderWidth: 1.5,
              borderColor: COLORS.white,
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Day Ring Hero ───────────────────────── */

const RING_SIZE = Math.min(s(260), Math.round(SCREEN.width * 0.62));
const RING_STROKE_LIGHT = s(8);
const RING_STROKE_BOLD = s(12);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function DayRingHero({
  current,
  currentIdx,
  completed,
  segmentFill,
  textFade,
  textSlide,
  breath,
  isBold,
  allDone,
}: {
  current: Schedule;
  currentIdx: number;
  completed: number;
  segmentFill: Animated.Value;
  textFade: Animated.Value;
  textSlide: Animated.Value;
  breath: Animated.Value;
  isBold: boolean;
  allDone: boolean;
}) {
  const strokeWidth = isBold ? RING_STROKE_BOLD : RING_STROKE_LIGHT;
  const radius = (RING_SIZE - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentCount = SCHEDULES.length;
  // segment 표시: dasharray = arc, gap (gap 은 시각용 ~12px)
  const gapPx = s(10);
  const arcPx = circumference / segmentCount - gapPx;

  // breath: 0..1 → scale 1.00 → 1.012 (subtle)
  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.012],
  });

  // segmentFill: 채워지는 현재 segment 의 dashoffset
  const fillingOffset = segmentFill.interpolate({
    inputRange: [0, 1],
    outputRange: [arcPx, 0],
  });

  return (
    <View style={{ alignItems: "center", marginTop: s(8) }}>
      <Animated.View
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: breathScale }],
        }}
      >
        {/* SVG ring */}
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: "absolute" }}
        >
          {/* 1) 빈 segments (gray) — 항상 N개 그려둠 */}
          {Array.from({ length: segmentCount }).map((_, i) => {
            const rotation =
              -90 + (360 / segmentCount) * i + (gapPx / circumference) * 180;
            return (
              <Circle
                key={`bg-${i}`}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke={COLORS.gray[200]}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${arcPx} ${circumference}`}
                strokeLinecap="round"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                rotation={rotation}
              />
            );
          })}
          {/* 2) 채워진 segments (primary) — completed 만큼 */}
          {Array.from({ length: completed }).map((_, i) => {
            const rotation =
              -90 + (360 / segmentCount) * i + (gapPx / circumference) * 180;
            return (
              <Circle
                key={`fill-${i}`}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke={COLORS.primary500}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${arcPx} ${circumference}`}
                strokeLinecap="round"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                rotation={rotation}
              />
            );
          })}
          {/* 3) 현재 채워지는 segment — segmentFill 로 dashoffset 애니메이션 */}
          {completed < segmentCount && (
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={COLORS.primary500}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${arcPx} ${circumference}`}
              strokeDashoffset={fillingOffset}
              strokeLinecap="round"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              rotation={
                -90 +
                (360 / segmentCount) * completed +
                (gapPx / circumference) * 180
              }
            />
          )}
        </Svg>

        {/* 중앙 흰 원 + 일정 정보 */}
        <View
          style={{
            width: RING_SIZE - s(70),
            height: RING_SIZE - s(70),
            borderRadius: (RING_SIZE - s(70)) / 2,
            backgroundColor: COLORS.white,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <Animated.View
            style={{
              alignItems: "center",
              opacity: textFade,
              transform: [{ translateX: textSlide }],
            }}
          >
            {allDone ? (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={32}
                  color={COLORS.primary500}
                />
                <Typography
                  variant="body-01"
                  weight="bold"
                  style={{ color: COLORS.text.title.default, marginTop: s(6) }}
                >
                  하루를 다 채웠어요
                </Typography>
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.text.body.subtle, marginTop: s(4) }}
                >
                  수고 많으셨어요
                </Typography>
              </>
            ) : (
              <>
                <Typography
                  weight="bold"
                  style={{
                    color: COLORS.text.title.default,
                    fontSize: s(40),
                    lineHeight: s(46),
                    letterSpacing: -1,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {current.time}
                </Typography>
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default, marginTop: s(4) }}
                >
                  {current.client}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
                >
                  {current.program}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {current.session}회기
                </Typography>
                <View
                  style={{
                    marginTop: s(10),
                    paddingHorizontal: s(10),
                    paddingVertical: s(4),
                    borderRadius: s(999),
                    backgroundColor: COLORS.bg.selected,
                  }}
                >
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.primary700 }}
                  >
                    {currentIdx === completed ? "다음 일정" : currentIdx < completed ? "완료" : "예정"}
                  </Typography>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ───────────────────────── Carousel Controls ───────────────────────── */

function CarouselControls({
  currentIdx,
  total,
  onLeft,
  onRight,
}: {
  currentIdx: number;
  total: number;
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: s(20),
        marginTop: s(12),
      }}
    >
      <CarouselArrow direction="left" onPress={onLeft} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === currentIdx;
          return (
            <View
              key={i}
              style={{
                width: isActive ? s(20) : s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: isActive
                  ? COLORS.primary500
                  : COLORS.gray[300],
              }}
            />
          );
        })}
      </View>
      <CarouselArrow direction="right" onPress={onRight} />
    </View>
  );
}

function CarouselArrow({
  direction,
  onPress,
}: {
  direction: "left" | "right";
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: s(36),
        height: s(36),
        borderRadius: s(999),
        backgroundColor: COLORS.white,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons
        name={direction === "left" ? "chevron-back" : "chevron-forward"}
        size={18}
        color={COLORS.text.title.default}
      />
    </Pressable>
  );
}

/* ───────────────────────── Complete Button ───────────────────────── */

function CompleteButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        marginTop: s(12),
        paddingHorizontal: s(28),
        height: s(44),
        borderRadius: s(999),
        backgroundColor: COLORS.bg.selected,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        완료 처리
      </Typography>
    </Pressable>
  );
}

/* ───────────────────────── Action Section ───────────────────────── */

function ActionSection({
  actions,
  onPressCard,
}: {
  actions: ActionItem[];
  onPressCard: (action: ActionItem, rect: { x: number; y: number; w: number; h: number }) => void;
}) {
  return (
    <View
      style={{
        marginTop: s(28),
        paddingHorizontal: s(16),
        paddingTop: s(16),
        backgroundColor: COLORS.bg.base,
        borderTopLeftRadius: s(24),
        borderTopRightRadius: s(24),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: s(12),
          paddingHorizontal: s(4),
        }}
      >
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: COLORS.text.title.default }}
        >
          해야 할 일
        </Typography>
        <Pressable hitSlop={6}>
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.primary700 }}
          >
            전체 보기
          </Typography>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: s(12),
        }}
      >
        {actions.map((a) => (
          <ActionCard key={a.id} action={a} onPress={onPressCard} />
        ))}
      </View>
    </View>
  );
}

function ActionCard({
  action,
  onPress,
}: {
  action: ActionItem;
  onPress: (
    action: ActionItem,
    rect: { x: number; y: number; w: number; h: number },
  ) => void;
}) {
  const wrapperRef = useRef<View>(null);
  const cardWidth = (SCREEN.width - s(16) * 2 - s(12)) / 2;

  const iconBg = COLORS.paletteBg[action.palette];
  const iconColor = COLORS.palette[action.palette];

  const handlePress = () => {
    const node = wrapperRef.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => {
      onPress(action, { x, y, w, h });
    });
  };

  return (
    <View
      ref={wrapperRef}
      style={{
        width: cardWidth,
        height: s(120),
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: COLORS.gray[100] }}
        style={{
          flex: 1,
          padding: s(14),
          borderRadius: s(16),
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(10),
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={action.icon} size={18} color={iconColor} />
          </View>
          {/* 체크 표식 — 시각용 (실제 토글 아님) */}
          <View
            style={{
              width: s(20),
              height: s(20),
              borderRadius: s(999),
              borderWidth: 1.5,
              borderColor: COLORS.gray[300],
            }}
          />
        </View>
        <View style={{ gap: s(2) }}>
          <Typography
            variant="body-02"
            weight="bold"
            style={{ color: COLORS.text.title.default }}
            numberOfLines={1}
          >
            {action.title}
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
            numberOfLines={1}
          >
            {action.subtitle}
          </Typography>
        </View>
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Expanded Sheet ─────────────────────────
 *
 * 카드 자리에서 → 하단 anchored 시트 모양(상단 라운드)으로 자라남.
 * 도착 후 내부 콘텐츠는 즉시 visible(전환 도중 fade-in).
 * 백 화살표 또는 시트 외부 탭 시 역방향 애니메이션 후 unmount.
 */
function ExpandedSheet({
  action,
  rect,
  progress,
  onClose,
}: {
  action: ActionItem;
  rect: { x: number; y: number; w: number; h: number };
  progress: Animated.Value;
  onClose: () => void;
}) {
  const sheetTop = s(80);
  const sheetHeight = SCREEN.height - sheetTop;
  const cornerRadius = s(20);
  const startRadius = s(16);

  const iconBg = COLORS.paletteBg[action.palette];
  const iconColor = COLORS.palette[action.palette];

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
      {/* dim — 진행도에 비례. 펴진 상태에서만 탭 가능하도록 Pressable 만 항상 활성 */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.32],
          }),
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* 확장되는 흰 시트 */}
      <Animated.View
        style={{
          position: "absolute",
          top: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.y, sheetTop],
          }),
          left: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.x, 0],
          }),
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.w, SCREEN.width],
          }),
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [rect.h, sheetHeight],
          }),
          borderTopLeftRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [startRadius, cornerRadius],
          }),
          borderTopRightRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [startRadius, cornerRadius],
          }),
          borderBottomLeftRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [startRadius, 0],
          }),
          borderBottomRightRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [startRadius, 0],
          }),
          backgroundColor: COLORS.white,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 16,
          overflow: "hidden",
        }}
      >
        {/* 내부 콘텐츠는 expand 50% 이상부터 등장 */}
        <Animated.View
          style={{
            flex: 1,
            opacity: progress.interpolate({
              inputRange: [0.5, 1],
              outputRange: [0, 1],
              extrapolate: "clamp",
            }),
          }}
        >
          {/* 드래그 핸들 */}
          <View
            style={{
              alignItems: "center",
              paddingTop: s(8),
              paddingBottom: s(4),
            }}
          >
            <View
              style={{
                width: s(36),
                height: s(4),
                borderRadius: s(2),
                backgroundColor: COLORS.gray[200],
              }}
            />
          </View>

          {/* 헤더 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: s(16),
              paddingTop: s(8),
              paddingBottom: s(12),
              gap: s(10),
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => ({
                width: s(32),
                height: s(32),
                borderRadius: s(999),
                backgroundColor: COLORS.gray[100],
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="arrow-back" size={18} color={COLORS.text.title.default} />
            </Pressable>
            <View
              style={{
                width: s(32),
                height: s(32),
                borderRadius: s(10),
                backgroundColor: iconBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={action.icon} size={16} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography
                variant="body-01"
                weight="bold"
                style={{ color: COLORS.text.title.default }}
                numberOfLines={1}
              >
                {action.title}
              </Typography>
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
                numberOfLines={1}
              >
                {action.subtitle}
              </Typography>
            </View>
          </View>

          {/* 본문 */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: s(20),
              paddingTop: s(12),
              paddingBottom: s(40),
              gap: s(16),
            }}
            showsVerticalScrollIndicator={false}
          >
            <Typography
              variant="body-02"
              weight="regular"
              style={{ color: COLORS.text.body.strong, lineHeight: s(24) }}
            >
              {action.body}
            </Typography>

            {/* 메타 카드 */}
            <View
              style={{
                backgroundColor: COLORS.bg.base,
                borderRadius: s(12),
                padding: s(14),
                gap: s(8),
              }}
            >
              <MetaRow label="감지 시각" value="오늘 09:42" />
              <MetaRow label="우선도" value="높음" />
              <MetaRow label="관련 회기" value={`${action.subtitle.split("·")[0]?.trim() ?? ""}`} />
            </View>

            {/* CTA */}
            <Pressable
              style={({ pressed }) => ({
                height: s(52),
                borderRadius: s(14),
                backgroundColor: COLORS.primary500,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
                marginTop: s(8),
              })}
            >
              <Typography
                variant="body-01"
                weight="bold"
                style={{ color: COLORS.white }}
              >
                {action.cta}
              </Typography>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: s(16) }}
    >
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, width: s(80) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.text.title.default, flex: 1 }}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ───────────────────────── Mock Tab Bar ───────────────────────── */

function MockTabBar() {
  const items: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
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
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.default,
        paddingTop: s(8),
        paddingBottom: s(20),
        paddingHorizontal: s(8),
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      {items.map((it) => {
        const isActive = it.key === "home";
        const color = isActive ? COLORS.primary500 : COLORS.gray[400];
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
