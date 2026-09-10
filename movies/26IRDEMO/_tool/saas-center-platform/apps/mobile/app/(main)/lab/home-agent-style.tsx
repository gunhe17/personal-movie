import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 — 에이전트 톤 (AI assistant feel)
 *
 * 현재 홈이 "오늘 일정 리스트 + 통계 요약" 대시보드형이라면,
 * 이 시안군은 "오늘 한 가지 핵심 액션에 집중하는" 에이전트 서비스 톤.
 *
 * 공통 원칙
 *  - 화면 전체 활용 (대시보드 X)
 *  - 단 하나의 시각 포커스 (다음 상담 1건)
 *  - 따뜻한 대화체 카피
 *  - 하단 prominent CTA (필드노트로 시작하기)
 *
 * A · 코치 카드  : 중앙 큰 AI 메시지 톤 카드 + 하단 CTA
 * B · 포커스 원  : 화면 중앙 큰 카운트다운 원형 시각화 + 하단 CTA
 * C · 따뜻한 카드 : 상단 일러스트 + 인사말 + 중앙 단일 큰 카드 + 하단 CTA
 */

type Variant = "coach" | "focus" | "card" | "primary";

const NEXT_SESSION = {
  name: "김은서",
  gender: "여",
  age: 7,
  type: "상담",
  program: "놀이치료",
  room: "1번 상담실",
  start: "14:00",
  end: "14:50",
};
const MINUTES_LEFT = 30;
const TODAY_TOTAL = 4;
const TODAY_DONE = 1;
const TODAY_COUNSELING = 3;
const TODAY_ASSESSMENT = 1;

export default function HomeAgentStyleLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("coach");

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <LabTopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: s(40) }}
          showsVerticalScrollIndicator={false}
        >
          <Intro variant={variant} />
          {variant === "coach" ? (
            <View style={{ marginTop: s(8), minHeight: s(620) }}>
              <CoachVariant />
            </View>
          ) : variant === "focus" ? (
            <View style={{ marginTop: s(8), minHeight: s(620) }}>
              <FocusVariant />
            </View>
          ) : variant === "card" ? (
            <View style={{ marginTop: s(8) }}>
              <CardVariant />
            </View>
          ) : (
            <View style={{ marginTop: s(8) }}>
              <PrimaryVariant />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────── 공통 ─────────── */

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
        홈 시안 · 에이전트 톤
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
    { key: "coach", label: "A · 코치" },
    { key: "focus", label: "B · 포커스" },
    { key: "card", label: "C · 따뜻한" },
    { key: "primary", label: "D · 프라이머리" },
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
  const txt = {
    coach:
      "AI가 다음 상담을 안내하듯 중앙 카드로 핵심 정보 전달. 시선이 한 곳에 집중.",
    focus:
      "Forest 앱처럼 큰 원형 카운트다운에 시선 집중. 정보는 최소화, 몰입감 강조.",
    card: "부드러운 일러스트 + 따뜻한 인사 + 단일 큰 카드. '오늘 한 건만 잘하자' 느낌.",
    primary:
      "Primary를 화면 전체에 깔아 브랜드 톤 강조. 흰 카드와 필드노트 그라디언트가 도드라짐.",
  }[variant];
  return (
    <View
      style={{
        marginHorizontal: s(16),
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

/** 각 시안 안에서 보여줄 mock 홈 헤더 (센터명 + 알림) */
function MockTopBar() {
  return (
    <View
      style={{
        height: s(48),
        paddingHorizontal: s(20),
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
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.primary100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="business" size={14} color={COLORS.primary700} />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          마음숲 상담센터
        </Typography>
      </View>
      <Ionicons
        name="notifications-outline"
        size={22}
        color={COLORS.gray[700]}
      />
    </View>
  );
}

/** 오늘 상담/검사 건수 배지 — 흰 배경 pill */
function TodayCountBadge() {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
        backgroundColor: COLORS.white,
        paddingVertical: s(8),
        paddingHorizontal: s(14),
        borderRadius: s(999),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(5),
        }}
      >
        <Icon name="counseling-20" size={s(16)} />
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          상담 {TODAY_COUNSELING}
        </Typography>
      </View>
      <View
        style={{
          width: 1,
          height: s(12),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(5),
        }}
      >
        <Icon name="assessment-20" size={s(16)} />
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          검사 {TODAY_ASSESSMENT}
        </Typography>
      </View>
    </View>
  );
}

/** 큰 1차 CTA — 필드노트 시작 (fieldnote-purple) */
function FieldnoteCta({ label }: { label: string }) {
  return (
    <Pressable
      style={({ pressed }) => ({
        height: s(56),
        borderRadius: s(16),
        backgroundColor: COLORS.fieldnote,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: s(8),
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Ionicons name="mic" size={20} color={COLORS.white} />
      <Typography
        variant="body-01"
        weight="bold"
        style={{ color: COLORS.white }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

/* ─────────── Variant A · 코치 카드 ─────────── */

function CoachVariant() {
  return (
    <View style={{ flex: 1 }}>
      <MockTopBar />

      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(24),
        }}
      >
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(24),
            lineHeight: s(34),
            letterSpacing: -0.6,
          }}
        >
          김민준 선생님,{"\n"}오늘도 잘 부탁드려요
        </Typography>
      </View>

      {/* 중앙 AI 메시지 카드 */}
      <View
        style={{
          marginHorizontal: s(20),
          marginTop: s(28),
          padding: s(20),
          borderRadius: s(20),
          backgroundColor: COLORS.primary75,
          gap: s(14),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
          }}
        >
          <Ionicons name="sparkles" size={14} color={COLORS.primary700} />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary700 }}
          >
            다음 상담 안내
          </Typography>
        </View>

        <Typography
          weight="bold"
          style={{
            fontSize: s(22),
            lineHeight: s(30),
            color: COLORS.text.title.default,
            letterSpacing: -0.4,
          }}
        >
          {MINUTES_LEFT}분 후,{"\n"}
          {NEXT_SESSION.name}님 만나요
        </Typography>

        <View style={{ gap: s(8) }}>
          <CoachMeta label="시간" value={`${NEXT_SESSION.start} ~ ${NEXT_SESSION.end}`} />
          <CoachMeta label="프로그램" value={NEXT_SESSION.program} />
          <CoachMeta label="상담실" value={NEXT_SESSION.room} />
        </View>

        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(12),
            padding: s(12),
            flexDirection: "row",
            alignItems: "flex-start",
            gap: s(8),
          }}
        >
          <Ionicons
            name="bulb-outline"
            size={16}
            color={COLORS.primary700}
            style={{ marginTop: 2 }}
          />
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.strong, flex: 1, lineHeight: s(20) }}
          >
            지난 회기 메모를 미리 봐두면 시작이 매끄러워요
          </Typography>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* 하단 CTA + 보조 정보 */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingBottom: s(20),
          gap: s(12),
        }}
      >
        <FieldnoteCta label="필드노트로 시작하기" />
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, textAlign: "center" }}
        >
          오늘 총 {TODAY_TOTAL}건 · {TODAY_DONE}건 완료
        </Typography>
      </View>
    </View>
  );
}

function CoachMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: s(12) }}>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.body.subtle, width: s(48) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.text.title.default, flex: 1 }}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ─────────── Variant B · 포커스 원 ─────────── */

function FocusVariant() {
  return (
    <View style={{ flex: 1 }}>
      <MockTopBar />

      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(40),
          alignItems: "center",
        }}
      >
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          다음 상담까지
        </Typography>
      </View>

      {/* 중앙 원형 시각화 */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginTop: s(24),
        }}
      >
        {/* 외곽 약한 ring */}
        <View
          style={{
            width: s(280),
            height: s(280),
            borderRadius: s(140),
            borderWidth: 1.5,
            borderColor: COLORS.primary200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 내곽 fill */}
          <View
            style={{
              width: s(244),
              height: s(244),
              borderRadius: s(122),
              backgroundColor: COLORS.primary75,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: s(20),
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: s(4),
              }}
            >
              <Typography
                weight="medium"
                style={{
                  fontSize: s(72),
                  lineHeight: s(78),
                  color: COLORS.primary700,
                  letterSpacing: -2,
                }}
              >
                {MINUTES_LEFT}
              </Typography>
              <Typography
                variant="body-01"
                weight="regular"
                style={{ color: COLORS.text.label.default }}
              >
                분
              </Typography>
            </View>
            <Typography
              variant="body-02"
              weight="regular"
              style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
            >
              남았어요
            </Typography>

            <View
              style={{
                marginTop: s(20),
                paddingTop: s(16),
                borderTopWidth: 1,
                borderTopColor: COLORS.primary200,
                alignItems: "center",
                width: "70%",
              }}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {NEXT_SESSION.name}님
              </Typography>
              <Typography
                variant="label-01"
                weight="regular"
                style={{ color: COLORS.text.label.default, marginTop: s(2) }}
              >
                {NEXT_SESSION.program} · {NEXT_SESSION.start}
              </Typography>
            </View>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* 하단 CTA */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingBottom: s(20),
          gap: s(12),
        }}
      >
        <FieldnoteCta label="필드노트 켜두기" />
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, textAlign: "center" }}
        >
          {NEXT_SESSION.room}에서 진행돼요
        </Typography>
      </View>
    </View>
  );
}

/* ─────────── Variant C · 따뜻한 카드 (필드노트 CTA 강조) ─────────── */

