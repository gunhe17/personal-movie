import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Image,
  InteractionManager,
  RefreshControl,
  type DimensionValue,
} from "react-native";
import Reanimated, {
  FadeIn,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useCenterStore } from "@/features/center";
import { useToastStore } from "@/features/toast";
import { useScheduleList } from "@/features/schedule";
import { useQueryClient } from "@tanstack/react-query";
import {
  useFieldNotes,
  useLinkSchedule,
  useFieldNotesByTask,
  getFieldNote,
  type FieldNoteResponse,
  type FieldNoteStatusItem,
} from "@/features/field-note";
import { effectiveDuration, nextChunkIndex } from "@/features/field-note/utils";
import {
  useCaseTasks,
  type AssessmentTaskResponse,
} from "@/features/assessment";
import { FieldNoteListContent } from "@/features/field-note/components/FieldNoteListContent";
import { FieldNoteConfirmModal } from "@/features/field-note/components/FieldNoteConfirmModal";
import { RecordTargetSheet } from "@/features/field-note/components/RecordTargetSheet";
import type { RecordingContext } from "@/features/field-note/components/RecordingSheet";
import { AnalyzingPulseDot } from "@/features/field-note/components/AnalyzingIndicator";
import { useFieldNoteFabBehavior } from "@/features/field-note/useFieldNoteFabBehavior";
import { useDarkNavBarOnFocus } from "@/features/field-note/useFieldNoteNavBar";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon, type IconName } from "@/shared/components/icons";
import { parseDate } from "@/shared/utils/date";
import { useFadeIn } from "@/shared/hooks/useFadeIn";
import { s } from "@/shared/utils/scale";
import FieldnoteMic from "@assets/FieldnoteMic.svg";
import RecordingIcon from "@assets/RecordingIcon.svg";
import NoScheduleFieldnote from "@assets/NoScheduleFieldnote.png";
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Text as SvgText,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

/**
 * 필드노트 홈 — FAB 진입점. 토스 '증권' 패턴의 sub-app 공간.
 *
 * 필드노트를 '액션'이 아니라 '도착하는 장소'로 승격. 다크 몰입 스킨 + 플로팅 바텀 네비
 * `[←] 홈 · ◉녹음 · 노트` 로 글로벌 탭바를 대체. 홈/노트는 in-place 전환(라우트 이동 아님),
 * 가운데 녹음은 항상 1탭, ← 로 메인 복귀.
 *
 *  · 홈   = 오늘 회기(useScheduleList) + 진행 중/최근(useFieldNotes). 회기 '녹음'은 그 회기에
 *           연결해 시작(start(undefined, scheduleId)).
 *  · 노트 = FieldNoteListContent(embedded) — 전체 목록(필터+리스트), 카드 탭은 상세 라우트.
 *
 * ⚠️ 중앙 오브는 브랜드 placeholder — 추후 3D 일러스트 에셋으로 교체 예정.
 */

const FN = COLORS.fieldnoteDark;
// 진행 중('지금') 일정 카드 — 블루→시안 그라데이션 보더 + 보라 글로우(이미지4).
const NOW_BORDER_GRADIENT = ["#4486FF", "#00C2E5"] as const;
const NOW_GLOW = "#C286FF"; // drop shadow #C286FF 20%
// '지금' 시간 텍스트 — 이미지4 그라데이션(#5CCBFF→#C4C3FF→#D9C2FF)의 중간색.
// (RN 그라데이션 텍스트는 masked-view 필요 — 코드베이스 전례대로 mid-color로 대체)
const TIME_NOW_COLOR = "#A8C5FF";
// 필드노트 홈 전용 색 오버라이드(글로벌 다크 토큰과 분리 — 홈에서만 적용).
const HOME_BG = "#171717"; // 홈 페이지 배경
const HOME_CARD = "#1D2227"; // 오늘 일정·최근 노트 카드 배경
// 진행 중('지금') 카드 배경 — #B7C8FF 16%(이미지5)를 HOME_BG(#171717) 위에 미리 합성한 불투명색.
// (그라데이션 보더가 카드 뒤에 깔리는 구조라 카드를 반투명으로 두면 그라데이션이 비침 → 불투명 합성값 사용)
const NOW_CARD_BG = "#31333C";
const HOME_COUNT = "#648AE3"; // "오늘 기록할 일정 N건"의 N건 색
// 오늘 일정 카드 액션 버튼 — 미녹음=녹음 시작(블루) / 분석완료=분석 보기(다크).
const REC_BTN_BG = "#4B7BEC";
const VIEW_BTN_BG = "#363B45";
const VIEW_BTN_TX = "#D8DCE4";
// 플로팅 네비(뒤로가기·탭 pill) — 흰 8% 프로스티드(블러 위) + 흰 림 + 딥네이비 드롭섀도.
const NAV_BG = "rgba(255,255,255,0.12)"; // 글래스 필 — 블러 위 흰 12%(8%는 너무 비쳐 형체만 보이게 상향)
const NAV_BORDER = "rgba(255,255,255,0.2)"; // inner shadow #FFFFFF 30% 근사(림 라이트)
const NAV_SHADOW = "#000000"; // 무채색 드롭섀도(색감 없는 글래스 — 이미지9)

function fmtTime(iso: string): string {
  try {
    return format(parseDate(iso), "HH:mm");
  } catch {
    return "--:--";
  }
}
/** 시작~종료 시간 범위 (예: "09:00 - 10:00"). */
function fmtTimeRange(start: string, end: string): string {
  return `${fmtTime(start)} - ${fmtTime(end)}`;
}

