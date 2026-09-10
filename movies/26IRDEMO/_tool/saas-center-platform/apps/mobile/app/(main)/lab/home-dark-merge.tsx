import { useState } from "react";
import { Pressable, ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 다크 시안 · 다음 상담 통합 lab.
 *
 * 현재 DarkClipboardGreeting은 같은 "다음 한 건"의 정보를 두 영역에 분산:
 *   상단 다크 패널 (시간·내담자·이전 일지)
 *   하단 흰 시트 (시간·내담자·상담/검사·프로그램·더보기)
 * → 시간/이름이 두 번 표시되어 시각 무게가 분산됨.
 *
 * 비교 시안:
 *   A 현재 (분리)  — 상단 내담자 패널 + 하단 다음 상담 카드
 *   B 통합        — 다크 패널 안에 다음 상담 한 카드로 통합 (이전 일지·더보기 액션 같이)
 *                   하단 흰 시트는 "오늘 일정" 리스트만
 */

type Variant = "current" | "merged" | "journal-hub";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "A 현재" },
  { key: "merged", label: "B 통합" },
  { key: "journal-hub", label: "C 일지 hub" },
];

const AVATAR_COLORS = [
  COLORS.palette.coral,
  COLORS.palette.violet,
  COLORS.palette.mint,
  COLORS.palette.orange,
];

interface MockClient {
  name: string;
  initial: string;
  gender: "남" | "여";
  age: number;
}

interface MockSchedule {
  start: string;
  end: string;
  client: MockClient;
  type: "상담" | "검사";
  program: string;
  room: string;
}

const NEXT_SESSION: MockSchedule = {
  start: "14:00",
  end: "16:00",
  client: { name: "박서연", initial: "박", gender: "여", age: 10 },
  type: "상담",
  program: "놀이치료",
  room: "상담실 A",
};

const SECONDARY_CLIENTS: MockClient[] = [
  { name: "이도현", initial: "이", gender: "남", age: 8 },
  { name: "최지우", initial: "최", gender: "여", age: 9 },
];

const TODAY_SCHEDULES: MockSchedule[] = [
  NEXT_SESSION,
  {
    start: "16:30",
    end: "17:30",
    client: { name: "이도현", initial: "이", gender: "남", age: 8 },
    type: "상담",
    program: "인지치료",
    room: "상담실 B",
  },
  {
    start: "18:00",
    end: "19:00",
    client: { name: "최지우", initial: "최", gender: "여", age: 9 },
    type: "검사",
    program: "주의력 검사",
    room: "검사실",
  },
];

export default function HomeDarkMergeLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("journal-hub");

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
              홈 다크 · 다음 상담 통합
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

      {/* 미리보기 */}
      <View style={{ flex: 1, backgroundColor: COLORS.gray[900] }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: s(40) }}
        >
          {/* 다크 hero (인사) — 시안에 따라 카피 차별 */}
          <View
            style={{
              paddingHorizontal: s(LAYOUT.screenPaddingX),
              paddingTop: s(24),
              paddingBottom: s(20),
            }}
          >
            <Typography
              weight="semibold"
              style={{
                color: COLORS.white,
                fontSize: s(24),
                lineHeight: s(32),
                letterSpacing: -0.8,
              }}
            >
              {variant === "journal-hub"
                ? "김민준 선생님,\n오늘 만날 분들이에요"
                : "김민준 선생님,\n오늘도 차분하게 시작해요"}
            </Typography>
          </View>

          {variant === "current" ? (
            <CurrentVariant />
          ) : variant === "merged" ? (
            <MergedVariant />
          ) : (
            <JournalHubVariant />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/* ───────── A 현재 — 분리 구조 ───────── */
function CurrentVariant() {
  return (
    <>
      {/* 상단 다크 패널 — 다음 만남 (내담자 중심) */}
      <View
        style={{
          marginHorizontal: s(LAYOUT.screenPaddingX),
          padding: s(20),
          borderRadius: s(20),
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          gap: s(16),
        }}
      >
        <DarkPrimaryClientCard schedule={NEXT_SESSION} />
        {SECONDARY_CLIENTS.map((c, i) => (
          <DarkSecondaryClientRow key={c.name} client={c} colorIndex={i + 1} />
        ))}
      </View>

      {/* 하단 흰 시트 */}
      <View
        style={{
          marginTop: s(20),
          backgroundColor: COLORS.white,
          borderTopLeftRadius: s(28),
          borderTopRightRadius: s(28),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(24),
          paddingBottom: s(24),
          gap: s(24),
        }}
      >
        {/* 다음 상담 (중복 정보) */}
        <View style={{ gap: s(8) }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            다음 상담
          </Typography>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
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
                  color: COLORS.text.title.default,
                  fontSize: s(36),
                  lineHeight: s(40),
                  letterSpacing: -1,
                }}
              >
                {NEXT_SESSION.start}
              </Typography>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.body.subtle }}
              >
                ~ {NEXT_SESSION.end}
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: 999,
                backgroundColor: COLORS.gray[100],
              }}
            >
              <Typography
                variant="body-03"
                weight="semibold"
                style={{ color: COLORS.text.body.strong }}
              >
                더보기
              </Typography>
            </View>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default, marginTop: s(4) }}
          >
            {NEXT_SESSION.client.name}님의 {NEXT_SESSION.type}
          </Typography>
          <Typography
            variant="body-03"
            style={{ color: COLORS.text.body.subtle }}
          >
            {NEXT_SESSION.client.gender} · 만 {NEXT_SESSION.client.age}세 ·{" "}
            {NEXT_SESSION.program}
          </Typography>
        </View>

        <TodaySchedulesList />
      </View>
    </>
  );
}

