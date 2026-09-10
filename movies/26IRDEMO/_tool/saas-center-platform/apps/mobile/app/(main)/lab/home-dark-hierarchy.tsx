import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈(다크) 정보 위계 비교 lab.
 *
 * 현재 production(DarkClipboardGreeting) 의 다크 상단 + 흰 하단 시트가 같은
 * "다음 만날 사람"을 두 번 가리키는 중복 문제를 풀기 위한 3안 비교.
 *
 *   A. 오버뷰 ↔ 행동 — 다크=거시적 요약(N명·카테고리), 흰=다음 상담 카드+타임라인
 *   B. 다음 1건 ↔ 흐름 — 다크=다음 만남 1건 풀강조, 흰=타임라인만(NextSession 제거)
 *   C. 관계 ↔ 시간      — 다크=내담자(사람), 흰=시간표(회기)
 */

type Variant = "overview" | "focus" | "relation" | "illustrated";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "overview", label: "A 오버뷰" },
  { key: "focus", label: "B 다음1건" },
  { key: "relation", label: "C 관계" },
  { key: "illustrated", label: "D 일러스트" },
];

const TODAY_DATE_LABEL = "2026년 5월 18일 (월)";

/* ─── Mock ─── */

const PERSON_NAME = "민준";

interface MockEntry {
  id: string;
  name: string;
  time: string;
  endTime: string;
  category: "counseling" | "assessment";
  program: string;
  isNext?: boolean;
}

const ENTRIES: MockEntry[] = [
  { id: "1", name: "김은서", time: "10:00", endTime: "10:50", category: "counseling", program: "놀이치료", isNext: true },
  { id: "2", name: "이도윤", time: "11:00", endTime: "12:00", category: "assessment", program: "K-WISC-V" },
  { id: "3", name: "최서연", time: "14:00", endTime: "14:50", category: "counseling", program: "인지행동치료" },
  { id: "4", name: "박지민", time: "15:30", endTime: "16:20", category: "counseling", program: "놀이치료" },
  { id: "5", name: "정하늘", time: "17:00", endTime: "17:50", category: "counseling", program: "놀이치료" },
];

const COUNSELING_COUNT = ENTRIES.filter((e) => e.category === "counseling").length;
const ASSESSMENT_COUNT = ENTRIES.filter((e) => e.category === "assessment").length;
const NEXT = ENTRIES.find((e) => e.isNext)!;

const AVATAR_COLORS = [
  COLORS.palette.violet,
  COLORS.palette.coral,
  COLORS.palette.mint,
  COLORS.palette.blue,
  COLORS.palette.orange,
];

/* ═══════════════════════════════════════════════════════════
 *  Root
 * ═══════════════════════════════════════════════════════════ */

export default function HomeDarkHierarchyLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("focus");

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.gray[900] }}>
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              홈 다크 · 정보 위계
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
                    style={{ color: active ? COLORS.text.title.default : COLORS.gray[500] }}
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
        contentContainerStyle={{ paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* 다크 상단 영역 */}
        <View style={{ paddingTop: s(20), paddingBottom: s(20) }}>
          {variant === "overview" && <DarkOverview />}
          {variant === "focus" && <DarkFocus />}
          {variant === "relation" && <DarkRelation />}
          {variant === "illustrated" && <DarkIllustrated />}
        </View>

        {/* 흰 시트 영역 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(28),
            borderTopRightRadius: s(28),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingTop: s(24),
            paddingBottom: s(24),
            gap: s(20),
            minHeight: s(360),
          }}
        >
          {variant === "overview" && <WhiteWithNextSession />}
          {variant === "focus" && <WhiteTimelineOnly />}
          {variant === "relation" && <WhiteTimelineOnly />}
          {variant === "illustrated" && <WhiteWithNextSession />}
        </View>

        <VariantMemo variant={variant} />
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  A — 오버뷰 ↔ 행동
 *  다크: 거시적 요약 (N명 + 카테고리 분포)
 *  흰:   NextSession 카드 + 타임라인 + 필드노트 CTA (현재 production 구조 유지)
 * ═══════════════════════════════════════════════════════════ */

function DarkOverview() {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        gap: s(20),
      }}
    >
      <Headline />

      {/* 카테고리 요약 — 다크 컨테이너 안 분할 */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: COLORS.gray[800],
          borderRadius: s(20),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <CategoryCell
          label="상담"
          count={COUNSELING_COUNT}
          color={COLORS.counseling}
        />
        <View
          style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }}
        />
        <CategoryCell
          label="검사"
          count={ASSESSMENT_COUNT}
          color={COLORS.assessment}
        />
        <View
          style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }}
        />
        <CategoryCell
          label="첫 일정"
          count={ENTRIES[0].time}
          color={COLORS.primary300}
          isText
        />
      </View>
    </View>
  );
}

