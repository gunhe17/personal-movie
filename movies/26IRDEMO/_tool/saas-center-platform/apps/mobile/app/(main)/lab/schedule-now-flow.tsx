import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Animated,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS, GAP, RADIUS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 시안 — 지금 흐름 + 임박 강조 (Now-Flow)
 *
 * 차별화 축 (기존 시안과의 구분점)
 *   schedule-concierge      = 만남 brief, 다음 1건 HERO + compact list
 *   schedule-agent-home     = 에이전트 톤 task 카드
 *   schedule-card-emphasis  = "준비할 다음 한 건" 3가지 강조 방식 비교
 *   ─────────────────────────────────────────────────────────────────
 *   schedule-now-flow       = "지금" 시각 기준으로 흐름 + 강조를 동시에
 *                             좌측 시간 spine + 실시간 NOW 마커가 흐름 파악,
 *                             임박도×준비도 결합 점수가 자동 강약 결정.
 *
 * 핵심 발상
 *   사용자가 일정 페이지에 들어왔을 때 한 화면에서 두 가지를 동시에 해결:
 *     1) 오늘 하루가 어떻게 흘러가는지 (시간축 흐름)
 *     2) 지금 가장 신경 써야 할 한 건은 무엇인지 (임박 + 준비 결합)
 *
 *   기존 시안은 둘 중 하나만 해결 — 캘린더는 흐름만, 비서실 HERO는 강조만.
 *   여기선 좌측 시간 spine 위에 카드를 매달아 흐름을 살리되, 점수가 높은
 *   카드는 자동으로 풀카드로 부풀어 강약을 만든다.
 *
 * 점수 계산 (mock — 가산 단순 합)
 *   urgency  (시간 임박)   30분 이내 +3 / 2시간 이내 +2 / 그 이상 +1
 *   prep     (준비 필요)   첫 만남·검사 미확인·일지 미작성 +2 / 노쇼 이력 +1
 *   ⇒ 4점 이상 = 풀카드 (HERO 강조)
 *     2~3점    = 시그널 라인이 있는 compact
 *     1점 이하 = 일반 compact
 *
 * 좌측 spine 구성
 *   - 06~22시 시간 눈금이 있는 세로 라인
 *   - "지금" 가로 마커 (primary 라인 + 작은 dot + "지금 13:30" 라벨)
 *   - 각 일정은 시작 시각 위치에 dot으로 anchor
 *   - 지난 일정은 dim (opacity 0.55)
 *
 * 강약 (Visual Hierarchy 메모리 반영)
 *   1순위 NOW HERO   다음 임박 카드 — 풀카드, 옅은 primary75 wrap
 *   2순위 SIGNAL     준비 신호 있는 compact — 좌측 4px 컬러 라인
 *   3순위 PLAIN      일반 compact
 *   4순위 PAST       fade
 */

type Variant = "current" | "now-flow";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "now-flow", label: "지금 흐름" },
];

const VARIANT_NOTE: Record<Variant, string> = {
  current:
    "현재 — 캘린더 그리드 + 선택일 시간순 카드 리스트. 모든 카드가 동일한 시각 비중을 가져 '지금 무엇을 신경 써야 하는지'는 사용자가 직접 스캔해서 판단해야 한다.",
  "now-flow":
    "지금 흐름 — 좌측 시간 spine + 실시간 'NOW' 마커로 하루의 흐름을 한눈에. 임박도(시간 가까움) × 준비도(첫 회기·미확인 검사·미작성 일지·노쇼 이력)를 합한 점수가 4점 이상인 일정은 자동으로 풀카드로 강조되고, 나머지는 compact로 매달려 흐름을 살린다. 지난 일정은 흐릿하게 가라앉음.",
};

/* ─────────── Mock data ─────────── */

type ScheduleType = "counseling" | "assessment";
type Signal = "first" | "assessment_pending" | "note_missing" | "noshow";
type State = "past" | "in_progress" | "upcoming";

interface ScheduleItem {
  id: string;
  startMin: number; // 분 단위 (e.g. 14:00 = 14*60 = 840)
  endMin: number;
  type: ScheduleType;
  clientName: string;
  meta: string;
  room?: string;
  signals: Signal[];
  brief?: string;
  action?: { label: string; icon: keyof typeof Ionicons.glyphMap };
}