// 진행 중('지금') 카드 시간 — 시안→블루 그라데이션 (이미지8). RN 텍스트 그라데이션은
// SVG <Text> 의 gradient fill 로 처리(masked-view 미설치). objectBoundingBox 라 텍스트 폭에 자동 맞춤.
const TIME_GRADIENT = ["#00C2E5", "#4486FF"] as const;
/** 카드 시간 텍스트 — 기본은 body-03 medium 단색, 진행 중이면 시안→블루 그라데이션. */
function CardTime({
  start,
  end,
  gradient,
  color,
}: {
  start: string;
  end: string;
  gradient: boolean;
  color: string;
}) {
  const text = fmtTimeRange(start, end);
  if (!gradient) {
    return (
      <Typography variant="body-03" weight="medium" style={{ color }}>
        {text}
      </Typography>
    );
  }
  return (
    <Svg width={s(120)} height={s(20)}>
      <Defs>
        <SvgLinearGradient id="cardTimeGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={TIME_GRADIENT[0]} />
          <Stop offset="1" stopColor={TIME_GRADIENT[1]} />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        fill="url(#cardTimeGrad)"
        fontSize={s(14)}
        fontWeight="500"
        x={0}
        y={s(15)}
      >
        {text}
      </SvgText>
    </Svg>
  );
}
/** "2026년 06월 12일 (수)" — 최근 노트 카드 날짜 표기. */
function fmtDateKo(iso: string): string {
  try {
    return format(parseDate(iso), "yyyy년 MM월 dd일 (E)", { locale: ko });
  } catch {
    return "";
  }
}
/** 필드노트 라벨 — "필드노트 N" (순번 없으면 폴백). */
function noteNumberLabel(n: FieldNoteResponse): string {
  return n.note_number != null ? `필드노트 ${n.note_number}` : "필드노트";
}
function clientLabel(names: string[] | undefined): string {
  if (!names || names.length === 0) return "내담자";
  return names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0];
}
function formatDurKor(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = Math.floor(sec % 60);
  if (m === 0) return `${r}초`;
  if (r === 0) return `${m}분`;
  return `${m}분 ${r}초`;
}
// 이른 녹음 컨펌 — 회기 시작까지 이 시간 이상 남았으면 바로 시작하지 않고 확인을 거친다.
// (내담자 조기 도착 등 정상 케이스가 있어 차단이 아니라 확인. 진행 중·임박 회기는 그대로 1탭 시작.)
const EARLY_RECORD_CONFIRM_MS = 30 * 60 * 1000;
function formatRemainKo(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${Math.max(m, 1)}분`;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/**
 * 오늘 회기 카드의 상태 라벨.
 * @param isLive 이 노트가 '지금 실제로 진행 중인' 녹음인지(전역 녹음 스토어의 활성 노트와 일치).
 *   라이브일 때만 진행 녹음으로 돌아가는 라벨을 보여준다 — 진행 중('녹음 중', 빨강)과
 *   일시정지('이어서 녹음', 앰버)를 구분. 둘 다 탭하면 녹음 시트로 복귀.
 *   status가 recording/paused여도 라이브가 아니면(중단·앱 종료된 미완료) 오해 없게 '저장됨' 처리.
 */
function noteStateMeta(
  note: FieldNoteResponse | undefined,
  isLive = false,
  isPaused = false,
) {
  // 라이브 판정은 전역 녹음 스토어 기준 — 목록에 노트가 아직 안 들어와도(생성 직후) 표시돼야 하므로
  // note 유무보다 먼저 본다.
  if (isLive)
    return isPaused
      ? { label: "이어서 녹음", color: COLORS.warning }
      : { label: "녹음 중", color: COLORS.error };
  if (!note) return null;
  if (note.status === "recording" || note.status === "paused")
    return { label: "저장됨", color: FN.sub };
  if (note.processing_status === "processing")
    return { label: "전사 중", color: FN.accent };
  if (note.processing_status === "completed")
    return { label: "분석완료", color: COLORS.palette.green };
  if (note.processing_status === "failed")
    return { label: "실패", color: COLORS.error };
  return { label: "저장됨", color: FN.sub };
}

/**
 * 헤드라인 우측 히어로 일러스트 — RecordingIcon(카드+돋보기 마이크) 뒤에
 * 옅은 사이언 방사형 글로우(#4BEAFF, Figma: 원 8% + blur 146)를 깔아 다크 배경에서 살짝 떠 보이게.
 */
const HERO_W = 120;
const HERO_H = Math.round((HERO_W * 126) / 113); // RecordingIcon 종횡비(113:126)
const HERO_GLOW_W = 340; // 사이언 글로우 가로 범위
const HERO_GLOW_H = 345; // 사이언 글로우 세로 범위
function HomeHeroArt() {
  return (
    <View
      style={{
        width: s(HERO_W),
        height: s(HERO_H),
        alignItems: "center",
        justifyContent: "center",
        // 아이콘을 화면 오른쪽에서 26px 떨어뜨림 (ScrollView 좌우 패딩 16 + 추가 10)
        marginRight: s(10),
      }}
    >
      <RecordingIcon width={s(HERO_W)} height={s(HERO_H)} />
    </View>
  );
}

/** 헤드라인 우측 — 오늘 예정된 일정이 없을 때 표시하는 일러스트 */
const NO_SCHEDULE_W = 120;
const NO_SCHEDULE_H = Math.round((NO_SCHEDULE_W * 352) / 398); // NoScheduleFieldnote 종횡비(398:352)
function NoScheduleArt() {
  return (
    <View
      style={{
        width: s(NO_SCHEDULE_W),
        height: s(HERO_H),
        alignItems: "center",
        justifyContent: "center",
        marginRight: s(10),
      }}
    >
      <Image
        source={NoScheduleFieldnote}
        style={{ width: s(NO_SCHEDULE_W), height: s(NO_SCHEDULE_H) }}
        resizeMode="contain"
      />
    </View>
  );
}

/**
 * 히어로 사이언 글로우 — 페이지 배경 레이어(absolute)로 띄워 헤더↔스크롤 경계를 가로질러
 * 자연스럽게 번지게 한다. (HomeHeroArt 안에 두면 ScrollView 가 상단에서 잘라 직선으로 보임)
 * top 은 호출부에서 safe-area inset 기준으로 전달해 히어로 아이콘 위치에 대략 맞춘다.
 */
function HomeHeroGlow({ top }: { top: number }) {
  return (
    <Svg
      width={s(HERO_GLOW_W)}
      height={s(HERO_GLOW_H)}
      style={{ position: "absolute", top, right: s(-84) }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="fnHeroGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#4BEAFF" stopOpacity={0.16} />
          <Stop offset="0.55" stopColor="#4BEAFF" stopOpacity={0.045} />
          <Stop offset="1" stopColor="#4BEAFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={s(HERO_GLOW_W)}
        height={s(HERO_GLOW_H)}
        fill="url(#fnHeroGlow)"
      />
    </Svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="label-01"
      weight="semibold"
      style={{ marginTop: s(18), marginBottom: s(8), color: FN.sub }}
    >
      {children}
    </Typography>
  );
}

/**
 * 오늘 일정 카드 셸 — 진행 중('지금')이면 그라데이션 보더 + 보라 글로우(이미지3),
 * 그 외엔 평면 카드(지난 회기는 흐리게).
 */
function ScheduleCardShell({
  emphasized,
  dimmed,
  children,
}: {
  emphasized: boolean;
  dimmed: boolean;
  children: React.ReactNode;
}) {
  // 그라데이션 보더 링은 fade-in — 불투명 카드를 항상 base 로 두고, 활성일 때만 보더/글로우를
  // 마운트 후 부드럽게 띄운다(첫 렌더 시 LinearGradient 전체-칠 플래시 제거).
  const ring = useSharedValue(emphasized ? 0 : 0);
  useEffect(() => {
    ring.value = withTiming(emphasized ? 1 : 0, { duration: 280 });
  }, [emphasized, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));

  return (
    <View
      style={{
        position: "relative",
        opacity: !emphasized && dimmed ? 0.55 : 1,
      }}
    >
      {/* 그라데이션 보더 링 — 카드보다 1px 크게 뒤에 깔고(가장자리 1px만 노출) opacity fade-in */}
      {emphasized ? (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: -1,
              left: -1,
              right: -1,
              bottom: -1,
              borderRadius: s(15),
              shadowColor: NOW_GLOW,
              shadowOpacity: 0.2,
              shadowRadius: 12.2,
              shadowOffset: { width: 0, height: 0 },
            },
            ringStyle,
          ]}
        >
          <LinearGradient
            colors={NOW_BORDER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, borderRadius: s(15) }}
          />
        </Reanimated.View>
      ) : null}
      {/* 불투명 카드(base) — 즉시 페인트라 다른 카드와 동일하게 보임. 높이는 자식(헤더 78)이 결정.
          진행 중('지금')이면 #B7C8FF 16% 합성 틴트(NOW_CARD_BG), 그 외 일반 카드색. */}
      <View
        style={{
          borderRadius: s(14),
          backgroundColor: emphasized ? NOW_CARD_BG : HOME_CARD,
          paddingHorizontal: s(14),
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * 높이 슬라이드 accordion — withTiming 으로 height 를 연속 보간(매 프레임 re-layout →
 * 왼쪽 타임라인 바·아래 카드가 자연스럽게 따라옴). inner 를 absolute 로 빼 자연 높이를
 * 측정(Fabric 에서 height:0 컨테이너에 안 갇히게 — 측정 0 버그 회피). open 시 mount /
 * close 애니메이션 후 unmount → 검사 task 지연 로드 유지.
 */
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const animH = useSharedValue(0);
  const measured = useRef(0);
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      if (measured.current > 0)
        animH.value = withTiming(measured.current, { duration: 280 });
    } else {
      animH.value = withTiming(0, { duration: 220 }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
  }, [open, animH]);
  const aStyle = useAnimatedStyle(() => ({ height: animH.value }));
  if (!mounted) return null;
  return (
    <Reanimated.View style={[aStyle, { overflow: "hidden" }]}>
      <View
        style={{ position: "absolute", left: 0, right: 0, top: 0 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - measured.current) > 0.5) {
            measured.current = h;
            if (open) animH.value = withTiming(h, { duration: 280 });
          }
        }}
      >
        {children}
      </View>
    </Reanimated.View>
  );
}

/** 펼침 화살표 — open 0→1 에 따라 chevron-down 을 0→180° 회전. */
function AnimatedChevron({ open, color }: { open: boolean; color: string }) {
  const rot = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    rot.value = withTiming(open ? 1 : 0, { duration: 240 });
  }, [open, rot]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rot.value, [0, 1], [0, 180])}deg` }],
  }));
  return (
    <Reanimated.View style={aStyle}>
      <Ionicons name="chevron-down" size={s(18)} color={color} />
    </Reanimated.View>
  );
}

type TaskFn =
  | "na"
  | "unlinked"
  | "recording"
  | "analyzing"
  | "analyzed"
  | "recorded";
/** 검사 task 의 필드노트 상태 — by-task 노트 목록에서 도출. */
function deriveTaskFn(
  notes: FieldNoteStatusItem[] | undefined,
  online: boolean,
): { state: TaskFn; noteId: string | null } {
  if (online) return { state: "na", noteId: null };
  if (!notes || notes.length === 0) return { state: "unlinked", noteId: null };
  const rec = notes.find(
    (n) => n.status === "recording" || n.status === "paused",
  );
  if (rec) return { state: "recording", noteId: rec.id };
  const proc = notes.find((n) => n.processing_status === "processing");
  if (proc) return { state: "analyzing", noteId: proc.id };
  const done = notes.find((n) => n.processing_status === "completed");
  if (done) return { state: "analyzed", noteId: done.id };
  return { state: "recorded", noteId: notes[0].id };
}

interface TaskActions {
  onRecordTask: (taskId: string, context: RecordingContext) => void;
  onOpenNote: (noteId: string) => void;
  onOpenSheet: () => void;
}

