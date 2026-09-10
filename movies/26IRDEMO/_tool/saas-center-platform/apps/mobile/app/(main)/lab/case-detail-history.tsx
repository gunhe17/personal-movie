import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 케이스 상세 · 일정 상세와 역할 분리 비교 lab.
 *
 * 배경:
 *   - 모바일 일정 상세에 일지/필드노트 등 모든 액션이 들어가 있음 (상담사 편의)
 *   - → 마이 페이지에서 상담/검사 케이스 상세로 들어가도 일정 상세와 구분이 약함
 *
 * 방향:
 *   - 일정 상세 = "이 회기 처리" (액션 허브) — 현재 구조 유지
 *   - 케이스 상세 = "이 케이스 전체 흐름" (이력·누적) — 차별화
 *
 * 시안 3개 (탭 전환):
 *   A. 현재 (대조군)        — 정보 카드 + 내담자 + 회기 리스트 (기존 구조)
 *   B. 요약 카드 추가       — 진행률/D-day/누적 일지를 상단 요약 카드로
 *   C. 타임라인 + 통계      — 회기 dot 타임라인 + 참석률·일지 작성률 + 회기 그룹화
 */

type Variant = "current" | "summary" | "timeline";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "A 현재" },
  { key: "summary", label: "B 요약 카드" },
  { key: "timeline", label: "C 타임라인" },
];

/* ───────── Mock data ───────── */

const CASE_INFO = {
  program: "놀이치료-그룹",
  managers: ["김민지", "박지영"],
  startDate: "2026. 4. 15",
  nextDate: "2026. 5. 18 (월)",
  daysUntilNext: 3,
  completed: 7,
  total: 12,
};

type Gender = "male" | "female";

interface MockClient {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  attended: number;
  noteWritten: number;
  total: number;
}

const CLIENTS: MockClient[] = [
  { id: "1", name: "김민준", gender: "male", age: 8, attended: 7, noteWritten: 6, total: 7 },
  { id: "2", name: "박서연", gender: "female", age: 10, attended: 7, noteWritten: 7, total: 7 },
  { id: "3", name: "이도현", gender: "male", age: 9, attended: 5, noteWritten: 5, total: 7 },
  { id: "4", name: "최지우", gender: "female", age: 7, attended: 6, noteWritten: 4, total: 7 },
];

type SessionStatus = "completed" | "scheduled";

interface MockSession {
  id: string;
  index: number;
  date: string;
  time: string;
  status: SessionStatus;
  noteCount?: number;
  attendCount?: number;
}

const SESSIONS: MockSession[] = [
  { id: "1", index: 1, date: "4. 15 (목)", time: "14:00", status: "completed", noteCount: 4, attendCount: 4 },
  { id: "2", index: 2, date: "4. 22 (목)", time: "14:00", status: "completed", noteCount: 3, attendCount: 4 },
  { id: "3", index: 3, date: "4. 29 (목)", time: "14:00", status: "completed", noteCount: 4, attendCount: 3 },
  { id: "4", index: 4, date: "5. 6 (목)", time: "14:00", status: "completed", noteCount: 4, attendCount: 4 },
  { id: "5", index: 5, date: "5. 13 (목)", time: "14:00", status: "completed", noteCount: 4, attendCount: 4 },
  { id: "6", index: 6, date: "5. 14 (금)", time: "14:00", status: "completed", noteCount: 3, attendCount: 4 },
  { id: "7", index: 7, date: "5. 15 (토)", time: "14:00", status: "completed", noteCount: 4, attendCount: 4 },
  { id: "8", index: 8, date: "5. 18 (월)", time: "14:00", status: "scheduled" },
  { id: "9", index: 9, date: "5. 25 (월)", time: "14:00", status: "scheduled" },
  { id: "10", index: 10, date: "6. 1 (월)", time: "14:00", status: "scheduled" },
  { id: "11", index: 11, date: "6. 8 (월)", time: "14:00", status: "scheduled" },
  { id: "12", index: 12, date: "6. 15 (월)", time: "14:00", status: "scheduled" },
];