const NOW_MIN = 13 * 60 + 30; // 13:30 가정

const TODAY_RAW: ScheduleItem[] = [
  {
    id: "s1",
    startMin: 9 * 60 + 30,
    endMin: 10 * 60 + 20,
    type: "counseling",
    clientName: "김은서",
    meta: "여 · 만 7세",
    room: "1번 상담실",
    signals: ["note_missing"],
    brief: "어제 회기 일지가 비어 있어요.",
    action: { label: "일지 작성", icon: "document-text-outline" },
  },
  {
    id: "s2",
    startMin: 11 * 60,
    endMin: 11 * 60 + 50,
    type: "counseling",
    clientName: "박지민",
    meta: "남 · 만 8세",
    room: "2번 상담실",
    signals: [],
  },
  {
    id: "s3",
    startMin: 13 * 60,
    endMin: 13 * 60 + 50,
    type: "counseling",
    clientName: "최서연",
    meta: "여 · 만 14세",
    room: "1번 상담실",
    signals: [],
    brief: "지금 진행 중이에요.",
  },
  {
    id: "s4",
    startMin: 14 * 60,
    endMin: 15 * 60,
    type: "assessment",
    clientName: "정하늘",
    meta: "남 · 만 6세",
    room: "검사실 A",
    signals: ["first", "assessment_pending"],
    brief: "첫 만남이에요. 어제 도착한 K-WISC 결과가 아직 확인되지 않았어요.",
    action: { label: "검사 결과 보기", icon: "clipboard-outline" },
  },
  {
    id: "s5",
    startMin: 15 * 60 + 30,
    endMin: 16 * 60 + 20,
    type: "counseling",
    clientName: "윤서아",
    meta: "여 · 만 11세",
    room: "2번 상담실",
    signals: ["noshow"],
    brief: "최근 두 번 못 오셨어요. 마지막 만남이 3주 전이에요.",
    action: { label: "리마인드 보내기", icon: "send-outline" },
  },
  {
    id: "s6",
    startMin: 17 * 60,
    endMin: 17 * 60 + 50,
    type: "counseling",
    clientName: "강민호",
    meta: "남 · 만 9세",
    room: "1번 상담실",
    signals: [],
  },
];

const SIGNAL_META: Record<
  Signal,
  {
    label: string;
    solid: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
    weight: number;
  }
> = {
  first: {
    label: "첫 만남",
    solid: COLORS.palette.mint,
    bg: COLORS.paletteBg.mint,
    icon: "sparkles",
    weight: 2,
  },
  assessment_pending: {
    label: "검사 결과 미확인",
    solid: COLORS.palette.blue,
    bg: COLORS.paletteBg.blue,
    icon: "clipboard",
    weight: 2,
  },
  note_missing: {
    label: "일지 미작성",
    solid: COLORS.palette.yellow,
    bg: COLORS.paletteBg.yellow,
    icon: "document-text",
    weight: 2,
  },
  noshow: {
    label: "노쇼 이력",
    solid: COLORS.palette.coral,
    bg: COLORS.paletteBg.coral,
    icon: "alert-circle",
    weight: 1,
  },
};

const TYPE_LABEL: Record<ScheduleType, string> = {
  counseling: "상담",
  assessment: "검사",
};

/* ─────────── Helpers ─────────── */

function fmtTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getState(item: ScheduleItem): State {
  if (item.endMin <= NOW_MIN) return "past";
  if (item.startMin <= NOW_MIN && NOW_MIN < item.endMin) return "in_progress";
  return "upcoming";
}

function urgencyScore(item: ScheduleItem): number {
  const delta = item.startMin - NOW_MIN;
  if (delta < 0) return 0; // 지난 일정
  if (delta <= 30) return 3;
  if (delta <= 120) return 2;
  return 1;
}

function totalScore(item: ScheduleItem): number {
  const u = urgencyScore(item);
  const p = item.signals.reduce((sum, sig) => sum + SIGNAL_META[sig].weight, 0);
  return u + p;
}

/* ─────────── Screen ─────────── */

export default function ScheduleNowFlowLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("now-flow");

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />
        {variant === "current" ? <CurrentVariant /> : <NowFlowVariant />}
      </SafeAreaView>
    </View>
  );
}