/** 검사 task 한 줄 — 검사명 + 필드노트 상태/액션 (§3-4-2). by-task 노트는 펼침 시에만 조회(지연). */
function TaskFnRow({
  centerId,
  task,
  clientName,
  actions,
}: {
  centerId: string | null;
  task: AssessmentTaskResponse;
  clientName: string;
  actions: TaskActions;
}) {
  const online = task.execution_method === "online";
  const { data: notes } = useFieldNotesByTask(centerId, task.id, !online);
  const { state, noteId } = deriveTaskFn(notes, online);
  const name = task.assessment?.kor_name ?? "검사";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(8),
        paddingVertical: s(8),
      }}
    >
      <View
        style={{
          width: s(5),
          height: s(5),
          borderRadius: s(3),
          backgroundColor: online ? FN.sub : COLORS.assessment,
        }}
      />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: online ? FN.sub : FN.text, flex: 1 }}
        numberOfLines={1}
      >
        {name}
      </Typography>
      {state === "na" ? (
        <Typography variant="label-02" style={{ color: FN.sub }}>
          온라인 · 녹음 안 함
        </Typography>
      ) : state === "unlinked" ? (
        <Pressable
          onPress={() =>
            actions.onRecordTask(task.id, {
              client: clientName,
              sub: name,
              kind: "assessment",
            })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(4),
            backgroundColor: REC_BTN_BG,
            borderRadius: s(999),
            paddingHorizontal: s(11),
            paddingVertical: s(6),
          }}
        >
          <Ionicons name="mic" size={s(12)} color={COLORS.white} />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            녹음 연결
          </Typography>
        </Pressable>
      ) : state === "recording" ? (
        <Pressable
          onPress={actions.onOpenSheet}
          hitSlop={6}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(4),
            paddingHorizontal: s(7),
            paddingVertical: s(2),
            borderRadius: s(8),
            backgroundColor: COLORS.error + "1F",
          }}
        >
          <AnalyzingPulseDot color={COLORS.error} size={s(5)} />
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: COLORS.error }}
          >
            녹음중
          </Typography>
        </Pressable>
      ) : state === "analyzing" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(4),
            paddingHorizontal: s(7),
            paddingVertical: s(2),
            borderRadius: s(8),
            backgroundColor: FN.accent + "1F",
          }}
        >
          <AnalyzingPulseDot size={s(5)} />
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: FN.accent }}
          >
            분석중
          </Typography>
        </View>
      ) : (
        <Pressable
          onPress={() => noteId && actions.onOpenNote(noteId)}
          hitSlop={6}
          style={{ flexDirection: "row", alignItems: "center", gap: s(3) }}
        >
          <Ionicons
            name={state === "analyzed" ? "sparkles" : "document-text-outline"}
            size={s(12)}
            color={FN.accent}
          />
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: FN.accent }}
          >
            {state === "analyzed" ? "분석 보기" : "노트 보기"}
          </Typography>
          <Ionicons name="chevron-forward" size={s(12)} color={FN.accent} />
        </Pressable>
      )}
    </View>
  );
}

/** 검사 세션 펼침 — case 의 task 들을 지연 조회해 검사별 필드노트 행으로. */
/** 검사 task 백그라운드 프리페치(렌더 null) — 펼치기 전 미리 캐싱해 첫 펼침 지연 제거. */
function TaskPrefetch({
  centerId,
  caseId,
}: {
  centerId: string | null;
  caseId: string;
}) {
  useCaseTasks(centerId, caseId);
  return null;
}

/** 검사 카드 부제 — 검사가 여러 개면 "첫검사 외 N개"(프리페치된 task 사용). + 상담실. */
function AssessmentSubtitle({
  centerId,
  caseId,
  room,
  fallback,
}: {
  centerId: string | null;
  caseId: string;
  room: string | null;
  fallback: string;
}) {
  const { data: tasks } = useCaseTasks(centerId, caseId);
  let label = fallback;
  if (tasks && tasks.length > 0) {
    const first = tasks[0].assessment?.kor_name ?? "검사";
    label = tasks.length > 1 ? `${first} 외 ${tasks.length - 1}개` : first;
  }
  const text = [label, room].filter(Boolean).join(" · ");
  return (
    <Typography
      variant="caption-01"
      style={{ color: FN.sub }}
      numberOfLines={1}
    >
      {text}
    </Typography>
  );
}

function AssessmentTaskList({
  centerId,
  caseId,
  clientName,
  actions,
}: {
  centerId: string | null;
  caseId: string;
  clientName: string;
  actions: TaskActions;
}) {
  const { data: tasks, isLoading } = useCaseTasks(centerId, caseId);
  if (isLoading) {
    return (
      <Typography
        variant="label-01"
        style={{ color: FN.sub, paddingVertical: s(10) }}
      >
        검사 불러오는 중…
      </Typography>
    );
  }
  if (!tasks || tasks.length === 0) {
    return (
      <Typography
        variant="label-01"
        style={{ color: FN.sub, paddingVertical: s(10) }}
      >
        검사 항목이 없어요
      </Typography>
    );
  }
  return (
    <>
      {tasks.map((t, i) => (
        <Reanimated.View
          key={t.id}
          entering={FadeIn.duration(200).delay(i * 40)}
        >
          <TaskFnRow centerId={centerId} task={t} clientName={clientName} actions={actions} />
        </Reanimated.View>
      ))}
    </>
  );
}

/** 완전 신규(노트 0건) 첫 진입 온보딩 — 가치 헤드라인 + 서브카피 + 일러스트 + 기능 카드(이미지17). */
// 아이콘은 완성형 컬러 SVG(MicIcon24 / AiIcon24 / JournalIcon24) — color prop 무시.
const FIRST_TIME_FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "mic-24",
    title: "실시간 녹취",
    desc: "상담 내용을 놓치지 않고 기록해요",
  },
  {
    icon: "ai-24",
    title: "AI 핵심 분석",
    desc: "중요한 내용을 빠르게 요약해요",
  },
  {
    icon: "journal-24",
    title: "상담일지 초안 작성",
    desc: "요약 내용을 기반으로 상담일지 초안을 작성해요",
  },
];
function FirstTimeGuide({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ alignItems: "center", marginTop: s(12) }}>
      <Typography
        variant="headline-01"
        weight="semibold"
        style={{ color: FN.text, textAlign: "center" }}
      >
        현장의 소리를 담는
      </Typography>
      <Typography
        variant="headline-01"
        weight="semibold"
        style={{ color: FN.text, textAlign: "center" }}
      >
        필드노트
      </Typography>
      <Typography
        variant="body-02-reading"
        weight="regular"
        style={{ color: "#F5F7F8", textAlign: "center", marginTop: s(14) }}
      >
        녹취부터 분석, 일지 초안 작성까지 한 번에.
      </Typography>
      <Typography
        variant="body-02-reading"
        weight="regular"
        style={{ color: "#F5F7F8", textAlign: "center" }}
      >
        상담사는 상담에만 집중하세요
      </Typography>
      {/* 3D 마이크 일러스트 + 뒤 은은한 방사형 글로우(#1BFFE4). Figma: 원 8%+blur 146 → radial gradient 로 동일 효과 */}
      <View
        style={{
          marginTop: s(24),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={s(600)}
          height={s(600)}
          style={{ position: "absolute" }}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="fnMicGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#1BFFE4" stopOpacity={0.1} />
              <Stop offset="0.55" stopColor="#1BFFE4" stopOpacity={0.025} />
              <Stop offset="1" stopColor="#1BFFE4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={s(600)}
            height={s(600)}
            fill="url(#fnMicGlow)"
          />
        </Svg>
        <FieldnoteMic width={s(150)} height={s(176)} />
      </View>
      {/* 기능 카드 — 실시간 녹취 / AI 핵심 분석 / 상담일지 초안 작성 */}
      <View
        style={{
          width: "100%",
          backgroundColor: "#292E3B",
          borderRadius: s(16),
          paddingHorizontal: s(18),
          paddingVertical: s(20),
          marginTop: s(24),
          gap: s(18),
        }}
      >
        {FIRST_TIME_FEATURES.map((f) => (
          <View
            key={f.title}
            style={{ flexDirection: "row", alignItems: "center", gap: s(12) }}
          >
            <Icon name={f.icon} size={s(24)} />
            <View style={{ flex: 1 }}>
              <Typography
                variant="body-02"
                weight="semibold"
                style={{ color: FN.text }}
              >
                {f.title}
              </Typography>
              <Typography
                variant="body-03"
                style={{ color: FN.sub, marginTop: s(3), lineHeight: s(19) }}
              >
                {f.desc}
              </Typography>
            </View>
          </View>
        ))}
      </View>
      {/* 녹음 시작하기 — 기능 카드 바로 아래 전체폭 버튼.
          내담자 상세 ContactButton 과 동일: style 객체에 배경/높이 직접 지정 + 내용 중앙 정렬. */}
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="녹음 시작하기"
        style={{
          width: "100%",
          height: 52,
          marginTop: 36,
          borderRadius: s(16),
          backgroundColor: "#3072ED",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.white }}
        >
          녹음 시작하기
        </Typography>
      </Pressable>
    </View>
  );
}

