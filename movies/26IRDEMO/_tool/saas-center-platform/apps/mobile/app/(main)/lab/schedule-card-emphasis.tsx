import { useMemo } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 카드 강조 비교 시안
 *
 * "현재 시간 기준으로 사용자가 준비해야 하는 일정"을 카드 리스트에서 어떻게 도드라지게 할지 3가지 방향 비교.
 *
 * A — 다음 한 건만 강조 (primary 보더 + 카운트다운 뱃지 + 옵션 상단 요약 라인)
 * B — 긴급도 순 재정렬 (시간순 X, 진행중 → 예정 → 완료 → 취소 순)
 * C — 과거 더 가라앉히기 (완료·취소 카드 opacity 강화)
 *
 * 시나리오: 지금 13:30
 *  10:00 김은서 — 완료
 *  11:00 박지민 — 노쇼
 *  13:00 최서연 — 진행 중
 *  14:00 정하늘 — 다음 (30분 후)
 *  15:00 윤서아 — 예정
 *  16:00 강민호 — 취소
 */

type State =
  | "completed"
  | "in_progress"
  | "upcoming"
  | "no_show"
  | "cancelled";

interface MockCard {
  id: string;
  startMin: number;
  endMin: number;
  clientName: string;
  clientAge: number;
  clientGender: "male" | "female";
  type: "counseling" | "assessment";
  programName: string;
  roomName: string;
  state: State;
}

const NOW_MIN = 13 * 60 + 30; // 13:30

const MOCKS: MockCard[] = [
  {
    id: "1",
    startMin: 10 * 60,
    endMin: 10 * 60 + 50,
    clientName: "김은서",
    clientAge: 7,
    clientGender: "female",
    type: "counseling",
    programName: "놀이치료",
    roomName: "1번 상담실",
    state: "completed",
  },
  {
    id: "2",
    startMin: 11 * 60,
    endMin: 11 * 60 + 50,
    clientName: "박지민",
    clientAge: 8,
    clientGender: "male",
    type: "counseling",
    programName: "정서지지",
    roomName: "2번 상담실",
    state: "no_show",
  },
  {
    id: "3",
    startMin: 13 * 60,
    endMin: 13 * 60 + 50,
    clientName: "최서연",
    clientAge: 14,
    clientGender: "female",
    type: "counseling",
    programName: "인지행동치료",
    roomName: "1번 상담실",
    state: "in_progress",
  },
  {
    id: "4",
    startMin: 14 * 60,
    endMin: 14 * 60 + 50,
    clientName: "정하늘",
    clientAge: 6,
    clientGender: "female",
    type: "counseling",
    programName: "놀이치료",
    roomName: "2번 상담실",
    state: "upcoming",
  },
  {
    id: "5",
    startMin: 15 * 60,
    endMin: 15 * 60 + 50,
    clientName: "윤서아",
    clientAge: 10,
    clientGender: "female",
    type: "assessment",
    programName: "K-WISC-V",
    roomName: "검사실 A",
    state: "upcoming",
  },
  {
    id: "6",
    startMin: 16 * 60,
    endMin: 16 * 60 + 50,
    clientName: "강민호",
    clientAge: 11,
    clientGender: "male",
    type: "counseling",
    programName: "사회성훈련",
    roomName: "3번 상담실",
    state: "cancelled",
  },
];

const STATUS_LABEL: Record<State, string> = {
  completed: "완료",
  in_progress: "진행 중",
  upcoming: "예정",
  no_show: "노쇼",
  cancelled: "취소",
};

const STATUS_COLOR: Record<State, { bg: string; text: string }> = {
  completed: { bg: "#84B5221A", text: "#84B522" },
  in_progress: {
    bg: COLORS.statusBadge.inProgress.bg,
    text: COLORS.statusBadge.inProgress.text,
  },
  upcoming: {
    bg: COLORS.statusBadge.scheduled.bg,
    text: COLORS.statusBadge.scheduled.text,
  },
  // 노쇼는 "안 온 일정" — orange 팔레트로 취소와 구분
  no_show: { bg: "rgba(244,117,0,0.08)", text: "#F47500" },
  cancelled: { bg: "#FFE8E8", text: COLORS.negative },
};

