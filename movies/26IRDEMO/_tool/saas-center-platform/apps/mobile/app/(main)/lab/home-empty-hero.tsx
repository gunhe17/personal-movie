import { useState } from "react";
import { View, ScrollView, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Circle,
  Mask,
} from "react-native-svg";
import RestWithCoffeeIcon from "@assets/RestWithCoffeeIcon.svg";
import { COLORS, LAYOUT } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 빈 상태 · 히어로 우선 + 에이전틱 신호 표현 비교 — 탭 lab.
 *
 * 결정 반영:
 *  · 이미지+문구 히어로를 메인 앵커로(레이아웃 고정)
 *  · 그 아래 일정 카드는 "지금 기준 다음 1건"만
 *  · 그 아래 에이전틱 신호(일지 작성·상담 연장·검사 공유·출석 주의·미수 등)를
 *    캡슐 스택 대신 차분하게 — 세 형태를 탭으로 비교
 *
 * 변형 탭:
 *  [현재]       production 빈 상태/일정 재현 (애매함 대조군)
 *  [브리프 카드] 한 카드에 묶고 1순위 살짝 강조 + 더보기 (홈=발견 스펙과 맞음)
 *  [섹션 리스트] heading + 박스 없는 행 나열 (가장 가벼움)
 *  [우선순위]    가장 중요한 1건만 크게 + "외 N건" 접기 (가장 절제)
 *
 * 시나리오 토글: [여유 0건]·[보통 2건]·[바쁨 5건] — 히어로 문구·다음 일정 카드 적응 확인.
 * 신호는 일정량과 무관하게 항상 존재(횡단 발견)하므로 모든 시나리오에서 노출.
 *
 * 전부 mock. 채택 시 BriefStackHome 히어로/일정/신호 분기에 반영.
 */

const PERSON_NAME = "김민준";
const CENTER_NAME = "마음숲 상담센터";
const DATE_STR = "2026년 6월 25일 목요일";

type Variant = "current" | "brief" | "list" | "priority";
type Load = "free" | "normal" | "busy";

const VARIANTS: { key: Variant; label: string }[] = [
  { key: "current", label: "현재" },
  { key: "brief", label: "브리프 카드" },
  { key: "list", label: "섹션 리스트" },
  { key: "priority", label: "우선순위" },
];

const LOADS: { key: Load; label: string }[] = [
  { key: "free", label: "여유 0건" },
  { key: "normal", label: "보통 2건" },
  { key: "busy", label: "바쁨 5건" },
];

type MockSchedule = {
  id: string;
  start: string;
  end: string;
  name: string;
  meta: string;
  room: string;
  program: string;
  category: "counseling" | "assessment";
};

const SCHEDULES: MockSchedule[] = [
  { id: "1", start: "10:00", end: "10:50", name: "박지우님의 상담", meta: "남 · 만 9세", room: "상담실 B", program: "놀이치료-개인", category: "counseling" },
  { id: "2", start: "11:00", end: "12:00", name: "이준호님의 검사", meta: "남 · 만 11세", room: "검사실 1", program: "풀배터리검사", category: "assessment" },
  { id: "3", start: "14:00", end: "14:50", name: "김서연님의 상담", meta: "여 · 만 8세", room: "상담실 A", program: "놀이치료-개인", category: "counseling" },
  { id: "4", start: "15:00", end: "15:50", name: "최하은님의 상담", meta: "여 · 만 7세", room: "상담실 A", program: "미술치료-개인", category: "counseling" },
  { id: "5", start: "16:30", end: "17:30", name: "정민서님 외 2명의 상담", meta: "그룹 · 3명", room: "그룹실", program: "사회성그룹-그룹", category: "counseling" },
];

const UPCOMING = { when: "내일 14:00", name: "김서연님의 상담" };

/** 다음 1건 — 오늘 남은 일정의 첫 건, 없으면 null(빈 상태) */
function nextScheduleFor(load: Load): MockSchedule | null {
  if (load === "free") return null;
  if (load === "normal") return SCHEDULES[2];
  return SCHEDULES[0];
}

function todayCountFor(load: Load): number {
  if (load === "free") return 0;
  if (load === "normal") return 2;
  return 5;
}

function heroCopy(load: Load): { title: string; sub: string } {
  if (load === "free")
    return { title: "오늘은 여유로운 하루예요", sub: "밀린 일을 정리하거나, 잠시 쉬어가도 좋아요" };
  if (load === "normal")
    return { title: `${PERSON_NAME}님, 좋은 오후예요`, sub: "오늘 2개의 일정이 기다리고 있어요" };
  return { title: "오늘은 바쁜 하루예요", sub: "5개의 일정이 있어요. 하나씩 차근히 해봐요" };
}

