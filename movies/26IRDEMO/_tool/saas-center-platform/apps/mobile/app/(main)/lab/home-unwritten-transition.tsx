import { useRef, useState } from "react";
import {
  View,
  Pressable,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 → 미작성 일지 페이지 전환 인터랙션 시안.
 *
 * 컨셉: chip 탭 시 단순 router push 가 아닌 시각적 연결감 부여.
 *
 * 비교 탭:
 *  A. Hero Expand    — chip 이 화면 가운데로 이동 + scale 확대 → 풀스크린 카드로 morph
 *  B. Pull-Up Sheet  — 하단에서 sheet 슬라이드 업 (depth-sheet 패턴, drag handle 포함)
 *  C. Cascade Cards  — chip 사라지고 회기 카드 N개가 stagger 로 위에서 떨어짐
 *
 * 시연: Play 버튼 → 애니메이션 → Reset 으로 초기 상태 복원.
 * lab 시연 단계 — RN Animated API 사용 (Reanimated 미사용).
 */

type Variant = "A" | "B" | "C" | "D";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "A", label: "Hero Expand" },
  { key: "B", label: "Pull-Up Sheet" },
  { key: "C", label: "Cascade" },
  { key: "D", label: "Hybrid" },
];

const SCREEN = Dimensions.get("window");

export default function HomeUnwrittenTransitionLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("A");

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.gray[50] }}>
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
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              홈 → 미작성 일지 전환
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
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={{
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : "transparent",
                    alignItems: "center",
                  }}
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

      {/* 시안별 데모 영역 */}
      {variant === "A" ? (
        <DemoHeroExpand />
      ) : variant === "B" ? (
        <DemoPullUpSheet />
      ) : variant === "C" ? (
        <DemoCascade />
      ) : (
        <DemoHybrid />
      )}
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 공통 컴포넌트
 * ──────────────────────────────────────────── */

function ChipBody() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Ionicons name="create-outline" size={16} color="#7B4FFF" />
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.gray[800], marginLeft: s(8) }}
      >
        미작성 일지 3건 작성하기
      </Typography>
    </View>
  );
}

function PageContent() {
  return (
    <View style={{ flex: 1, paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(20) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: s(20),
        }}
      >
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ marginLeft: s(12), color: COLORS.gray[900] }}
        >
          미작성 일지
        </Typography>
      </View>

      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.gray[700], marginBottom: s(12) }}
      >
        5월 15일 (목) · 7일 전
      </Typography>

      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          14:00 ~ 15:00 · 1번 상담실
        </Typography>
        <Typography
          variant="body-03"
          style={{ color: COLORS.gray[600], marginTop: s(4) }}
        >
          놀이치료-그룹
        </Typography>
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginVertical: s(12),
          }}
        />
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.gray[800] }}
        >
          박지훈님 · 이수연님 · 최도윤님
        </Typography>
      </View>
    </View>
  );
}

function Controls({
  playing,
  onTrigger,
  onReset,
}: {
  playing: boolean;
  onTrigger: () => void;
  onReset: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        paddingVertical: s(20),
      }}
    >
      <Pressable
        onPress={playing ? onReset : onTrigger}
        style={{
          paddingVertical: s(12),
          paddingHorizontal: s(28),
          backgroundColor: COLORS.primary500,
          borderRadius: s(12),
        }}
        accessibilityRole="button"
        accessibilityLabel={playing ? "리셋" : "재생"}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          {playing ? "Reset" : "Play"}
        </Typography>
      </Pressable>
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 시안 A — Hero Expand
 *  chip 이 가운데로 이동 + scale 확대 → 풀스크린 카드로 morph.
 *  chip 라벨 fade-out → 페이지 콘텐츠 fade-in.
 *  width/height layout 애니메이션이라 useNativeDriver: false.
 * ──────────────────────────────────────────── */