const TOTAL_NOTES = SESSIONS.reduce((acc, s) => acc + (s.noteCount ?? 0), 0);
const TOTAL_ATTEND = SESSIONS.reduce((acc, s) => acc + (s.attendCount ?? 0), 0);
const POSSIBLE = CASE_INFO.completed * CLIENTS.length;
const ATTEND_RATE = Math.round((TOTAL_ATTEND / POSSIBLE) * 100);
const NOTE_RATE = Math.round((TOTAL_NOTES / POSSIBLE) * 100);

/* ───────── Color helpers (Extended Palette) ───────── */

function getProgressPalette(ratio: number) {
  if (ratio >= 1) return { solid: COLORS.palette.green, bg: COLORS.paletteBg.green };
  if (ratio >= 0.67) return { solid: COLORS.palette.greenYellow, bg: COLORS.paletteBg.greenYellow };
  if (ratio > 0) return { solid: COLORS.palette.orange, bg: COLORS.paletteBg.orange };
  return { solid: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

function getGenderPalette(gender: Gender) {
  if (gender === "male") return { solid: COLORS.palette.blue, bg: COLORS.paletteBg.blue };
  return { solid: COLORS.palette.coral, bg: COLORS.paletteBg.coral };
}

/* ═══════════════════════════════════════════════════════════
 *  Root
 * ═══════════════════════════════════════════════════════════ */

export default function CaseDetailHistoryLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("current");

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              상담 케이스 상세
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
            flexDirection: "row",
          }}
        >
          <View
            style={{
              flex: 1,
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
                    paddingVertical: s(7),
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
                    variant="label-02"
                    weight={active ? "semibold" : "medium"}
                    style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40), gap: s(24) }}
        showsVerticalScrollIndicator={false}
      >
        {variant === "current" && <VariantCurrent />}
        {variant === "summary" && <VariantSummary />}
        {variant === "timeline" && <VariantTimeline />}
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  A. 현재 (대조군)
 * ═══════════════════════════════════════════════════════════ */

function VariantCurrent() {
  return (
    <>
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingVertical: s(12),
            gap: s(8),
          }}
        >
          <InfoRow label="프로그램" value={CASE_INFO.program} />
          <InfoRow label="담당자" value={CASE_INFO.managers.join(", ")} />
          <InfoRow label="시작일" value={CASE_INFO.startDate} />
          <InfoRow label="다음 상담일" value={CASE_INFO.nextDate} />
          <InfoRow label="회기 진행" value={`${CASE_INFO.completed} / ${CASE_INFO.total}회`} />
        </View>
      </View>

      <ClientsSection variant="simple" />
      <SessionsSection variant="simple" />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  B. 요약 카드 추가
 * ═══════════════════════════════════════════════════════════ */

function VariantSummary() {
  const ratio = CASE_INFO.completed / CASE_INFO.total;
  const percent = Math.round(ratio * 100);

  return (
    <>
      {/* 케이스 요약 카드 — primary400 풀톤으로 시각 무게를 키워 강약 대비 */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
        <View
          style={{
            backgroundColor: COLORS.primary400,
            borderRadius: s(16),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingVertical: s(16),
            gap: s(14),
          }}
        >
          {/* 큰 진행률 */}
          <View>
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: "rgba(255,255,255,0.85)", marginBottom: s(4) }}
            >
              전체 진행
            </Typography>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: s(6) }}>
              <Typography
                variant="headline-01"
                weight="semibold"
                style={{ color: COLORS.white, lineHeight: s(34) }}
              >
                {CASE_INFO.completed}
              </Typography>
              <Typography
                variant="body-01"
                style={{ color: "rgba(255,255,255,0.9)", lineHeight: s(28) }}
              >
                / {CASE_INFO.total}회 · {percent}%
              </Typography>
            </View>
            <View
              style={{
                height: s(6),
                borderRadius: s(3),
                backgroundColor: "rgba(255,255,255,0.25)",
                overflow: "hidden",
                marginTop: s(10),
              }}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  backgroundColor: COLORS.white,
                }}
              />
            </View>
          </View>

          {/* 3분할 통계 */}
          <View style={{ flexDirection: "row" }}>
            <SummaryStat label="다음 상담" value={`D-${CASE_INFO.daysUntilNext}`} />
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <SummaryStat label="누적 일지" value={`${TOTAL_NOTES}건`} />
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <SummaryStat label="내담자" value={`${CLIENTS.length}명`} />
          </View>
        </View>
      </View>

      {/* 기본 정보 (콤팩트) */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          style={{ marginBottom: s(8) }}
        >
          기본 정보
        </Typography>
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingVertical: s(12),
            gap: s(8),
          }}
        >
          <InfoRow label="프로그램" value={CASE_INFO.program} />
          <InfoRow label="담당자" value={CASE_INFO.managers.join(", ")} />
          <InfoRow label="시작일" value={CASE_INFO.startDate} />
          <InfoRow label="다음 상담일" value={CASE_INFO.nextDate} />
        </View>
      </View>

      <ClientsSection variant="with-notes" />
      <SessionsSection variant="with-notes" />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  C. 타임라인 + 통계
 * ═══════════════════════════════════════════════════════════ */

