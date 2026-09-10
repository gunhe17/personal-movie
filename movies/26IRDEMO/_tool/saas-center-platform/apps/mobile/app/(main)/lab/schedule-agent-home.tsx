import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

// Android에서 LayoutAnimation 활성화 (모듈 1회 셋업)
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 진입 화면 · 에이전트 홈 lab.
 *
 * 기존 일정 메뉴는 진입 시 캘린더가 디폴트라 "오늘 무엇이 중요한지"가
 * 한 눈에 안 잡힘. 이 lab은 진입 시 캘린더가 아닌 "유의미한 정보 위주의
 * 일정 홈"을 보여주고, 캘린더는 헤더 아이콘/하단 CTA로 전환하는 플로우를 제안.
 *
 * 시안 2개 (탭 전환):
 *   A 정보 카드   — 다음 일정 강조 + 오늘 진행 요약 + 다가오는 리스트 + CTA
 *   B 에이전트   — AI 비서가 우선순위로 정리한 "오늘 챙길 일" task 리스트 (home-agentic 톤)
 */

type Variant = "info" | "agent" | "carousel" | "stack";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "info", label: "A 정보" },
  { key: "agent", label: "B 리스트" },
  { key: "carousel", label: "C 캐러셀" },
  { key: "stack", label: "D 스택" },
];

/* ───────── Mock 데이터 ───────── */
const NEXT_SESSION = {
  start: "14:00",
  end: "16:00",
  minutesUntil: 30,
  clientName: "박서연",
  type: "상담" as const,
  program: "놀이치료",
  room: "상담실 A",
};

const TODAY_REMAINING = [
  { start: "14:00", clientName: "박서연", type: "상담", program: "놀이치료" },
  { start: "16:30", clientName: "이도현", type: "상담", program: "인지치료" },
  { start: "18:00", clientName: "최지우", type: "검사", program: "주의력" },
];

const TOMORROW = [
  { start: "10:00", clientName: "김민지", type: "상담" },
  { start: "14:00", clientName: "정유나", type: "검사" },
];

const TODAY_PROGRESS = { completed: 2, total: 5 };
const PENDING_NOTES = 2;

/* ───────── 회기 데이터 (B 시안 — 위계 강조) ─────────
 * "일정" = 내담자 만남(상담·검사). 시간순 + 회기 특성(라벨)으로 강조 차별.
 */
type SessionTag = "soon" | "new" | "guardian" | "final";

type AgentSession = {
  id: string;
  start: string;
  end: string;
  clientName: string;
  initial: string;
  type: "상담" | "검사";
  program: string;
  room: string;
  /** 다음 회기까지 분 (음수면 진행 중) */
  minutesUntil: number | null;
  /** 강조용 회기 특성 라벨 (옵셔널) */
  tag?: SessionTag;
};

// 오늘의 회기 (Hero + 오늘 남은) — 시간순
const TODAY_SESSIONS: AgentSession[] = [
  {
    id: "s1",
    start: "14:00",
    end: "16:00",
    clientName: "박서연",
    initial: "박",
    type: "상담",
    program: "놀이치료",
    room: "상담실 A",
    minutesUntil: 30,
    tag: "soon",
  },
  {
    id: "s2",
    start: "16:30",
    end: "17:30",
    clientName: "이도현",
    initial: "이",
    type: "상담",
    program: "인지치료",
    room: "상담실 B",
    minutesUntil: 180,
  },
  {
    id: "s3",
    start: "18:00",
    end: "19:00",
    clientName: "최지우",
    initial: "최",
    type: "검사",
    program: "주의력",
    room: "검사실",
    minutesUntil: 270,
    tag: "new",
  },
];

// 다가오는 회기 (내일·모레) — 작은 행
const UPCOMING_SESSIONS: AgentSession[] = [
  {
    id: "u1",
    start: "10:00",
    end: "11:00",
    clientName: "김민지",
    initial: "김",
    type: "상담",
    program: "정서치료",
    room: "상담실 A",
    minutesUntil: null,
  },
  {
    id: "u2",
    start: "14:00",
    end: "15:30",
    clientName: "정유나",
    initial: "정",
    type: "검사",
    program: "종합심리",
    room: "검사실",
    minutesUntil: null,
    tag: "guardian",
  },
  {
    id: "u3",
    start: "16:00",
    end: "17:00",
    clientName: "한지호",
    initial: "한",
    type: "상담",
    program: "놀이치료",
    room: "상담실 B",
    minutesUntil: null,
    tag: "final",
  },
];

// 회기 특성 라벨 메타
const TAG_META: Record<
  SessionTag,
  { label: string; solid: string; bg: string }
> = {
  soon: {
    label: "곧 시작",
    solid: COLORS.palette.red,
    bg: COLORS.paletteBg.red,
  },
  new: {
    label: "신규",
    solid: COLORS.palette.violet,
    bg: COLORS.paletteBg.violet,
  },
  guardian: {
    label: "보호자 동석",
    solid: COLORS.palette.orange,
    bg: COLORS.paletteBg.orange,
  },
  final: {
    label: "종결 회기",
    solid: COLORS.palette.greenYellow,
    bg: COLORS.paletteBg.greenYellow,
  },
};

// 회기 타입별 색
function getTypeColor(type: AgentSession["type"]) {
  return type === "상담" ? COLORS.counseling : COLORS.assessment;
}