function DemoHeroExpand() {
  const anim = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);

  const DEMO_HEIGHT = SCREEN.height - s(220);

  const trigger = () => {
    setPlaying(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: false,
    }).start();
  };

  const reset = () => {
    anim.setValue(0);
    setPlaying(false);
  };

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(220), SCREEN.width - s(LAYOUT.screenPaddingX) * 2],
  });
  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(44), DEMO_HEIGHT - s(40)],
  });
  const borderRadius = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [999, s(20)],
  });
  const bottom = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(20), DEMO_HEIGHT / 2 - (DEMO_HEIGHT - s(40)) / 2],
  });
  const labelOpacity = anim.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
  });
  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: DEMO_HEIGHT, position: "relative" }}>
        <Animated.View
          style={{
            position: "absolute",
            bottom,
            alignSelf: "center",
            width,
            height,
            borderRadius,
            backgroundColor: COLORS.white,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
            overflow: "hidden",
          }}
        >
          {/* chip 라벨 (fade-out) */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: labelOpacity,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChipBody />
          </Animated.View>

          {/* 페이지 콘텐츠 (fade-in) */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: contentOpacity,
            }}
          >
            <PageContent />
          </Animated.View>
        </Animated.View>
      </View>

      <Controls playing={playing} onTrigger={trigger} onReset={reset} />
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 시안 D — Hybrid (Hero Expand + Cascade)
 *  3단계 sequence:
 *   1) chip → 풀스크린 영역으로 expand (A 패턴, 550ms, useNativeDriver:false)
 *   2) 페이지 헤더 fade-in (200ms, useNativeDriver:true)
 *   3) 회기 카드 3개 stagger 등장 (C 패턴, 120ms 간격, spring easing)
 *  컨테이너 배경 white → gray-50 보간 — expand 끝에서 페이지 톤(§4.2).
 * ──────────────────────────────────────────── */

const CARDS_HYBRID = [
  {
    date: "5월 15일 (목)",
    daysAgo: 7,
    timeRange: "14:00 ~ 15:00",
    room: "1번 상담실",
    program: "놀이치료-그룹",
    clients: [
      { name: "박지훈", gender: "남" as const, age: 7 },
      { name: "이수연", gender: "여" as const, age: 6 },
      { name: "최도윤", gender: "남" as const, age: 7 },
    ],
  },
  {
    date: "5월 19일 (월)",
    daysAgo: 3,
    timeRange: "11:00 ~ 12:00",
    room: "2번 상담실",
    program: "인지행동치료-개인",
    clients: [{ name: "김민준", gender: "여" as const, age: 10 }],
  },
  {
    date: "5월 20일 (화)",
    daysAgo: 2,
    timeRange: "10:00 ~ 11:00",
    room: "3번 상담실",
    program: "놀이치료-그룹",
    clients: [
      { name: "한지원", gender: "여" as const, age: 8 },
      { name: "강서윤", gender: "남" as const, age: 9 },
    ],
  },
];

