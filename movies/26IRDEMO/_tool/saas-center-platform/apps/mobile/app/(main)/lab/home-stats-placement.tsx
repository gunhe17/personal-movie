import { useState } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 통계 배치 비교 시안
 *
 * A · 현재 : 홈에 "일정/통계" 텍스트 탭 분기 — 사용자가 탭 토글 필요
 * B · 신규 : 일정 단일 + 하단 1줄 요약 카드 — 탭하면 마이페이지 상세로
 * C · 히어로 하단 : 인사말 바로 아래 1줄 요약 — "내 주간 컨텍스트"를 화면 진입 즉시 표시
 *
 * 기획 컨텍스트: 페이 가늠은 매일 보는 정보가 아니지만(월말·정산 위주),
 * 가시성을 어디까지 살릴지에 따라 위계가 달라짐.
 * B는 "오늘 우선, 통계는 부수", C는 "이번주 컨텍스트 안에서 오늘이 펼쳐짐".
 */

type Tab = "current" | "summary" | "hero";

const MOCK_SCHEDULES = [
  {
    id: "1",
    start: "09:00",
    end: "09:50",
    name: "김은서",
    type: "상담" as const,
    state: "completed" as const,
    program: "놀이치료",
    room: "1번 상담실",
  },
  {
    id: "2",
    start: "11:00",
    end: "11:50",
    name: "최서연",
    type: "상담" as const,
    state: "in_progress" as const,
    program: "인지행동치료",
    room: "1번 상담실",
  },
  {
    id: "3",
    start: "14:00",
    end: "14:50",
    name: "정하늘",
    type: "검사" as const,
    state: "upcoming" as const,
    program: "K-WISC-V",
    room: "검사실 A",
  },
];

const WEEK_STATS = { counseling: 12, assessment: 3, noShow: 1 };

export default function HomeStatsPlacementLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("summary");

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} />

        <TabSwitcher value={tab} onChange={setTab} />

        <ScrollView
          contentContainerStyle={{ paddingBottom: s(60) }}
          showsVerticalScrollIndicator={false}
        >
          <Intro variant={tab} />

          {tab === "current" ? (
            <CurrentVariant />
          ) : tab === "summary" ? (
            <SummaryVariant />
          ) : (
            <HeroSummaryVariant />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─────────── Common UI ─────────── */

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
        홈 통계 배치 비교
      </Typography>
    </View>
  );
}

function TabSwitcher({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (v: Tab) => void;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "current", label: "A · 현재" },
    { key: "summary", label: "B · 하단" },
    { key: "hero", label: "C · 히어로" },
  ];
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginTop: s(8),
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

function Intro({ variant }: { variant: Tab }) {
  const text =
    variant === "current"
      ? "사용자가 '통계' 탭을 눌러야 페이 정보가 보임. 매일 확인 안 하는 정보인데 첫 화면에 탭 분기가 차지하는 비중이 큼."
      : variant === "summary"
        ? "홈은 '오늘 준비'에 집중. 일정 카드 다음에 1줄 요약으로 가시성은 살리고, 상세는 마이페이지로 분리."
        : "인사말 바로 아래에 1줄 요약 — '내 주간 컨텍스트'를 화면 진입 즉시 보여줌. 히어로가 '내 상태' 묶음으로 확장됨.";
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginTop: s(4),
        padding: s(14),
        borderRadius: s(12),
        backgroundColor: COLORS.bg.selected,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          marginBottom: s(4),
        }}
      >
        <Ionicons
          name="information-circle"
          size={14}
          color={COLORS.primary700}
        />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          {variant === "current"
            ? "A · 현재 (탭 분기)"
            : variant === "summary"
              ? "B · 하단 요약 카드"
              : "C · 히어로 하단 요약"}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default, lineHeight: s(20) }}
      >
        {text}
      </Typography>
    </View>
  );
}

/* ─────────── 공통: 미니 홈 헤더 + 일정 카드 ─────────── */

function MiniHero() {
  return (
    <View
      style={{
        marginHorizontal: s(16),
        marginTop: s(20),
        padding: s(16),
        borderRadius: s(16),
        backgroundColor: COLORS.primary75,
      }}
    >
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        김민준님, 좋은 오후예요
      </Typography>
    </View>
  );
}