/* ───────── B 통합 — 다음 상담 강조 + 타임라인에서 일지 접근 ───────── */
function MergedVariant() {
  return (
    <>
      {/* 다크 패널 — 다음 상담 강조 카드 (액션은 상세 보기만, 일지는 타임라인으로) */}
      <View
        style={{
          marginHorizontal: s(LAYOUT.screenPaddingX),
          padding: s(20),
          borderRadius: s(20),
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          gap: s(18),
        }}
      >
        {/* 헤더: 라벨 + 시간 */}
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
                backgroundColor: COLORS.primary300,
              }}
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary300, letterSpacing: 0.3 }}
            >
              다음 상담
            </Typography>
          </View>
          <Typography
            variant="label-01"
            weight="medium"
            style={{
              color: "rgba(255,255,255,0.6)",
              fontVariant: ["tabular-nums"],
            }}
          >
            오늘 {NEXT_SESSION.start} ~ {NEXT_SESSION.end}
          </Typography>
        </View>

        {/* 메인: 큰 시간 + 큰 아바타 + 이름 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(16),
          }}
        >
          <View
            style={{
              width: s(64),
              height: s(64),
              borderRadius: s(32),
              backgroundColor: AVATAR_COLORS[0],
              alignItems: "center",
              justifyContent: "center",
              shadowColor: AVATAR_COLORS[0],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 6,
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
              {NEXT_SESSION.client.initial}
            </Typography>
          </View>
          <View style={{ flex: 1, gap: s(4) }}>
            <Typography
              weight="semibold"
              style={{
                color: COLORS.white,
                fontSize: s(20),
                lineHeight: s(26),
                letterSpacing: -0.5,
              }}
              numberOfLines={1}
            >
              {NEXT_SESSION.client.name}님의 {NEXT_SESSION.type}
            </Typography>
            <Typography
              variant="body-03"
              style={{ color: "rgba(255,255,255,0.7)" }}
              numberOfLines={1}
            >
              {NEXT_SESSION.client.gender} · 만 {NEXT_SESSION.client.age}세 ·{" "}
              {NEXT_SESSION.program} · {NEXT_SESSION.room}
            </Typography>
          </View>
        </View>

        {/* 상세 보기 액션 한 개 — 일지는 타임라인에서 */}
        <ActionPill icon="chevron-forward" label="상담 상세 보기" flex={1} />
      </View>

      {/* 하단 흰 시트 — 오늘 일정 타임라인 (각 행에 이전 일지 액션) */}
      <View
        style={{
          marginTop: s(20),
          backgroundColor: COLORS.white,
          borderTopLeftRadius: s(28),
          borderTopRightRadius: s(28),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(24),
          paddingBottom: s(24),
        }}
      >
        <TodayScheduleTimelineWithJournal />
      </View>
    </>
  );
}

/* ───────── B 시안 전용 — 오늘 일정 한 행 가로 정렬 + 이전 일지 액션 ─────────
 * 한 행 = [시간] [dot] [내담자명 상담] [이전 일지 pill]
 * 첫 항목(다음 상담)은 dot/시간/이름 강조 (primary).
 */