/* ───────── 에이전틱 신호 mock ───────── */

type SignalTone = "brand" | "urgent" | "neutral";
type Signal = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  cta: string;
  tone: SignalTone;
};

// 색은 의미 있을 때만(design.md §7.5): 1순위=brand 보라, 위급=red, 그 외 중립 gray.
const SIGNALS: Signal[] = [
  { id: "journal", icon: "create-outline", label: "일지 2건 미작성", detail: "완료한 회기 2건의 일지가 비어 있어요", cta: "작성하기", tone: "brand" },
  { id: "extend", icon: "time-outline", label: "상담 연장 결정", detail: "마지막 예정 회기가 7일 이내예요", cta: "확인하기", tone: "neutral" },
  { id: "share", icon: "clipboard-outline", label: "검사 결과 미공유", detail: "완료한 검사 1건의 결과를 아직 공유하지 않았어요", cta: "공유하기", tone: "neutral" },
  { id: "attend", icon: "alert-circle-outline", label: "출석 주의 1명", detail: "최근 3회기 중 2회 결석한 내담자가 있어요", cta: "보기", tone: "urgent" },
  { id: "bill", icon: "card-outline", label: "미수금 청구 1건", detail: "본인 담당 케이스에 미수금이 있어요", cta: "확인하기", tone: "neutral" },
];

function toneColor(tone: SignalTone): string {
  if (tone === "brand") return "#7B4FFF";
  if (tone === "urgent") return "#D23E46";
  return COLORS.gray[400];
}

export default function HomeEmptyHeroLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>("brief");
  const [load, setLoad] = useState<Load>("free");

  const next = nextScheduleFor(load);
  const todayCount = todayCountFor(load);

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
              홈 · 히어로 + 신호 표현
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 변형 탭 */}
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(8) }}>
          <SegmentRow options={VARIANTS} value={variant} onChange={setVariant} />
        </View>

        {/* 시나리오(일정량) 토글 */}
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[500], marginBottom: s(6), marginLeft: s(2) }}>
            오늘 일정
          </Typography>
          <SegmentRow options={LOADS} value={load} onChange={setLoad} small />
        </View>
      </SafeAreaView>

      {/* 프리뷰 */}
      <View style={{ flex: 1, backgroundColor: COLORS.white }}>
        <HomeBlob />
        <ScrollView contentContainerStyle={{ paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
          <HomeHeaderBar />

          {variant === "current" ? (
            <CurrentContent load={load} next={next} todayCount={todayCount} />
          ) : (
            <>
              <HeroBlock load={load} />
              {next ? (
                <NextSessionCard sch={next} todayCount={todayCount} />
              ) : (
                <View style={{ marginTop: s(28), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
                  <UpcomingCard />
                </View>
              )}
              <SignalsSection form={variant} />
            </>
          )}

          <VerdictCaption variant={variant} />
        </ScrollView>
      </View>
    </View>
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
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: small ? s(6) : s(8),
              borderRadius: s(8),
              backgroundColor: active ? COLORS.white : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
              shadowColor: "#000",
              shadowOpacity: active ? 0.06 : 0,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 4,
              elevation: active ? 1 : 0,
            })}
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

/* ───────── 홈 배경 블롭 (production 재현) ───────── */

function HomeBlob() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="blobGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#DFFFF1" />
            <Stop offset="1" stopColor="#D9F5FF" />
          </SvgLinearGradient>
          <SvgRadialGradient id="blobFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgRadialGradient>
          <Mask id="blobMask">
            <Circle cx={s(187.83)} cy={s(71)} r={s(419)} fill="url(#blobFade)" />
          </Mask>
        </Defs>
        <Circle cx={s(187.83)} cy={s(71)} r={s(419)} fill="url(#blobGrad)" mask="url(#blobMask)" />
      </Svg>
    </View>
  );
}

/* ───────── 홈 헤더 바 ───────── */

function HomeHeaderBar() {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: s(28), height: s(28), borderRadius: s(8), backgroundColor: COLORS.primary500, alignItems: "center", justifyContent: "center", marginRight: s(8) }}>
          <Ionicons name="business" size={14} color={COLORS.white} />
        </View>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {CENTER_NAME}
        </Typography>
      </View>
      <View style={{ width: s(36), height: s(36), alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="notifications-outline" size={24} color={COLORS.gray[800]} />
      </View>
    </View>
  );
}