function formatHHmm(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "지금 집중할 일정" — in_progress 우선, 없으면 가장 가까운 미래 upcoming */
function findActiveCardId(cards: MockCard[]): string | null {
  const inProgress = cards.find((c) => c.state === "in_progress");
  if (inProgress) return inProgress.id;
  const futures = cards
    .filter((c) => c.state === "upcoming" && c.startMin > NOW_MIN)
    .sort((a, b) => a.startMin - b.startMin);
  return futures[0]?.id ?? null;
}

function sortByUrgency(cards: MockCard[]): MockCard[] {
  const order: Record<State, number> = {
    in_progress: 0,
    upcoming: 1,
    completed: 2,
    no_show: 3,
    cancelled: 3,
  };
  return [...cards].sort((a, b) => {
    if (order[a.state] !== order[b.state])
      return order[a.state] - order[b.state];
    return a.startMin - b.startMin;
  });
}

type Variant = "A" | "B" | "C";

export default function ScheduleCardEmphasisLab() {
  const router = useRouter();
  const activeId = useMemo(() => findActiveCardId(MOCKS), []);
  const urgencySorted = useMemo(() => sortByUrgency(MOCKS), []);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: s(60) }}
          showsVerticalScrollIndicator={false}
        >
          <Intro />

          <Section
            number="A"
            title="시간의 흐름 + 다음 강조"
            description="시간 순서로 표시. '지금 집중할 일정'(진행중 우선, 없으면 가장 가까운 예정)에만 옅은 primary 보더 — 시간이 흐르면 보더가 다음 카드로 자연스럽게 이동."
          >
            <CardListWithNowDivider
              cards={MOCKS}
              variant="A"
              activeId={activeId}
            />
          </Section>

          <Section
            number="B"
            title="긴급도 순 재정렬"
            description="시간순이 아닌 진행중 → 예정 → 완료 → 취소 순으로 카드 자체를 재배치. 위에서 아래로 자연스럽게 우선순위가 읽힘."
          >
            <CardList>
              {urgencySorted.map((c) => (
                <ScheduleCard
                  key={c.id}
                  card={c}
                  variant="B"
                  activeId={activeId}
                />
              ))}
            </CardList>
          </Section>

          <Section
            number="C"
            title="과거 더 가라앉히기"
            description="시간순 유지, 취소 카드의 opacity를 더 극단적으로 낮춰 미래 카드와의 대비를 강화."
          >
            <CardList>
              {MOCKS.map((c) => (
                <ScheduleCard
                  key={c.id}
                  card={c}
                  variant="C"
                  activeId={activeId}
                />
              ))}
            </CardList>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────── Sub Components ─────────── */

function TopBar({ onBack }: { onBack: () => void }) {
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
        일정 카드 강조 비교
      </Typography>
    </View>
  );
}

function Intro() {
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginTop: s(8),
        padding: s(16),
        borderRadius: s(12),
        backgroundColor: COLORS.bg.selected,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          marginBottom: s(6),
        }}
      >
        <Ionicons
          name="time-outline"
          size={16}
          color={COLORS.primary700}
        />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          시나리오 — 지금 13:30
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, lineHeight: s(20) }}
      >
        13:00 최서연 진행 중 · 14:00 정하늘이 다음(30분 후) · 10·11시는 종료/노쇼 · 16시 강민호 취소
      </Typography>
    </View>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: s(36), paddingHorizontal: s(16) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(8),
          marginBottom: s(6),
        }}
      >
        <View
          style={{
            width: s(26),
            height: s(26),
            borderRadius: s(13),
            backgroundColor: COLORS.primary500,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            variant="label-01"
            weight="bold"
            style={{ color: COLORS.white }}
          >
            {number}
          </Typography>
        </View>
        <Typography
          variant="headline-02"
          weight="bold"
          style={{ color: COLORS.text.title.default }}
        >
          {title}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="regular"
        style={{
          color: COLORS.text.body.subtle,
          marginBottom: s(16),
          lineHeight: s(20),
        }}
      >
        {description}
      </Typography>
      {children}
    </View>
  );
}

function CardList({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: s(12) }}>{children}</View>;
}

/** "지금 HH:mm" 가로 구분선 — 과거/현재 전환점을 명시 */
function NowDivider({ nowMin }: { nowMin: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(10),
        paddingVertical: s(4),
      }}
    >
      <View
        style={{ flex: 1, height: 1, backgroundColor: COLORS.primary300 }}
      />
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: COLORS.primary700 }}
      >
        지금 {formatHHmm(nowMin)}
      </Typography>
      <View
        style={{ flex: 1, height: 1, backgroundColor: COLORS.primary300 }}
      />
    </View>
  );
}

