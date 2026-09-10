import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 타임라인 · 빈 시간(갭) 처리 비교 — 탭 lab.
 *
 * 문제(디자이너 제기): 현재 DayTimeline 은 시간 비례 그리드(00–24 spine)라
 * 두 일정 사이가 멀면 큰 빈 공간이 그대로 노출돼 스크롤 낭비·답답함.
 *
 * 방향(채택) — 첨부 이미지처럼 "N시간 비어있음" 으로 빈 시간을 생략.
 * 단 다음을 더해 다듬음:
 *  · 가장자리(첫 일정 전 / 마지막 일정 후) 빈 시간은 접지 말고 아예 trim.
 *  · 내부 갭만 임계값(3시간) 초과 시 접고, 짧은 갭은 비례 유지(시간 감각 보존).
 *  · 접힌 밴드는 정보 라벨(인터랙션 없음) — 모바일은 일정 등록이 web 전용이라
 *    빈 시간에 붙일 액션이 없다. 밀린 일(일지 등)은 별도 추천 카드 담당.
 *
 * 변형 탭 — 타임라인 → 리스트 스펙트럼:
 *  [현재]      운영시간(09–19) 비례 그리드 — 큰 갭이 빈 공간으로 (대조군, 순수 타임라인)
 *  [선형+생략]  선형 그리드(가로 시간선) 유지 + 큰 갭만 1시간 압축 'broken axis'(시간 숫자 점프)
 *  [갭 접기]    가장자리 trim + 내부 갭>3시간 접기 — 죽은 공간만 잘라낸 타임라인
 *  [갭 접기+]  갭 접기 + 연속 spine(일정=노드) + 요약 헤더 + 위계 + 빈 구간 추천 카드 조건부 승격 — 타임라인 유지하며 일정만 또렷이 스캔(권장)
 *  [정규화]   갭 크기 무관 같은 높이 밴드 — 갭 비례감 사라져 리스트에 가까움
 *  [아젠다]   시간=라벨, 오전·오후·저녁 그룹 카드 리스트 — 빈 시간 개념 없음(순수 리스트)
 *
 * 시나리오 토글: [일반]·[드문드문]·[몰림] — 갭 모양이 다른 하루에서 각 전략 비교.
 *
 * 토큰: 밴드 = border/dashed(gray-300) 점선, "비어있음" = ghost(gray-400) 텍스트,
 *       일정 카드 = 흰 페이지 위 gray-50(보더·좌측 컬러바 없음).
 *
 * 전부 mock — 확정 시 DayTimeline 의 spine/gap 렌더에 반영.
 */

const THRESHOLD_MIN = 180; // 3시간 — 이 값 초과 내부 갭만 접음
const HOUR_PX = 56; // 1시간 = s(56)
const GUTTER = 48; // 좌측 시간 거터 폭
const RAIL = 52; // 갭 접기+ 의 spine 레일 폭 (시간 + 세로선 + 노드)
const COLLAPSED_H = 56; // 접힌 밴드 고정 높이
const NORMALIZED_H = 44; // 정규화 밴드 고정 높이
const MIN_SESSION_H = 52; // 일정 카드 최소 높이(flow)
const DAY_START = 9; // 현재(그리드) 운영 시작
const DAY_END = 19; // 현재(그리드) 운영 종료

type Variant = "current" | "linear" | "collapse" | "plus" | "normalize" | "agenda";
type Scenario = "general" | "sparse" | "dense";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "linear", label: "선형+생략" },
  { key: "collapse", label: "갭 접기" },
  { key: "plus", label: "갭 접기+" },
  { key: "normalize", label: "정규화" },
  { key: "agenda", label: "아젠다" },
];

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "general", label: "일반" },
  { key: "sparse", label: "드문드문" },
  { key: "dense", label: "몰림" },
];

type Category = "counseling" | "assessment";
type Block = {
  id: string;
  sh: number;
  sm: number;
  eh: number;
  em: number;
  name: string;
  program: string;
  category: Category;
  /** 이 일정 직후의 빈 구간에 '할 일' 추천이 있는지 (mock — 일지/소견 미작성 등) */
  reco?: boolean;
};