/* ───────── 히어로 블록 (이미지 영역 — 레이아웃 고정) ───────── */

function HeroBlock({ load }: { load: Load }) {
  const copy = heroCopy(load);
  return (
    <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(28), alignItems: "center" }}>
      <View style={{ alignItems: "center", justifyContent: "center", marginBottom: s(20) }}>
        <View
          style={{
            position: "absolute",
            width: s(180),
            height: s(180),
            borderRadius: s(90),
            backgroundColor: load === "busy" ? COLORS.primary100 : COLORS.primary50,
            opacity: 0.7,
          }}
        />
        <RestWithCoffeeIcon width={s(168)} height={s(149)} />
      </View>

      <Typography variant="body-02" weight="regular" style={{ color: COLORS.gray[600] }}>
        {DATE_STR}
      </Typography>
      <Typography variant="headline-01" weight="semibold" style={{ marginTop: s(6), color: COLORS.gray[900], textAlign: "center" }}>
        {copy.title}
      </Typography>
      <Typography variant="body-02" weight="regular" style={{ marginTop: s(8), color: COLORS.gray[500], textAlign: "center" }}>
        {copy.sub}
      </Typography>
    </View>
  );
}

/* ───────── 다음 일정 1건 카드 ───────── */

function NextSessionCard({ sch, todayCount }: { sch: MockSchedule; todayCount: number }) {
  return (
    <View style={{ marginTop: s(32), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <Typography variant="body-01" weight="semibold" style={{ color: COLORS.gray[900], marginBottom: s(12) }}>
        다음 일정
      </Typography>
      <Pressable
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(20),
          paddingVertical: s(16),
          paddingHorizontal: s(16),
          shadowColor: "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 16,
          elevation: 3,
          flexDirection: "row",
          alignItems: "flex-start",
        }}
        accessibilityRole="button"
        accessibilityLabel={`${sch.name} 일정 보기`}
      >
        <View style={{ width: s(56), alignItems: "center", paddingTop: s(4) }}>
          <Typography variant="body-01" weight="semibold" className="text-gray-900">
            {sch.start}
          </Typography>
          <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300], marginVertical: s(4) }} />
          <Typography variant="body-01" weight="regular" className="text-gray-500">
            {sch.end}
          </Typography>
        </View>
        <View style={{ width: 1, alignSelf: "stretch", backgroundColor: COLORS.gray[200], marginHorizontal: s(14) }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sch.category === "assessment" ? COLORS.assessment : COLORS.counseling, marginRight: s(8) }} />
            <Typography variant="body-01" weight="semibold" className="text-gray-900" style={{ flex: 1 }}>
              {sch.name}
            </Typography>
          </View>
          <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[600], marginTop: s(2), marginLeft: 6 + s(8) }}>
            {sch.meta}
          </Typography>
          <View style={{ marginTop: s(12) }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon name="location-20" size={s(20)} color={COLORS.gray[400]} />
              <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[800], marginLeft: s(6) }}>
                {sch.room}
              </Typography>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: s(4) }}>
              <Icon name="document-20" size={s(20)} color={COLORS.gray[400]} />
              <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[800], marginLeft: s(6) }}>
                {sch.program}
              </Typography>
            </View>
          </View>
        </View>
      </Pressable>
      {todayCount > 1 && (
        <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[500], marginTop: s(10), textAlign: "center" }}>
          오늘 일정 {todayCount}건 중 다음 일정이에요
        </Typography>
      )}
    </View>
  );
}

/** 빈 상태 — 다가오는(내일 이후) 일정 한 줄 */
function UpcomingCard() {
  return (
    <>
      <Typography variant="body-01" weight="semibold" style={{ color: COLORS.gray[900], marginBottom: s(12) }}>
        다가오는 일정
      </Typography>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.white,
          borderRadius: s(20),
          paddingVertical: s(16),
          paddingHorizontal: s(16),
          shadowColor: "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 16,
          elevation: 3,
        }}
        accessibilityRole="button"
        accessibilityLabel="다음 일정 보기"
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[600] }}>
            {UPCOMING.when}
          </Typography>
          <Typography variant="body-02" weight="semibold" style={{ marginLeft: s(8), color: COLORS.gray[900] }}>
            {UPCOMING.name}
          </Typography>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
      </Pressable>
    </>
  );
}

/* ───────── 신호 섹션 — 세 형태 ───────── */

