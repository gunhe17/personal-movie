import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  addDays,
} from "date-fns";
import { ko } from "date-fns/locale";
import { COLORS, SHADOWS, GAP, RADIUS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 일정 시안 — 만남의 맥락 brief (Concierge)
 *
 * 차별화 축
 *   홈        = "지금 뭐 해?" (오늘 TO DO)
 *   내담자    = "누구를 챙겨?" (사람 단위 우선순위)
 *   일정 탭   = "다음 만남에 대해 알아야 할 것" (만남 단위 맥락)
 *
 * 핵심 발상: TO DO 카드는 액션이 있을 때만 떠 있지만, 일정 카드는 항상
 * 있다. 일정 탭이 줄 수 있는 고유 가치는 "할 일이 없더라도 그 만남 전에
 * 알고 들어가야 할 것" = 맥락 brief.
 *
 * 강약 (단조로움 회피)
 *   1순위  HERO     다음 임박 1건 — 큰 카드 + 옅은 wrap + 풀 brief
 *   2순위  COMPACT  남은/내일 일정 — compact 카드. 신호 있는 카드만
 *                   좌측 4px 컬러 라인으로 도드라짐 (시각 리듬)
 *   3순위  PAST     마친 일정 — fade(gray + opacity) 처리
 *
 * 신호 카테고리 (필요한 카드에만 옵션 부착, 한 화면 ≤3색)
 *   첫 만남·라포   (mint)
 *   일지 미작성    (yellow)
 *   노쇼 리스크    (coral)
 *
 * 카드 인터랙션은 display-only — 실제 라우팅 연결은 production 화면에서.
 */

type Variant = "current" | "concierge";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "concierge", label: "비서실" },
];

const VARIANT_NOTE: Record<Variant, string> = {
  current:
    "현재 — 캘린더 그리드 + 선택일 시간순 리스트. 시간을 보여주는 도구. 사람·맥락은 일정 카드 탭 후에야 보인다.",
  concierge:
    "비서실 — 시간순 일정 카드 각각이 '만남 전 알아야 할 brief'를 들고 있음 (지난 회기 요약 / 첫 만남 사전 정보 / 노쇼 이력 등). 일부 카드엔 옵션 액션 칩(일지 작성·검사 결과 보기 등) 부착. TO DO 화면이 아니라 '만남의 맥락 덤프'. 우상단 토글로 캘린더 시야 전환.",
};

/* ─────────── Mock data ─────────── */

type ScheduleType = "counseling" | "assessment";
type Signal = "first" | "note" | "noshow";

interface Brief {
  /** 옵션 신호 — 부착 시 좌측 컬러 라벨 칩으로 시각화 */
  signal?: Signal;
  /** 만남 전 알아야 할 핵심 한두 줄 */
  text: string;
  /** 옵션 액션 — 부착 시 카드 하단 chip으로 이동 동선 제공 */
  action?: { label: string; destination: string };
}

interface DaySchedule {
  id: string;
  hh: string;
  endHh: string;
  type: ScheduleType;
  clientName: string;
  meta: string;
  room?: string;
  brief: Brief;
}

const TODAY_SCHEDULES: DaySchedule[] = [
  {
    id: "t1",
    hh: "10:00",
    endHh: "10:50",
    type: "counseling",
    clientName: "김은서",
    meta: "여 · 만 7세",
    room: "1번 상담실",
    brief: {
      text: "4회차 · 지난 회기엔 학교 친구 관계 걱정을 표현했어요.",
    },
  },
  {
    id: "t2",
    hh: "14:00",
    endHh: "15:00",
    type: "assessment",
    clientName: "박지민",
    meta: "남 · 만 8세",
    room: "검사실 A",
    brief: {
      signal: "first",
      text: "첫 만남이에요. K-WISC 결과가 어제 도착했어요.",
      action: { label: "검사 결과 보기", destination: "assessment" },
    },
  },
  {
    id: "t3",
    hh: "16:30",
    endHh: "17:20",
    type: "counseling",
    clientName: "최서연",
    meta: "여 · 만 14세",
    room: "2번 상담실",
    brief: {
      signal: "note",
      text: "어제 회기 일지가 비어 있어요.",
      action: { label: "일지 작성", destination: "note" },
    },
  },
];