function MockScheduleCard({
  schedule,
}: {
  schedule: (typeof MOCK_SCHEDULES)[number];
}) {
  const isInProgress = schedule.state === "in_progress";
  const cardBg = isInProgress ? COLORS.bg.selected : COLORS.gray[50];
  const accent =
    schedule.type === "상담" ? COLORS.counseling : COLORS.assessment;
  const stateLabel = {
    completed: "완료",
    in_progress: "진행 중",
    upcoming: "예정",
  }[schedule.state];
  const stateColor = {
    completed: { bg: "#84B5221A", text: "#84B522" },
    in_progress: {
      bg: COLORS.statusBadge.inProgress.bg,
      text: COLORS.statusBadge.inProgress.text,
    },
    upcoming: {
      bg: COLORS.statusBadge.scheduled.bg,
      text: COLORS.statusBadge.scheduled.text,
    },
  }[schedule.state];

  return (
    <View style={{ flexDirection: "row", gap: s(8) }}>
      <View
        style={{
          width: s(54),
          paddingTop: s(12),
          alignItems: "center",
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{
            color: isInProgress ? COLORS.primary700 : COLORS.text.title.default,
          }}
        >
          {schedule.start}
        </Typography>
      </View>
      <View
        style={{
          flex: 1,
          backgroundColor: cardBg,
          borderRadius: s(16),
          paddingVertical: s(12),
          paddingHorizontal: s(16),
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
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: accent,
            }}
          />
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ flex: 1, color: COLORS.text.title.default }}
          >
            {schedule.name}님의 {schedule.type}
          </Typography>
          <View
            style={{
              backgroundColor: stateColor.bg,
              paddingHorizontal: s(8),
              paddingVertical: s(4),
              borderRadius: s(8),
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: stateColor.text }}
            >
              {stateLabel}
            </Typography>
          </View>
        </View>
        <Typography
          variant="body-03"
          weight="regular"
          style={{
            marginLeft: 6 + s(8),
            marginTop: s(2),
            color: COLORS.gray[600],
          }}
        >
          {schedule.program} · {schedule.room}
        </Typography>
      </View>
    </View>
  );
}

/* ─────────── Variant A: 현재 — 일정/통계 탭 분기 ─────────── */

function CurrentVariant() {
  const [innerTab, setInnerTab] = useState<"schedule" | "stats">("stats");
  return (
    <View>
      <MiniHero />

      <View
        style={{ marginHorizontal: s(16), marginTop: s(20) }}
      >
        {/* 텍스트 탭 — 현재 BrandHome의 ViewTabSwitcher 모사 */}
        <View style={{ flexDirection: "row", gap: s(8) }}>
          {(["schedule", "stats"] as const).map((t) => {
            const isActive = innerTab === t;
            const label = t === "schedule" ? "일정" : "통계";
            return (
              <Pressable
                key={t}
                onPress={() => setInnerTab(t)}
                hitSlop={6}
              >
                <Typography
                  variant="title-01"
                  weight={isActive ? "bold" : "medium"}
                  style={{
                    color: isActive ? COLORS.text.title.default : COLORS.gray[400],
                  }}
                >
                  {label}
                </Typography>
              </Pressable>
            );
          })}
        </View>

        {/* 선택 탭 콘텐츠 */}
        {innerTab === "schedule" ? (
          <View style={{ marginTop: s(20), gap: s(12) }}>
            {MOCK_SCHEDULES.map((s) => (
              <MockScheduleCard key={s.id} schedule={s} />
            ))}
          </View>
        ) : (
          <View style={{ marginTop: s(20) }}>
            {/* 기간 토글 */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: COLORS.bg.surface,
                borderRadius: s(20),
                padding: s(3),
                gap: s(2),
              }}
            >
              {["이번주", "이번달", "직접선택"].map((label, i) => {
                const isActive = i === 0;
                return (
                  <View
                    key={label}
                    style={{
                      flex: 1,
                      paddingVertical: s(8),
                      borderRadius: s(18),
                      backgroundColor: isActive
                        ? COLORS.primary500
                        : "transparent",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      variant="label-01"
                      weight="semibold"
                      style={{
                        color: isActive ? COLORS.white : COLORS.gray[500],
                      }}
                    >
                      {label}
                    </Typography>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: s(20) }}>
              <Typography
                variant="label-01"
                weight="regular"
                style={{ color: COLORS.text.body.subtle }}
              >
                5월 12일 ~ 18일
              </Typography>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  marginTop: s(6),
                  gap: s(6),
                }}
              >
                <Typography
                  weight="bold"
                  style={{
                    color: COLORS.text.title.default,
                    fontSize: s(28),
                    lineHeight: s(34),
                    letterSpacing: -0.6,
                  }}
                >
                  총 {WEEK_STATS.counseling + WEEK_STATS.assessment}회
                </Typography>
                <Typography
                  variant="body-02"
                  weight="regular"
                  style={{ color: COLORS.text.label.default }}
                >
                  진행했어요
                </Typography>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                marginTop: s(20),
                gap: s(12),
              }}
            >
              <StatCardMini
                color={COLORS.counseling}
                label="진행한 상담"
                value={WEEK_STATS.counseling}
              />
              <StatCardMini
                color={COLORS.assessment}
                label="진행한 검사"
                value={WEEK_STATS.assessment}
              />
              <StatCardMini
                color={COLORS.negative}
                label="노쇼"
                value={WEEK_STATS.noShow}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function StatCardMini({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        paddingVertical: s(16),
        paddingHorizontal: s(8),
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: s(28),
          height: s(28),
          borderRadius: s(8),
          backgroundColor: COLORS.gray[100],
          alignItems: "center",
          justifyContent: "center",
          marginBottom: s(8),
        }}
      >
        <View
          style={{
            width: s(10),
            height: s(10),
            borderRadius: s(5),
            backgroundColor: color,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: s(2),
        }}
      >
        <Typography
          weight="bold"
          style={{
            fontSize: s(22),
            lineHeight: s(26),
            color: COLORS.text.title.default,
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          회
        </Typography>
      </View>
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: COLORS.text.label.default, marginTop: s(2) }}
      >
        {label}
      </Typography>
    </View>
  );
}

/* ─────────── Variant B: 신규 — 일정 단일 + 하단 요약 카드 ─────────── */

function SummaryVariant() {
  return (
    <View>
      <MiniHero />

      {/* 일정 섹션 — 탭 없이 바로 카드 리스트 */}
      <View style={{ marginHorizontal: s(16), marginTop: s(20) }}>
        <Typography
          variant="title-01"
          weight="bold"
          style={{ color: COLORS.text.title.default, marginBottom: s(20) }}
        >
          오늘 일정
        </Typography>
        <View style={{ gap: s(12) }}>
          {MOCK_SCHEDULES.map((s) => (
            <MockScheduleCard key={s.id} schedule={s} />
          ))}
        </View>
      </View>

      {/* 1줄 요약 카드 — 일정 리스트 끝나고 자연스럽게 등장 */}
      <View
        style={{
          marginHorizontal: s(16),
          marginTop: s(24),
        }}
      >
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, marginBottom: s(8) }}
        >
          이번주 요약
        </Typography>
        <Pressable
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: COLORS.gray[50],
            borderRadius: s(16),
            paddingVertical: s(14),
            paddingHorizontal: s(16),
            gap: s(8),
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              gap: s(12),
            }}
          >
            <SummaryStat
              dotColor={COLORS.counseling}
              label="상담"
              value={WEEK_STATS.counseling}
            />
            <Divider />
            <SummaryStat
              dotColor={COLORS.assessment}
              label="검사"
              value={WEEK_STATS.assessment}
            />
            <Divider />
            <SummaryStat
              dotColor={COLORS.negative}
              label="노쇼"
              value={WEEK_STATS.noShow}
            />
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.gray[400]}
          />
        </Pressable>
        <Typography
          variant="label-02"
          weight="regular"
          style={{
            color: COLORS.text.placeholder,
            marginTop: s(8),
            textAlign: "center",
          }}
        >
          탭하면 마이페이지 상세 통계로 이동
        </Typography>
      </View>
    </View>
  );
}