// 첫 항목(Hero) 외 오늘 남은 회기
function getTodayRemaining(): AgentSession[] {
  return TODAY_SESSIONS.slice(1);
}

function getHeroSession(): AgentSession {
  return TODAY_SESSIONS[0];
}

export default function ScheduleAgentHomeLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("agent");

  return (
    <View className="flex-1 bg-base">
      {/* 헤더 + 탭 */}
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
              일정 홈 · 에이전트
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

      {/* 미리보기 영역 */}
      <View style={{ flex: 1, backgroundColor: COLORS.bg.base }}>
        <PreviewHeader />
        <ScrollView
          contentContainerStyle={{ paddingBottom: s(40) }}
          showsVerticalScrollIndicator={false}
        >
          {variant === "info" ? (
            <InfoVariant />
          ) : variant === "agent" ? (
            <AgentVariant />
          ) : variant === "carousel" ? (
            <CarouselVariant />
          ) : (
            <StackVariant />
          )}
          <CalendarCTA />
        </ScrollView>
      </View>
    </View>
  );
}

/* ───────── 공통 페이지 헤더 (실제 일정 메뉴 헤더 모사) ───────── */
function PreviewHeader() {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(16),
        paddingBottom: s(16),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Typography
        variant="headline-02"
        weight="bold"
        style={{ color: COLORS.gray[900] }}
      >
        일정
      </Typography>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(4) }}>
        <View
          style={{
            width: s(36),
            height: s(36),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={22}
            color={COLORS.gray[700]}
          />
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
            color={COLORS.gray[700]}
          />
        </View>
      </View>
    </View>
  );
}