function VariantTimeline() {
  return (
    <>
      {/* 케이스 헤더 — 페이지 자체를 케이스 단위로 보이게 */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
        <Typography variant="headline-02" weight="semibold" className="text-gray-900">
          {CASE_INFO.program}
        </Typography>
        <Typography
          variant="body-03"
          className="text-gray-500"
          style={{ marginTop: s(4) }}
        >
          {CASE_INFO.managers.join(", ")} · {CASE_INFO.startDate} 시작
        </Typography>
      </View>

      {/* 회기 진행 + 누적 통계 — 하나의 화이트 카드로 묶음 */}
      <View
        style={{
          marginHorizontal: s(LAYOUT.screenPaddingX),
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          gap: s(16),
        }}
      >
        <SessionTimeline />

        <View style={{ flexDirection: "row", gap: s(8) }}>
          <StatCard
            label="참석률"
            value={`${ATTEND_RATE}%`}
            sub={`${TOTAL_ATTEND}/${POSSIBLE}회 출석`}
            ratio={ATTEND_RATE / 100}
          />
          <StatCard
            label="일지 작성률"
            value={`${NOTE_RATE}%`}
            sub={`${TOTAL_NOTES}/${POSSIBLE}건 작성`}
            ratio={NOTE_RATE / 100}
          />
        </View>
      </View>

      <ClientsSection variant="compact-stats" />
      <SessionsGrouped />
    </>
  );
}

/* ───────── 회기 타임라인 (가로 dot) ───────── */

function SessionTimeline() {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: s(4),
        }}
      >
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          회기 진행
        </Typography>
        <Typography variant="caption-01" className="text-gray-500">
          {CASE_INFO.completed} / {CASE_INFO.total}회
        </Typography>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: s(12),
          alignItems: "center",
        }}
      >
        {SESSIONS.map((session, i) => {
          const isCompleted = session.status === "completed";
          // 다음에 진행될 회기를 "다음" 강조
          const isNext = i === CASE_INFO.completed;
          const showLine = i < SESSIONS.length - 1;
          const lineCompleted = i < CASE_INFO.completed - 1;

          return (
            <View key={session.id} style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ alignItems: "center", width: s(40) }}>
                <View
                  style={{
                    width: s(28),
                    height: s(28),
                    borderRadius: s(14),
                    backgroundColor: isCompleted
                      ? COLORS.palette.green
                      : isNext
                        ? COLORS.palette.blue
                        : COLORS.gray[100],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="caption-01"
                    weight="semibold"
                    style={{
                      color:
                        isCompleted || isNext ? COLORS.white : COLORS.gray[500],
                    }}
                  >
                    {session.index}
                  </Typography>
                </View>
                <Typography
                  variant="caption-01"
                  weight={isNext ? "semibold" : "regular"}
                  style={{
                    color: isNext ? COLORS.gray[900] : COLORS.gray[500],
                    marginTop: s(6),
                  }}
                >
                  {session.date.split(" ")[0]}
                </Typography>
              </View>
              {showLine && (
                <View
                  style={{
                    width: s(12),
                    height: s(2),
                    backgroundColor: lineCompleted
                      ? COLORS.palette.green
                      : COLORS.gray[200],
                    marginBottom: s(18),
                  }}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ───────── 통계 카드 ───────── */

function StatCard({
  label,
  value,
  sub,
  ratio,
}: {
  label: string;
  value: string;
  sub: string;
  ratio: number;
}) {
  const color = getProgressPalette(ratio);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
        gap: s(6),
      }}
    >
      <Typography variant="label-01" className="text-gray-500">
        {label}
      </Typography>
      <Typography
        variant="headline-02"
        weight="semibold"
        style={{ color: color.solid }}
      >
        {value}
      </Typography>
      <View
        style={{
          height: s(4),
          borderRadius: s(2),
          backgroundColor: COLORS.gray[100],
          overflow: "hidden",
          marginTop: s(4),
        }}
      >
        <View
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            backgroundColor: color.solid,
          }}
        />
      </View>
      <Typography variant="caption-01" className="text-gray-500">
        {sub}
      </Typography>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  공용 — 정보 행 / 요약 통계
 * ═══════════════════════════════════════════════════════════ */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Typography
        variant="body-02"
        className="text-gray-600"
        style={{ width: s(88) }}
      >
        {label}
      </Typography>
      <Typography variant="body-02" weight="medium" className="flex-1 text-gray-800">
        {value}
      </Typography>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: s(4) }}>
      <Typography
        variant="caption-01"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  내담자 섹션 (3 variants)
 * ═══════════════════════════════════════════════════════════ */

function ClientsSection({
  variant,
}: {
  variant: "simple" | "with-notes" | "compact-stats";
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
        style={{ marginBottom: s(8) }}
      >
        내담자 ({CLIENTS.length}명)
      </Typography>
      <View style={{ gap: s(8) }}>
        {CLIENTS.map((c) => {
          if (variant === "simple") return <ClientCardSimple key={c.id} client={c} />;
          if (variant === "with-notes") return <ClientCardWithNotes key={c.id} client={c} />;
          return <ClientCardCompactStats key={c.id} client={c} />;
        })}
      </View>
    </View>
  );
}

function ClientCardSimple({ client }: { client: MockClient }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: COLORS.gray[100],
          marginRight: s(12),
        }}
      />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline" }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {client.name}
        </Typography>
        <Typography
          variant="label-01"
          className="text-gray-500"
          style={{ marginLeft: s(6) }}
        >
          {client.gender === "male" ? "남" : "여"} | 만 {client.age}세
        </Typography>
      </View>
      <Typography
        variant="label-01"
        className="text-gray-500"
        style={{ marginRight: s(6) }}
      >
        {client.attended}/{client.total}회
      </Typography>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </View>
  );
}