// 시나리오별 mock 하루 (정렬된 상태로 정의)
const DATA: Record<Scenario, Block[]> = {
  // 오전 2건 → 큰 점심·오후 갭 → 오후 2건 (가장 흔한 패턴)
  general: [
    { id: "g1", sh: 9, sm: 0, eh: 9, em: 50, name: "박지우님의 상담", program: "놀이치료-개인", category: "counseling" },
    { id: "g2", sh: 10, sm: 0, eh: 11, em: 0, name: "이준호님의 검사", program: "풀배터리검사", category: "assessment", reco: true },
    { id: "g3", sh: 16, sm: 0, eh: 16, em: 50, name: "김서연님의 상담", program: "놀이치료-개인", category: "counseling" },
    { id: "g4", sh: 17, sm: 0, eh: 17, em: 50, name: "최하은님의 상담", program: "미술치료-개인", category: "counseling" },
  ],
  // 큰 갭이 여러 번 — 접기/정규화가 반복 노출되는지
  sparse: [
    { id: "s1", sh: 9, sm: 0, eh: 9, em: 50, name: "박지우님의 상담", program: "놀이치료-개인", category: "counseling", reco: true },
    { id: "s2", sh: 13, sm: 0, eh: 13, em: 50, name: "김서연님의 상담", program: "미술치료-개인", category: "counseling" },
    { id: "s3", sh: 18, sm: 0, eh: 18, em: 50, name: "정민서님의 검사", program: "풀배터리검사", category: "assessment" },
  ],
  // 오전 연속 → 오후 통째로 비움 (가장자리 trim 효과 + 짧은 갭만)
  dense: [
    { id: "d1", sh: 9, sm: 0, eh: 9, em: 50, name: "박지우님의 상담", program: "놀이치료-개인", category: "counseling" },
    { id: "d2", sh: 10, sm: 0, eh: 10, em: 50, name: "이준호님의 상담", program: "놀이치료-개인", category: "counseling" },
    { id: "d3", sh: 11, sm: 0, eh: 11, em: 50, name: "최하은님의 상담", program: "미술치료-개인", category: "counseling" },
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const startMin = (b: Block) => b.sh * 60 + b.sm;
const endMin = (b: Block) => b.eh * 60 + b.em;

function gapLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분 비어있음`;
  if (m === 0) return `${h}시간 비어있음`;
  return `${h}시간 ${m}분 비어있음`;
}

export default function TimelineGapCollapseLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("collapse");
  const [scenario, setScenario] = useState<Scenario>("general");

  const blocks = DATA[scenario];

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.white }}>
        {/* lab 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              타임라인 · 빈 시간 처리
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 변형 탭 — 6개라 가로 스크롤 pill */}
        <View style={{ paddingBottom: s(8) }}>
          <ScrollTabs options={VARIANTS} value={variant} onChange={setVariant} />
        </View>

        {/* 시나리오 토글 */}
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[500], marginBottom: s(6), marginLeft: s(2) }}>
            하루 모양
          </Typography>
          <SegmentRow options={SCENARIOS} value={scenario} onChange={setScenario} small />
        </View>
      </SafeAreaView>

      {/* 프리뷰 */}
      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.white }}
        contentContainerStyle={{ paddingTop: s(16), paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}
        showsVerticalScrollIndicator={false}
      >
        {variant === "current" ? (
          <CurrentGrid blocks={blocks} />
        ) : variant === "linear" ? (
          <LinearOmitGrid blocks={blocks} />
        ) : variant === "agenda" ? (
          <AgendaList blocks={blocks} />
        ) : variant === "plus" ? (
          <FlowTimelinePlus blocks={blocks} />
        ) : (
          <FlowTimeline blocks={blocks} mode={variant} />
        )}

        <VerdictCaption variant={variant} />
      </ScrollView>
    </View>
  );
}

/* ───────── 공용: 가로 스크롤 pill 탭 (변형 多) ───────── */

function ScrollTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: s(LAYOUT.screenPaddingX), gap: s(6) }}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{ paddingVertical: s(7), paddingHorizontal: s(14), borderRadius: 999, backgroundColor: active ? COLORS.gray[900] : COLORS.gray[50] }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Typography variant="label-01" weight={active ? "semibold" : "medium"} style={{ color: active ? COLORS.white : COLORS.gray[600] }}>
              {o.label}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ───────── 공용: 세그먼트 행 ───────── */

function SegmentRow<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3), gap: s(2) }}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: small ? s(6) : s(8),
              borderRadius: s(8),
              backgroundColor: active ? COLORS.white : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Typography variant="label-01" weight={active ? "semibold" : "medium"} style={{ color: active ? COLORS.text.title.default : COLORS.gray[500] }}>
              {o.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────── 일정 카드 (공통) ───────── */

function SessionCard({ block, height }: { block: Block; height: number }) {
  const dotColor = block.category === "assessment" ? COLORS.assessment : COLORS.counseling;
  const showProgram = height >= s(60);
  return (
    <View
      style={{
        height,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(8),
        paddingHorizontal: s(12),
        justifyContent: "center",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
        <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900], flexShrink: 1 }} numberOfLines={1}>
          {block.name}
        </Typography>
        <View style={{ flex: 1 }} />
        <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[500] }}>
          {fmt(block.sh, block.sm)}~{fmt(block.eh, block.em)}
        </Typography>
      </View>
      {showProgram && (
        <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[600], marginTop: s(4), marginLeft: 6 + s(6) }} numberOfLines={1}>
          {block.program}
        </Typography>
      )}
    </View>
  );
}

/* ───────── 변형 0: 현재 — 운영시간 비례 그리드 ───────── */

function CurrentGrid({ blocks }: { blocks: Block[] }) {
  const hourPx = s(HOUR_PX);
  const totalHours = DAY_END - DAY_START;
  const gridHeight = totalHours * hourPx;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => DAY_START + i);

  return (
    <View style={{ flexDirection: "row", height: gridHeight }}>
      {/* 좌측 시간 거터 */}
      <View style={{ width: s(GUTTER) }}>
        {hours.map((h) => (
          <View key={h} style={{ position: "absolute", top: (h - DAY_START) * hourPx - s(8), right: s(8) }}>
            <Typography variant="label-02" weight="medium" style={{ color: COLORS.gray[400] }}>
              {pad(h)}
            </Typography>
          </View>
        ))}
      </View>

      {/* 카드 영역 */}
      <View style={{ flex: 1, position: "relative" }}>
        {/* 시간선 */}
        {hours.map((h, i) => (
          <View
            key={`line-${h}`}
            pointerEvents="none"
            style={{ position: "absolute", top: i * hourPx, left: 0, right: 0, height: 1, backgroundColor: COLORS.gray[100] }}
          />
        ))}
        {/* 일정 카드 — 절대 배치 */}
        {blocks.map((b) => {
          const top = ((startMin(b) - DAY_START * 60) / 60) * hourPx;
          const height = Math.max(((endMin(b) - startMin(b)) / 60) * hourPx, s(40));
          return (
            <View key={b.id} style={{ position: "absolute", top, left: s(8), right: 0, height }}>
              <SessionCard block={b} height={height} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 변형 0.5: 선형+생략 (broken axis — 선형 그리드 유지, 큰 갭만 1시간 압축) ───────── */
// 현재처럼 가로 시간선 + 선형 눈금을 유지하되, 가장자리는 trim 하고 내부 큰 갭(>3시간)만
// 1시간 높이로 압축해 "생략 밴드"로 표시한다. 좌측 시간 숫자가 점프(12·13·14·15 건너뜀)해
// "여기 접혔다"가 자명. 압축 구간 안에는 가로선을 긋지 않는다(긋면 시간이 뭉쳐 거짓이 됨).

// 생략 표식 — 세로 점 3개(⋮). 선형 그리드에서 시간↔시간 사이가 압축·생략됐음을 알림
function OmitDots({ color = COLORS.gray[400] }: { color?: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: s(2) }}>
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: color }} />
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: color }} />
      <View style={{ width: s(2.5), height: s(2.5), borderRadius: s(1.25), backgroundColor: color }} />
    </View>
  );
}

function LinearOmitGrid({ blocks }: { blocks: Block[] }) {
  const hourPx = s(HOUR_PX);
  const firstStartMin = startMin(blocks[0]);
  const lastEndMin = endMin(blocks[blocks.length - 1]);

  // 큰 갭 = 생략(압축) 구간
  const breaks: { startMin: number; endMin: number; gap: number }[] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const gStart = endMin(blocks[i]);
    const gEnd = startMin(blocks[i + 1]);
    const gap = gEnd - gStart;
    if (gap > THRESHOLD_MIN) breaks.push({ startMin: gStart, endMin: gEnd, gap });
  }

  const BREAK_PX = hourPx; // 생략 구간은 1시간 높이로 고정
  // 압축 좌표계: 실시간 t → 표시 y. break 는 (실제 길이 대신) BREAK_PX 만큼만 차지.
  const displayY = (t: number) => {
    let active = t - firstStartMin;
    let bpx = 0;
    for (const br of breaks) {
      if (br.endMin <= t) {
        active -= br.endMin - br.startMin;
        bpx += BREAK_PX;
      }
    }
    return (active / 60) * hourPx + bpx;
  };

  const totalH = displayY(lastEndMin);
  const firstHour = Math.ceil(firstStartMin / 60);
  const lastHour = Math.floor(lastEndMin / 60);
  const hourMarks: number[] = [];
  for (let h = firstHour; h <= lastHour; h++) {
    const inside = breaks.some((br) => br.startMin < h * 60 && h * 60 < br.endMin);
    if (!inside) hourMarks.push(h); // 압축 구간 내부 시각은 생략(숫자 점프)
  }

  return (
    <View style={{ flexDirection: "row", height: totalH }}>
      {/* 좌측 시간 거터 — 압축 구간 숫자는 건너뛰고, 시간↔시간 사이에 생략 점(⋮) */}
      <View style={{ width: s(GUTTER) }}>
        {hourMarks.map((h) => (
          <View key={h} style={{ position: "absolute", top: displayY(h * 60) - s(8), right: s(8) }}>
            <Typography variant="label-02" weight="medium" style={{ color: COLORS.gray[400] }}>
              {pad(h)}
            </Typography>
          </View>
        ))}
        {breaks.map((br, i) => (
          <View key={`gm-${i}`} style={{ position: "absolute", top: displayY(br.startMin) + BREAK_PX / 2 - s(7), right: s(10) }}>
            <OmitDots />
          </View>
        ))}
      </View>

      {/* 그리드/카드 */}
      <View style={{ flex: 1, position: "relative" }}>
        {/* 가로 시간선 — active hour 에만 */}
        {hourMarks.map((h) => (
          <View
            key={`l-${h}`}
            pointerEvents="none"
            style={{ position: "absolute", top: displayY(h * 60), left: 0, right: 0, height: 1, backgroundColor: COLORS.gray[100] }}
          />
        ))}

        {/* 생략(압축) 밴드 — broken axis 표식 */}
        {breaks.map((br, i) => (
          <View
            key={`b-${i}`}
            style={{
              position: "absolute",
              top: displayY(br.startMin),
              left: s(8),
              right: 0,
              height: BREAK_PX,
              borderRadius: s(8),
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: COLORS.gray[300],
              backgroundColor: COLORS.gray[50],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[400] }}>
              {gapLabel(br.gap)}
            </Typography>
          </View>
        ))}

        {/* 일정 카드 — 비례 높이(선형 유지) */}
        {blocks.map((b) => {
          const top = displayY(startMin(b));
          const h = (Math.max(endMin(b) - startMin(b), 15) / 60) * hourPx;
          return (
            <View key={b.id} style={{ position: "absolute", top, left: s(8), right: 0, height: h }}>
              <SessionCard block={b} height={h} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── 변형 1·2: flow 타임라인 (가장자리 trim + 갭 밴드) ───────── */

function FlowTimeline({ blocks, mode }: { blocks: Block[]; mode: "collapse" | "normalize" }) {
  const hourPx = s(HOUR_PX);

  const rows: React.ReactNode[] = [];

  blocks.forEach((b, i) => {
    const sessionHeight = Math.max(((endMin(b) - startMin(b)) / 60) * hourPx, s(MIN_SESSION_H));
    // 일정 행 — 좌측 시작 시각 + 카드
    rows.push(
      <View key={`row-${b.id}`} style={{ flexDirection: "row", marginBottom: s(8) }}>
        <View style={{ width: s(GUTTER), paddingRight: s(8), paddingTop: s(6), alignItems: "flex-end" }}>
          <Typography variant="label-02" weight="medium" style={{ color: COLORS.gray[400] }}>
            {fmt(b.sh, b.sm)}
          </Typography>
        </View>
        <View style={{ flex: 1 }}>
          <SessionCard block={b} height={sessionHeight} />
        </View>
      </View>,
    );

    // 갭 (다음 일정이 있을 때만 — 가장자리는 자연히 trim)
    const next = blocks[i + 1];
    if (!next) return;
    const gap = startMin(next) - endMin(b);
    if (gap <= 0) return;

    if (mode === "normalize") {
      // 모든 갭을 같은 높이 밴드로
      rows.push(<GapBand key={`gap-${b.id}`} label={gapLabel(gap)} height={s(NORMALIZED_H)} />);
      return;
    }

    // collapse 모드
    if (gap <= THRESHOLD_MIN) {
      // 짧은 갭 — 비례 spacer (밴드 없이 비워둠, 시간 감각 유지)
      rows.push(<View key={`gap-${b.id}`} style={{ height: (gap / 60) * hourPx, marginBottom: s(8) }} />);
      return;
    }

    // 큰 갭 — 고정 높이 정보 밴드 (인터랙션 없음)
    rows.push(<GapBand key={`gap-${b.id}`} label={gapLabel(gap)} height={s(COLLAPSED_H)} />);
  });

  return <View>{rows}</View>;
}

/* ───────── 갭 밴드 (점선 + ghost 텍스트, 정보 라벨 — 비인터랙티브) ───────── */

function GapBand({ label, height }: { label: string; height: number }) {
  return (
    <View
      style={{
        height,
        marginLeft: s(GUTTER),
        marginBottom: s(8),
        borderRadius: s(12),
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: COLORS.gray[300],
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: s(12),
      }}
    >
      {/* ghost: 빈 시간 라벨은 gray-400 (inline style) */}
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[400] }}>
        {label}
      </Typography>
    </View>
  );
}

/* ───────── 변형 2.5: 갭 접기+ (연속 spine + 노드 + 요약 헤더 + 위계) ───────── */
// 갭 접기에 좌측 연속 세로선(spine)을 깔고 일정을 노드로 매달아, 시간 의미는 유지하되
// 세로선을 따라 "일정만" 리스트처럼 또렷이 스캔되게 한다. scaffolding(선·시간·갭 라벨)은
// 옅은 gray 로 후퇴시키고, 채워진 면은 카드에만 둬 도형/배경 위계를 만든다.

function FlowTimelinePlus({ blocks }: { blocks: Block[] }) {
  const hourPx = s(HOUR_PX);
  const total = blocks.length;
  const counsel = blocks.filter((b) => b.category === "counseling").length;
  const assess = total - counsel;

  const rows: React.ReactNode[] = [];
  blocks.forEach((b, i) => {
    const h = Math.max(((endMin(b) - startMin(b)) / 60) * hourPx, s(MIN_SESSION_H));
    rows.push(<PlusSessionRow key={`s-${b.id}`} block={b} height={h} />);

    const next = blocks[i + 1];
    if (!next) return;
    const gap = startMin(next) - endMin(b);
    if (gap <= 0) return;
    if (gap <= THRESHOLD_MIN) {
      // 짧은 갭 — 연속 실선 그대로(시간 감각 유지), 라벨 없음
      rows.push(<PlusGapRow key={`g-${b.id}`} height={(gap / 60) * hourPx} dashed={false} />);
    } else if (b.reco) {
      // 큰 갭인데 할 일이 있음 — 죽은 갭이 '추천 카드'로 승격 (의미 있는 갭만 자리값)
      rows.push(<PlusRecoRow key={`g-${b.id}`} block={b} gap={gapLabel(gap)} />);
    } else {
      // 큰 갭(할 일 없음) — spine 이 점선으로 "건너뜀" + ghost 라벨
      rows.push(<PlusGapRow key={`g-${b.id}`} height={s(COLLAPSED_H)} dashed label={gapLabel(gap)} />);
    }
  });

  return (
    <View>
      {/* 요약 헤더 — 스크롤 전 '오늘 몇 건'을 즉시 파악 */}
      <View style={{ marginBottom: s(16) }}>
        <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900] }}>
          오늘 {total}건의 일정
        </Typography>
        <Typography variant="label-01" weight="regular" style={{ color: COLORS.gray[500], marginTop: s(2) }}>
          상담 {counsel} · 검사 {assess}
        </Typography>
      </View>
      <View>{rows}</View>
    </View>
  );
}

function PlusSessionRow({ block, height }: { block: Block; height: number }) {
  const dot = block.category === "assessment" ? COLORS.assessment : COLORS.counseling;
  const lineX = s(RAIL) - s(6); // 세로선 위치(카드 쪽에 가깝게)
  return (
    <View style={{ flexDirection: "row", height }}>
      <View style={{ width: s(RAIL) }}>
        {/* 연속 세로선 (scaffolding — 옅게) */}
        <View style={{ position: "absolute", left: lineX, top: 0, bottom: 0, width: 1.5, backgroundColor: COLORS.gray[200] }} />
        {/* 시작 시각 — 선 왼쪽 */}
        <View style={{ position: "absolute", top: s(6), left: 0, right: s(RAIL) - lineX + s(6), alignItems: "flex-end" }}>
          <Typography variant="label-02" weight="medium" style={{ color: COLORS.gray[400] }}>
            {fmt(block.sh, block.sm)}
          </Typography>
        </View>
        {/* 노드 — 카테고리 색(채워진 요소는 일정에만) */}
        <View
          style={{
            position: "absolute",
            left: lineX - s(4.5),
            top: s(8),
            width: s(9),
            height: s(9),
            borderRadius: s(4.5),
            backgroundColor: dot,
            borderWidth: 2,
            borderColor: COLORS.white,
          }}
        />
      </View>
      <View style={{ flex: 1, paddingLeft: s(6) }}>
        <SessionCard block={block} height={height} />
      </View>
    </View>
  );
}

// 빈 구간 추천 행 — spine 에 primary 액션 노드 + 우측에 추천 카드(production GapRecommendationCard 자리)
function PlusRecoRow({ block, gap }: { block: Block; gap: string }) {
  const lineX = s(RAIL) - s(6);
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: s(RAIL) }}>
        {/* spine — 점선(건너뜀)이되 할 일이 있는 구간 */}
        <View style={{ position: "absolute", left: lineX, top: 0, bottom: 0, borderLeftWidth: 1.5, borderStyle: "dashed", borderLeftColor: COLORS.gray[300] }} />
        {/* 액션 노드 — primary (할 일 있음) */}
        <View
          style={{
            position: "absolute",
            left: lineX - s(4.5),
            top: s(24),
            width: s(9),
            height: s(9),
            borderRadius: s(4.5),
            backgroundColor: COLORS.primary,
            borderWidth: 2,
            borderColor: COLORS.white,
          }}
        />
      </View>
      <View style={{ flex: 1, paddingLeft: s(6), paddingVertical: s(4) }}>
        <GapRecoCard block={block} gap={gap} />
      </View>
    </View>
  );
}

// 추천 카드 (mock — production GapRecommendationCard 축약). 상담=일지 정리 / 검사=소견 정리.
function GapRecoCard({ block, gap }: { block: Block; gap: string }) {
  const who = block.name.split("님")[0];
  const title =
    block.category === "assessment"
      ? `${who}님의 검사 소견을 정리해보세요`
      : `${who}님의 상담 내용을 정리해보세요`;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ backgroundColor: COLORS.primary50, borderRadius: s(16), padding: s(16), gap: s(10) }}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {/* 빈 구간 정보는 ghost 로 유지 — "여긴 비었고, 그 시간에 이걸 하면 좋아요" */}
      <Typography variant="label-01" weight="regular" style={{ color: COLORS.gray[400] }}>
        {gap}
      </Typography>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
        <Ionicons name="create-outline" size={s(22)} color={COLORS.primary} />
        <View style={{ flex: 1, gap: s(4) }}>
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary }}>
            지금 처리하면 좋아요
          </Typography>
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.text.title.default }} numberOfLines={2}>
            {title}
          </Typography>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>
        <Typography variant="label-01" weight="medium" style={{ color: COLORS.text.label.default }}>
          바로가기
        </Typography>
        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.primary} />
      </View>
    </TouchableOpacity>
  );
}

function PlusGapRow({ height, dashed, label }: { height: number; dashed: boolean; label?: string }) {
  const lineX = s(RAIL) - s(6);
  return (
    <View style={{ flexDirection: "row", height }}>
      <View style={{ width: s(RAIL) }}>
        {dashed ? (
          // 큰 갭 — 점선 spine (건너뜀)
          <View style={{ position: "absolute", left: lineX, top: 0, bottom: 0, borderLeftWidth: 1.5, borderStyle: "dashed", borderLeftColor: COLORS.gray[300] }} />
        ) : (
          // 짧은 갭 — 실선 연속
          <View style={{ position: "absolute", left: lineX, top: 0, bottom: 0, width: 1.5, backgroundColor: COLORS.gray[200] }} />
        )}
      </View>
      <View style={{ flex: 1, justifyContent: "center", paddingLeft: s(6) }}>
        {label ? (
          <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[400] }}>
            {label}
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

/* ───────── 변형 3: 아젠다 리스트 (시간=라벨, 오전·오후·저녁 그룹) ───────── */
// 타임라인 scaffolding(spine·그리드·갭) 전부 제거. 빈 시간 개념 없음 — 순수 카드 리스트.

const AGENDA_GROUPS: { key: "morning" | "afternoon" | "evening"; label: string }[] = [
  { key: "morning", label: "오전" },
  { key: "afternoon", label: "오후" },
  { key: "evening", label: "저녁" },
];

function groupOf(b: Block): "morning" | "afternoon" | "evening" {
  if (b.sh < 12) return "morning";
  if (b.sh < 18) return "afternoon";
  return "evening";
}

function AgendaList({ blocks }: { blocks: Block[] }) {
  return (
    <View>
      {AGENDA_GROUPS.map((g) => {
        const items = blocks.filter((b) => groupOf(b) === g.key);
        if (items.length === 0) return null;
        return (
          <View key={g.key} style={{ marginBottom: s(24) }}>
            {/* 그룹 헤더 — 시간 흐름 대신 시각 리듬 */}
            <Typography variant="label-01" weight="semibold" style={{ color: COLORS.gray[600], marginBottom: s(12), marginLeft: s(2) }}>
              {g.label}
            </Typography>
            {items.map((b, i) => (
              <View key={b.id} style={{ marginBottom: i === items.length - 1 ? 0 : s(12) }}>
                {/* 일정 카드 — 균일 높이(시간 길이에 비례하지 않음) */}
                <SessionCard block={b} height={s(64)} />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/* ───────── 하단 시안 판정 캡션 ───────── */

function VerdictCaption({ variant }: { variant: Variant }) {
  const text =
    variant === "current"
      ? "대조군 — 운영시간(09–19) 비례 그리드. 일정이 멀면 그 사이가 그대로 빈 공간이라 스크롤 낭비·답답함."
      : variant === "linear"
        ? "현재처럼 선형 그리드(가로 시간선) 유지 + 가장자리 trim + 큰 갭만 1시간 높이로 압축(broken axis). 좌측 시간 숫자가 점프(12·13·14·15 건너뜀)해 접힘이 자명. production에 가장 가깝게 시간 눈금 감각 유지. 단 압축 밴드 표식이 약하면 1시간으로 오독 위험."
        : variant === "collapse"
        ? "가장자리 빈 시간은 trim, 내부 갭이 3시간 초과면 'N시간 비어있음' 밴드로 접음(정보 라벨, 탭 없음 — 모바일은 일정 등록이 web 전용). 짧은 갭은 비례 유지 → 시간 감각 보존. 타임라인 정체성 유지."
        : variant === "plus"
          ? "갭 접기 + 좌측 연속 spine(일정=노드) + 요약 헤더 + 위계. 빈 구간은 기본은 조용한 'N시간 비어있음'이되, 할 일(일지·소견 정리)이 있는 갭만 추천 카드로 승격(primary 노드) — 죽은 공간은 줄이고 의미 있는 갭만 자리값. NOW 마커 등 시간축 기능과 양립. 권장."
          : variant === "normalize"
          ? "갭 크기와 무관하게 모두 같은 높이 밴드로 정규화. 하루가 한눈에. 단 갭 비례감이 사라져 사실상 카드 리스트에 가까움."
          : "시간을 공간이 아니라 라벨로. 오전·오후·저녁 그룹으로 묶은 카드 리스트 — 빈 시간 개념 자체가 없음. 가장 컴팩트·스캔 쉬움. 단 하루의 '모양'(비례·여백·언제 비나)은 못 느낌.";
  return (
    <View
      style={{
        marginTop: s(28),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
      }}
    >
      <Typography variant="label-01" weight="regular" style={{ color: COLORS.gray[500] }}>
        {text}
      </Typography>
    </View>
  );
}