const TOMORROW_SCHEDULES: DaySchedule[] = [
  {
    id: "n1",
    hh: "10:00",
    endHh: "10:50",
    type: "counseling",
    clientName: "정하늘",
    meta: "여 · 만 6세",
    room: "1번 상담실",
    brief: {
      text: "2회차 · 어머니가 함께 오실 예정이에요.",
    },
  },
  {
    id: "n2",
    hh: "11:00",
    endHh: "11:50",
    type: "counseling",
    clientName: "이서연",
    meta: "여 · 만 11세",
    room: "2번 상담실",
    brief: {
      signal: "noshow",
      text: "최근 두 번 못 오셨어요. 마지막 만남이 3주 전이에요.",
      action: { label: "리마인드 보내기", destination: "client" },
    },
  },
];

const SIGNAL_META: Record<
  Signal,
  {
    label: string;
    solid: string;
    bg: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  first: {
    label: "첫 만남",
    solid: COLORS.palette.mint,
    bg: COLORS.paletteBg.mint,
    icon: "sparkles",
  },
  note: {
    label: "일지 미작성",
    solid: COLORS.palette.yellow,
    bg: COLORS.paletteBg.yellow,
    icon: "document-text",
  },
  noshow: {
    label: "노쇼 이력",
    solid: COLORS.palette.coral,
    bg: COLORS.paletteBg.coral,
    icon: "alert-circle",
  },
};

const TYPE_LABEL: Record<ScheduleType, string> = {
  counseling: "상담",
  assessment: "검사",
};

/* ─────────── Screen ─────────── */

export default function ScheduleConciergeLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("concierge");

  return (
    <View className="flex-1 bg-surface">
      <SafeAreaView edges={["top"]} className="flex-1">
        <TopBar onBack={() => router.back()} />
        <VariantTabs value={variant} onChange={setVariant} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: s(GAP.related),
            paddingBottom: s(120),
          }}
        >
          <VariantNote text={VARIANT_NOTE[variant]} />
          {variant === "current" ? <CurrentVariant /> : <ConciergeVariant />}
        </ScrollView>
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
    <View
      style={{
        marginHorizontal: s(LAYOUT.screenPaddingX),
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(20),
        gap: s(GAP.related),
      }}
    >
      <Typography
        variant="body-01"
        weight="semibold"
        className="text-title-default"
      >
        캘린더 + 선택일 시간순 리스트
      </Typography>
      <Typography
        variant="body-02"
        weight="regular"
        style={{ color: COLORS.text.body.subtle, lineHeight: s(22) }}
      >
        지금의 일정 탭은 시간을 보여주는 도구예요.{"\n"}
        오늘 누구를 만나는지는 알지만, "왜 그 사람을 만나는지"의 맥락은
        일정 카드를 눌러 들어간 뒤에야 보입니다.
      </Typography>
      <View
        style={{
          height: s(1),
          backgroundColor: COLORS.gray[100],
          marginVertical: s(4),
        }}
      />
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.text.label.default }}
      >
        비서실 탭으로 전환해서 비교해보세요
      </Typography>
    </View>
  );
}

/* ─────────── Variant: 비서실 (메인) ─────────── */

function ConciergeVariant() {
  const [mode, setMode] = useState<"list" | "calendar">("list");
  return (
    <View>
      <ModeToggleRow mode={mode} onChange={setMode} />
      {mode === "list" ? <ListMode /> : <CalendarMode />}
    </View>
  );
}