function CardVariant() {
  return (
    <LinearGradient
      // 사선 그라디언트 — 좌상 연한 블루 → 우하 연한 그린
      colors={["#DCE9FF", "#F7FFEE"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: "100%" }}
    >
      <MockTopBar />

      {/* 히어로 — 오늘 날짜 + 큰 인사말 (일러스트 대신 타이포로 무게감) */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(28),
        }}
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.primary700 }}
        >
          5월 15일 목요일
        </Typography>
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -0.8,
            marginTop: s(8),
          }}
        >
          김민준 선생님,{"\n"}오늘도 잘 부탁드려요
        </Typography>
        <View style={{ marginTop: s(16) }}>
          <TodayCountBadge />
        </View>
      </View>

      {/* 다음 상담 — 컴팩트 흰 카드 */}
      <View
        style={{
          marginHorizontal: s(20),
          marginTop: s(28),
          padding: s(20),
          borderRadius: s(24),
          backgroundColor: COLORS.white,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 4,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
          }}
        >
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(12),
              backgroundColor: COLORS.primary75,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="counseling-20" size={s(20)} color={COLORS.primary700} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.text.body.subtle }}
            >
              다음 상담
            </Typography>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: s(3),
                marginTop: s(2),
              }}
            >
              <Typography
                weight="bold"
                style={{
                  color: COLORS.primary700,
                  fontSize: s(22),
                  lineHeight: s(28),
                  letterSpacing: -0.5,
                }}
              >
                {MINUTES_LEFT}분
              </Typography>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.label.default }}
              >
                후 시작해요
              </Typography>
            </View>
          </View>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            {NEXT_SESSION.start} ~ {NEXT_SESSION.end}
          </Typography>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginVertical: s(16),
          }}
        />

        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {NEXT_SESSION.name} ({NEXT_SESSION.gender} · 만 {NEXT_SESSION.age}세)님의 {NEXT_SESSION.type}
        </Typography>
        <View
          style={{
            marginTop: s(12),
            gap: s(4),
          }}
        >
          <CardMetaRow iconName="document-20" text={NEXT_SESSION.program} />
          <CardMetaRow iconName="location-20" text={NEXT_SESSION.room} />
        </View>
      </View>

      {/* 큰 필드노트 피처 카드 — 화면의 무게중심 액션 */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingBottom: s(24),
          marginTop: s(32),
        }}
      >
        {/* shadow 컨테이너 — 둥근 모서리는 LinearGradient 자체에 적용 */}
        <View
          style={{
            borderRadius: s(28),
            shadowColor: "#7B79FF",
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.32,
            shadowRadius: 28,
            elevation: 14,
            backgroundColor: "transparent",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="필드노트 시작 — AI가 회기 일지를 자동 정리"
            style={({ pressed }) => ({
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <LinearGradient
              colors={["#A56EFF", "#7B79FF", "#219EFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: s(28),
                paddingTop: s(20),
                paddingBottom: s(20),
                paddingHorizontal: s(20),
                overflow: "hidden",
              }}
            >
              {/* 액션 행 — 큰 mic 원 + 라벨 + 화살표 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(14),
                }}
              >
                <View
                  style={{
                    width: s(56),
                    height: s(56),
                    borderRadius: s(28),
                    backgroundColor: "rgba(255,255,255,0.20)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.30)",
                  }}
                >
                  <Ionicons name="mic" size={26} color={COLORS.white} />
                </View>

                <View style={{ flex: 1 }}>
                  <Typography
                    weight="semibold"
                    style={{
                      color: COLORS.white,
                      fontSize: s(20),
                      lineHeight: s(26),
                      letterSpacing: -0.4,
                    }}
                  >
                    필드노트로 시작하기
                  </Typography>
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{
                      color: "rgba(255,255,255,0.80)",
                      marginTop: s(2),
                    }}
                  >
                    녹음만 켜두세요. 일지는 AI가 정리해드려요
                  </Typography>
                </View>

                <View
                  style={{
                    width: s(36),
                    height: s(36),
                    borderRadius: s(18),
                    backgroundColor: "rgba(255,255,255,0.20)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.white}
                  />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* 보조 정보 — 오늘 전체 진행 상황 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(6),
            marginTop: s(16),
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            오늘 {TODAY_TOTAL}건 중 {TODAY_DONE}건 완료
          </Typography>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ─────────── Variant D · 프라이머리 배경 ─────────── */

function PrimaryVariant() {
  return (
    <LinearGradient
      colors={[COLORS.primary500, COLORS.primary700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: "100%" }}
    >
      {/* MockTopBar — primary 배경용 흰 톤 */}
      <View
        style={{
          height: s(48),
          paddingHorizontal: s(20),
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
              width: s(28),
              height: s(28),
              borderRadius: s(8),
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="business" size={14} color={COLORS.white} />
          </View>
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            마음숲 상담센터
          </Typography>
        </View>
        <Ionicons
          name="notifications-outline"
          size={22}
          color={COLORS.white}
        />
      </View>

      {/* 히어로 — 오늘 날짜 + 큰 인사말 */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingTop: s(28),
        }}
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: "rgba(255,255,255,0.80)" }}
        >
          5월 15일 목요일
        </Typography>
        <Typography
          weight="semibold"
          style={{
            color: COLORS.white,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -0.8,
            marginTop: s(8),
          }}
        >
          김민준 선생님,{"\n"}오늘도 잘 부탁드려요
        </Typography>
        <View style={{ marginTop: s(16) }}>
          <TodayCountBadge />
        </View>
      </View>

      {/* 다음 상담 — 흰 카드 (primary 위에서 도드라짐) */}
      <View
        style={{
          marginHorizontal: s(20),
          marginTop: s(28),
          padding: s(20),
          borderRadius: s(24),
          backgroundColor: COLORS.white,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
          }}
        >
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(12),
              backgroundColor: COLORS.primary75,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="counseling-20" size={s(20)} color={COLORS.primary700} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.text.body.subtle }}
            >
              다음 상담
            </Typography>
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                gap: s(3),
                marginTop: s(2),
              }}
            >
              <Typography
                weight="bold"
                style={{
                  color: COLORS.primary700,
                  fontSize: s(22),
                  lineHeight: s(28),
                  letterSpacing: -0.5,
                }}
              >
                {MINUTES_LEFT}분
              </Typography>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.label.default }}
              >
                후 시작해요
              </Typography>
            </View>
          </View>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            {NEXT_SESSION.start} ~ {NEXT_SESSION.end}
          </Typography>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginVertical: s(16),
          }}
        />

        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {NEXT_SESSION.name} ({NEXT_SESSION.gender} · 만 {NEXT_SESSION.age}세)님의 {NEXT_SESSION.type}
        </Typography>
        <View
          style={{
            marginTop: s(12),
            gap: s(4),
          }}
        >
          <CardMetaRow iconName="document-20" text={NEXT_SESSION.program} />
          <CardMetaRow iconName="location-20" text={NEXT_SESSION.room} />
        </View>
      </View>

      {/* 큰 필드노트 피처 카드 */}
      <View
        style={{
          paddingHorizontal: s(20),
          paddingBottom: s(24),
          marginTop: s(32),
        }}
      >
        <View
          style={{
            borderRadius: s(28),
            shadowColor: "#7B79FF",
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.32,
            shadowRadius: 28,
            elevation: 14,
            backgroundColor: "transparent",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="필드노트 시작 — AI가 회기 일지를 자동 정리"
            style={({ pressed }) => ({
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <LinearGradient
              colors={["#A56EFF", "#7B79FF", "#219EFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: s(28),
                paddingTop: s(20),
                paddingBottom: s(20),
                paddingHorizontal: s(20),
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(14),
                }}
              >
                <View
                  style={{
                    width: s(56),
                    height: s(56),
                    borderRadius: s(28),
                    backgroundColor: "rgba(255,255,255,0.20)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.30)",
                  }}
                >
                  <Ionicons name="mic" size={26} color={COLORS.white} />
                </View>

                <View style={{ flex: 1 }}>
                  <Typography
                    weight="semibold"
                    style={{
                      color: COLORS.white,
                      fontSize: s(20),
                      lineHeight: s(26),
                      letterSpacing: -0.4,
                    }}
                  >
                    필드노트로 시작하기
                  </Typography>
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{
                      color: "rgba(255,255,255,0.80)",
                      marginTop: s(2),
                    }}
                  >
                    녹음만 켜두세요. 일지는 AI가 정리해드려요
                  </Typography>
                </View>

                <View
                  style={{
                    width: s(36),
                    height: s(36),
                    borderRadius: s(18),
                    backgroundColor: "rgba(255,255,255,0.20)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={COLORS.white}
                  />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* 보조 정보 — 오늘 전체 진행 상황 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(6),
            marginTop: s(16),
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "rgba(255,255,255,0.55)",
            }}
          />
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: "rgba(255,255,255,0.80)" }}
          >
            오늘 {TODAY_TOTAL}건 중 {TODAY_DONE}건 완료
          </Typography>
        </View>
      </View>
    </LinearGradient>
  );
}

function CardMetaRow({
  iconName,
  text,
}: {
  iconName: React.ComponentProps<typeof Icon>["name"];
  text: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
      }}
    >
      <Icon name={iconName} size={s(20)} color={COLORS.gray[400]} />
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.gray[800], flex: 1 }}
        numberOfLines={1}
      >
        {text}
      </Typography>
    </View>
  );
}