/* ─────────── Top / Tabs ─────────── */

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{ height: s(52), paddingHorizontal: s(LAYOUT.screenPaddingX) }}
      className="flex-row items-center"
    >
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </TouchableOpacity>
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-title-default"
        style={{ marginLeft: s(8) }}
      >
        일정
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
  return (
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.md),
        padding: s(4),
      }}
      className="flex-row"
    >
      {VARIANTS.map((v) => {
        const active = v.key === value;
        return (
          <Pressable
            key={v.key}
            onPress={() => onChange(v.key)}
            style={{
              flex: 1,
              paddingVertical: s(8),
              borderRadius: s(RADIUS.sm),
              backgroundColor: active ? COLORS.white : "transparent",
              ...(active ? SHADOWS.card : {}),
            }}
            className="items-center justify-center"
          >
            <Typography
              variant="body-03"
              weight={active ? "semibold" : "medium"}
              style={{
                color: active ? COLORS.text.title.default : COLORS.text.body.subtle,
              }}
            >
              {v.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

function VariantNote({ text }: { text: string }) {
  return (
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        marginBottom: s(GAP.related),
        padding: s(12),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.md),
      }}
    >
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: COLORS.text.label.default, lineHeight: s(18) }}
      >
        {text}
      </Typography>
    </View>
  );
}

/* ─────────── Variant: 현재 (대조군) ─────────── */

function CurrentVariant() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: s(GAP.related),
        paddingBottom: s(120),
      }}
    >
      <VariantNote text={VARIANT_NOTE.current} />
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), gap: s(GAP.card) }}>
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(RADIUS.lg),
            padding: s(GAP.related),
            gap: s(GAP.intra),
          }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
          >
            오늘
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            5월 20일 (화) · 6건
          </Typography>
        </View>

        {TODAY_RAW.map((item) => (
          <PlainScheduleCard key={item.id} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

function PlainScheduleCard({ item }: { item: ScheduleItem }) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;

  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        paddingVertical: s(GAP.card),
        paddingHorizontal: s(GAP.related),
        ...SHADOWS.card,
      }}
    >
      <View className="flex-row items-baseline justify-between">
        <View
          className="flex-row items-baseline"
          style={{ gap: s(8), flexShrink: 1 }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
          >
            {fmtTime(item.startMin)}
          </Typography>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-title-default"
            numberOfLines={1}
          >
            {item.clientName}
          </Typography>
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {item.meta}
          </Typography>
        </View>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(RADIUS.sm),
            backgroundColor:
              item.type === "counseling"
                ? COLORS.counselingLight
                : COLORS.assessmentLight,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: accent }}
          >
            {TYPE_LABEL[item.type]}
          </Typography>
        </View>
      </View>
      {item.room && (
        <Typography
          variant="body-03"
          weight="regular"
          style={{
            color: COLORS.text.body.subtle,
            marginTop: s(GAP.intra),
          }}
        >
          {item.room}
        </Typography>
      )}
    </View>
  );
}

/* ─────────── Variant: 지금 흐름 (메인) ─────────── */

/** viewport 상단에서 포커스 anchor 까지의 비율 (0~1). 30% 지점 = 시야 상단의 1/3 */
const FOCUS_ANCHOR_RATIO = 0.3;