function ModeToggleRow({
  mode,
  onChange,
}: {
  mode: "list" | "calendar";
  onChange: (m: "list" | "calendar") => void;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        marginBottom: s(GAP.related),
      }}
      className="flex-row items-center justify-end"
    >
      <Pressable
        onPress={() => onChange(mode === "list" ? "calendar" : "list")}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: s(6),
          paddingHorizontal: s(12),
          paddingVertical: s(8),
          borderRadius: s(RADIUS.full),
          backgroundColor: COLORS.gray[100],
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons
          name={mode === "list" ? "calendar-outline" : "list-outline"}
          size={16}
          color={COLORS.gray[700]}
        />
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.gray[700] }}
        >
          {mode === "list" ? "캘린더" : "리스트"}
        </Typography>
      </Pressable>
    </View>
  );
}

/* ─────────── List Mode ─────────── */

/**
 * Mock 가정: "지금"이 오후 1시
 *   김은서 10:00 → 마친 일정
 *   박지민 14:00 → 다음 만남 (HERO)
 *   최서연 16:30 → 남은 일정
 */
function ListMode() {
  const nextMeeting = TODAY_SCHEDULES[1]; // 박지민 14:00
  const remainingToday = [TODAY_SCHEDULES[2]]; // 최서연 16:30
  const pastToday = [TODAY_SCHEDULES[0]]; // 김은서 10:00

  return (
    <View style={{ gap: s(GAP.section) }}>
      <NextMeetingHero item={nextMeeting} />

      <CompactSection
        title="오늘 남은 일정"
        items={remainingToday}
      />

      <PastSection items={pastToday} />

      <CompactSection
        title="내일"
        date={format(addDays(new Date(), 1), "M월 d일 (EEE)", { locale: ko })}
        items={TOMORROW_SCHEDULES}
      />
    </View>
  );
}

/* ─────────── Next Meeting Hero (1순위) ─────────── */