function ClientCardWithNotes({ client }: { client: MockClient }) {
  const genderColor = getGenderPalette(client.gender);
  const noteRatio = client.noteWritten / client.total;
  const noteColor = getProgressPalette(noteRatio);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: genderColor.bg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: s(12),
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: genderColor.solid }}
        >
          {client.name.charAt(0)}
        </Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {client.name}
        </Typography>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(8),
            marginTop: s(2),
          }}
        >
          <Typography variant="caption-01" className="text-gray-500">
            출석 {client.attended}/{client.total}
          </Typography>
          <View
            style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[200] }}
          />
          <Typography variant="caption-01" style={{ color: noteColor.solid }}>
            일지 {client.noteWritten}건
          </Typography>
        </View>
      </View>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </View>
  );
}

function ClientCardCompactStats({ client }: { client: MockClient }) {
  const genderColor = getGenderPalette(client.gender);
  const attendRatio = client.attended / client.total;
  const noteRatio = client.noteWritten / client.total;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: genderColor.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: genderColor.solid }}
        >
          {client.name.charAt(0)}
        </Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {client.name}
        </Typography>
        <View style={{ flexDirection: "row", gap: s(12), marginTop: s(4) }}>
          <MiniStat
            label="출석"
            ratio={attendRatio}
            count={`${client.attended}/${client.total}`}
          />
          <MiniStat
            label="일지"
            ratio={noteRatio}
            count={`${client.noteWritten}/${client.total}`}
          />
        </View>
      </View>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </View>
  );
}