function CategoryCell({
  label,
  count,
  color,
  isText = false,
}: {
  label: string;
  count: number | string;
  color: string;
  isText?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: s(16),
        alignItems: "center",
        gap: s(6),
      }}
    >
      <Typography
        variant="caption-01"
        weight="medium"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </Typography>
      <Typography
        weight="bold"
        style={{
          color,
          fontSize: isText ? s(20) : s(24),
          lineHeight: s(28),
          letterSpacing: -0.3,
          fontVariant: ["tabular-nums"],
        }}
      >
        {isText ? count : `${count}건`}
      </Typography>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  B — 다음 1건 ↔ 흐름 (추천)
 *  다크: 다음 만남 1건만 풀강조 — 큰 아바타 + 이름 + 시간 + 이전 일지 CTA
 *  흰:   타임라인만 (NextSession 카드 제거, 시간순 첫 항목이 자연 강조)
 * ═══════════════════════════════════════════════════════════ */

function DarkFocus() {
  const avatarColor = AVATAR_COLORS[0];
  const initial = NEXT.name.charAt(0);

  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        gap: s(20),
      }}
    >
      <Headline />

      {/* 다음 만남 1건 풀 강조 카드 */}
      <View
        style={{
          backgroundColor: COLORS.gray[800],
          borderRadius: s(24),
          paddingVertical: s(20),
          paddingHorizontal: s(20),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
          gap: s(20),
        }}
      >
        {/* 상단: 라벨 + 시간 */}
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
              style={{ color: COLORS.primary300, letterSpacing: 0.4 }}
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
            오늘 {NEXT.time} · {NEXT.program}
          </Typography>
        </View>

        {/* 중앙: 큰 아바타 + 이름 */}
        <View style={{ alignItems: "center", gap: s(12) }}>
          <View
            style={{
              width: s(84),
              height: s(84),
              borderRadius: s(42),
              backgroundColor: avatarColor,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: avatarColor,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <Typography
              weight="bold"
              style={{
                color: COLORS.white,
                fontSize: s(32),
                lineHeight: s(36),
                letterSpacing: -0.5,
              }}
            >
              {initial}
            </Typography>
          </View>
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(22),
              lineHeight: s(28),
              letterSpacing: -0.5,
            }}
          >
            {NEXT.name}
          </Typography>
        </View>

        {/* CTA — 이전 일지 보기 풀폭 */}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(8),
            paddingVertical: s(14),
            borderRadius: s(14),
            backgroundColor: "rgba(255,255,255,0.12)",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="document-text" size={16} color={COLORS.white} />
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            이전 회기 일지 보기
          </Typography>
          <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
        </Pressable>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  C — 관계 ↔ 시간
 *  다크: 내담자 리스트 (사람 중심)
 *  흰:   시간표 타임라인 (회기 중심)
 * ═══════════════════════════════════════════════════════════ */