function NextMeetingHero({ item }: { item: DaySchedule }) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  const signalMeta = item.brief.signal
    ? SIGNAL_META[item.brief.signal]
    : null;

  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      {/* 헤더 라벨 */}
      <View
        className="flex-row items-baseline"
        style={{ marginBottom: s(GAP.related), gap: s(8) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-title-default"
        >
          다음 만남
        </Typography>
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          오늘 · {item.hh}
        </Typography>
      </View>

      {/* HERO 카드 */}
      <Pressable
        style={({ pressed }) => ({
          backgroundColor: COLORS.primary75,
          borderRadius: s(RADIUS.xl),
          padding: s(GAP.related + 4),
          opacity: pressed ? 0.96 : 1,
          ...SHADOWS.card,
        })}
      >
        {/* 시간 대형 + 카테고리 칩 */}
        <View className="flex-row items-start justify-between">
          <View>
            <View
              className="flex-row items-baseline"
              style={{ gap: s(6) }}
            >
              <Typography
                variant="headline-01"
                weight="bold"
                className="text-title-default"
              >
                {item.hh}
              </Typography>
              <Typography
                variant="body-02"
                weight="regular"
                style={{ color: COLORS.text.body.subtle }}
              >
                ~{item.endHh}
              </Typography>
            </View>
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
            {item.room ? ` · ${item.room}` : ""}
          </Typography>
        </View>

        {/* 신호 + brief */}
        <View
          style={{
            marginTop: s(GAP.related),
            backgroundColor: COLORS.gray[100],
            borderRadius: s(RADIUS.lg),
            padding: s(GAP.related),
          }}
        >
          {signalMeta && (
            <View
              className="flex-row items-center"
              style={{
                alignSelf: "flex-start",
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(RADIUS.sm),
                backgroundColor: signalMeta.bg,
                gap: s(6),
                marginBottom: s(GAP.card),
              }}
            >
              <Ionicons
                name={signalMeta.icon}
                size={12}
                color={signalMeta.solid}
              />
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: signalMeta.solid }}
              >
                {signalMeta.label}
              </Typography>
            </View>
          )}
          <Typography
            variant="body-01"
            weight="medium"
            className="text-title-default"
            style={{ lineHeight: s(24) }}
          >
            {item.brief.text}
          </Typography>
          {item.brief.action && (
            <View
              className="flex-row items-center"
              style={{
                alignSelf: "flex-start",
                marginTop: s(GAP.related),
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: s(RADIUS.full),
                backgroundColor: COLORS.primary500,
                gap: s(4),
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                {item.brief.action.label}
              </Typography>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={COLORS.white}
              />
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

/* ─────────── Compact Section (2순위) ─────────── */

function CompactSection({
  title,
  date,
  items,
}: {
  title: string;
  date?: string;
  items: DaySchedule[];
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        className="flex-row items-baseline justify-between"
        style={{ marginBottom: s(GAP.related) }}
      >
        <View
          className="flex-row items-baseline"
          style={{ gap: s(8) }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-title-default"
          >
            {title}
          </Typography>
          {date && (
            <Typography
              variant="body-03"
              weight="regular"
              style={{ color: COLORS.text.body.subtle }}
            >
              {date}
            </Typography>
          )}
        </View>
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {items.length}건
        </Typography>
      </View>

      <View style={{ gap: s(GAP.card) }}>
        {items.map((it) => (
          <CompactCard key={it.id} item={it} />
        ))}
      </View>
    </View>
  );
}

function CompactCard({ item }: { item: DaySchedule }) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  const signalMeta = item.brief.signal
    ? SIGNAL_META[item.brief.signal]
    : null;

  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        ...SHADOWS.card,
      }}
    >
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          borderRadius: s(RADIUS.lg),
          overflow: "hidden",
          opacity: pressed ? 0.96 : 1,
        })}
      >
        {/* 신호 있는 카드만 좌측 4px 컬러 라인 */}
        {signalMeta && (
          <View
            style={{ width: s(4), backgroundColor: signalMeta.solid }}
          />
        )}

        <View
          style={{
            flex: 1,
            paddingVertical: s(GAP.card),
            paddingHorizontal: s(GAP.related),
          }}
        >
        {/* 상단: 시간 + 이름 + 카테고리 */}
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
              {item.hh}
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

        {/* 신호 칩 (옵션) */}
        {signalMeta && (
          <View
            className="flex-row items-center"
            style={{
              alignSelf: "flex-start",
              marginTop: s(GAP.card),
              paddingHorizontal: s(8),
              paddingVertical: s(3),
              borderRadius: s(RADIUS.sm),
              backgroundColor: signalMeta.bg,
              gap: s(6),
            }}
          >
            <Ionicons
              name={signalMeta.icon}
              size={12}
              color={signalMeta.solid}
            />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: signalMeta.solid }}
            >
              {signalMeta.label}
            </Typography>
          </View>
        )}

        {/* brief */}
        <Typography
          variant="body-02"
          weight="regular"
          style={{
            color: signalMeta ? COLORS.text.body.strong : COLORS.text.body.subtle,
            lineHeight: s(22),
            marginTop: signalMeta ? s(GAP.intra + 2) : s(GAP.card),
          }}
        >
          {item.brief.text}
        </Typography>

        {/* 액션 칩 (옵션) */}
        {item.brief.action && (
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
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {item.brief.action.label}
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={COLORS.gray[600]}
            />
          </View>
        )}
        </View>
      </Pressable>
    </View>
  );
}

/* ─────────── Past Section (3순위, fade) ─────────── */

function PastSection({ items }: { items: DaySchedule[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View
        className="flex-row items-baseline justify-between"
        style={{ marginBottom: s(GAP.related) }}
      >
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          이미 마친 일정
        </Typography>
        <Typography
          variant="label-01"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {items.length}건
        </Typography>
      </View>
      <View style={{ gap: s(GAP.card) }}>
        {items.map((it) => (
          <PastCard key={it.id} item={it} />
        ))}
      </View>
    </View>
  );
}

function PastCard({ item }: { item: DaySchedule }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[100],
        borderRadius: s(RADIUS.lg),
      }}
    >
      <Pressable
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: s(GAP.card),
          paddingHorizontal: s(GAP.related),
          borderRadius: s(RADIUS.lg),
          overflow: "hidden",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Typography
          variant="body-02"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          {item.hh}
        </Typography>
        <View style={{ flex: 1, marginLeft: s(GAP.card) }}>
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.text.body.subtle }}
            numberOfLines={1}
          >
            {item.clientName} · {TYPE_LABEL[item.type]}
          </Typography>
        </View>
        <Ionicons name="checkmark" size={16} color={COLORS.gray[400]} />
      </Pressable>
    </View>
  );
}