/* ───────── A 정보 카드 시안 ───────── */
function InfoVariant() {
  return (
    <View style={{ padding: s(LAYOUT.screenPaddingX), gap: s(16) }}>
      {/* 다음 일정 강조 카드 */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(20),
          padding: s(20),
          gap: s(14),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
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
            style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: COLORS.primary,
              }}
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary, letterSpacing: 0.3 }}
            >
              다음 일정
            </Typography>
          </View>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            {NEXT_SESSION.minutesUntil}분 후
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
              fontSize: s(32),
              lineHeight: s(36),
              letterSpacing: -1,
            }}
          >
            {NEXT_SESSION.start}
          </Typography>
          <Typography
            variant="body-02"
            style={{ color: COLORS.gray[500] }}
          >
            ~ {NEXT_SESSION.end}
          </Typography>
        </View>

        <View style={{ gap: s(4) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {NEXT_SESSION.clientName}님의 {NEXT_SESSION.type}
          </Typography>
          <Typography
            variant="body-03"
            style={{ color: COLORS.gray[500] }}
          >
            {NEXT_SESSION.program} · {NEXT_SESSION.room}
          </Typography>
        </View>
      </View>

      {/* 오늘 진행 요약 */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          gap: s(12),
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
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            오늘 진행
          </Typography>
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {TODAY_PROGRESS.completed}/{TODAY_PROGRESS.total}건 완료
          </Typography>
        </View>
        <View
          style={{
            height: s(6),
            borderRadius: s(3),
            backgroundColor: COLORS.gray[100],
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${(TODAY_PROGRESS.completed / TODAY_PROGRESS.total) * 100}%`,
              height: "100%",
              backgroundColor: COLORS.primary,
              borderRadius: s(3),
            }}
          />
        </View>
      </View>

      {/* 일지 미작성 알림 */}
      {PENDING_NOTES > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(12),
            paddingHorizontal: s(16),
            paddingVertical: s(14),
            borderRadius: s(16),
            backgroundColor: COLORS.paletteBg.orange,
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color={COLORS.palette.orange}
          />
          <View style={{ flex: 1 }}>
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
            >
              일지 {PENDING_NOTES}건 작성 필요
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[600] }}
            >
              지난 회기 일지가 아직 비어 있어요
            </Typography>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.gray[400]}
          />
        </View>
      )}

      {/* 다가오는 일정 */}
      <View style={{ gap: s(8) }}>
        <View
          style={{
            paddingHorizontal: s(4),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[700] }}
          >
            오늘 남은 일정
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[500] }}
          >
            {TODAY_REMAINING.length}건
          </Typography>
        </View>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            paddingHorizontal: s(16),
            paddingVertical: s(8),
          }}
        >
          {TODAY_REMAINING.map((sch, i) => (
            <View
              key={`${sch.start}-${sch.clientName}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: s(12),
                paddingVertical: s(10),
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: COLORS.gray[100],
              }}
            >
              <Typography
                weight="semibold"
                style={{
                  color: COLORS.gray[900],
                  fontSize: s(14),
                  fontVariant: ["tabular-nums"],
                  width: s(44),
                }}
              >
                {sch.start}
              </Typography>
              <View
                style={{
                  width: s(6),
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: COLORS.counseling,
                }}
              />
              <View style={{ flex: 1 }}>
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[900] }}
                >
                  {sch.clientName}님의 {sch.type}
                </Typography>
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.gray[500] }}
                >
                  {sch.program}
                </Typography>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 내일 미리보기 */}
      <View style={{ gap: s(8) }}>
        <View
          style={{
            paddingHorizontal: s(4),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[700] }}
          >
            내일 미리보기
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[500] }}
          >
            {TOMORROW.length}건
          </Typography>
        </View>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            paddingHorizontal: s(16),
            paddingVertical: s(8),
          }}
        >
          {TOMORROW.map((sch, i) => (
            <View
              key={`${sch.start}-${sch.clientName}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: s(12),
                paddingVertical: s(10),
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: COLORS.gray[100],
              }}
            >
              <Typography
                weight="medium"
                style={{
                  color: COLORS.gray[700],
                  fontSize: s(14),
                  fontVariant: ["tabular-nums"],
                  width: s(44),
                }}
              >
                {sch.start}
              </Typography>
              <Typography
                variant="body-02"
                style={{ color: COLORS.gray[700] }}
              >
                {sch.clientName}님의 {sch.type}
              </Typography>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ───────── B 에이전트 시안 — 회기 중심 + 위계 강조 ───────── */
function AgentVariant() {
  const hero = getHeroSession();
  const remaining = getTodayRemaining();
  return (
    <View style={{ padding: s(LAYOUT.screenPaddingX), gap: s(20) }}>
      {/* AI 한 줄 인사 */}
      <View
        style={{
          paddingHorizontal: s(4),
          flexDirection: "row",
          alignItems: "center",
          gap: s(10),
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.primary50,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles" size={14} color={COLORS.primary} />
        </View>
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.gray[700], flex: 1 }}
        >
          오늘 만날 분들을 시간 순으로 정리했어요
        </Typography>
      </View>

      {/* Hero 회기 — 가장 가까운 1건 */}
      <SessionHeroCard session={hero} />

      {/* 오늘 남은 회기 — 중간 카드들 */}
      {remaining.length > 0 && (
        <View style={{ gap: s(10) }}>
          <View
            style={{
              paddingHorizontal: s(4),
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.gray[700] }}
            >
              오늘 남은 회기
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[500] }}
            >
              {remaining.length}건
            </Typography>
          </View>
          <View style={{ gap: s(8) }}>
            {remaining.map((sch) => (
              <SessionMediumCard key={sch.id} session={sch} />
            ))}
          </View>
        </View>
      )}

      {/* 다가오는 회기 — 내일·모레, 작은 행 */}
      <View style={{ gap: s(10) }}>
        <View
          style={{
            paddingHorizontal: s(4),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[700] }}
          >
            다가오는 회기
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[500] }}
          >
            {UPCOMING_SESSIONS.length}건
          </Typography>
        </View>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            paddingHorizontal: s(16),
            paddingVertical: s(4),
          }}
        >
          {UPCOMING_SESSIONS.map((sch, i) => (
            <SessionMinimalRow
              key={sch.id}
              session={sch}
              isLast={i === UPCOMING_SESSIONS.length - 1}
            />
          ))}
        </View>
      </View>

      {/* 일지 미작성 — 보조 알림 (회기 영역과 분리) */}
      {PENDING_NOTES > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
            paddingHorizontal: s(14),
            paddingVertical: s(12),
            borderRadius: s(12),
            backgroundColor: COLORS.gray[50],
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={COLORS.gray[500]}
          />
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[700], flex: 1 }}
          >
            지난 회기 일지 {PENDING_NOTES}건이 비어있어요
          </Typography>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.gray[400]}
          />
        </View>
      )}
    </View>
  );
}

/* ───────── Hero 회기 카드 (가장 가까운 1건) ───────── */
function SessionHeroCard({ session }: { session: AgentSession }) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(16),
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1.5,
        borderColor: COLORS.primary100,
      }}
    >
      {/* 상단: 라벨 (다음 회기) + 카운트다운 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: COLORS.primary,
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary, letterSpacing: 0.3 }}
          >
            다음 회기
          </Typography>
        </View>
        {session.minutesUntil != null && (
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary }}
          >
            {session.minutesUntil}분 후 시작
          </Typography>
        )}
      </View>

      {/* 중앙: 큰 시간 + 큰 아바타 + 내담자 */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(14) }}
      >
        <View
          style={{
            width: s(64),
            height: s(64),
            borderRadius: s(32),
            backgroundColor: typeColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: typeColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(26),
              lineHeight: s(30),
              letterSpacing: -0.5,
            }}
          >
            {session.initial}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(4) }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: s(6),
            }}
          >
            <Typography
              weight="bold"
              style={{
                color: COLORS.gray[900],
                fontSize: s(24),
                lineHeight: s(28),
                letterSpacing: -0.8,
                fontVariant: ["tabular-nums"],
              }}
            >
              {session.start}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              ~ {session.end}
            </Typography>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            {session.clientName}님의 {session.type}
          </Typography>
        </View>
      </View>

      {/* 메타 + 라벨 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          flexWrap: "wrap",
        }}
      >
        <MetaChip label={session.program} />
        <MetaChip label={session.room} />
        {tagMeta && <TagPill meta={tagMeta} />}
      </View>
    </View>
  );
}

/* ───────── 중간 카드 (오늘 남은 회기) ───────── */
function SessionMediumCard({ session }: { session: AgentSession }) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(14),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
      }}
    >
      {/* 시간 */}
      <Typography
        weight="bold"
        style={{
          color: COLORS.gray[900],
          fontSize: s(16),
          fontVariant: ["tabular-nums"],
          width: s(48),
        }}
      >
        {session.start}
      </Typography>

      {/* 아바타 */}
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: typeColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          weight="bold"
          style={{
            color: COLORS.white,
            fontSize: s(15),
            lineHeight: s(18),
          }}
        >
          {session.initial}
        </Typography>
      </View>

      {/* 이름 + 메타 + 옵셔널 태그 */}
      <View style={{ flex: 1, gap: s(2) }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
            numberOfLines={1}
          >
            {session.clientName}님의 {session.type}
          </Typography>
          {tagMeta && <TagPill meta={tagMeta} compact />}
        </View>
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[500] }}
          numberOfLines={1}
        >
          {session.program} · {session.room}
        </Typography>
      </View>
    </View>
  );
}

/* ───────── 작은 행 (다가오는 회기 — 내일+) ───────── */
function SessionMinimalRow({
  session,
  isLast,
}: {
  session: AgentSession;
  isLast: boolean;
}) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(10),
        paddingVertical: s(10),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
      }}
    >
      <Typography
        weight="medium"
        style={{
          color: COLORS.gray[700],
          fontSize: s(13),
          fontVariant: ["tabular-nums"],
          width: s(40),
        }}
      >
        {session.start}
      </Typography>
      <View
        style={{
          width: s(6),
          height: s(6),
          borderRadius: s(3),
          backgroundColor: typeColor,
        }}
      />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[800], flex: 1 }}
        numberOfLines={1}
      >
        {session.clientName}님의 {session.type}
      </Typography>
      {tagMeta && <TagPill meta={tagMeta} compact />}
    </View>
  );
}

/* ───────── 헬퍼 ───────── */

function MetaChip({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        borderRadius: 999,
        backgroundColor: COLORS.gray[50],
      }}
    >
      <Typography
        variant="caption-01"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        {label}
      </Typography>
    </View>
  );
}

function TagPill({
  meta,
  compact = false,
}: {
  meta: { label: string; solid: string; bg: string };
  compact?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: compact ? s(6) : s(8),
        paddingVertical: compact ? s(2) : s(3),
        borderRadius: 999,
        backgroundColor: meta.bg,
      }}
    >
      <Typography
        variant="caption-01"
        weight="semibold"
        style={{ color: meta.solid }}
      >
        {meta.label}
      </Typography>
    </View>
  );
}

/* ───────── 캘린더 진입 CTA (일간/월간 2개 카드) ───────── */
function CalendarCTA() {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingTop: s(8),
        gap: s(10),
      }}
    >
      <View
        style={{
          paddingHorizontal: s(4),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.gray[700] }}
        >
          캘린더로 보기
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[500] }}
        >
          전체 일정 확인
        </Typography>
      </View>
      <View style={{ flexDirection: "row", gap: s(10) }}>
        <CalendarOption
          icon="today-outline"
          label="일간"
          desc="시간 순으로 보기"
        />
        <CalendarOption
          icon="calendar-outline"
          label="월간"
          desc="달력으로 한 눈에"
        />
      </View>
    </View>
  );
}

function CalendarOption({
  icon,
  label,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 캘린더 보기`}
      style={({ pressed }) => ({
        flex: 1,
        paddingHorizontal: s(16),
        paddingVertical: s(14),
        borderRadius: s(14),
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.gray[200],
        gap: s(8),
        opacity: pressed ? 0.92 : 1,
      })}
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
            width: s(34),
            height: s(34),
            borderRadius: s(10),
            backgroundColor: COLORS.primary50,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={COLORS.gray[400]}
        />
      </View>
      <View style={{ gap: s(2) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {label}
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: COLORS.gray[500] }}
        >
          {desc}
        </Typography>
      </View>
    </Pressable>
  );
}

/* ───────── C 캐러셀 시안 — Hero + 오늘 남은 회기를 가로 스와이프 ─────────
 * 한 카드 = 화면 너비의 80% (양쪽 10%씩 peek). snapToInterval로 카드 단위 정렬.
 * 첫 카드는 primary glow로 "다음 회기" 강조 — 다른 카드들은 동일 사이즈지만 톤 가벼움.
 */
function CarouselVariant() {
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = screenWidth - s(LAYOUT.screenPaddingX) * 2 - s(40);
  const cardGap = s(12);
  const sidePadding = s(LAYOUT.screenPaddingX);

  return (
    <View style={{ gap: s(20) }}>
      {/* AI 인사 */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX) + s(4),
          flexDirection: "row",
          alignItems: "center",
          gap: s(10),
          marginTop: s(LAYOUT.screenPaddingX),
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.primary50,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles" size={14} color={COLORS.primary} />
        </View>
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.gray[700], flex: 1 }}
        >
          오늘 만날 분들 · 좌우로 넘겨보세요
        </Typography>
      </View>

      {/* 가로 캐러셀 */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + cardGap}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: sidePadding,
            gap: cardGap,
          }}
        >
          {TODAY_SESSIONS.map((session, i) => (
            <View key={session.id} style={{ width: cardWidth }}>
              <CarouselSessionCard session={session} isPrimary={i === 0} />
            </View>
          ))}
        </ScrollView>
        {/* page indicator */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: s(6),
            marginTop: s(12),
          }}
        >
          {TODAY_SESSIONS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === 0 ? s(18) : s(6),
                height: s(6),
                borderRadius: s(3),
                backgroundColor: i === 0 ? COLORS.primary : COLORS.gray[300],
              }}
            />
          ))}
        </View>
      </View>

      {/* 다가오는 회기 (작은 행) + 일지 알림은 B 시안과 동일 — 재사용 */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), gap: s(20) }}>
        <UpcomingSection />
        {PENDING_NOTES > 0 && <PendingNotesNotice />}
      </View>
    </View>
  );
}