function DarkRelation() {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        gap: s(20),
      }}
    >
      <Headline />

      {/* 가로 스크롤 — 내담자 아바타 + 이름 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: s(12) }}
      >
        {ENTRIES.map((entry, i) => (
          <RelationCard key={entry.id} entry={entry} colorIndex={i} />
        ))}
      </ScrollView>
    </View>
  );
}

function RelationCard({
  entry,
  colorIndex,
}: {
  entry: MockEntry;
  colorIndex: number;
}) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initial = entry.name.charAt(0);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: s(96),
        paddingVertical: s(16),
        paddingHorizontal: s(12),
        borderRadius: s(20),
        backgroundColor: COLORS.gray[800],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        gap: s(10),
        alignItems: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: s(48),
          height: s(48),
          borderRadius: s(24),
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          weight="bold"
          style={{ color: COLORS.white, fontSize: s(20), lineHeight: s(24) }}
        >
          {initial}
        </Typography>
      </View>
      <View style={{ alignItems: "center", gap: s(2) }}>
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.white }}
          numberOfLines={1}
        >
          {entry.name}
        </Typography>
        <Typography
          variant="caption-01"
          style={{
            color: "rgba(255,255,255,0.55)",
            fontVariant: ["tabular-nums"],
          }}
        >
          {entry.time}
        </Typography>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════
 *  D — 일러스트 (오늘 날짜 + 히어로 + 우측 일러스트)
 *  다크: 좌측 날짜 라벨 + 히어로 문구 + 우측 SunCloud 일러스트
 *  흰:   기존 다크 시안 그대로 (NextSessionCard + Timeline)
 * ═══════════════════════════════════════════════════════════ */

function DarkIllustrated() {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: s(12),
        }}
      >
        {/* 좌측: 날짜 + 히어로 문구 */}
        <View style={{ flex: 1, paddingTop: s(4) }}>
          <Typography
            variant="label-01"
            weight="medium"
            style={{
              color: "rgba(255,255,255,0.6)",
              letterSpacing: 0.2,
              marginBottom: s(8),
            }}
          >
            {TODAY_DATE_LABEL}
          </Typography>
          <Typography
            weight="bold"
            style={{
              color: COLORS.white,
              fontSize: s(26),
              lineHeight: s(36),
              letterSpacing: -0.8,
            }}
          >
            {PERSON_NAME}님,{"\n"}오늘도{" "}
            <Typography
              weight="bold"
              style={{
                color: COLORS.primary300,
                fontSize: s(26),
                lineHeight: s(36),
                letterSpacing: -0.8,
              }}
            >
              좋은 하루
            </Typography>
            예요
          </Typography>
        </View>

        {/* 우측: 일러스트 */}
        <SunCloudIllustration />
      </View>
    </View>
  );
}

/** 다크 배경에 어울리는 sun + cloud + sparkle 일러스트 (View 기반). */
function SunCloudIllustration() {
  const SIZE = s(112);

  return (
    <View style={{ width: SIZE, height: SIZE, position: "relative" }}>
      {/* 외곽 광선 */}
      {[
        { top: 2, left: SIZE / 2 - 1, w: 2, h: 8, deg: 0 },
        { top: 12, left: SIZE - 16, w: 2, h: 7, deg: 45 },
        { top: SIZE / 2 - 18, left: SIZE - 4, w: 8, h: 2, deg: 0 },
        { top: 12, left: 10, w: 2, h: 7, deg: -45 },
        { top: SIZE / 2 - 18, left: -2, w: 8, h: 2, deg: 0 },
      ].map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: r.top,
            left: r.left,
            width: r.w,
            height: r.h,
            borderRadius: 2,
            backgroundColor: "rgba(255,216,107,0.55)",
            transform: [{ rotate: `${r.deg}deg` }],
          }}
        />
      ))}

      {/* Sun halo */}
      <View
        style={{
          position: "absolute",
          top: s(16),
          left: SIZE / 2 - s(34),
          width: s(68),
          height: s(68),
          borderRadius: s(34),
          backgroundColor: "rgba(255,216,107,0.18)",
        }}
      />
      {/* Sun body */}
      <View
        style={{
          position: "absolute",
          top: s(24),
          left: SIZE / 2 - s(26),
          width: s(52),
          height: s(52),
          borderRadius: s(26),
          backgroundColor: "#FFD86B",
        }}
      />
      {/* Sun highlight */}
      <View
        style={{
          position: "absolute",
          top: s(30),
          left: SIZE / 2 - s(20),
          width: s(20),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: "#FFE699",
          opacity: 0.85,
        }}
      />

      {/* Cloud — 3 puffs + base. 다크 배경엔 옅은 회색 톤 */}
      <View
        style={{
          position: "absolute",
          bottom: s(8),
          left: s(4),
          width: s(38),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(16),
          left: s(18),
          width: s(34),
          height: s(34),
          borderRadius: s(17),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(12),
          left: s(44),
          width: s(40),
          height: s(28),
          borderRadius: s(14),
          backgroundColor: COLORS.gray[200],
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: s(8),
          left: s(10),
          width: s(76),
          height: s(20),
          borderRadius: s(10),
          backgroundColor: COLORS.gray[200],
        }}
      />

      {/* Sparkle */}
      <View
        style={{
          position: "absolute",
          top: s(6),
          left: s(14),
          width: s(5),
          height: s(5),
          borderRadius: s(2.5),
          backgroundColor: "rgba(255,255,255,0.85)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: s(18),
          right: s(8),
          width: s(4),
          height: s(4),
          borderRadius: s(2),
          backgroundColor: "rgba(255,255,255,0.7)",
        }}
      />
    </View>
  );
}