/* ─────────── Timeline Section — 좌측 라인 + dot 시간축 ─────────── */

function TimelineSection({
  sectionLabel,
  dateLabel,
  items,
  showTodayBadge,
}: {
  sectionLabel: string;
  dateLabel: string;
  items: DaySchedule[];
  showTodayBadge?: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <SectionHeader
        label={sectionLabel}
        date={dateLabel}
        count={items.length}
        showTodayBadge={showTodayBadge}
      />

      {items.length === 0 ? (
        <EmptyDay />
      ) : (
        <View style={{ position: "relative", marginTop: s(GAP.related) }}>
          {/* 좌측 세로 라인 */}
          <View
            style={{
              position: "absolute",
              left: s(7),
              top: s(8),
              bottom: s(8),
              width: s(2),
              backgroundColor: COLORS.gray[200],
              borderRadius: s(1),
            }}
          />
          <View style={{ gap: s(GAP.card) }}>
            {items.map((it, i) => (
              <TimelineRow
                key={it.id}
                item={it}
                isFirst={i === 0}
                isLast={i === items.length - 1}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function SectionHeader({
  label,
  date,
  count,
  showTodayBadge,
}: {
  label: string;
  date: string;
  count: number;
  showTodayBadge?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View
        className="flex-row items-center"
        style={{ gap: s(8) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-title-default"
        >
          {label}
        </Typography>
        {showTodayBadge && (
          <View
            style={{
              paddingHorizontal: s(8),
              paddingVertical: s(2),
              borderRadius: s(RADIUS.sm),
              backgroundColor: COLORS.gray[100],
            }}
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.gray[700] }}
            >
              오늘
            </Typography>
          </View>
        )}
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          {date}
        </Typography>
      </View>
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: COLORS.text.body.subtle }}
      >
        {count}건
      </Typography>
    </View>
  );
}

function TimelineRow({
  item,
}: {
  item: DaySchedule;
  isFirst: boolean;
  isLast: boolean;
}) {
  const accent =
    item.type === "counseling" ? COLORS.counseling : COLORS.assessment;
  const signalMeta = item.brief.signal
    ? SIGNAL_META[item.brief.signal]
    : null;

  return (
    <View className="flex-row" style={{ gap: s(GAP.card) }}>
      {/* 좌측 dot + 시간 영역 */}
      <View style={{ width: s(56), alignItems: "flex-start" }}>
        <View
          style={{
            width: s(16),
            height: s(16),
            borderRadius: s(8),
            backgroundColor: COLORS.bg.surface,
            borderWidth: 2,
            borderColor: accent,
            alignItems: "center",
            justifyContent: "center",
            marginTop: s(6),
          }}
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: accent,
            }}
          />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-title-default"
          style={{ marginTop: s(6) }}
        >
          {item.hh}
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          style={{ color: COLORS.text.body.subtle, marginTop: s(1) }}
        >
          ~{item.endHh}
        </Typography>
      </View>

      {/* 우측 카드 — 만남 정보 + brief 묶음 */}
      <Pressable
        style={({ pressed }) => ({
          flex: 1,
          backgroundColor: COLORS.gray[50],
          borderRadius: s(RADIUS.lg),
          paddingVertical: s(GAP.card),
          paddingHorizontal: s(GAP.related),
          opacity: pressed ? 0.95 : 1,
          ...SHADOWS.card,
        })}
      >
        {/* 상단: 내담자명·메타·카테고리 칩 */}
        <View className="flex-row items-baseline justify-between">
          <View
            className="flex-row items-baseline"
            style={{ gap: s(6), flexShrink: 1 }}
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
        {item.room && (
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.text.label.default, marginTop: s(GAP.intra) }}
            numberOfLines={1}
          >
            {item.room}
          </Typography>
        )}

        {/* 구분선 */}
        <View
          style={{
            height: s(1),
            backgroundColor: COLORS.gray[100],
            marginVertical: s(GAP.card),
          }}
        />

        {/* 브리프 영역 */}
        <BriefBlock brief={item.brief} signalMeta={signalMeta} />
      </Pressable>
    </View>
  );
}

function BriefBlock({
  brief,
  signalMeta,
}: {
  brief: Brief;
  signalMeta: (typeof SIGNAL_META)[Signal] | null;
}) {
  return (
    <View>
      {/* 신호 칩 (옵션) */}
      {signalMeta && (
        <View
          className="flex-row items-center"
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: s(8),
            paddingVertical: s(3),
            borderRadius: s(RADIUS.sm),
            backgroundColor: signalMeta.bg,
            gap: s(6),
            marginBottom: s(GAP.intra + 2),
          }}
        >
          <Ionicons
            name={signalMeta.icon}
            size={12}
            color={signalMeta.solid}
          />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: signalMeta.solid }}
          >
            {signalMeta.label}
          </Typography>
        </View>
      )}

      {/* brief 본문 */}
      <Typography
        variant="body-02"
        weight="regular"
        style={{
          color: COLORS.text.body.strong,
          lineHeight: s(22),
        }}
      >
        {brief.text}
      </Typography>

      {/* 액션 칩 (옵션) */}
      {brief.action && (
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: s(GAP.card),
          }}
          className="flex-row items-center"
        >
          <View
            className="flex-row items-center"
            style={{
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderRadius: s(RADIUS.full),
              backgroundColor: COLORS.gray[100],
              gap: s(4),
            }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {brief.action.label}
            </Typography>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={COLORS.gray[600]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function EmptyDay() {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(RADIUS.lg),
        padding: s(20),
        marginTop: s(GAP.related),
        ...SHADOWS.card,
      }}
      className="items-center"
    >
      <Typography
        variant="body-02"
        weight="medium"
        style={{ color: COLORS.text.body.subtle }}
      >
        예정된 일정이 없어요
      </Typography>
    </View>
  );
}