function NowFlowVariant() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, View | null>>({});
  const rowOffsetsRef = useRef<Record<string, { y: number; h: number }>>({});
  const viewportHRef = useRef<number>(0);
  const didInitialScrollRef = useRef<boolean>(false);

  const items = useMemo(() => {
    return [...TODAY_RAW].sort((a, b) => a.startMin - b.startMin);
  }, []);

  const initialFocusId = useMemo(() => {
    const next = items.find((i) => i.startMin > NOW_MIN);
    return next?.id ?? items[items.length - 1]?.id ?? null;
  }, [items]);

  const [focusedId, setFocusedId] = useState<string | null>(initialFocusId);

  const summary = useMemo(() => {
    const past = items.filter((i) => getState(i) === "past").length;
    const inProgress = items.filter((i) => getState(i) === "in_progress").length;
    const upcoming = items.filter((i) => getState(i) === "upcoming").length;
    return { past, inProgress, upcoming, total: items.length };
  }, [items]);

  const registerRow = useCallback((id: string, ref: View | null) => {
    rowRefs.current[id] = ref;
  }, []);

  /** 모든 row 의 Y/Height 를 contentRef 기준으로 측정해서 저장 */
  const measureRows = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    Object.entries(rowRefs.current).forEach(([id, ref]) => {
      if (!ref) return;
      ref.measureLayout(
        content as unknown as number,
        (_x: number, y: number, _w: number, h: number) => {
          rowOffsetsRef.current[id] = { y, h };
        },
        () => {},
      );
    });
  }, []);

  /** 측정이 끝났다면 초기 진입 시 다음 임박 일정으로 스크롤 */
  const tryInitialScroll = useCallback(() => {
    if (didInitialScrollRef.current) return;
    if (!initialFocusId) return;
    const offset = rowOffsetsRef.current[initialFocusId];
    const vh = viewportHRef.current;
    if (!offset || vh <= 0) return;
    const targetY = Math.max(0, offset.y - vh * FOCUS_ANCHOR_RATIO);
    scrollRef.current?.scrollTo({ y: targetY, animated: false });
    didInitialScrollRef.current = true;
  }, [initialFocusId]);

  // mount 이후 layout 이 완전히 잡힐 때까지 몇 번 재시도
  useEffect(() => {
    const delays = [80, 180, 320];
    const timers = delays.map((d) =>
      setTimeout(() => {
        measureRows();
        tryInitialScroll();
      }, d),
    );
    return () => timers.forEach(clearTimeout);
  }, [measureRows, tryInitialScroll]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollY = e.nativeEvent.contentOffset.y;
      const vh = e.nativeEvent.layoutMeasurement.height;
      if (vh > 0) viewportHRef.current = vh;
      if (vh <= 0) return;

      const anchor = scrollY + vh * FOCUS_ANCHOR_RATIO;
      let closestId: string | null = null;
      let minDist = Infinity;
      Object.entries(rowOffsetsRef.current).forEach(([id, off]) => {
        const center = off.y + off.h / 2;
        const dist = Math.abs(center - anchor);
        if (dist < minDist) {
          minDist = dist;
          closestId = id;
        }
      });
      if (closestId) {
        setFocusedId((prev) => (closestId !== prev ? closestId : prev));
      }
    },
    [],
  );

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onLayout={(e) => {
        viewportHRef.current = e.nativeEvent.layout.height;
      }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: s(GAP.related),
        paddingBottom: s(160),
      }}
    >
      <View ref={contentRef}>
        <VariantNote text={VARIANT_NOTE["now-flow"]} />
        <View style={{ gap: s(GAP.section) }}>
          <NowHeader summary={summary} />
          <TimelineSpine
            items={items}
            focusedId={focusedId}
            registerRow={registerRow}
            onRowsLayout={measureRows}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function NowHeader({
  summary,
}: {
  summary: { past: number; inProgress: number; upcoming: number; total: number };
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        style={{
          backgroundColor: COLORS.primary75,
          borderRadius: s(RADIUS.lg),
          padding: s(GAP.related),
          gap: s(GAP.card),
        }}
      >
        <View className="flex-row items-baseline justify-between">
          <View
            className="flex-row items-baseline"
            style={{ gap: s(8) }}
          >
            <Typography
              variant="headline-02"
              weight="bold"
              className="text-title-default"
            >
              지금 {fmtTime(NOW_MIN)}
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: COLORS.text.body.subtle }}
            >
              5월 20일 (화)
            </Typography>
          </View>
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              borderRadius: s(RADIUS.sm),
              backgroundColor: COLORS.white,
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.primary500 }}
            >
              오늘 {summary.total}건
            </Typography>
          </View>
        </View>

        <View className="flex-row" style={{ gap: s(GAP.card) }}>
          <SummaryChip
            label="마침"
            count={summary.past}
            color={COLORS.text.body.subtle}
          />
          <View
            style={{
              width: 1,
              backgroundColor: COLORS.gray[200],
            }}
          />
          <SummaryChip
            label="진행 중"
            count={summary.inProgress}
            color={COLORS.warning}
          />
          <View
            style={{
              width: 1,
              backgroundColor: COLORS.gray[200],
            }}
          />
          <SummaryChip
            label="남음"
            count={summary.upcoming}
            color={COLORS.primary500}
          />
        </View>
      </View>
    </View>
  );
}