function SignalsSection({ form }: { form: Exclude<Variant, "current"> }) {
  const [showAll, setShowAll] = useState(false);

  if (form === "priority") return <SignalsPriority />;

  const shown = showAll ? SIGNALS : SIGNALS.slice(0, 3);
  const remaining = SIGNALS.length - shown.length;

  return (
    <View style={{ marginTop: s(28), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <Typography variant="body-01" weight="semibold" style={{ color: COLORS.gray[900], marginBottom: s(12) }}>
        오늘 살펴볼 것들
      </Typography>

      {form === "brief" ? (
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(20),
            paddingHorizontal: s(16),
            shadowColor: "#000",
            shadowOpacity: 0.07,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 16,
            elevation: 3,
          }}
        >
          {shown.map((sig, idx) => (
            <SignalRow key={sig.id} sig={sig} emphasized={idx === 0} divider={idx > 0} />
          ))}
          <MoreToggle showAll={showAll} remaining={remaining} onPress={() => setShowAll((v) => !v)} />
        </View>
      ) : (
        <View>
          {shown.map((sig, idx) => (
            <SignalRow key={sig.id} sig={sig} emphasized={false} divider={idx > 0} bare />
          ))}
          <MoreToggle showAll={showAll} remaining={remaining} onPress={() => setShowAll((v) => !v)} bare />
        </View>
      )}
    </View>
  );
}

function SignalRow({
  sig,
  emphasized,
  divider,
  bare,
}: {
  sig: Signal;
  emphasized: boolean;
  divider: boolean;
  bare?: boolean;
}) {
  const color = toneColor(sig.tone);
  return (
    <Pressable
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: s(14),
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: COLORS.gray[100],
      }}
      accessibilityRole="button"
      accessibilityLabel={sig.label}
    >
      <Ionicons name={sig.icon} size={18} color={color} style={{ marginRight: s(10) }} />
      <Typography
        variant="body-02"
        weight={emphasized ? "semibold" : "medium"}
        style={{ flex: 1, color: emphasized ? COLORS.gray[900] : COLORS.gray[800] }}
      >
        {sig.label}
      </Typography>
      <Ionicons name="chevron-forward" size={16} color={COLORS.gray[400]} />
    </Pressable>
  );
}

function MoreToggle({
  showAll,
  remaining,
  onPress,
  bare,
}: {
  showAll: boolean;
  remaining: number;
  onPress: () => void;
  bare?: boolean;
}) {
  if (!showAll && remaining <= 0) return null;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: s(12),
        borderTopWidth: bare ? 0 : 1,
        borderTopColor: COLORS.gray[100],
      }}
      accessibilityRole="button"
      accessibilityLabel={showAll ? "접기" : "더보기"}
    >
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[500] }}>
        {showAll ? "접기" : `${remaining}건 더보기`}
      </Typography>
      <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={16} color={COLORS.gray[500]} style={{ marginLeft: s(2) }} />
    </Pressable>
  );
}

/* 우선순위: 1건만 크게 + 나머지 접기 */
function SignalsPriority() {
  const top = SIGNALS[0];
  const rest = SIGNALS.length - 1;
  const color = toneColor(top.tone);
  return (
    <View style={{ marginTop: s(28), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
      <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), padding: s(16) }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name={top.icon} size={20} color={color} style={{ marginRight: s(8) }} />
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.gray[900], flex: 1 }}>
            {top.label}
          </Typography>
        </View>
        <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[600], marginTop: s(6) }}>
          {top.detail}
        </Typography>
        <Pressable
          style={{
            alignSelf: "flex-start",
            marginTop: s(14),
            backgroundColor: COLORS.primary500,
            borderRadius: s(10),
            paddingVertical: s(10),
            paddingHorizontal: s(18),
          }}
          accessibilityRole="button"
          accessibilityLabel={top.cta}
        >
          <Typography variant="body-03" weight="medium" style={{ color: COLORS.white }}>
            {top.cta}
          </Typography>
        </Pressable>
      </View>

      <Pressable
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: s(14) }}
        accessibilityRole="button"
        accessibilityLabel={`살펴볼 것 외 ${rest}건`}
      >
        <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[500] }}>
          살펴볼 것 외 {rest}건
        </Typography>
        <Ionicons name="chevron-forward" size={16} color={COLORS.gray[500]} style={{ marginLeft: s(2) }} />
      </Pressable>
    </View>
  );
}

/* ───────── 변형 0: 현재(production) 재현 — 대조군 ───────── */