function SummaryStat({
  dotColor,
  label,
  value,
}: {
  dotColor: string;
  label: string;
  value: number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(6),
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: dotColor,
        }}
      />
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.label.default }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {value}
      </Typography>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={{
        width: 1,
        height: s(12),
        backgroundColor: COLORS.gray[300],
      }}
    />
  );
}

/* ─────────── Variant C: 히어로 하단 요약 (별도 컨테이너) ─────────── */

function HeroSummaryVariant() {
  return (
    <View>
      {/* 히어로 — 인사말만 */}
      <View
        style={{
          marginHorizontal: s(16),
          marginTop: s(20),
          padding: s(16),
          borderRadius: s(16),
          backgroundColor: COLORS.primary75,
        }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          김민준님, 좋은 오후예요
        </Typography>
      </View>

      {/* 1줄 요약 영역 — 히어로 바로 아래 별도 라운드 컨테이너 (s(8) 타이트 갭) */}
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          marginHorizontal: s(16),
          marginTop: s(8),
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          paddingVertical: s(12),
          paddingHorizontal: s(14),
          gap: s(8),
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
            gap: s(10),
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.text.body.subtle }}
          >
            이번주
          </Typography>
          <Divider />
          <SummaryStat
            dotColor={COLORS.counseling}
            label="상담"
            value={WEEK_STATS.counseling}
          />
          <Divider />
          <SummaryStat
            dotColor={COLORS.assessment}
            label="검사"
            value={WEEK_STATS.assessment}
          />
          <Divider />
          <SummaryStat
            dotColor={COLORS.negative}
            label="노쇼"
            value={WEEK_STATS.noShow}
          />
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={COLORS.gray[400]}
        />
      </Pressable>

      {/* 일정 섹션 — 요약과 충분히 분리되도록 s(28) 섹션 갭 */}
      <View style={{ marginHorizontal: s(16), marginTop: s(28) }}>
        <Typography
          variant="title-01"
          weight="bold"
          style={{ color: COLORS.text.title.default, marginBottom: s(20) }}
        >
          오늘 일정
        </Typography>
        <View style={{ gap: s(12) }}>
          {MOCK_SCHEDULES.map((s) => (
            <MockScheduleCard key={s.id} schedule={s} />
          ))}
        </View>
      </View>

      <Typography
        variant="label-02"
        weight="regular"
        style={{
          color: COLORS.text.placeholder,
          marginTop: s(16),
          textAlign: "center",
        }}
      >
        요약 카드 탭 → 마이페이지 상세 통계로 이동
      </Typography>
    </View>
  );
}