function SummaryChip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={{ flex: 1, gap: s(2) }}>
      <Typography
        variant="label-02"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        {label}
      </Typography>
      <View
        className="flex-row items-baseline"
        style={{ gap: s(2) }}
      >
        <Typography
          variant="headline-02"
          weight="bold"
          style={{ color }}
        >
          {count}
        </Typography>
        <Typography
          variant="label-02"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          건
        </Typography>
      </View>
    </View>
  );
}

/* ─────────── Timeline Spine ─────────── */

const SPINE_LEFT = 64; // 좌측 시간 컬럼 폭
const SPINE_X = SPINE_LEFT - 16; // spine 라인 x 위치 (cell 우측 끝에서 16px 안쪽)

function TimelineSpine({
  items,
  focusedId,
  registerRow,
  onRowsLayout,
}: {
  items: ScheduleItem[];
  focusedId: string | null;
  registerRow: (id: string, ref: View | null) => void;
  onRowsLayout: () => void;
}) {
  // NOW marker 위치 결정: NOW가 어느 두 일정 사이에 있는지
  const nowInsertIndex = useMemo(() => {
    const idx = items.findIndex((it) => it.startMin > NOW_MIN);
    return idx === -1 ? items.length : idx;
  }, [items]);

  return (
    <View
      style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}
      onLayout={onRowsLayout}
    >
      <View style={{ position: "relative" }}>
        {/* spine 세로 라인 */}
        <View
          style={{
            position: "absolute",
            left: s(SPINE_X),
            top: s(12),
            bottom: s(12),
            width: s(2),
            backgroundColor: COLORS.gray[200],
            borderRadius: s(1),
          }}
        />

        <View style={{ gap: s(GAP.card) }}>
          {items.map((item, idx) => {
            const isNowInsert = idx === nowInsertIndex;
            return (
              <View key={item.id}>
                {isNowInsert && <NowMarker />}
                <TimelineRow
                  item={item}
                  isFocused={focusedId === item.id}
                  registerRow={registerRow}
                />
              </View>
            );
          })}
          {nowInsertIndex === items.length && <NowMarker />}
        </View>
      </View>
    </View>
  );
}

function NowMarker() {
  return (
    <View
      className="flex-row items-center"
      style={{
        marginVertical: s(GAP.intra),
        height: s(24),
      }}
    >
      {/* 좌측 시간 라벨 */}
      <View
        style={{
          width: s(SPINE_LEFT - 8),
          alignItems: "flex-end",
          paddingRight: s(8),
        }}
      >
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(2),
            borderRadius: s(RADIUS.sm),
            backgroundColor: COLORS.primary500,
          }}
        >
          <Typography
            variant="label-02"
            weight="bold"
            style={{ color: COLORS.white }}
          >
            지금 {fmtTime(NOW_MIN)}
          </Typography>
        </View>
      </View>
      {/* dot (라인 정중앙 위치) */}
      <View
        style={{
          position: "absolute",
          left: s(SPINE_X - 5),
          width: s(12),
          height: s(12),
          borderRadius: s(6),
          backgroundColor: COLORS.primary500,
          borderWidth: 2,
          borderColor: COLORS.white,
        }}
      />
      {/* 우측 가로 점선 */}
      <View
        style={{
          flex: 1,
          marginLeft: s(16),
          height: 1,
          backgroundColor: COLORS.primary500,
          opacity: 0.4,
        }}
      />
    </View>
  );
}