/* ─────────── Calendar Mode ─────────── */

function CalendarMode() {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, ScheduleType[]>();
    const toKey = (d: Date) => format(d, "yyyy-MM-dd");
    map.set(toKey(today), ["counseling", "assessment", "counseling"]);
    map.set(toKey(addDays(today, 1)), ["counseling", "counseling"]);
    map.set(toKey(addDays(today, 3)), ["assessment"]);
    map.set(toKey(addDays(today, 5)), ["counseling", "counseling"]);
    map.set(toKey(addDays(today, -2)), ["counseling"]);
    map.set(toKey(addDays(today, -4)), ["assessment", "counseling"]);
    return map;
  }, [today]);

  const selectedItems = useMemo(() => {
    if (isSameDay(selectedDate, today)) return TODAY_SCHEDULES;
    if (isSameDay(selectedDate, addDays(today, 1))) return TOMORROW_SCHEDULES;
    return [];
  }, [selectedDate, today]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [viewMonth]);

  return (
    <View style={{ gap: s(GAP.section) }}>
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(RADIUS.lg),
            paddingHorizontal: s(12),
            paddingTop: s(8),
            paddingBottom: s(GAP.related),
            ...SHADOWS.card,
          }}
        >
          <MonthHeader
            viewMonth={viewMonth}
            onPrev={() => setViewMonth(subMonths(viewMonth, 1))}
            onNext={() => setViewMonth(addMonths(viewMonth, 1))}
            onResetToday={() => {
              setViewMonth(today);
              setSelectedDate(today);
            }}
          />
          <DowRow />
          <CalendarGrid
            days={calendarDays}
            viewMonth={viewMonth}
            today={today}
            selectedDate={selectedDate}
            dotsByDate={dotsByDate}
            onSelect={setSelectedDate}
          />
        </View>
      </View>

      <TimelineSection
        sectionLabel={
          isSameDay(selectedDate, today)
            ? "오늘"
            : isSameDay(selectedDate, addDays(today, 1))
              ? "내일"
              : "선택일"
        }
        dateLabel={format(selectedDate, "M월 d일 (EEE)", { locale: ko })}
        items={selectedItems}
        showTodayBadge={isSameDay(selectedDate, today)}
      />
    </View>
  );
}