/** 플로팅 네비 탭(홈/노트) — 활성 시 scale 팝 + 누름 피드백. */
function NavTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
    wasActive.current = active;
  }, [active, scale]);
  const color = active ? COLORS.white : "#9BA3AE";
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 200,
          useNativeDriver: true,
        }).start()
      }
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : {}}
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: s(10),
        paddingVertical: s(6),
      }}
    >
      <Animated.View
        style={{ alignItems: "center", gap: s(2), transform: [{ scale }] }}
      >
        <Icon name={icon} size={s(20)} color={color} />
        <Typography
          variant="caption-01"
          weight={active ? "semibold" : "regular"}
          style={{ color }}
        >
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

/** 가운데 녹음 버튼 — 그라데이션 + 글로우 + 은은한 펄스 halo + 누름 피드백으로 주 액션 강조. */
/** 파형 — 녹음 중(animating)엔 흰 바가 오르내리고, 정지(일시정지)엔 멈춘 정지 파형. */
const STATIC_BARS = [0.5, 0.85, 0.6, 0.9];
function MicBars({ animating = true }: { animating?: boolean }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.45))).current;
  useEffect(() => {
    if (!animating) {
      bars.forEach((b, i) => b.setValue(STATIC_BARS[i]));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, {
            toValue: 1,
            duration: 320 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.45,
            duration: 320 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars, animating]);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: s(3),
        height: s(22),
      }}
    >
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: s(3),
            height: s(20),
            borderRadius: s(2),
            backgroundColor: COLORS.white,
            transform: [{ scaleY: b }],
          }}
        />
      ))}
    </View>
  );
}

// 가운데 녹음 버튼 — 54×54. 그라데이션은 5.5px 링으로만(좌상→우하), 가운데는 어두운 빈 코어.
// 코어 안에 재생/정지 아이콘·녹음 중 파형 애니메이션이 들어간다.
const REC_SIZE = 54;
const REC_RING_W = 5.5; // 그라데이션 링 두께
const REC_CORE = REC_SIZE - REC_RING_W * 2; // 43 — 링 안쪽 빈 코어 지름
const REC_RING_GRADIENT = ["#00C2E5", "#4486FF"] as const; // 링 그라데이션 시안→블루 (좌상 → 우하, FAB 팔레트)
const REC_CORE_BG = "#1B2233"; // 코어(빈 가운데) 배경 — 어두운 네이비

/** 흰색 필드노트 물결 — 가운데 녹음 버튼 기본 상태 아이콘 (Fieldnote_Wave 를 흰색 fill 로). */
function WhiteWave() {
  return (
    <Svg width={s(22)} height={s(15)} viewBox="0 0 16 11">
      <Path
        d="M2.94627 5.15604C2.94627 5.96963 2.28672 6.62918 1.47313 6.62918C0.659545 6.62918 0 5.96963 0 5.15604C0 4.34245 0.659545 3.68291 1.47313 3.68291C2.28672 3.68291 2.94627 4.34245 2.94627 5.15604Z"
        fill="#FFFFFF"
      />
      <Path
        d="M4.0266 1.47314C4.0266 0.659545 4.68615 0 5.49974 0C6.31333 0 6.97287 0.659545 6.97287 1.47314V8.83881C6.97287 9.6524 6.31333 10.3119 5.49974 10.3119C4.68615 10.3119 4.0266 9.6524 4.0266 8.83881V1.47314Z"
        fill="#FFFFFF"
      />
      <Path
        d="M8.05311 2.94619C8.05311 2.1326 8.71265 1.47305 9.52624 1.47305C10.3398 1.47305 10.9994 2.1326 10.9994 2.94619V7.36559C10.9994 8.17918 10.3398 8.83873 9.52624 8.83873C8.71265 8.83873 8.05311 8.17918 8.05311 7.36559V2.94619Z"
        fill="#FFFFFF"
      />
      <Path
        d="M15.0259 5.15604C15.0259 5.96963 14.3664 6.62918 13.5528 6.62918C12.7392 6.62918 12.0797 5.96963 12.0797 5.15604C12.0797 4.34245 12.7392 3.68291 13.5528 3.68291C14.3664 3.68291 15.0259 4.34245 15.0259 5.15604Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function RecordButton({
  active,
  paused,
  onPress,
}: {
  active: boolean;
  paused: boolean;
  onPress: () => void;
}) {
  const press = useRef(new Animated.Value(1)).current;
  const live = active && !paused; // 실제 녹음 중(일시정지 아님)
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(press, {
          toValue: 0.92,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(press, {
          toValue: 1,
          friction: 5,
          tension: 200,
          useNativeDriver: true,
        }).start()
      }
      accessibilityRole="button"
      accessibilityLabel={active ? "녹음 시트 열기" : "바로 녹음"}
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: s(6),
      }}
    >
      <Animated.View
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginTop: s(-18),
          transform: [{ scale: press }],
        }}
      >
        {/* 그라데이션 링(5.5px) — 안쪽 코어를 어둡게 덮어 링만 보이게 */}
        <LinearGradient
          colors={REC_RING_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: s(REC_SIZE),
            height: s(REC_SIZE),
            borderRadius: s(REC_SIZE / 2),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: s(REC_CORE),
              height: s(REC_CORE),
              borderRadius: s(REC_CORE / 2),
              backgroundColor: REC_CORE_BG,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 녹음 중: 파형 애니메이션 / 일시정지·대기: 필드노트 물결 아이콘(FAB와 동일) */}
            {live ? (
              <MicBars animating />
            ) : (
              <WhiteWave />
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

/** 등장 시 staggered 페이드인 래퍼 (움직임 없이 제자리 등장). index 로 순서 지정. */
function FadeInView({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const anim = useFadeIn(index);
  return <Animated.View style={anim}>{children}</Animated.View>;
}

function SkelBox({
  w,
  h,
  r = s(8),
  mt = 0,
}: {
  w: DimensionValue;
  h: number;
  r?: number;
  mt?: number;
}) {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        backgroundColor: FN.card,
        opacity: 0.5,
        marginTop: mt,
      }}
    />
  );
}

/**
 * 로딩 스켈레톤 — 네이티브 전환은 즉시 끝나 이 스켈레톤이 '도착'해 있고,
 * 전환 완료 + 데이터 도착이 모두 끝나면 실제 콘텐츠가 페이드인으로 교체된다.
 * (전환 속도와 등장 연출을 분리 — 슬라이드 중 콘텐츠가 같이 움직여 느려 보이던 문제 해소.)
 */
function HomeSkeleton({ navClear }: { navClear: number }) {
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: s(16),
        paddingTop: s(56), // 떠있는 헤더(48) + 기존 여백(8)
        paddingBottom: navClear,
      }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* 히어로 오브 자리 */}
      <View style={{ alignItems: "center", paddingVertical: s(24) }}>
        <View
          style={{
            width: s(88),
            height: s(88),
            borderRadius: s(44),
            backgroundColor: FN.card,
            opacity: 0.5,
          }}
        />
      </View>
      {/* 헤드라인 */}
      <SkelBox w="70%" h={s(26)} mt={s(6)} />
      <SkelBox w="48%" h={s(26)} mt={s(8)} />
      {/* 체크 라인 */}
      <SkelBox w="82%" h={s(14)} mt={s(16)} />
      <SkelBox w="68%" h={s(14)} mt={s(8)} />
      {/* 오늘 일정 */}
      <SkelBox w={s(56)} h={s(13)} mt={s(24)} />
      <View style={{ gap: s(8), marginTop: s(8) }}>
        <SkelBox w="100%" h={s(56)} r={s(14)} />
        <SkelBox w="100%" h={s(56)} r={s(14)} />
      </View>
      {/* 최근 노트 */}
      <SkelBox w={s(56)} h={s(13)} mt={s(24)} />
      <View style={{ gap: s(8), marginTop: s(8) }}>
        <SkelBox w="100%" h={s(56)} r={s(14)} />
        <SkelBox w="100%" h={s(56)} r={s(14)} />
      </View>
    </ScrollView>
  );
}