function MiniStat({
  label,
  ratio,
  count,
}: {
  label: string;
  ratio: number;
  count: string;
}) {
  const color = getProgressPalette(ratio);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: s(4) }}>
      <Typography variant="caption-01" className="text-gray-500">
        {label}
      </Typography>
      <Typography variant="caption-01" weight="semibold" style={{ color: color.solid }}>
        {count}
      </Typography>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  회기 섹션 (3 variants)
 * ═══════════════════════════════════════════════════════════ */

function SessionsSection({ variant }: { variant: "simple" | "with-notes" }) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
        style={{ marginBottom: s(8) }}
      >
        회기 ({SESSIONS.length}회)
      </Typography>
      <View style={{ gap: s(8) }}>
        {SESSIONS.map((session) =>
          variant === "simple" ? (
            <SessionCardSimple key={session.id} session={session} />
          ) : (
            <SessionCardWithNotes key={session.id} session={session} />
          )
        )}
      </View>
    </View>
  );
}

function SessionCardSimple({ session }: { session: MockSession }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        className="text-gray-500"
        style={{ width: s(36) }}
      >
        {session.index}회
      </Typography>
      <Typography variant="body-02" weight="medium" className="flex-1 text-gray-900">
        {session.date} {session.time}
      </Typography>
      <StatusBadge status={session.status} />
    </View>
  );
}

function SessionCardWithNotes({ session }: { session: MockSession }) {
  const isCompleted = session.status === "completed";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        paddingVertical: s(12),
        gap: s(8),
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        className="text-gray-500"
        style={{ width: s(36) }}
      >
        {session.index}회
      </Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="medium" className="text-gray-900">
          {session.date} {session.time}
        </Typography>
        {isCompleted && (
          <Typography
            variant="caption-01"
            className="text-gray-500"
            style={{ marginTop: s(2) }}
          >
            출석 {session.attendCount}/{CLIENTS.length} · 일지 {session.noteCount}건
          </Typography>
        )}
      </View>
      <StatusBadge status={session.status} />
    </View>
  );
}

function SessionsGrouped() {
  const completed = SESSIONS.filter((s) => s.status === "completed");
  const upcoming = SESSIONS.filter((s) => s.status === "scheduled");
  const recent = [...completed].reverse().slice(0, 3);
  const next = upcoming.slice(0, 3);

  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), gap: s(20) }}>
      {/* 다가오는 회기 */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: s(8),
          }}
        >
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            다가오는 회기
          </Typography>
          <Typography variant="caption-01" className="text-gray-500">
            전체 {upcoming.length}회
          </Typography>
        </View>
        <View style={{ gap: s(8) }}>
          {next.map((s) => (
            <SessionCardWithNotes key={s.id} session={s} />
          ))}
        </View>
      </View>

      {/* 최근 회기 */}
      <View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: s(8),
          }}
        >
          <Typography variant="body-02" weight="semibold" className="text-gray-900">
            최근 회기
          </Typography>
          <Typography variant="caption-01" className="text-gray-500">
            전체 {completed.length}회
          </Typography>
        </View>
        <View style={{ gap: s(8) }}>
          {recent.map((s) => (
            <SessionCardWithNotes key={s.id} session={s} />
          ))}
        </View>
      </View>
    </View>
  );
}

/* ───────── 상태 뱃지 ───────── */

function StatusBadge({ status }: { status: SessionStatus }) {
  const isCompleted = status === "completed";
  return (
    <View
      style={{
        backgroundColor: isCompleted ? COLORS.paletteBg.green : COLORS.paletteBg.gray,
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        borderRadius: s(6),
      }}
    >
      <Typography
        variant="label-02"
        weight="medium"
        style={{
          color: isCompleted ? COLORS.palette.green : COLORS.palette.gray,
        }}
      >
        {isCompleted ? "완료" : "예정"}
      </Typography>
    </View>
  );
}