function TimelineRow({
  item,
  isFocused,
  registerRow,
}: {
  item: ScheduleItem;
  isFocused: boolean;
  registerRow: (id: string, ref: View | null) => void;
}) {
  const state = getState(item);
  const score = totalScore(item);
  const isHero = state !== "past" && score >= 4;
  const primarySignal = item.signals[0]
    ? SIGNAL_META[item.signals[0]]
    : null;

  /** focus 애니메이션 (shadow / translateY / ring opacity 공통 구동) */
  const focusAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const setRowRef = useCallback(
    (ref: View | null) => {
      registerRow(item.id, ref);
    },
    [item.id, registerRow],
  );

  const ringOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });
  const ringScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <View
      ref={setRowRef}
      className="flex-row"
      style={{ opacity: state === "past" ? 0.55 : 1 }}
    >
      {/* 좌측 시간 컬럼 */}
      <View
        style={{
          width: s(SPINE_LEFT - 16),
          paddingRight: s(8),
          paddingTop: s(isHero ? 12 : 8),
          alignItems: "flex-end",
        }}
      >
        <Typography
          variant="body-02"
          weight={isHero ? "bold" : "semibold"}
          style={{
            color:
              state === "in_progress"
                ? COLORS.warning
                : state === "past"
                  ? COLORS.text.body.subtle
                  : COLORS.text.title.default,
          }}
        >
          {fmtTime(item.startMin)}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, marginTop: s(2) }}
        >
          ~{fmtTime(item.endMin)}
        </Typography>
      </View>

      {/* dot + focus ring 컨테이너 — center 정렬로 28x28 박스 안에 ring/dot 동시 배치 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: s(SPINE_X - 14),
          top: s(isHero ? 9 : 7),
          width: s(28),
          height: s(28),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            backgroundColor: COLORS.primary300,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <RowDot state={state} signal={primarySignal} isHero={isHero} />
      </View>

      {/* 우측 카드 — focusAnim 을 카드에 전달해 shadow/translate 애니메이트 */}
      <View style={{ flex: 1, marginLeft: s(16) }}>
        {isHero ? (
          <HeroCard item={item} focusAnim={focusAnim} />
        ) : item.signals.length > 0 || state === "in_progress" ? (
          <SignalCard
            item={item}
            state={state}
            signal={primarySignal}
            focusAnim={focusAnim}
          />
        ) : (
          <PlainCompactCard item={item} state={state} focusAnim={focusAnim} />
        )}
      </View>
    </View>
  );
}

function RowDot({
  state,
  signal,
  isHero,
}: {
  state: State;
  signal: { solid: string } | null;
  isHero: boolean;
}) {
  if (state === "in_progress") {
    return (
      <View
        style={{
          width: s(14),
          height: s(14),
          borderRadius: s(7),
          backgroundColor: COLORS.warning,
          borderWidth: 3,
          borderColor: COLORS.white,
        }}
      />
    );
  }
  if (isHero) {
    return (
      <View
        style={{
          width: s(14),
          height: s(14),
          borderRadius: s(7),
          backgroundColor: signal?.solid ?? COLORS.primary500,
          borderWidth: 3,
          borderColor: COLORS.white,
        }}
      />
    );
  }
  if (signal) {
    return (
      <View
        style={{
          width: s(10),
          height: s(10),
          borderRadius: s(5),
          backgroundColor: signal.solid,
          borderWidth: 2,
          borderColor: COLORS.white,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: s(10),
        height: s(10),
        borderRadius: s(5),
        backgroundColor: state === "past" ? COLORS.gray[300] : COLORS.gray[400],
        borderWidth: 2,
        borderColor: COLORS.white,
      }}
    />
  );
}

/* ─────────── Card variants ─────────── */

function HeroCard({
  item,
  focusAnim,
}: {
  item: ScheduleItem;
  focusAnim: Animated.Value;
}) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  const deltaMin = item.startMin - NOW_MIN;

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });
  const shadowRadius = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 16],
  });
  const elevation = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 6],
  });
  const translateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Animated.View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.xl),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
      }}
    >
    <Pressable
      style={({ pressed }) => ({
        borderRadius: s(RADIUS.xl),
        flexDirection: "row",
        overflow: "hidden",
        opacity: pressed ? 0.96 : 1,
      })}
    >
      {/* 좌측 강조 라인 — 다른 SignalCard와 같은 패턴, 색·두께만 강함 */}
      <View
        style={{
          width: s(6),
          backgroundColor: COLORS.primary500,
        }}
      />

      <View
        style={{
          flex: 1,
          padding: s(GAP.related),
        }}
      >
        {/* 카운트다운 + 카테고리 */}
        <View className="flex-row items-center justify-between">
          <View
            className="flex-row items-center"
            style={{
              paddingHorizontal: s(10),
              paddingVertical: s(4),
              borderRadius: s(RADIUS.full),
              backgroundColor: COLORS.primary500,
              gap: s(4),
            }}
          >
            <Ionicons name="time" size={12} color={COLORS.white} />
            <Typography
              variant="label-02"
              weight="bold"
              style={{ color: COLORS.white }}
            >
              {deltaMin}분 뒤 시작
            </Typography>
          </View>
          <View
            style={{
              paddingHorizontal: s(10),
              paddingVertical: s(4),
              borderRadius: s(RADIUS.sm),
              backgroundColor:
                item.type === "counseling"
                  ? COLORS.counselingLight
                  : COLORS.assessmentLight,
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: accent }}
            >
              {TYPE_LABEL[item.type]}
            </Typography>
          </View>
        </View>

        {/* 내담자명 + 메타 */}
        <View
          className="flex-row items-baseline"
          style={{ marginTop: s(GAP.card), gap: s(8) }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-title-default"
          >
            {item.clientName}
          </Typography>
          <Typography
            variant="body-03"
            weight="regular"
            style={{ color: COLORS.text.label.default }}
          >
            {item.meta}
          </Typography>
        </View>
        {item.room && (
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.label.default, marginTop: s(GAP.intra) }}
          >
            {item.room}
          </Typography>
        )}

        {/* 신호 칩 묶음 */}
        {item.signals.length > 0 && (
          <View
            className="flex-row"
            style={{
              marginTop: s(GAP.related),
              gap: s(6),
              flexWrap: "wrap",
            }}
          >
            {item.signals.map((sig) => {
              const meta = SIGNAL_META[sig];
              return (
                <View
                  key={sig}
                  className="flex-row items-center"
                  style={{
                    paddingHorizontal: s(8),
                    paddingVertical: s(3),
                    borderRadius: s(RADIUS.sm),
                    backgroundColor: meta.bg,
                    gap: s(6),
                  }}
                >
                  <Ionicons name={meta.icon} size={12} color={meta.solid} />
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: meta.solid }}
                  >
                    {meta.label}
                  </Typography>
                </View>
              );
            })}
          </View>
        )}

        {/* brief — primary75 inner block 으로 강조 */}
        {item.brief && (
          <View
            style={{
              marginTop: s(GAP.card),
              backgroundColor: COLORS.primary75,
              borderRadius: s(RADIUS.md),
              padding: s(GAP.card),
            }}
          >
            <Typography
              variant="body-02"
              weight="medium"
              className="text-title-default"
              style={{ lineHeight: s(22) }}
            >
              {item.brief}
            </Typography>
          </View>
        )}

        {/* 액션 칩 */}
        {item.action && (
          <View
            className="flex-row items-center"
            style={{
              alignSelf: "flex-start",
              marginTop: s(GAP.card),
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(RADIUS.full),
              backgroundColor: COLORS.primary500,
              gap: s(6),
            }}
          >
            <Ionicons name={item.action.icon} size={14} color={COLORS.white} />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.white }}
            >
              {item.action.label}
            </Typography>
            <Ionicons name="chevron-forward" size={14} color={COLORS.white} />
          </View>
        )}
      </View>
    </Pressable>
    </Animated.View>
  );
}