function MonthHeader({
  viewMonth,
  onPrev,
  onNext,
  onResetToday,
}: {
  viewMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  onResetToday: () => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingVertical: s(12), paddingHorizontal: s(4) }}
    >
      <TouchableOpacity
        onPress={onResetToday}
        hitSlop={8}
        activeOpacity={0.7}
        className="flex-row items-center"
        style={{ gap: s(6) }}
      >
        <Typography
          variant="headline-02"
          weight="bold"
          className="text-title-default"
        >
          {format(viewMonth, "yyyy년 M월", { locale: ko })}
        </Typography>
      </TouchableOpacity>
      <View className="flex-row" style={{ gap: s(16) }}>
        <TouchableOpacity onPress={onPrev} hitSlop={8} activeOpacity={0.7}>
          <Ionicons
            name="chevron-back"
            size={22}
            color={COLORS.gray[600]}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} hitSlop={8} activeOpacity={0.7}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={COLORS.gray[600]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
function DowRow() {
  return (
    <View className="flex-row">
      {DOW_LABELS.map((d, i) => (
        <View
          key={d}
          style={{ height: s(36) }}
          className="flex-1 items-center justify-center"
        >
          <Typography
            variant="body-02"
            weight="medium"
            style={{
              color: i === 0 ? COLORS.negative : COLORS.gray[500],
            }}
          >
            {d}
          </Typography>
        </View>
      ))}
    </View>
  );
}

function CalendarGrid({
  days,
  viewMonth,
  today,
  selectedDate,
  dotsByDate,
  onSelect,
}: {
  days: Date[];
  viewMonth: Date;
  today: Date;
  selectedDate: Date;
  dotsByDate: Map<string, ScheduleType[]>;
  onSelect: (d: Date) => void;
}) {
  const rows = Math.ceil(days.length / 7);
  return (
    <View>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <View key={rowIdx} className="flex-row">
          {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <CalendarCell
                key={key}
                day={d}
                isCurrentMonth={isSameMonth(d, viewMonth)}
                isToday={isSameDay(d, today)}
                isSelected={isSameDay(d, selectedDate)}
                types={dotsByDate.get(key) ?? []}
                onPress={() => onSelect(d)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function CalendarCell({
  day,
  isCurrentMonth,
  isToday,
  isSelected,
  types,
  onPress,
}: {
  day: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  types: ScheduleType[];
  onPress: () => void;
}) {
  const isSunday = day.getDay() === 0;
  const textColor = isSelected
    ? COLORS.white
    : !isCurrentMonth
      ? COLORS.gray[300]
      : isSunday
        ? COLORS.negative
        : COLORS.gray[900];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: s(4),
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: isSelected ? COLORS.primary500 : "transparent",
          borderWidth: isToday && !isSelected ? 1.5 : 0,
          borderColor: COLORS.primary500,
        }}
        className="items-center justify-center"
      >
        <Typography
          variant="body-02"
          weight={isToday || isSelected ? "semibold" : "medium"}
          style={{ color: textColor }}
        >
          {day.getDate()}
        </Typography>
      </View>
      <View
        className="flex-row items-center"
        style={{ height: s(8), gap: s(3), marginTop: s(4) }}
      >
        {types.slice(0, 3).map((t, i) => (
          <View
            key={`${t}-${i}`}
            style={{
              width: s(4),
              height: s(4),
              borderRadius: s(2),
              backgroundColor: isSelected
                ? "rgba(255,255,255,0.85)"
                : t === "counseling"
                  ? COLORS.counseling
                  : COLORS.assessment,
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}