function CurrentContent({ load, next, todayCount }: { load: Load; next: MockSchedule | null; todayCount: number }) {
  return (
    <>
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(35), alignItems: "center" }}>
        <Typography variant="body-02" weight="regular" style={{ color: "#464F58" }}>
          {DATE_STR}
        </Typography>
        <Typography variant="headline-01" weight="semibold" style={{ marginTop: s(6), color: "#1D2227" }}>
          {PERSON_NAME}님, 좋은 오후예요
        </Typography>
      </View>

      {next === null ? (
        /* 현재 빈 상태 — 커피 일러스트 ('애매하다'고 한 지점) */
        <View style={{ alignItems: "center", paddingTop: s(83), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
          <RestWithCoffeeIcon width={s(160)} height={s(142)} />
          <Typography variant="body-01" weight="semibold" style={{ marginTop: s(38), color: COLORS.gray[600] }}>
            오늘은 등록된 일정이 없어요
          </Typography>
          <Typography variant="body-03" weight="regular" style={{ marginTop: s(6), textAlign: "center", color: "#7D848F" }}>
            웹에서 일정을 등록하면{"\n"}여기에 자동으로 표시됩니다
          </Typography>
        </View>
      ) : (
        <>
          {/* 현재 일정 카드 */}
          <View style={{ marginTop: s(64), paddingHorizontal: s(LAYOUT.screenPaddingX) }}>
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: s(20),
                paddingVertical: s(16),
                paddingHorizontal: s(16),
                shadowColor: "#000",
                shadowOpacity: 0.07,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 16,
                elevation: 3,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <View style={{ width: s(56), alignItems: "center", paddingTop: s(4) }}>
                <Typography variant="body-01" weight="semibold" className="text-gray-900">
                  {next.start}
                </Typography>
                <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300], marginVertical: s(4) }} />
                <Typography variant="body-01" weight="regular" className="text-gray-500">
                  {next.end}
                </Typography>
              </View>
              <View style={{ width: 1, alignSelf: "stretch", backgroundColor: COLORS.gray[200], marginHorizontal: s(14) }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary500, marginRight: s(8) }} />
                  <Typography variant="body-01" weight="semibold" className="text-gray-900" style={{ flex: 1 }}>
                    {next.name}
                  </Typography>
                </View>
                <Typography variant="body-03" weight="regular" style={{ color: COLORS.gray[600], marginTop: s(2), marginLeft: 6 + s(8) }}>
                  {next.meta}
                </Typography>
                <View style={{ marginTop: s(12) }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Icon name="location-20" size={s(20)} color={COLORS.gray[400]} />
                    <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[800], marginLeft: s(6) }}>
                      {next.room}
                    </Typography>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: s(4) }}>
                    <Icon name="document-20" size={s(20)} color={COLORS.gray[400]} />
                    <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[800], marginLeft: s(6) }}>
                      {next.program}
                    </Typography>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* 현재 신호 — 프로스티드 캡슐 칩 스택(가운데) */}
          <View style={{ height: s(24) }} />
          <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), alignItems: "center", gap: s(12) }}>
            {SIGNALS.slice(0, 3).map((sig) => (
              <View
                key={sig.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: COLORS.gray[200],
                  backgroundColor: COLORS.white,
                  paddingVertical: s(12),
                  paddingHorizontal: s(16),
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowOffset: { width: 0, height: 3 },
                  shadowRadius: 10,
                  elevation: 2,
                }}
              >
                <Ionicons name={sig.icon} size={16} color={toneColor(sig.tone)} style={{ marginRight: s(8) }} />
                <Typography variant="body-02" weight="medium" className="text-gray-800">
                  {sig.label}
                </Typography>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}

/* ───────── 하단 시안 판정 캡션 ───────── */

function VerdictCaption({ variant }: { variant: Variant }) {
  const text =
    variant === "current"
      ? "대조군 — 신호를 프로스티드 캡슐 칩으로 가운데 쌓음. 히어로 톤과 충돌, 정렬축 어긋남."
      : variant === "brief"
        ? "하나의 카드에 묶고 1순위만 살짝 강조 + 더보기. 흩뿌리지 않아 차분, 홈=발견(요약) 스펙과 맞음."
        : variant === "list"
          ? "박스 없이 행만 + 옅은 구분선. 가장 가볍고 N개로 확장 쉬움. 단 일반 TO DO 목록처럼 읽힐 수 있음."
          : "가장 중요한 1건만 크게(액션 버튼) + 나머지 접기. 가장 절제·친화적. 단 나머지 신호 가시성 낮음.";
  return (
    <View
      style={{
        marginTop: s(36),
        marginHorizontal: s(LAYOUT.screenPaddingX),
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