function SignalCard({
  item,
  state,
  signal,
  focusAnim,
}: {
  item: ScheduleItem;
  state: State;
  signal: { solid: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string } | null;
  focusAnim: Animated.Value;
}) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  const isInProgress = state === "in_progress";

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [state === "past" ? 0 : 0.06, state === "past" ? 0.04 : 0.14],
  });
  const shadowRadius = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 14],
  });
  const elevation = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [state === "past" ? 0 : 2, 5],
  });
  const translateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Animated.View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
      }}
    >
    <View
      style={{
        borderRadius: s(RADIUS.lg),
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {/* 좌측 4px 컬러 라인 — 신호 있거나 진행 중일 때만 */}
      <View
        style={{
          width: s(4),
          backgroundColor: isInProgress
            ? COLORS.warning
            : (signal?.solid ?? COLORS.gray[300]),
        }}
      />

      <View
        style={{
          flex: 1,
          paddingVertical: s(GAP.card),
          paddingHorizontal: s(GAP.related),
        }}
      >
        <View className="flex-row items-baseline justify-between">
          <View
            className="flex-row items-baseline"
            style={{ gap: s(8), flexShrink: 1 }}
          >
            <Typography
              variant="body-01"
              weight="semibold"
              className="text-title-default"
              numberOfLines={1}
            >
              {item.clientName}
            </Typography>
            <Typography
              variant="label-01"
              weight="regular"
              style={{ color: COLORS.text.body.subtle }}
            >
              {item.meta}
            </Typography>
          </View>
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(2),
              borderRadius: s(RADIUS.sm),
              backgroundColor:
                item.type === "counseling"
                  ? COLORS.counselingLight
                  : COLORS.assessmentLight,
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: accent }}
            >
              {TYPE_LABEL[item.type]}
            </Typography>
          </View>
        </View>

        {/* 진행 중 뱃지 + 신호 칩 */}
        {(isInProgress || signal) && (
          <View
            className="flex-row"
            style={{ marginTop: s(GAP.card), gap: s(6), flexWrap: "wrap" }}
          >
            {isInProgress && (
              <View
                className="flex-row items-center"
                style={{
                  paddingHorizontal: s(8),
                  paddingVertical: s(3),
                  borderRadius: s(RADIUS.sm),
                  backgroundColor: "rgba(255,146,0,0.12)",
                  gap: s(6),
                }}
              >
                <View
                  style={{
                    width: s(6),
                    height: s(6),
                    borderRadius: s(3),
                    backgroundColor: COLORS.warning,
                  }}
                />
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.warning }}
                >
                  진행 중
                </Typography>
              </View>
            )}
            {signal && (
              <View
                className="flex-row items-center"
                style={{
                  paddingHorizontal: s(8),
                  paddingVertical: s(3),
                  borderRadius: s(RADIUS.sm),
                  backgroundColor: signal.bg,
                  gap: s(6),
                }}
              >
                <Ionicons name={signal.icon} size={12} color={signal.solid} />
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: signal.solid }}
                >
                  {signal.label}
                </Typography>
              </View>
            )}
          </View>
        )}

        {/* brief — past 상태에선 한 줄로 축약 */}
        {item.brief && (
          <Typography
            variant="body-02"
            weight="regular"
            style={{
              color: COLORS.text.body.strong,
              lineHeight: s(22),
              marginTop: s(GAP.card),
            }}
            numberOfLines={state === "past" ? 1 : 2}
          >
            {item.brief}
          </Typography>
        )}

        {/* 액션 칩 — past 아닐 때만 */}
        {item.action && state !== "past" && (
          <View
            className="flex-row items-center"
            style={{
              alignSelf: "flex-start",
              marginTop: s(GAP.card),
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderRadius: s(RADIUS.full),
              backgroundColor: COLORS.gray[100],
              gap: s(4),
            }}
          >
            <Ionicons name={item.action.icon} size={12} color={COLORS.gray[700]} />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {item.action.label}
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={COLORS.gray[600]}
            />
          </View>
        )}
      </View>
    </View>
    </Animated.View>
  );
}