/** Variant A 전용 — 과거 카드들 직후에 "지금" 디바이더 삽입 */
function CardListWithNowDivider({
  cards,
  variant,
  activeId,
}: {
  cards: MockCard[];
  variant: Variant;
  activeId: string | null;
}) {
  // 디바이더 위치: 첫 번째 비-과거(진행중 또는 예정) 카드 인덱스
  const dividerIdx = cards.findIndex(
    (c) => c.state === "in_progress" || c.state === "upcoming",
  );
  return (
    <View style={{ gap: s(12) }}>
      {cards.map((c, i) => (
        <View key={c.id}>
          {i === dividerIdx && (
            <View style={{ marginBottom: s(12) }}>
              <NowDivider nowMin={NOW_MIN} />
            </View>
          )}
          <ScheduleCard card={c} variant={variant} activeId={activeId} />
        </View>
      ))}
    </View>
  );
}

function ScheduleCard({
  card,
  variant,
  activeId,
}: {
  card: MockCard;
  variant: Variant;
  activeId: string | null;
}) {
  const isInProgress = card.state === "in_progress";
  // 취소(없어진 일정) vs 노쇼(시간 점유됐는데 안 옴) — 시각 처리 분리
  const isCancelled = card.state === "cancelled";
  const isNoShow = card.state === "no_show";
  const isActive = card.id === activeId;

  // 카드 배경 + 콘텐츠 opacity
  // - 진행중: brand-subtle bg
  // - 그 외: gray-50 통일
  // - 취소만 가라앉히기 (노쇼는 정상 가시성)
  let cardBg: string = COLORS.gray[50];
  let contentOpacity = 1;

  if (isInProgress) {
    cardBg = COLORS.bg.selected;
  } else if (isCancelled) {
    contentOpacity = variant === "C" ? 0.25 : 0.4;
  }
  // 완료·노쇼는 예정과 동일 — bg·opacity 모두 그대로

  // 활성 카드 보더 — "지금 집중할 일정"에 옅은 primary300 1.5px
  const borderColor = isActive ? COLORS.primary300 : "transparent";
  const borderWidth = isActive ? 1.5 : 0;

  // 뱃지 — 일반 상태 라벨 (카운트다운 강조 제거)
  const badge = {
    label: STATUS_LABEL[card.state],
    bg: STATUS_COLOR[card.state].bg,
    text: STATUS_COLOR[card.state].text,
    icon: null as null,
  };

  // 시간 컬럼 색상 — in_progress에만 brand 컬러, 취소만 tertiary
  const timeColor = isInProgress
    ? COLORS.primary700
    : isCancelled
      ? COLORS.text.body.subtle
      : COLORS.text.title.default;

  return (
    <View style={{ flexDirection: "row", gap: s(8) }}>
      {/* Time column */}
      <View
        style={{
          width: s(54),
          paddingTop: s(16),
          opacity: contentOpacity,
        }}
      >
        <Typography
          variant="body-02"
          weight={isInProgress ? "semibold" : "medium"}
          style={{ color: timeColor }}
        >
          {formatHHmm(card.startMin)}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          style={{ color: COLORS.gray[400], marginTop: 2 }}
        >
          ~ {formatHHmm(card.endMin)}
        </Typography>
      </View>

      {/* Card */}
      <View
        style={{
          flex: 1,
          backgroundColor: cardBg,
          borderRadius: s(16),
          padding: s(16),
          borderWidth,
          borderColor,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: s(12),
          }}
        >
          <View style={{ flex: 1, opacity: contentOpacity }}>
            <Typography
              variant="body-01"
              weight="semibold"
              numberOfLines={1}
              style={{
                color: COLORS.text.title.default,
                textDecorationLine: isCancelled ? "line-through" : "none",
                textDecorationColor: COLORS.gray[500],
              }}
            >
              {card.clientName}님과{" "}
              {card.type === "counseling" ? "상담" : "검사"}
            </Typography>
            <Typography
              variant="label-01"
              weight="regular"
              numberOfLines={1}
              style={{
                color: COLORS.text.label.default,
                marginTop: s(4),
              }}
            >
              {card.programName} · {card.roomName} ·{" "}
              {card.clientGender === "female" ? "여" : "남"} · 만{" "}
              {card.clientAge}세
            </Typography>
          </View>

          <StatusPill badge={badge} />
        </View>
      </View>
    </View>
  );
}

function StatusPill({
  badge,
}: {
  badge: {
    label: string;
    bg: string;
    text: string;
    icon: "time" | null;
  };
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: badge.bg,
        paddingHorizontal: s(8),
        paddingVertical: s(4),
        borderRadius: s(8),
        gap: s(4),
      }}
    >
      {badge.icon && (
        <Ionicons name={badge.icon} size={11} color={badge.text} />
      )}
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: badge.text }}
      >
        {badge.label}
      </Typography>
    </View>
  );
}