function DemoHybrid() {
  const expandAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const card3 = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);

  const DEMO_HEIGHT = SCREEN.height - s(220);

  const trigger = () => {
    setPlaying(true);
    Animated.sequence([
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: false,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.stagger(120, [
        Animated.timing(card1, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(card2, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(card3, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const reset = () => {
    expandAnim.setValue(0);
    headerAnim.setValue(0);
    card1.setValue(0);
    card2.setValue(0);
    card3.setValue(0);
    setPlaying(false);
  };

  const width = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(220), SCREEN.width - s(LAYOUT.screenPaddingX) * 2],
  });
  const height = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(44), DEMO_HEIGHT - s(40)],
  });
  const borderRadius = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [999, s(20)],
  });
  const bottom = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [s(20), DEMO_HEIGHT / 2 - (DEMO_HEIGHT - s(40)) / 2],
  });
  const containerBg = expandAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [COLORS.white, COLORS.white, COLORS.gray[50]],
  });
  const labelOpacity = expandAnim.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
  });

  const cardStyle = (val: Animated.Value) => ({
    opacity: val,
    transform: [
      {
        translateY: val.interpolate({
          inputRange: [0, 1],
          outputRange: [-s(40), 0],
        }),
      },
    ],
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: DEMO_HEIGHT, position: "relative" }}>
        <Animated.View
          style={{
            position: "absolute",
            bottom,
            alignSelf: "center",
            width,
            height,
            borderRadius,
            backgroundColor: containerBg,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
            overflow: "hidden",
          }}
        >
          {/* chip 라벨 fade-out */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: labelOpacity,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChipBody />
          </Animated.View>

          {/* 페이지 헤더 + 카드 cascade */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: headerAnim,
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingTop: s(24),
            }}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.gray[900], marginBottom: s(20) }}
            >
              미작성 일지
            </Typography>

            {[card1, card2, card3].map((cardAnim, idx) => {
              const data = CARDS_HYBRID[idx]!;
              return (
                <Animated.View
                  key={idx}
                  style={[
                    cardStyle(cardAnim),
                    { marginTop: idx === 0 ? 0 : s(20) },
                  ]}
                >
                  {/* 날짜 헤더 + 경과 라벨 (unwritten-journals 패턴) */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: s(8),
                      paddingHorizontal: s(4),
                    }}
                  >
                    <Typography
                      variant="label-01"
                      weight="semibold"
                      style={{ color: COLORS.gray[700] }}
                    >
                      {data.date}
                    </Typography>
                    <View
                      style={{
                        width: 1,
                        height: s(10),
                        backgroundColor: COLORS.gray[300],
                        marginHorizontal: s(8),
                      }}
                    />
                    <Typography
                      variant="label-01"
                      weight="medium"
                      style={{ color: COLORS.gray[500] }}
                    >
                      {data.daysAgo}일 전
                    </Typography>
                  </View>

                  {/* 회기 카드 — 시간·장소 / 프로그램 / divider / 내담자 rows */}
                  <View
                    style={{
                      backgroundColor: COLORS.white,
                      borderRadius: s(16),
                      paddingVertical: s(14),
                      paddingHorizontal: s(14),
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowOffset: { width: 0, height: 2 },
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    {/* 시간 · 장소 */}
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Typography
                        variant="body-02"
                        weight="semibold"
                        style={{ color: COLORS.gray[900] }}
                      >
                        {data.timeRange}
                      </Typography>
                      <View
                        style={{
                          width: 1,
                          height: s(10),
                          backgroundColor: COLORS.gray[300],
                          marginHorizontal: s(8),
                        }}
                      />
                      <Typography
                        variant="body-03"
                        weight="regular"
                        style={{ color: COLORS.gray[600] }}
                      >
                        {data.room}
                      </Typography>
                    </View>

                    {/* 프로그램 */}
                    <Typography
                      variant="body-03"
                      weight="regular"
                      style={{ color: COLORS.gray[600], marginTop: s(4) }}
                    >
                      {data.program}
                    </Typography>

                    {/* divider — 회기 메타 / 일지 row 분리 */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: COLORS.gray[100],
                        marginVertical: s(10),
                      }}
                    />

                    {/* 내담자 row — 미작성 일지 단위 */}
                    {data.clients.map((client) => (
                      <View
                        key={client.name}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: s(6),
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flex: 1,
                          }}
                        >
                          <Typography
                            variant="body-02"
                            weight="semibold"
                            style={{ color: COLORS.gray[900] }}
                          >
                            {client.name}님
                          </Typography>
                          <Typography
                            variant="body-03"
                            weight="regular"
                            style={{
                              color: COLORS.gray[600],
                              marginLeft: s(8),
                            }}
                          >
                          {client.gender} · 만 {client.age}세
                          </Typography>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={COLORS.gray[400]}
                        />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>
        </Animated.View>
      </View>

      <Controls playing={playing} onTrigger={trigger} onReset={reset} />
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 시안 B — Pull-Up Sheet
 *  chip 은 그대로, sheet 가 하단에서 슬라이드 업 (depth-sheet 패턴).
 *  drag handle + radius 상단만. dim layer 추가.
 *  translateY 애니메이션이라 useNativeDriver: true.
 * ──────────────────────────────────────────── */

function DemoPullUpSheet() {
  const anim = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);

  const DEMO_HEIGHT = SCREEN.height - s(220);
  const SHEET_TOP = s(60); // sheet 가 도달할 top 위치 (demo 영역 안)

  const trigger = () => {
    setPlaying(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  };

  const reset = () => {
    anim.setValue(0);
    setPlaying(false);
  };

  const sheetTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [DEMO_HEIGHT, 0],
  });
  const dimOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: DEMO_HEIGHT,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 초기 chip — 화면 하단 */}
        <View
          style={{
            position: "absolute",
            bottom: s(20),
            alignSelf: "center",
            paddingVertical: s(12),
            paddingHorizontal: s(20),
            backgroundColor: COLORS.white,
            borderRadius: 999,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <ChipBody />
        </View>

        {/* Dim layer */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "black",
            opacity: dimOpacity,
          }}
        />

        {/* Sheet */}
        <Animated.View
          style={{
            position: "absolute",
            top: SHEET_TOP,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(20),
            borderTopRightRadius: s(20),
            paddingTop: s(12),
            transform: [{ translateY: sheetTranslateY }],
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: -4 },
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: "center",
              width: s(36),
              height: 4,
              backgroundColor: COLORS.gray[300],
              borderRadius: 2,
              marginBottom: s(8),
            }}
          />
          <PageContent />
        </Animated.View>
      </View>

      <Controls playing={playing} onTrigger={trigger} onReset={reset} />
    </View>
  );
}

/* ─────────────────────────────────────────────
 * 시안 C — Cascade Cards
 *  chip fade-out 후 페이지 헤더 fade-in.
 *  회기 카드 N개가 stagger 로 translateY(-30 → 0) + opacity(0 → 1).
 *  spring easing 으로 살짝 바운스.
 * ──────────────────────────────────────────── */

function DemoCascade() {
  const chipAnim = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const card3 = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);

  const DEMO_HEIGHT = SCREEN.height - s(220);

  const trigger = () => {
    setPlaying(true);
    Animated.sequence([
      Animated.timing(chipAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.stagger(120, [
        Animated.timing(card1, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(card2, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(card3, {
          toValue: 1,
          duration: 450,
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const reset = () => {
    chipAnim.setValue(0);
    card1.setValue(0);
    card2.setValue(0);
    card3.setValue(0);
    setPlaying(false);
  };

  const chipOpacity = chipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const pageOpacity = chipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const cardStyle = (val: Animated.Value) => ({
    opacity: val,
    transform: [
      {
        translateY: val.interpolate({
          inputRange: [0, 1],
          outputRange: [-s(40), 0],
        }),
      },
    ],
  });

  const CARDS_CASCADE = [
    { date: "5월 15일 (목)", meta: "놀이치료-그룹 · 박지훈님 외 2명" },
    { date: "5월 19일 (월)", meta: "인지행동치료-개인 · 김민준님" },
    { date: "5월 20일 (화)", meta: "놀이치료-그룹 · 한지원님 외 1명" },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: DEMO_HEIGHT, position: "relative" }}>
        {/* chip — fade-out */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: s(20),
            alignSelf: "center",
            opacity: chipOpacity,
            paddingVertical: s(12),
            paddingHorizontal: s(20),
            backgroundColor: COLORS.white,
            borderRadius: 999,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <ChipBody />
        </Animated.View>

        {/* 페이지 콘텐츠 */}
        <Animated.View
          style={{
            flex: 1,
            opacity: pageOpacity,
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(24),
          }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.gray[900], marginBottom: s(20) }}
          >
            미작성 일지
          </Typography>

          {[card1, card2, card3].map((cardAnim, idx) => (
            <Animated.View
              key={idx}
              style={[
                cardStyle(cardAnim),
                {
                  marginTop: idx === 0 ? 0 : s(12),
                  backgroundColor: COLORS.white,
                  borderRadius: s(16),
                  padding: s(16),
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 8,
                  elevation: 2,
                },
              ]}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.gray[900] }}
              >
                {CARDS_CASCADE[idx]!.date}
              </Typography>
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[600], marginTop: s(4) }}
              >
                {CARDS_CASCADE[idx]!.meta}
              </Typography>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      <Controls playing={playing} onTrigger={trigger} onReset={reset} />
    </View>
  );
}