function PlainCompactCard({
  item,
  state,
  focusAnim,
}: {
  item: ScheduleItem;
  state: State;
  focusAnim: Animated.Value;
}) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [state === "past" ? 0 : 0.06, state === "past" ? 0.04 : 0.14],
  });
  const shadowRadius = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 14],
  });
  const elevation = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [state === "past" ? 0 : 2, 5],
  });
  const translateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Animated.View
      style={{
        backgroundColor:
          state === "past" ? COLORS.gray[100] : COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity,
        shadowRadius,
        elevation,
        transform: [{ translateY }],
      }}
    >
    <View
      style={{
        borderRadius: s(RADIUS.lg),
        paddingVertical: s(GAP.card),
        paddingHorizontal: s(GAP.related),
      }}
    >
      <View className="flex-row items-center justify-between">
        <View
          className="flex-row items-baseline"
          style={{ gap: s(8), flexShrink: 1 }}
        >
          <Typography
            variant="body-01"
            weight={state === "past" ? "medium" : "semibold"}
            style={{
              color: state === "past" ? COLORS.text.body.subtle : COLORS.text.title.default,
              textDecorationLine: state === "past" ? "line-through" : "none",
            }}
            numberOfLines={1}
          >
            {item.clientName}
          </Typography>
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {item.meta}
            {item.room ? ` · ${item.room}` : ""}
          </Typography>
        </View>
        {state === "past" ? (
          <Ionicons name="checkmark" size={16} color={COLORS.gray[400]} />
        ) : (
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(2),
              borderRadius: s(RADIUS.sm),
              backgroundColor:
                item.type === "counseling"
                  ? COLORS.counselingLight
                  : COLORS.assessmentLight,
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: accent }}
            >
              {TYPE_LABEL[item.type]}
            </Typography>
          </View>
        )}
      </View>
    </View>
    </Animated.View>
  );
}