function CarouselSessionCard({
  session,
  isPrimary,
}: {
  session: AgentSession;
  isPrimary: boolean;
}) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(16),
        shadowColor: isPrimary ? COLORS.primary : "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isPrimary ? 0.14 : 0.06,
        shadowRadius: 16,
        elevation: isPrimary ? 4 : 2,
        borderWidth: isPrimary ? 1.5 : 0,
        borderColor: isPrimary ? COLORS.primary100 : "transparent",
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
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: isPrimary ? COLORS.primary : COLORS.gray[400],
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{
              color: isPrimary ? COLORS.primary : COLORS.gray[500],
              letterSpacing: 0.3,
            }}
          >
            {isPrimary ? "다음 회기" : "오늘 남음"}
          </Typography>
        </View>
        {isPrimary && session.minutesUntil != null && (
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary }}
          >
            {session.minutesUntil}분 후
          </Typography>
        )}
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(14) }}
      >
        <View
          style={{
            width: s(56),
            height: s(56),
            borderRadius: s(28),
            backgroundColor: typeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(22),
              lineHeight: s(26),
            }}
          >
            {session.initial}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(4) }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: s(6),
            }}
          >
            <Typography
              weight="bold"
              style={{
                color: COLORS.gray[900],
                fontSize: s(22),
                lineHeight: s(26),
                letterSpacing: -0.6,
                fontVariant: ["tabular-nums"],
              }}
            >
              {session.start}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              ~ {session.end}
            </Typography>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
            numberOfLines={1}
          >
            {session.clientName}님의 {session.type}
          </Typography>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          flexWrap: "wrap",
        }}
      >
        <MetaChip label={session.program} />
        <MetaChip label={session.room} />
        {tagMeta && <TagPill meta={tagMeta} />}
      </View>
    </View>
  );
}