/* ─── 흰 시트 — 두 가지 변형 ─── */

function WhiteWithNextSession() {
  return (
    <>
      <NextSessionCard entry={NEXT} />
      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />
      <Timeline />
    </>
  );
}

function WhiteTimelineOnly() {
  return <Timeline />;
}

function NextSessionCard({ entry }: { entry: MockEntry }) {
  const typeLabel = entry.category === "counseling" ? "상담" : "검사";

  return (
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
              fontVariant: ["tabular-nums"],
            }}
          >
            {entry.time}
          </Typography>
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
          >
            ~ {entry.endTime}
          </Typography>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 상담 상세 보기"
          style={({ pressed }) => ({
            paddingHorizontal: s(14),
            paddingVertical: s(8),
            borderRadius: s(999),
            backgroundColor: COLORS.gray[100],
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.text.body.strong }}
          >
            더보기
          </Typography>
        </Pressable>
      </View>

      <Typography
        variant="body-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default, marginTop: s(4) }}
      >
        {entry.name}님의 {typeLabel}
      </Typography>
      <Typography
        variant="body-03"
        weight="regular"
        style={{ color: COLORS.text.body.subtle }}
        numberOfLines={1}
      >
        여 · 만 7세 · {entry.program}
      </Typography>

      {/* 이전 회기 일지 보기 — 풀폭 CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}님의 이전 회기 일지 보기`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: s(6),
          paddingVertical: s(12),
          borderRadius: s(12),
          backgroundColor: COLORS.gray[100],
          marginTop: s(8),
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons
          name="document-text"
          size={14}
          color={COLORS.primary700}
        />
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          이전 회기 일지 보기
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={COLORS.primary700}
        />
      </Pressable>
    </View>
  );
}

function Timeline() {
  return (
    <View style={{ gap: s(12) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          오늘 일정
        </Typography>
        <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
          총 {ENTRIES.length}건
        </Typography>
      </View>
      <View style={{ gap: s(10) }}>
        {ENTRIES.map((entry, i) => (
          <TimelineRow key={entry.id} entry={entry} isFirst={i === 0} />
        ))}
      </View>
    </View>
  );
}

function TimelineRow({
  entry,
  isFirst,
}: {
  entry: MockEntry;
  isFirst: boolean;
}) {
  const accent =
    entry.category === "counseling" ? COLORS.counseling : COLORS.assessment;
  const bg = isFirst ? COLORS.bg.selected : COLORS.gray[50];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: s(14),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        gap: s(12),
      }}
    >
      <View style={{ width: s(44) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{
            color: isFirst ? COLORS.primary700 : COLORS.text.title.default,
            fontVariant: ["tabular-nums"],
          }}
        >
          {entry.time}
        </Typography>
        <Typography
          variant="caption-01"
          style={{
            color: isFirst ? COLORS.primary500 : COLORS.gray[500],
            fontVariant: ["tabular-nums"],
            marginTop: s(2),
          }}
        >
          ~{entry.endTime}
        </Typography>
      </View>

      <View style={{ flex: 1 }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
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
            variant="body-02"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
            numberOfLines={1}
          >
            {entry.name}
          </Typography>
        </View>
        <Typography
          variant="caption-01"
          style={{ color: COLORS.gray[600], marginTop: s(2) }}
        >
          {entry.program}
        </Typography>
      </View>

      {/* 이전 일지 보기 — 행 우측 inline pill */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}님의 이전 회기 일지 보기`}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: s(4),
          paddingVertical: s(6),
          paddingHorizontal: s(10),
          borderRadius: s(999),
          backgroundColor: COLORS.white,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons
          name="document-text"
          size={11}
          color={COLORS.primary700}
        />
        <Typography
          variant="caption-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          이전 일지
        </Typography>
      </Pressable>
    </View>
  );
}

/* ─── 공용 ─── */

function Headline() {
  return (
    <Typography
      weight="bold"
      style={{
        color: COLORS.white,
        fontSize: s(28),
        lineHeight: s(38),
        letterSpacing: -0.8,
      }}
    >
      {PERSON_NAME}님,{"\n"}오늘 만날{" "}
      <Typography
        weight="bold"
        style={{
          color: COLORS.primary300,
          fontSize: s(28),
          lineHeight: s(38),
          letterSpacing: -0.8,
        }}
      >
        {ENTRIES.length}명
      </Typography>
      이에요
    </Typography>
  );
}

function VariantMemo({ variant }: { variant: Variant }) {
  const memo: Record<Variant, { title: string; desc: string }> = {
    overview: {
      title: "A — 오버뷰 ↔ 행동",
      desc: "다크 = 오늘 전반 그림(상담 N건·검사 N건·첫 일정 시간), 흰 = 다음 상담 카드 + 타임라인. 다크는 거시적이라 시각 무게가 약하지만 화면 켰을 때 '오늘 어떤 날인지' 빠르게 인지됨. 다음 행동 단서는 흰 시트의 다음 상담 카드에 있음.",
    },
    focus: {
      title: "B — 다음 1건 ↔ 흐름 (추천)",
      desc: "다크 = 다음 만남 1건만 풀강조(큰 아바타 + 이름 + 이전 일지 CTA), 흰 = 시간순 타임라인(첫 항목이 자연스럽게 강조). 가장 시급한 1건에 다크 영역의 시각 무게가 정확히 꽂힘. 정보 중복 해소. 단, 다른 내담자는 즉시 다크 영역에서 안 보임 → 헤드라인의 'N명' 카운트와 하단 타임라인이 보강.",
    },
    relation: {
      title: "C — 관계 ↔ 시간",
      desc: "다크 = 내담자 카드 가로 스크롤(사람 중심), 흰 = 시간 타임라인(회기 중심). 같은 데이터의 두 단면이라 정보 구조는 깔끔하나, '사람'이 '시간'보다 위에 와야 할 근거가 약함. 첫 만남 강조가 약해 다음 행동 단서가 흐림.",
    },
    illustrated: {
      title: "D — 일러스트 (날짜 + 인사 + 일러스트)",
      desc: "다크 = 오늘 날짜 + '좋은 하루예요' 인사 + sun+cloud 일러스트. 정보 카운트는 빼고 무드·격려 톤. 흰 시트는 production 다크 시안 그대로 — 큰 시간(36pt) + 더보기 pill + 이름·성별·나이·프로그램. 매일 봐도 따뜻한 첫인상, 행동 단서는 모두 흰 시트로 위임. 다크는 분위기·날짜·맥락 제공 역할.",
    },
  };
  const { title, desc } = memo[variant];
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        margin: s(LAYOUT.screenPaddingX),
        marginTop: s(24),
        borderRadius: s(16),
        padding: s(16),
        gap: s(8),
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.gray[900] }}
      >
        {title}
      </Typography>
      <Typography
        variant="body-03"
        style={{ color: COLORS.gray[600], lineHeight: s(20) }}
      >
        {desc}
      </Typography>
    </View>
  );
}