export default function FieldNoteHomeScreen() {
  useDarkNavBarOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const centerId = useCenterStore((s) => s.centerId);
  const showToast = useToastStore((s) => s.show);
  const today = useMemo(() => new Date(), []);
  const fab = useFieldNoteFabBehavior();
  const linkMutation = useLinkSchedule(centerId, fab.fieldNoteId);
  const [view, setView] = useState<"home" | "notes">("home");
  // 완전 신규 온보딩(FirstTimeGuide)에서 "녹음 시작하기"를 누르면 인트로를 닫고
  // 실제 필드노트 홈(기능 화면)으로 진입한다. 데이터 판정(isFirstTime)과 분리.
  const [introDismissed, setIntroDismissed] = useState(false);

  // 페이지 전환(네이티브 슬라이드)이 끝난 시점 — 이때까지 페이드인을 미뤄
  // 슬라이드와 등장 연출이 겹쳐 느려 보이던 걸 막는다. (캐시 진입에도 동일하게 빠름)
  const [transitionReady, setTransitionReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() =>
      setTransitionReady(true),
    );
    return () => handle.cancel();
  }, []);

  const {
    data: schedules,
    isLoading: schLoading,
    refetch: refetchSchedules,
  } = useScheduleList(centerId, today);
  // 노트탭(FieldNoteListContent)과 동일 파라미터로 단일 캐시 공유 — 홈 '최근 노트'와 노트탭 목록이
  // 같은 fetch/신선도를 쓰게 해 삭제·갱신이 양쪽에 항상 동일하게 반영된다(쿼리키가 params 포함).
  const {
    data: notesPage,
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useFieldNotes(centerId, { size: 50 });
  const notes = notesPage?.items ?? [];

  // 당겨서 새로고침 — 오늘 회기 + 노트 동시 refetch. 빠른 캐시 새로고침은 스피너 명멸로
  // 시야를 방해해 최소 표시시간(600ms)으로 부드럽게(노트 목록과 동일 패턴).
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSchedules(),
      refetchNotes(),
      new Promise((r) => setTimeout(r, 600)),
    ]);
    setRefreshing(false);
  }, [refetchSchedules, refetchNotes]);

  // 전환이 끝나고(transitionReady) 데이터도 도착해야(!loading) 콘텐츠를 페이드인.
  // 그 전엔 HomeSkeleton 을 보여줘 슬라이드가 '빈 화면'이 아닌 스켈레톤으로 즉시 도착하게 한다.
  const revealReady = transitionReady && !schLoading && !notesLoading;

  const todaySessions = useMemo(
    () =>
      (schedules ?? [])
        // 상담 회기 + 검사 일정 모두 — "오늘 일정" 오버뷰. (meeting/block 제외)
        .filter(
          (sc) =>
            sc.schedule_type === "counseling" ||
            sc.schedule_type === "assessment",
        )
        // 시간순(시작 빠른 순) 정렬 — 현재 시각 기준 지난/진행/예정을 읽기 쉽게.
        .sort(
          (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime(),
        ),
    [schedules],
  );
  const noteBySchedule = useMemo(() => {
    const m = new Map<string, FieldNoteResponse>();
    for (const n of notes) if (n.schedule_id) m.set(n.schedule_id, n);
    return m;
  }, [notes]);
  const processing = useMemo(
    () => notes.filter((n) => n.processing_status === "processing"),
    [notes],
  );
  const recent = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            n.status !== "recording" &&
            n.status !== "paused" &&
            n.processing_status !== "processing",
        )
        .slice(0, 4),
    [notes],
  );

  const sessionCount = todaySessions.length;
  // 완전 신규: 오늘 회기 0 + 노트 0 (로딩 끝난 뒤에만 판정 — 기존 사용자에게 가이드 깜빡임 방지).
  // 이때만 헤드라인/본문을 온보딩 가이드로 대체하고, 중복되는 '최근 노트' 빈 카드는 숨긴다.
  const isFirstTime =
    !schLoading && !notesLoading && sessionCount === 0 && notes.length === 0;
  // 온보딩 takeover 노출 여부 — isFirstTime 이어도 사용자가 "녹음 시작하기"로
  // 인트로를 닫으면(introDismissed) 기능 홈을 보여준다.
  const showIntro = isFirstTime && !introDismissed;
  // 온보딩 → 기능 홈 부드러운 전환: "녹음 시작하기" 누르면 온보딩을 페이드아웃(RN Animated,
  // useFadeIn 과 동일 엔진)한 뒤 introDismissed 를 켜 기능 홈으로 넘긴다.
  const introAnim = useRef(new Animated.Value(1)).current;
  const enterHome = () => {
    Animated.timing(introAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIntroDismissed(true);
    });
  };
  const recording = fab.isActive;
  const paused = fab.isPaused;
  // 오늘 회기의 지난/진행/예정 판정 기준 시각 (렌더 시점의 현재 시각).
  const nowMs = Date.now();
  // 플로팅 네비(원형 ← + pill)가 차지하는 높이만큼 콘텐츠 하단 여백 확보.
  const navClear = insets.bottom + s(92);

  const openNote = (id: string) =>
    router.push(`/(main)/field-note/_quick?fieldNoteId=${id}`);

  // 녹음 전환 확인 — 네이티브 Alert 대신 필드노트 결 커스텀 모달(선언형).
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // link-at-start — 마이크 탭은 blind 녹음이 아니라 "무엇을 녹음할까요?" 연결 선택 시트.
  // (회기 없이 녹음은 시트 안의 fallback으로 강등.)
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);

  const onRecord = () => {
    if (recording) fab.openSheet();
    else setTargetSheetVisible(true);
  };

  // 오늘 회기 카드의 '녹음' 충돌 해소.
  //  - 녹음 안 함         → 그 회기에 연결된 새 녹음 시작
  //  - 같은 회기 녹음 중   → 진행 시트만 열기 (보통 이 회기는 상태 pill 이라 도달 드묾)
  //  - 미연결 녹음 중      → "이 회기에 연결?" (새 녹음 X, 진행 녹음을 그 회기에 연결)
  //  - 다른 회기 녹음 중   → "멈추고 새로?" (멈춤=분석 저장, 폐기 아님)
  const onSessionRecord = (sc: (typeof todaySessions)[number]) => {
    const sid = sc.id;
    if (!sid) return;
    const who = clientLabel(sc.client_names);
    // 선택 시점 표기 컨텍스트 — 녹음 시작 후에도 좌상단에 그대로 보존(쿼리 재조회 불필요).
    const ctx: RecordingContext = {
      client: who,
      sub: sc.program_name ?? null,
      kind: "counseling",
    };
    if (!recording) {
      // 시작이 한참 남은 회기 — 주 CTA가 '다음 예정 회기'를 자동 타겟하므로 조용히 시작되면 사고.
      const remainMs = parseDate(sc.start).getTime() - Date.now();
      if (remainMs > EARLY_RECORD_CONFIRM_MS) {
        setConfirm({
          title: "지금 녹음을 시작할까요?",
          message: `${who} 상담은 ${formatRemainKo(remainMs)} 뒤에 시작해요.\n녹음은 이 회기에 연결돼요.`,
          confirmLabel: "녹음 시작",
          cancelLabel: "취소",
          onConfirm: () => void fab.start(undefined, sid, undefined, ctx),
        });
        return;
      }
      void fab.start(undefined, sid, undefined, ctx);
      return;
    }
    if (fab.scheduleId === sid) {
      fab.openSheet();
      return;
    }
    if (fab.scheduleId == null) {
      setConfirm({
        title: "이 회기에 연결할까요?",
        message: `진행 중인 녹음을 ${who} 회기에 연결해요. 녹음은 멈추지 않고 이어져요.`,
        confirmLabel: "연결",
        cancelLabel: "취소",
        onConfirm: () =>
          linkMutation.mutate(sid, {
            onSuccess: () =>
              showToast({
                type: "success",
                message: `${who} 회기에 연결했어요`,
              }),
            onError: () =>
              showToast({
                type: "error",
                message: "이 회기엔 이미 필드노트가 있어 연결하지 못했어요",
              }),
          }),
      });
    } else {
      setConfirm({
        title: "녹음을 전환할까요?",
        message: `진행 중인 녹음을 멈추면 분석으로 저장돼요. ${who} 회기를 새로 녹음할까요?`,
        confirmLabel: "멈추고 새로",
        cancelLabel: "계속 녹음",
        destructive: true,
        onConfirm: () => void fab.switchToSchedule(sid),
      });
    }
  };

  // 홈에서 녹음 이어하기 — 완료(분석 포함) 노트 뒤에 이어 붙이는 추가 녹음.
  // 목록 응답엔 audios 가 없어 상세를 선조회해 청크 인덱스/누적 길이를 산출한다
  // (상세 화면 onStartAdditional 과 동일 패턴). "분석은 분석" — 이어하기는 분석을
  // 건드리지 않고, 정지 시 finish 재파이프라인이 갱신한다.
  const queryClient = useQueryClient();
  const canResumeNote = (note: FieldNoteResponse) =>
    note.status === "completed" && note.processing_status !== "processing";
  const onResumeNote = (note: FieldNoteResponse, who: string) => {
    if (fab.isActive) {
      showToast({ type: "error", message: "진행 중인 녹음을 먼저 멈춰주세요" });
      return;
    }
    // 이어녹음 표기 컨텍스트 — 리스트 응답에 enrich된 schedule/task brief에서 도출.
    const ctx: RecordingContext = note.task
      ? {
          client: note.task.client_name ?? who,
          sub:
            note.task.assessment_kor_name ??
            note.task.assessment_code ??
            "검사",
          kind: "assessment",
        }
      : { client: who, sub: note.schedule?.program_name ?? null, kind: "counseling" };
    setConfirm({
      title: "이어서 녹음할까요?",
      message: `${who} 노트의 기존 녹음 뒤에 이어 붙여요. 정지하면 다시 분석돼요.`,
      confirmLabel: "이어서 녹음",
      cancelLabel: "취소",
      onConfirm: () => {
        void (async () => {
          try {
            const detail = await queryClient.fetchQuery({
              queryKey: ["fieldNote", centerId, note.id],
              queryFn: () => getFieldNote(centerId!, note.id),
            });
            await fab.start(
              {
                fieldNoteId: note.id,
                baseDuration: effectiveDuration(detail),
                startChunkIndex: nextChunkIndex(detail.audios),
              },
              undefined,
              undefined,
              ctx,
            );
          } catch {
            showToast({
              type: "error",
              message: "녹음을 이어가지 못했어요. 다시 시도해 주세요",
            });
          }
        })();
      },
    });
  };

  // 검사 세션 펼침(검사별 필드노트) — 토글 시 스르륵 애니메이션. 펼칠 때만 task 지연 조회.
  const [expandedAssessment, setExpandedAssessment] = useState<
    Record<string, boolean>
  >({});
  const toggleAssessment = (id: string) => {
    setExpandedAssessment((o) => ({ ...o, [id]: !o[id] }));
  };
  const taskActions: TaskActions = {
    onRecordTask: (taskId: string, context: RecordingContext) => {
      void fab.start(undefined, undefined, taskId, context);
    },
    onOpenNote: openNote,
    onOpenSheet: () => fab.openSheet(),
  };

  return (
    <View style={{ flex: 1, backgroundColor: HOME_BG }}>
      <StatusBar style="light" />
      {/* 히어로 글로우 — 페이지 배경 레이어(헤더+스크롤 경계 무관). 홈 비온보딩일 때만. */}
      {view === "home" && !showIntro ? (
        <HomeHeroGlow top={insets.top - s(40)} />
      ) : null}
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* 상단 미니 헤더 — 떠있는 투명 오버레이(콘텐츠가 그 아래로 흐름, 경계 클립 제거).
            pointerEvents=box-none 으로 빈 영역은 터치 통과, 자식(인트로 뒤로가기)만 탭 가능. */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top, // 절대배치라 SafeAreaView top 패딩을 못 받음 → 상태바와 겹치지 않게 직접 보정
            left: 0,
            right: 0,
            zIndex: 10,
            height: s(48),
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: s(16),
          }}
        >
          {showIntro ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="뒤로"
            >
              <Ionicons name="chevron-back" size={s(24)} color={FN.sub} />
            </Pressable>
          ) : (
            <View style={{ width: s(24) }} />
          )}
          <View style={{ width: s(24) }} />
        </View>

        <View style={{ flex: 1 }}>
          {view === "home" ? (
            !revealReady ? (
              <HomeSkeleton navClear={navClear} />
            ) : (
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: s(16),
                  paddingTop: s(56), // 떠있는 헤더(48) + 기존 여백(8) — 콘텐츠가 헤더 아래로 흐름
                  paddingBottom: navClear,
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={FN.accent}
                    colors={[FN.accent]}
                    progressBackgroundColor={HOME_CARD}
                  />
                }
              >
                {/* 헤드라인 + 녹음 시작하기 (완전 신규는 온보딩 가이드로 대체) */}
                <FadeInView index={0}>
                  {showIntro ? (
                    <Animated.View style={{ opacity: introAnim }}>
                      <FirstTimeGuide onStart={enterHome} />
                    </Animated.View>
                  ) : (
                    <View
                      style={{
                        marginTop: s(8),
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        {sessionCount > 0 ? (
                          <>
                            <Typography
                              variant="headline-01"
                              weight="semibold"
                              style={{ color: FN.text }}
                            >
                              오늘 기록할 일정
                            </Typography>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "baseline",
                              }}
                            >
                              <Typography
                                variant="headline-01"
                                weight="semibold"
                                style={{ color: HOME_COUNT }}
                              >
                                {sessionCount}건
                              </Typography>
                              <Typography
                                variant="headline-01"
                                weight="semibold"
                                style={{ color: FN.text }}
                              >
                                이 있어요
                              </Typography>
                            </View>
                          </>
                        ) : (
                          <>
                            <Typography
                              variant="headline-01"
                              weight="semibold"
                              style={{ color: FN.text }}
                            >
                              오늘은 예정된
                            </Typography>
                            <Typography
                              variant="headline-01"
                              weight="semibold"
                              style={{ color: FN.text }}
                            >
                              일정이 없어요
                            </Typography>
                          </>
                        )}
                      </View>
                      {/* 헤드라인 우측 히어로 일러스트 + 옅은 사이언 글로우 */}
                      {sessionCount > 0 ? <HomeHeroArt /> : <NoScheduleArt />}
                    </View>
                  )}
                </FadeInView>

                {/* 진행 중 */}
                {processing.length > 0 && (
                  <FadeInView index={2}>
                    <SectionLabel>진행 중</SectionLabel>
                    <View style={{ gap: s(8) }}>
                      {processing.map((n) => (
                        <Pressable
                          key={n.id}
                          onPress={() => openNote(n.id)}
                          style={{
                            borderRadius: s(14),
                            backgroundColor: "rgba(185,139,255,0.12)",
                            padding: s(14),
                            flexDirection: "row",
                            alignItems: "center",
                            gap: s(8),
                          }}
                        >
                          <Ionicons
                            name="sync"
                            size={s(15)}
                            color={FN.accent}
                          />
                          <Typography
                            variant="body-03"
                            weight="semibold"
                            style={{ flex: 1, color: FN.text }}
                          >
                            {clientLabel(n.schedule?.client_names)} · 전사 중
                          </Typography>
                          <Ionicons
                            name="chevron-forward"
                            size={s(15)}
                            color={FN.sub}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </FadeInView>
                )}

                {/* 오늘 검사 세션의 task 백그라운드 프리페치 — 펼치기 전 캐싱(첫 펼침 지연 제거) */}
                {todaySessions
                  .filter(
                    (sc) => sc.schedule_type === "assessment" && sc.case_id,
                  )
                  .map((sc) => (
                    <TaskPrefetch
                      key={`pf-${sc.id}`}
                      centerId={centerId}
                      caseId={sc.case_id!}
                    />
                  ))}

                {/* 오늘 일정 — 타임라인(좌측 spine + dot, 진행 중 강조) */}
                {sessionCount > 0 && (
                  <FadeInView index={3}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: s(6),
                        marginTop: s(18),
                        marginBottom: s(8),
                      }}
                    >
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        style={{ color: FN.text }}
                      >
                        오늘 일정
                      </Typography>
                      <Typography
                        variant="body-03"
                        weight="regular"
                        style={{ color: FN.sub }}
                      >
                        {sessionCount}
                      </Typography>
                    </View>
                    <View>
                      {todaySessions.map((sc, i) => {
                        const note = sc.id
                          ? noteBySchedule.get(sc.id)
                          : undefined;
                        // 이 회기가 '지금 진행 중인 녹음'에 연결됐는지 — 전역 녹음 스토어로 즉시 판정.
                        const isLive =
                          fab.isActive &&
                          fab.scheduleId != null &&
                          fab.scheduleId === sc.id;
                        const meta = noteStateMeta(note, isLive, fab.isPaused);
                        const isAssessment = sc.schedule_type === "assessment";
                        const startMs = parseDate(sc.start).getTime();
                        const endMs = parseDate(sc.end).getTime();
                        const isPast = endMs < nowMs;
                        const isOngoing = startMs <= nowMs && nowMs <= endMs;
                        const isLast = i === todaySessions.length - 1;
                        const emphasized = isOngoing || isLive;
                        // 타임라인 dot — 지난 회기 #6685CF / 진행 예정 #304169 (진행 중은 아래 ring).
                        const dotColor = isPast ? "#6685CF" : "#304169";
                        const timeColor = isOngoing
                          ? TIME_NOW_COLOR
                          : isPast
                            ? FN.sub
                            : FN.text;
                        const subMeta = [
                          sc.program_name ?? (isAssessment ? "검사" : "상담"),
                          sc.room_name,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <View key={sc.id} style={{ flexDirection: "row" }}>
                            {/* 타임라인 spine — dot 은 헤더(시간)에 top 정렬(펼쳐도 안 움직임), 라인은 연속 */}
                            <View
                              style={{ width: s(24), alignItems: "center" }}
                            >
                              <View
                                style={{
                                  width: s(2),
                                  height: s(18),
                                  backgroundColor:
                                    i === 0 ? "transparent" : FN.line,
                                }}
                              />
                              {emphasized ? (
                                // 진행 중('지금') — 16×16 #292E3B 배경 + 1px #648AE3 60% 보더 + 가운데 8×8 #648AE3
                                <View
                                  style={{
                                    width: s(16),
                                    height: s(16),
                                    borderRadius: s(8),
                                    backgroundColor: "#292E3B",
                                    borderWidth: 1,
                                    borderColor: "rgba(100,138,227,0.6)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: s(8),
                                      height: s(8),
                                      borderRadius: s(4),
                                      backgroundColor: "#648AE3",
                                    }}
                                  />
                                </View>
                              ) : (
                                <View
                                  style={{
                                    width: s(9),
                                    height: s(9),
                                    borderRadius: s(5),
                                    backgroundColor: dotColor,
                                  }}
                                />
                              )}
                              <View
                                style={{
                                  width: s(2),
                                  flex: 1,
                                  backgroundColor: isLast
                                    ? "transparent"
                                    : FN.line,
                                }}
                              />
                            </View>
                            {/* 카드 (dot 헤더 정렬 — top 부터, paddingVertical 로 카드 간 간격, marginLeft 로 타임라인과 간격) */}
                            <View
                              style={{
                                flex: 1,
                                paddingVertical: s(5),
                                marginLeft: s(10),
                              }}
                            >
                              <ScheduleCardShell
                                emphasized={emphasized}
                                dimmed={isPast && !isLive}
                              >
                                {isAssessment && sc.case_id ? (
                                  // 검사 — 세션 1개 ⊃ 검사 task N (§3-4-2). 탭하면 검사별 필드노트 펼침(지연 로드).
                                  <View>
                                    <Pressable
                                      onPress={() => toggleAssessment(sc.id)}
                                      style={{
                                        height: s(102),
                                        justifyContent: "center",
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={`${clientLabel(sc.client_names)} 검사 ${expandedAssessment[sc.id] ? "접기" : "펼치기"}`}
                                    >
                                      <CardTime
                                        start={sc.start}
                                        end={sc.end}
                                        gradient={isOngoing}
                                        color={timeColor}
                                      />
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: s(12),
                                          marginTop: s(8),
                                        }}
                                      >
                                        <View style={{ flex: 1 }}>
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: s(6),
                                            }}
                                          >
                                            <View
                                              style={{
                                                width: s(7),
                                                height: s(7),
                                                borderRadius: s(4),
                                                backgroundColor:
                                                  COLORS.assessment,
                                              }}
                                            />
                                            <Typography
                                              variant="body-02"
                                              weight="medium"
                                              style={{
                                                color: FN.text,
                                                flex: 1,
                                              }}
                                              numberOfLines={1}
                                            >
                                              {clientLabel(sc.client_names)}
                                            </Typography>
                                          </View>
                                          <View style={{ marginTop: s(3) }}>
                                            <AssessmentSubtitle
                                              centerId={centerId}
                                              caseId={sc.case_id}
                                              room={sc.room_name}
                                              fallback={
                                                sc.program_name ?? "검사"
                                              }
                                            />
                                          </View>
                                        </View>
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: s(6),
                                          }}
                                        >
                                          {!expandedAssessment[sc.id] ? (
                                            <View
                                              style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: s(4),
                                                backgroundColor:
                                                  COLORS.assessment + "26",
                                                borderRadius: s(8),
                                                paddingHorizontal: s(10),
                                                paddingVertical: s(6),
                                              }}
                                            >
                                              <Ionicons
                                                name="clipboard-outline"
                                                size={s(12)}
                                                color={COLORS.assessment}
                                              />
                                              <Typography
                                                variant="label-02"
                                                weight="medium"
                                                style={{
                                                  color: COLORS.assessment,
                                                }}
                                              >
                                                검사
                                              </Typography>
                                            </View>
                                          ) : null}
                                          <AnimatedChevron
                                            open={!!expandedAssessment[sc.id]}
                                            color={FN.sub}
                                          />
                                        </View>
                                      </View>
                                    </Pressable>
                                    <Collapsible
                                      open={!!expandedAssessment[sc.id]}
                                    >
                                      <View
                                        style={{
                                          borderTopWidth: 1,
                                          borderTopColor: FN.line,
                                          paddingTop: s(4),
                                          paddingBottom: s(8),
                                        }}
                                      >
                                        <AssessmentTaskList
                                          centerId={centerId}
                                          caseId={sc.case_id}
                                          clientName={clientLabel(sc.client_names)}
                                          actions={taskActions}
                                        />
                                      </View>
                                    </Collapsible>
                                  </View>
                                ) : (
                                  // 상담(또는 case_id 없는 검사) — 높이 78: 시간·내담자·상태/버튼
                                  <View
                                    style={{
                                      height: s(102),
                                      justifyContent: "center",
                                    }}
                                  >
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: s(12),
                                      }}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <CardTime
                                          start={sc.start}
                                          end={sc.end}
                                          gradient={isOngoing}
                                          color={timeColor}
                                        />
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: s(6),
                                            marginTop: s(8),
                                          }}
                                        >
                                          <View
                                            style={{
                                              width: s(7),
                                              height: s(7),
                                              borderRadius: s(4),
                                              backgroundColor: isAssessment
                                                ? COLORS.assessment
                                                : COLORS.counseling,
                                            }}
                                          />
                                          <Typography
                                            variant="body-02"
                                            weight="medium"
                                            style={{ color: FN.text, flex: 1 }}
                                            numberOfLines={1}
                                          >
                                            {clientLabel(sc.client_names)}
                                          </Typography>
                                        </View>
                                        <Typography
                                          variant="label-01"
                                          style={{
                                            color: FN.sub,
                                            marginTop: s(4),
                                          }}
                                          numberOfLines={1}
                                        >
                                          {subMeta}
                                        </Typography>
                                      </View>
                                      {isAssessment ? (
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: s(4),
                                            backgroundColor:
                                              COLORS.assessment + "26",
                                            borderRadius: s(8),
                                            paddingHorizontal: s(10),
                                            paddingVertical: s(6),
                                          }}
                                        >
                                          <Ionicons
                                            name="clipboard-outline"
                                            size={s(12)}
                                            color={COLORS.assessment}
                                          />
                                          <Typography
                                            variant="label-02"
                                            weight="medium"
                                            style={{ color: COLORS.assessment }}
                                          >
                                            검사
                                          </Typography>
                                        </View>
                                      ) : isLive && meta ? (
                                        <Pressable
                                          onPress={() => fab.openSheet()}
                                          hitSlop={6}
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: s(4),
                                          }}
                                        >
                                          <AnalyzingPulseDot
                                            color={meta.color}
                                            size={s(6)}
                                          />
                                          <Typography
                                            variant="label-02"
                                            weight="medium"
                                            style={{ color: meta.color }}
                                          >
                                            {meta.label}
                                          </Typography>
                                          <Ionicons
                                            name="chevron-forward"
                                            size={s(13)}
                                            color={meta.color}
                                          />
                                        </Pressable>
                                      ) : note &&
                                        meta &&
                                        note.processing_status ===
                                          "completed" ? (
                                        // 분석완료 — 다크 "분석 보기" 버튼 (AI 분석 후엔 이어녹음 비노출, §3-4-5)
                                        <Pressable
                                          onPress={() => openNote(note.id)}
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            backgroundColor: VIEW_BTN_BG,
                                            borderRadius: s(10),
                                            paddingHorizontal: s(14),
                                            paddingVertical: s(9),
                                          }}
                                          accessibilityRole="button"
                                          accessibilityLabel={`${clientLabel(sc.client_names)} 분석 보기`}
                                        >
                                          <Typography
                                            variant="label-01"
                                            weight="semibold"
                                            style={{ color: VIEW_BTN_TX }}
                                          >
                                            분석 보기
                                          </Typography>
                                        </Pressable>
                                      ) : note && meta ? (
                                        // 전사 중·저장됨·실패 — 상태칩(+이어녹음 가능 시 마이크)
                                        <View
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: s(8),
                                          }}
                                        >
                                          <Pressable
                                            onPress={() => openNote(note.id)}
                                            hitSlop={6}
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: s(4),
                                            }}
                                          >
                                            <View
                                              style={{
                                                width: s(6),
                                                height: s(6),
                                                borderRadius: s(3),
                                                backgroundColor: meta.color,
                                              }}
                                            />
                                            <Typography
                                              variant="label-02"
                                              weight="medium"
                                              style={{ color: FN.sub }}
                                            >
                                              {meta.label}
                                            </Typography>
                                            {/* 이어녹음 마이크가 뒤따르면 › 가 마이크를 가리키는 화살표처럼 읽혀(오독) 숨김 */}
                                            {!canResumeNote(note) && (
                                              <Ionicons
                                                name="chevron-forward"
                                                size={s(13)}
                                                color={FN.sub}
                                              />
                                            )}
                                          </Pressable>
                                          {/* 이어서 녹음 — 미분석 노트에 추가 녹음(분석은 정지 시 갱신) */}
                                          {canResumeNote(note) ? (
                                            <Pressable
                                              onPress={() =>
                                                onResumeNote(
                                                  note,
                                                  clientLabel(sc.client_names),
                                                )
                                              }
                                              hitSlop={8}
                                              accessibilityRole="button"
                                              accessibilityLabel={`${clientLabel(sc.client_names)} 이어서 녹음`}
                                              style={{
                                                width: s(26),
                                                height: s(26),
                                                borderRadius: s(13),
                                                backgroundColor:
                                                  "rgba(185,139,255,0.16)",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <Ionicons
                                                name="mic"
                                                size={s(13)}
                                                color={FN.accent}
                                              />
                                            </Pressable>
                                          ) : null}
                                        </View>
                                      ) : (
                                        // 미녹음 — 블루 "녹음 시작" 버튼
                                        <Pressable
                                          onPress={() => onSessionRecord(sc)}
                                          style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            backgroundColor: REC_BTN_BG,
                                            borderRadius: s(10),
                                            paddingHorizontal: s(14),
                                            paddingVertical: s(9),
                                          }}
                                          accessibilityRole="button"
                                          accessibilityLabel={`${clientLabel(sc.client_names)} 회기 녹음`}
                                        >
                                          <Typography
                                            variant="label-01"
                                            weight="semibold"
                                            className="text-white"
                                          >
                                            녹음 시작
                                          </Typography>
                                        </Pressable>
                                      )}
                                    </View>
                                  </View>
                                )}
                              </ScheduleCardShell>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </FadeInView>
                )}

                {/* 최근 노트 — 2열 그리드 (완전 신규는 가이드가 대신하므로 숨김) */}
                {!showIntro && (
                  <FadeInView index={4}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: s(18),
                        marginBottom: s(8),
                      }}
                    >
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        style={{ color: FN.text }}
                      >
                        최근 노트
                      </Typography>
                      {recent.length > 0 && (
                        <Pressable onPress={() => setView("notes")} hitSlop={6}>
                          <Typography
                            variant="body-03"
                            weight="regular"
                            style={{ color: FN.sub }}
                          >
                            전체보기
                          </Typography>
                        </Pressable>
                      )}
                    </View>
                    {recent.length > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                        }}
                      >
                        {recent.map((n) => {
                          const dur = n.total_duration ?? 0;
                          return (
                            <Pressable
                              key={n.id}
                              onPress={() => openNote(n.id)}
                              style={{
                                width: "48.5%",
                                marginBottom: s(8),
                                borderRadius: s(14),
                                backgroundColor: HOME_CARD,
                                padding: s(14),
                                minHeight: s(102),
                                justifyContent: "space-between",
                              }}
                            >
                              <View>
                                <Typography
                                  variant="body-02"
                                  weight="semibold"
                                  numberOfLines={1}
                                  style={{ color: FN.text }}
                                >
                                  {noteNumberLabel(n)}
                                </Typography>
                                {dur > 0 && (
                                  <Typography
                                    variant="caption-01"
                                    style={{ color: FN.sub, marginTop: s(4) }}
                                  >
                                    {formatDurKor(dur)}
                                  </Typography>
                                )}
                              </View>
                              <Typography
                                variant="caption-01"
                                style={{ color: FN.sub, marginTop: s(12) }}
                              >
                                {fmtDateKo(n.created_at)}
                              </Typography>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <View
                        style={{
                          alignItems: "center",
                          paddingVertical: s(24),
                          borderRadius: s(14),
                          backgroundColor: HOME_CARD,
                        }}
                      >
                        <Ionicons
                          name="mic-outline"
                          size={s(28)}
                          color={FN.sub}
                        />
                        <Typography
                          variant="body-03"
                          weight="medium"
                          style={{ marginTop: s(10), color: FN.text }}
                        >
                          아직 녹음한 노트가 없어요
                        </Typography>
                        <Typography
                          variant="caption-01"
                          style={{ marginTop: s(4), color: FN.sub }}
                        >
                          회기를 녹음하면 여기에 쌓여요
                        </Typography>
                      </View>
                    )}
                  </FadeInView>
                )}
              </ScrollView>
            )
          ) : (
            // 노트 탭 진입 — 다른 페이지처럼 우→좌 슬라이드로 등장(인플레이스 전환이라 직접 부여).
            <Reanimated.View
              key="notes"
              entering={SlideInRight.duration(240)}
              style={{ flex: 1, paddingTop: s(8) }}
            >
              <FieldNoteListContent
                embedded
                listBottomPadding={navClear}
                onRequestRecord={() => setTargetSheetVisible(true)}
              />
            </Reanimated.View>
          )}
        </View>
      </SafeAreaView>

      {/* 하단 페이드 — 플로팅 다크 네비 아래·안드로이드 시스템 바와 겹치는 영역으로
          새어 보이는 스크롤 콘텐츠가 다크 배경(HOME_BG)으로 자연스럽게 흐려지도록.
          네비 pill 은 이 그라데이션 뒤(아래 블록)에서 렌더돼 위에 얹혀 선명하게 유지된다.
          내담자 탭(clients.tsx) 하단 페이드와 동일 패턴 — 색만 다크. */}
      {!showIntro && (
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", HOME_BG]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: insets.bottom + s(64),
          }}
        />
      )}

      {/* 플로팅 바텀 네비 — 빈 상태(온보딩)에선 숨김(온보딩 버튼이 카드 아래에 인라인으로 있음). */}
      {!showIntro && (
        <View
          style={{
            position: "absolute",
            left: s(14),
            right: s(14),
            bottom: insets.bottom + s(16),
            flexDirection: "row",
            alignItems: "center",
            gap: s(10),
          }}
        >
          {/* 나가기 — 펄 바깥 독립 원형 (리뉴얼 네비, 검색 제거) */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="메인으로 나가기"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: s(56), height: s(56) }}>
              <BlurView
                intensity={92}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: s(28),
                  overflow: "hidden",
                }}
              />
              <View
                style={{
                  width: s(56),
                  height: s(56),
                  borderRadius: s(28),
                  backgroundColor: NAV_BG,
                  borderWidth: 1,
                  borderColor: NAV_BORDER,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: NAV_SHADOW,
                  shadowOpacity: 0.06,
                  shadowRadius: 15.8,
                  shadowOffset: { width: 0, height: -1 },
                }}
              >
                <Ionicons name="arrow-back" size={s(22)} color={COLORS.white} />
              </View>
            </View>
          </Pressable>

          {/* 펄 — 홈 ◉녹음 노트 (중앙 정렬). 중앙 마이크는 위로 튀므로 BlurView는 pill 만 rounded clip. */}
          <View style={{ flex: 1 }}>
            <BlurView
              intensity={92}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: s(30),
                overflow: "hidden",
              }}
            />
            <View
              style={{
                flexDirection: "row",
                height: s(60),
                borderRadius: s(30),
                backgroundColor: NAV_BG,
                borderWidth: 1,
                borderColor: NAV_BORDER,
                alignItems: "center",
                justifyContent: "center",
                gap: s(28),
                shadowColor: NAV_SHADOW,
                shadowOpacity: 0.06,
                shadowRadius: 15.8,
                shadowOffset: { width: 0, height: -1 },
              }}
            >
              <NavTab
                active={view === "home"}
                icon="home-24"
                label="홈"
                onPress={() => setView("home")}
              />
              <RecordButton
                active={recording}
                paused={paused}
                onPress={onRecord}
              />
              <NavTab
                active={view === "notes"}
                icon="fieldnote-list-24"
                label="노트"
                onPress={() => setView("notes")}
              />
            </View>
          </View>
        </View>
      )}

      {/* 녹음 진입 연결 선택 — 회기/검사/미지정 link-at-start */}
      <RecordTargetSheet
        visible={targetSheetVisible}
        onClose={() => setTargetSheetVisible(false)}
        onPickSchedule={onSessionRecord}
        onPickTask={(taskId, context) =>
          void fab.start(undefined, undefined, taskId, context)
        }
        onOpenNote={openNote}
      />

      <FieldNoteConfirmModal
        visible={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel ?? ""}
        cancelLabel={confirm?.cancelLabel ?? ""}
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