/* ───────── D 스택 시안 — Perspective stack + swipe 전환 ─────────
 * Dribbble "Universe Education App" 톤 추정 구현.
 * 위 카드 = 풀 사이즈, 뒤 카드들 = 점점 작아지는 perspective.
 * 위 카드를 위↑로 swipe → 다음 카드로 cycle (위 카드 슬라이드 아웃).
 * 아래↓로 swipe → 이전 카드 복귀.
 */
function StackVariant() {
  const stack = TODAY_SESSIONS;
  // 카드 순서 — 첫 항목이 항상 위(활성). cycle 시 회전.
  const [order, setOrder] = useState(() => stack.map((_, i) => i));

  // 화면 카드 영역 폭/높이
  const SCREEN_H = Dimensions.get("window").height;
  const DISMISS_DISTANCE = SCREEN_H * 0.18;
  const DISMISS_VELOCITY = 0.6;
  // 위 카드가 화면 밖으로 완전히 빠지는 거리 — swipe out 종료점
  const FLY_AWAY = SCREEN_H * 0.85;

  // 위 카드의 손가락 따라가는 translateY/회전
  const dragY = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // dragY → "다음 카드로 넘어가는 진행도(0~1)" (위로 swipe 방향만)
  // 뒤 카드들이 한 칸씩 앞으로 보간되는 데 사용. swipe out 시점(=DISMISS_DISTANCE)에 1 도달.
  // 아래로 swipe(cyclePrev) 시에는 맨 뒤 카드가 앞으로 와야 하므로 이 방식이 어울리지 않아 0 유지.
  const progress = dragY.interpolate({
    inputRange: [-DISMISS_DISTANCE, 0, DISMISS_DISTANCE],
    outputRange: [1, 0, 0],
    extrapolate: "clamp",
  });

  const cycleNext = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    Animated.timing(dragY, {
      toValue: -FLY_AWAY,
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0.34, 1),
      useNativeDriver: true,
    }).start(() => {
      // 이 시점엔 뒤 카드들이 이미 progress=1 위치(=한 칸 앞)로 보간 완료.
      // setOrder + dragY 리셋만으로 시각적 점프 없이 새 배치가 그대로 이어짐.
      setOrder((prev) => [...prev.slice(1), prev[0]]);
      dragY.setValue(0);
      isAnimating.current = false;
    });
  };

  const cyclePrev = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    // 위 카드는 아래로 슬라이드 아웃. 뒤 카드들은 progress=0 유지 → 그 자리에 멈춤.
    // setOrder 후 LayoutAnimation으로 맨 뒤 카드가 위로, 나머지가 한 칸씩 뒤로 spring 전환.
    Animated.timing(dragY, {
      toValue: FLY_AWAY,
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0.34, 1),
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext({
        duration: 320,
        update: { type: "spring", springDamping: 0.78 },
      });
      setOrder((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
      dragY.setValue(0);
      isAnimating.current = false;
    });
  };

  // 뒤 카드 탭 — 그 카드를 위로 직접 가져오기 (한 번에 활성)
  const bringToTop = (clickedOriginalIdx: number) => {
    if (isAnimating.current) return;
    if (clickedOriginalIdx === order[0]) return;
    LayoutAnimation.configureNext({
      duration: 320,
      update: { type: "spring", springDamping: 0.78 },
    });
    setOrder((prev) => [
      clickedOriginalIdx,
      ...prev.filter((i) => i !== clickedOriginalIdx),
    ]);
  };

  // 위 카드 PanResponder — 위↑/아래↓ swipe 감지
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (isAnimating.current) return;
        dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (isAnimating.current) return;
        if (g.dy < -DISMISS_DISTANCE || g.vy < -DISMISS_VELOCITY) {
          cycleNext();
        } else if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          cyclePrev();
        } else {
          // 임계점 미달 — 위 카드와 뒤 카드가 함께 부드럽게 제자리로
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 240,
            mass: 0.9,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 240,
          mass: 0.9,
        }).start();
      },
    }),
  ).current;

  const orderedStack = order.map((idx) => stack[idx]);
  // 모든 카드를 visible에 포함 — cycle 시 맨 뒤로 가는 흐름이 시각적으로 보이도록
  const visible = orderedStack;

  const TOP_CARD_H = s(300); // 위 카드 높이 — 더 크게
  const STACK_PEEK = s(18); // 뒤 카드 간 peek 간격

  return (
    <View
      style={{
        padding: s(LAYOUT.screenPaddingX),
        gap: s(20),
      }}
    >
      {/* AI 인사 */}
      <View
        style={{
          paddingHorizontal: s(4),
          flexDirection: "row",
          alignItems: "center",
          gap: s(10),
        }}
      >
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.primary50,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles" size={14} color={COLORS.primary} />
        </View>
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.gray[700], flex: 1 }}
        >
          오늘 만날 분 {stack.length}명 · 위로 밀어 다음 회기로
        </Typography>
      </View>

      {/* Perspective stack */}
      <View
        style={{
          height: TOP_CARD_H + STACK_PEEK * (visible.length - 1),
          position: "relative",
        }}
      >
        {visible
          .slice()
          .reverse()
          .map((session, revIdx) => {
            const depth = visible.length - 1 - revIdx; // 0=top, 1, 2, 3
            const isTop = depth === 0;
            // visible 배열에서 이 카드의 인덱스 → order 배열의 원본 인덱스
            const originalIdx = order[visible.length - 1 - revIdx];

            // 각 depth의 정착 위치 (base) 와, 한 칸 앞으로 올라왔을 때의 위치 (prev)
            const baseOffsetY = depth * STACK_PEEK;
            const baseScale = 1 - depth * 0.05;
            const baseOpacity = depth === 0 ? 1 : 1 - depth * 0.15;
            const prevDepth = Math.max(depth - 1, 0);
            const prevOffsetY = prevDepth * STACK_PEEK;
            const prevScale = 1 - prevDepth * 0.05;
            const prevOpacity = prevDepth === 0 ? 1 : 1 - prevDepth * 0.15;

            if (isTop) {
              // 위 카드 — drag 따라 움직임 + 임계점 넘어가면 swipe out
              const animatedStyle = {
                transform: [
                  { translateY: dragY },
                  {
                    rotate: dragY.interpolate({
                      inputRange: [-FLY_AWAY, 0, FLY_AWAY],
                      outputRange: ["-6deg", "0deg", "6deg"],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: dragY.interpolate({
                  inputRange: [
                    -FLY_AWAY,
                    -DISMISS_DISTANCE * 1.6,
                    0,
                    DISMISS_DISTANCE * 1.6,
                    FLY_AWAY,
                  ],
                  outputRange: [0, 0.85, 1, 0.85, 0],
                  extrapolate: "clamp",
                }),
              };
              return (
                <Animated.View
                  key={session.id}
                  {...panResponder.panHandlers}
                  style={[
                    {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      zIndex: 100,
                    },
                    animatedStyle,
                  ]}
                >
                  <Pressable onPress={cycleNext}>
                    <StackPerspectiveCard session={session} isTop />
                  </Pressable>
                </Animated.View>
              );
            }

            // 뒤 카드 — dragY 진행도(progress)에 비례해 한 칸씩 앞으로 보간
            //   swipe 진행 중: base 위치 → prev 위치로 점진 이동 (delta만 translateY로 보간)
            //   swipe out 종료 시점에 정확히 prev 위치에 도착해 있으므로
            //   setOrder + dragY 리셋만으로 시각적 점프 없이 새 배치가 이어짐
            //   top은 layout property로 남겨 두어 bringToTop의 LayoutAnimation 전환과도 호환
            const deltaY = prevOffsetY - baseOffsetY; // 항상 음수 또는 0
            return (
              <Animated.View
                key={session.id}
                style={{
                  position: "absolute",
                  top: baseOffsetY,
                  left: 0,
                  right: 0,
                  zIndex: visible.length - depth,
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, deltaY],
                      }),
                    },
                    {
                      scale: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [baseScale, prevScale],
                      }),
                    },
                  ],
                  opacity: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [baseOpacity, prevOpacity],
                  }),
                }}
              >
                <Pressable
                  onPress={() => bringToTop(originalIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.clientName}님 회기 카드 위로`}
                >
                  <StackPerspectiveCard session={session} isTop={false} />
                </Pressable>
              </Animated.View>
            );
          })}
      </View>

      {/* page indicator */}
      {stack.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: s(6),
          }}
        >
          {stack.map((_, i) => {
            const isActive = i === order[0];
            return (
              <View
                key={i}
                style={{
                  width: isActive ? s(18) : s(6),
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: isActive
                    ? COLORS.primary
                    : COLORS.gray[300],
                }}
              />
            );
          })}
        </View>
      )}

      {/* 일지 알림 */}
      {PENDING_NOTES > 0 && <PendingNotesNotice />}
    </View>
  );
}

/* ───────── Stack용 카드 (perspective) ───────── */
function StackPerspectiveCard({
  session,
  isTop,
}: {
  session: AgentSession;
  isTop: boolean;
}) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(24),
        padding: s(24),
        gap: s(18),
        shadowColor: isTop ? COLORS.primary : "#000",
        shadowOffset: { width: 0, height: isTop ? 12 : 4 },
        shadowOpacity: isTop ? 0.18 : 0.08,
        shadowRadius: isTop ? 24 : 12,
        elevation: isTop ? 8 : 3,
        borderWidth: isTop ? 1.5 : 1,
        borderColor: isTop ? COLORS.primary100 : COLORS.gray[100],
      }}
    >
      {/* 라벨 + 카운트다운 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: isTop ? COLORS.primary : COLORS.gray[400],
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{
              color: isTop ? COLORS.primary : COLORS.gray[500],
              letterSpacing: 0.3,
            }}
          >
            {isTop ? "다음 회기" : "오늘 남음"}
          </Typography>
        </View>
        {isTop && session.minutesUntil != null && (
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary }}
          >
            {session.minutesUntil}분 후
          </Typography>
        )}
      </View>

      {/* 시간 + 아바타 + 이름 */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(16) }}
      >
        <View
          style={{
            width: s(68),
            height: s(68),
            borderRadius: s(34),
            backgroundColor: typeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(28),
              lineHeight: s(32),
            }}
          >
            {session.initial}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(6) }}>
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
                fontSize: s(28),
                lineHeight: s(32),
                letterSpacing: -0.8,
                fontVariant: ["tabular-nums"],
              }}
            >
              {session.start}
            </Typography>
            <Typography
              variant="body-02"
              style={{ color: COLORS.gray[500] }}
            >
              ~ {session.end}
            </Typography>
          </View>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
            numberOfLines={1}
          >
            {session.clientName}님의 {session.type}
          </Typography>
        </View>
      </View>

      {/* 메타 + 라벨 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          flexWrap: "wrap",
        }}
      >
        <MetaChip label={session.program} />
        <MetaChip label={session.room} />
        {tagMeta && <TagPill meta={tagMeta} />}
      </View>

      {/* 액션 — 위 카드만 */}
      {isTop && (
        <View
          style={{
            flexDirection: "row",
            gap: s(8),
            marginTop: s(4),
          }}
        >
          <View
            style={{
              flex: 1,
              paddingVertical: s(12),
              borderRadius: s(12),
              backgroundColor: COLORS.gray[50],
              alignItems: "center",
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.gray[700] }}
            >
              이전 일지
            </Typography>
          </View>
          <View
            style={{
              flex: 1,
              paddingVertical: s(12),
              borderRadius: s(12),
              backgroundColor: COLORS.primary,
              alignItems: "center",
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              회기 상세
            </Typography>
          </View>
        </View>
      )}
    </View>
  );
}

/* ───────── 아코디언 카드 (헤더 항상 + 활성 시 본문 펼침) ───────── */
function AccordionSessionCard({
  session,
  isActive,
  onPress,
}: {
  session: AgentSession;
  isActive: boolean;
  onPress: () => void;
}) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.clientName}님의 ${session.type} ${isActive ? "닫기" : "펼치기"}`}
      style={({ pressed }) => ({
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(16),
        paddingVertical: s(14),
        shadowColor: isActive ? COLORS.primary : "#000",
        shadowOffset: { width: 0, height: isActive ? 6 : 2 },
        shadowOpacity: isActive ? 0.14 : 0.05,
        shadowRadius: isActive ? 16 : 6,
        elevation: isActive ? 4 : 1,
        borderWidth: isActive ? 1.5 : 0,
        borderColor: isActive ? COLORS.primary100 : "transparent",
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {/* 헤더 — 항상 보임 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(12),
        }}
      >
        <View
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: typeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(15),
              lineHeight: s(18),
            }}
          >
            {session.initial}
          </Typography>
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
            }}
          >
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.gray[900] }}
              numberOfLines={1}
            >
              {session.clientName}님의 {session.type}
            </Typography>
            {tagMeta && <TagPill meta={tagMeta} compact />}
          </View>
          <Typography
            variant="label-01"
            style={{
              color: COLORS.gray[500],
              fontVariant: ["tabular-nums"],
            }}
          >
            {session.start} ~ {session.end}
          </Typography>
        </View>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: isActive ? COLORS.primary50 : COLORS.gray[50],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={isActive ? "chevron-up" : "chevron-down"}
            size={14}
            color={isActive ? COLORS.primary : COLORS.gray[500]}
          />
        </View>
      </View>

      {/* 본문 — 활성 시만 */}
      {isActive && (
        <View
          style={{
            marginTop: s(14),
            paddingTop: s(14),
            borderTopWidth: 1,
            borderTopColor: COLORS.gray[100],
            gap: s(12),
          }}
        >
          {/* 큰 시간 + 카운트다운 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
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
                  color: COLORS.gray[900],
                  fontSize: s(28),
                  lineHeight: s(32),
                  letterSpacing: -0.8,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {session.start}
              </Typography>
              <Typography
                variant="body-03"
                style={{ color: COLORS.gray[500] }}
              >
                ~ {session.end}
              </Typography>
            </View>
            {session.minutesUntil != null && (
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.primary }}
              >
                {session.minutesUntil}분 후
              </Typography>
            )}
          </View>

          {/* 메타 칩 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              flexWrap: "wrap",
            }}
          >
            <MetaChip label={session.program} />
            <MetaChip label={session.room} />
          </View>

          {/* 액션 — 상세 보기 + 이전 일지 */}
          <View
            style={{
              flexDirection: "row",
              gap: s(8),
              marginTop: s(4),
            }}
          >
            <View
              style={{
                flex: 1,
                paddingVertical: s(10),
                borderRadius: s(10),
                backgroundColor: COLORS.gray[50],
                alignItems: "center",
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.gray[700] }}
              >
                이전 일지
              </Typography>
            </View>
            <View
              style={{
                flex: 1,
                paddingVertical: s(10),
                borderRadius: s(10),
                backgroundColor: COLORS.primary,
                alignItems: "center",
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                회기 상세
              </Typography>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function StackSessionCard({
  session,
  isPrimary,
  hidden = false,
}: {
  session: AgentSession;
  isPrimary: boolean;
  hidden?: boolean;
}) {
  const typeColor = getTypeColor(session.type);
  const tagMeta = session.tag ? TAG_META[session.tag] : null;
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(20),
        padding: s(20),
        gap: s(16),
        shadowColor: isPrimary ? COLORS.primary : "#000",
        shadowOffset: { width: 0, height: isPrimary ? 8 : 4 },
        shadowOpacity: isPrimary ? 0.16 : 0.08,
        shadowRadius: isPrimary ? 18 : 10,
        elevation: isPrimary ? 6 : 3,
        borderWidth: isPrimary ? 1.5 : 1,
        borderColor: isPrimary ? COLORS.primary100 : COLORS.gray[100],
      }}
    >
      {/* 뒤 카드(hidden=true)는 시간/이름만 표시 (살짝 보일 정도). 디테일 제외 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: isPrimary ? COLORS.primary : COLORS.gray[400],
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{
              color: isPrimary ? COLORS.primary : COLORS.gray[500],
              letterSpacing: 0.3,
            }}
          >
            {isPrimary ? "다음 회기" : "오늘 남음"}
          </Typography>
        </View>
        {isPrimary && session.minutesUntil != null && (
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary }}
          >
            {session.minutesUntil}분 후
          </Typography>
        )}
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(14) }}
      >
        <View
          style={{
            width: s(56),
            height: s(56),
            borderRadius: s(28),
            backgroundColor: typeColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(22),
              lineHeight: s(26),
            }}
          >
            {session.initial}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(4) }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: s(6),
            }}
          >
            <Typography
              weight="bold"
              style={{
                color: COLORS.gray[900],
                fontSize: s(22),
                lineHeight: s(26),
                letterSpacing: -0.6,
                fontVariant: ["tabular-nums"],
              }}
            >
              {session.start}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: COLORS.gray[500] }}
            >
              ~ {session.end}
            </Typography>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
            numberOfLines={1}
          >
            {session.clientName}님의 {session.type}
          </Typography>
        </View>
      </View>

      {/* 뒤 카드는 메타 생략 (살짝 보임 + 임팩트 우선) */}
      {!hidden && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
            flexWrap: "wrap",
          }}
        >
          <MetaChip label={session.program} />
          <MetaChip label={session.room} />
          {tagMeta && <TagPill meta={tagMeta} />}
        </View>
      )}
    </View>
  );
}

/* ───────── 공통 섹션 (C/D 시안에서 재사용) ───────── */

function UpcomingSection() {
  return (
    <View style={{ gap: s(10) }}>
      <View
        style={{
          paddingHorizontal: s(4),
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.gray[700] }}
        >
          다가오는 회기
        </Typography>
        <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
          {UPCOMING_SESSIONS.length}건
        </Typography>
      </View>
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          paddingHorizontal: s(16),
          paddingVertical: s(4),
        }}
      >
        {UPCOMING_SESSIONS.map((sch, i) => (
          <SessionMinimalRow
            key={sch.id}
            session={sch}
            isLast={i === UPCOMING_SESSIONS.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function PendingNotesNotice() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(10),
        paddingHorizontal: s(14),
        paddingVertical: s(12),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[50],
      }}
    >
      <Ionicons
        name="document-text-outline"
        size={16}
        color={COLORS.gray[500]}
      />
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.gray[700], flex: 1 }}
      >
        지난 회기 일지 {PENDING_NOTES}건이 비어있어요
      </Typography>
      <Ionicons
        name="chevron-forward"
        size={14}
        color={COLORS.gray[400]}
      />
    </View>
  );
}