function TodayScheduleTimelineWithJournal() {
  return (
    <View style={{ gap: s(8) }}>
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
          style={{ color: COLORS.text.body.subtle }}
        >
          오늘 일정
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: COLORS.text.body.subtle }}
        >
          {TODAY_SCHEDULES.length}건
        </Typography>
      </View>

      <View style={{ paddingTop: s(4), gap: s(12) }}>
        {TODAY_SCHEDULES.map((sch, i) => {
          const isNext = i === 0;
          const dotColor = isNext
            ? COLORS.primary
            : AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <View
              key={`${sch.start}-${sch.client.name}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: s(10),
              }}
            >
              {/* 시간 */}
              <Typography
                weight={isNext ? "bold" : "semibold"}
                style={{
                  color: isNext ? COLORS.primary : COLORS.text.title.default,
                  fontSize: s(14),
                  fontVariant: ["tabular-nums"],
                  width: s(44),
                }}
              >
                {sch.start}
              </Typography>

              {/* dot */}
              <View
                style={{
                  width: isNext ? s(10) : s(8),
                  height: isNext ? s(10) : s(8),
                  borderRadius: 999,
                  backgroundColor: dotColor,
                  borderWidth: isNext ? 2 : 0,
                  borderColor: isNext ? COLORS.white : "transparent",
                  shadowColor: isNext ? COLORS.primary : "transparent",
                  shadowOpacity: isNext ? 0.3 : 0,
                  shadowRadius: 6,
                }}
              />

              {/* 내담자명 + 상담/검사 */}
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(6),
                }}
              >
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default }}
                  numberOfLines={1}
                >
                  {sch.client.name}님의 {sch.type}
                </Typography>
                {isNext && (
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: COLORS.primary }}
                  >
                    다음
                  </Typography>
                )}
              </View>

              {/* 이전 일지 pill */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: s(4),
                  paddingVertical: s(6),
                  paddingHorizontal: s(10),
                  borderRadius: 999,
                  backgroundColor: COLORS.gray[100],
                }}
              >
                <Ionicons
                  name="document-text"
                  size={12}
                  color={COLORS.text.body.strong}
                />
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.text.body.strong }}
                >
                  이전 일지
                </Typography>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 다크 패널 헬퍼 (A 현재용) ───────── */

function DarkPrimaryClientCard({ schedule }: { schedule: MockSchedule }) {
  return (
    <View style={{ gap: s(14) }}>
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
              backgroundColor: COLORS.primary300,
            }}
          />
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary300, letterSpacing: 0.3 }}
          >
            다음 만남
          </Typography>
        </View>
        <Typography
          variant="label-01"
          weight="semibold"
          style={{
            color: "rgba(255,255,255,0.75)",
            fontVariant: ["tabular-nums"],
          }}
        >
          오늘 {schedule.start}
        </Typography>
      </View>

      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(14) }}
      >
        <View
          style={{
            width: s(60),
            height: s(60),
            borderRadius: s(30),
            backgroundColor: AVATAR_COLORS[0],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(24),
              lineHeight: s(28),
              letterSpacing: -0.5,
            }}
          >
            {schedule.client.initial}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(6) }}>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            {schedule.client.name}
          </Typography>
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
              paddingVertical: s(6),
              paddingHorizontal: s(10),
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Ionicons
              name="document-text"
              size={12}
              color="rgba(255,255,255,0.9)"
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              이전 일지 보기
            </Typography>
          </View>
        </View>
      </View>
    </View>
  );
}

function DarkSecondaryClientRow({
  client,
  colorIndex,
}: {
  client: MockClient;
  colorIndex: number;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: s(12) }}
    >
      <View
        style={{
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          weight="bold"
          style={{
            color: COLORS.white,
            fontSize: s(16),
            lineHeight: s(20),
          }}
        >
          {client.initial}
        </Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          {client.name}
        </Typography>
        <Typography
          variant="label-01"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {client.gender} · 만 {client.age}세
        </Typography>
      </View>
    </View>
  );
}

/* ───────── 통합 시안의 액션 pill ───────── */
function ActionPill({
  icon,
  label,
  flex,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  flex: number;
}) {
  return (
    <View
      style={{
        flex,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: s(6),
        paddingVertical: s(12),
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.12)",
      }}
    >
      <Ionicons name={icon} size={14} color={COLORS.white} />
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {label}
      </Typography>
    </View>
  );
}

/* ───────── C 일지 hub — 다크 패널 = 일지 영역, 흰 시트 = 일정 ───────── */
function JournalHubVariant() {
  return (
    <>
      {/* 다크 패널 — 오늘 만날 모든 내담자 일지 리스트 */}
      <View
        style={{
          marginHorizontal: s(LAYOUT.screenPaddingX),
          padding: s(20),
          borderRadius: s(20),
          backgroundColor: "rgba(255,255,255,0.06)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          gap: s(14),
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
                backgroundColor: COLORS.primary300,
              }}
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary300, letterSpacing: 0.3 }}
            >
              회기 들어가기 전 일지 확인
            </Typography>
          </View>
          <Typography
            variant="label-01"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {TODAY_SCHEDULES.length}명
          </Typography>
        </View>

        <View style={{ gap: s(10) }}>
          {TODAY_SCHEDULES.map((sch, i) => (
            <JournalHubItem
              key={`${sch.start}-${sch.client.name}`}
              schedule={sch}
              colorIndex={i}
              isNext={i === 0}
            />
          ))}
        </View>
      </View>

      {/* 흰 시트 — 다음 상담 큰 카드 + 오늘 일정 리스트 */}
      <View
        style={{
          marginTop: s(20),
          backgroundColor: COLORS.white,
          borderTopLeftRadius: s(28),
          borderTopRightRadius: s(28),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(24),
          paddingBottom: s(24),
          gap: s(24),
        }}
      >
        <View style={{ gap: s(8) }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            다음 상담
          </Typography>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
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
                  color: COLORS.text.title.default,
                  fontSize: s(36),
                  lineHeight: s(40),
                  letterSpacing: -1,
                }}
              >
                {NEXT_SESSION.start}
              </Typography>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.body.subtle }}
              >
                ~ {NEXT_SESSION.end}
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: 999,
                backgroundColor: COLORS.gray[100],
              }}
            >
              <Typography
                variant="body-03"
                weight="semibold"
                style={{ color: COLORS.text.body.strong }}
              >
                더보기
              </Typography>
            </View>
          </View>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default, marginTop: s(4) }}
          >
            {NEXT_SESSION.client.name}님의 {NEXT_SESSION.type}
          </Typography>
          <Typography
            variant="body-03"
            style={{ color: COLORS.text.body.subtle }}
          >
            {NEXT_SESSION.client.gender} · 만 {NEXT_SESSION.client.age}세 ·{" "}
            {NEXT_SESSION.program} · {NEXT_SESSION.room}
          </Typography>
        </View>

        <TodaySchedulesList />
      </View>
    </>
  );
}

/** 다크 패널 안의 한 내담자 행 — 아바타 + 이름·시간 + 이전 일지 액션. 다음 만남은 강조. */
function JournalHubItem({
  schedule,
  colorIndex,
  isNext,
}: {
  schedule: MockSchedule;
  colorIndex: number;
  isNext: boolean;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(12),
        paddingVertical: s(8),
        paddingHorizontal: s(10),
        borderRadius: s(14),
        backgroundColor: isNext ? "rgba(133,175,249,0.12)" : "transparent",
        borderWidth: isNext ? 1 : 0,
        borderColor: isNext ? "rgba(133,175,249,0.25)" : "transparent",
      }}
    >
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          weight="bold"
          style={{
            color: COLORS.white,
            fontSize: s(18),
            lineHeight: s(22),
          }}
        >
          {schedule.client.initial}
        </Typography>
      </View>
      <View style={{ flex: 1, gap: s(2) }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(8),
          }}
        >
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.white }}
            numberOfLines={1}
          >
            {schedule.client.name}
          </Typography>
          {isNext && (
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.primary300 }}
            >
              다음
            </Typography>
          )}
        </View>
        <Typography
          variant="label-01"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontVariant: ["tabular-nums"],
          }}
        >
          오늘 {schedule.start} · {schedule.type}
        </Typography>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(4),
          paddingVertical: s(7),
          paddingHorizontal: s(10),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.10)",
        }}
      >
        <Ionicons
          name="document-text"
          size={12}
          color="rgba(255,255,255,0.9)"
        />
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          이전 일지
        </Typography>
      </View>
    </View>
  );
}

/* ───────── 오늘 일정 리스트 (흰 시트, 두 시안 공유) ───────── */
function TodaySchedulesList() {
  return (
    <View style={{ gap: s(12) }}>
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        오늘 일정
      </Typography>
      <View style={{ gap: s(14) }}>
        {TODAY_SCHEDULES.map((sch, i) => (
          <View
            key={`${sch.start}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: s(12),
            }}
          >
            <Typography
              weight="semibold"
              style={{
                color: COLORS.text.title.default,
                fontSize: s(14),
                fontVariant: ["tabular-nums"],
                width: s(44),
              }}
            >
              {sch.start}
            </Typography>
            <View
              style={{
                width: s(8),
                height: s(8),
                borderRadius: s(4),
                backgroundColor:
                  AVATAR_COLORS[i % AVATAR_COLORS.length],
              }}
            />
            <View style={{ flex: 1 }}>
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {sch.client.name}님의 {sch.type}
              </Typography>
              <Typography
                variant="label-01"
                style={{ color: COLORS.text.body.subtle }}
              >
                {sch.program} · {sch.room}
              </Typography>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
