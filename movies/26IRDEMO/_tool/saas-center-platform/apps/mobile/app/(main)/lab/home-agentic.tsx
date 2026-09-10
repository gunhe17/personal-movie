import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { s } from "@/shared/utils/scale";

/**
 * 홈 시안 · Agentic (AI 비서)
 *
 * AI가 정리한 "오늘 챙길 일"이 떠있는 pill 카드 컨테이너로 나열. 카드를 누르면
 * 그 카드가 자기 위치에서 자연스럽게 풀스크린으로 확장되며 새 페이지가 되는
 * shared-element morph 인터랙션. 닫기 시 다시 원래 카드 위치로 축소.
 *
 * 디자인 톤
 *  - AI Orb로 에이전트 존재감
 *  - primary75 → white 그라데이션 배경
 *  - 떠있는 pill 카드 + soft shadow
 *  - 1위 카드 primary glow + AI hint으로 강조
 *  - 하단 AI 입력 pill로 응답성 신호
 */

type Urgency = "now" | "today" | "week";

type TaskType =
  | "session-prep"
  | "missing-note"
  | "assessment-review"
  | "guardian-followup"
  | "case-prep";

type Task = {
  id: string;
  urgency: Urgency;
  timeLabel: string;
  title: string;
  description: string;
  hint: string;
  type: TaskType;
};

type Rect = { x: number; y: number; width: number; height: number };

const TASKS: Task[] = [
  {
    id: "t1",
    urgency: "now",
    timeLabel: "30분 후 시작",
    title: "김은서님 4회기 준비",
    description: "놀이치료 · 1번 상담실 · 14:00",
    hint: "지난 회기 일지 다시 읽기",
    type: "session-prep",
  },
  {
    id: "t2",
    urgency: "now",
    timeLabel: "어제부터 대기",
    title: "박지훈님 일지 미작성",
    description: "5/14 회기 · AI 초안 준비됐어요",
    hint: "초안 보고 한 번에 마무리",
    type: "missing-note",
  },
  {
    id: "t3",
    urgency: "today",
    timeLabel: "오늘 안에",
    title: "정유나님 검사 결과 검토",
    description: "MMPI-2 채점 완료",
    hint: "보고서 작성 전 검토",
    type: "assessment-review",
  },
  {
    id: "t4",
    urgency: "today",
    timeLabel: "3일째 대기",
    title: "최서아님 보호자 문의",
    description: "회기 일정 조정 요청",
    hint: "오늘 안에 회신해주세요",
    type: "guardian-followup",
  },
  {
    id: "t5",
    urgency: "week",
    timeLabel: "다음 주 월요일",
    title: "김민지님 첫 회기 계획",
    description: "신규 내담자 · 초기 상담일지",
    hint: "사전 검토 추천",
    type: "case-prep",
  },
];

const URGENCY_META: Record<
  Urgency,
  { label: string; solid: string; bg: string }
> = {
  now: {
    label: "지금",
    solid: COLORS.palette.red,
    bg: COLORS.paletteBg.red,
  },
  today: {
    label: "오늘",
    solid: COLORS.palette.orange,
    bg: COLORS.paletteBg.orange,
  },
  week: {
    label: "이번 주",
    solid: COLORS.palette.gray,
    bg: COLORS.paletteBg.gray,
  },
};

const PAGE_PX = s(24);
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function HomeAgenticLab() {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [originRect, setOriginRect] = useState<Rect | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const openTask = (task: Task, rect: Rect) => {
    setOriginRect(rect);
    setSelectedTask(task);
    Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const closeTask = () => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setSelectedTask(null);
        setOriginRect(null);
      }
    });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={["top"]} className="flex-1">
        <LabTopBar onBack={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: s(56) }}
          showsVerticalScrollIndicator={false}
        >
          <FocusVariant
            selectedTaskId={selectedTask?.id ?? null}
            onTaskPress={openTask}
          />
        </ScrollView>
      </SafeAreaView>

      {selectedTask && originRect && (
        <DetailMorphOverlay
          task={selectedTask}
          origin={originRect}
          progress={progress}
          onClose={closeTask}
        />
      )}
    </View>
  );
}

/* ─────────── Lab 헤더 ─────────── */

function LabTopBar({ onBack }: { onBack: () => void }) {
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
        홈 시안 · Agentic
      </Typography>
    </View>
  );
}

/* ─────────── Mock 홈 상단 ─────────── */

function MockTopBar() {
  return (
    <View
      style={{
        height: s(48),
        paddingHorizontal: PAGE_PX,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}>
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(8),
            backgroundColor: COLORS.primary100,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="business" size={14} color={COLORS.primary700} />
        </View>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          마음숲 상담센터
        </Typography>
      </View>
      <Ionicons
        name="notifications-outline"
        size={22}
        color={COLORS.gray[700]}
      />
    </View>
  );
}

/* ─────────── 메인 홈 시안 ─────────── */

function FocusVariant({
  selectedTaskId,
  onTaskPress,
}: {
  selectedTaskId: string | null;
  onTaskPress: (task: Task, rect: Rect) => void;
}) {
  // 카드별 ref 보관 — measureInWindow 로 스크린 좌표 측정용
  const cardRefs = useRef<Record<string, View | null>>({});

  const handleCardPress = (task: Task) => {
    const view = cardRefs.current[task.id];
    if (!view) return;
    view.measureInWindow((x, y, width, height) => {
      onTaskPress(task, { x, y, width, height });
    });
  };

  return (
    <LinearGradient
      colors={[COLORS.primary100, COLORS.bg.base]}
      locations={[0, 0.5]}
      style={{ width: "100%" }}
    >
      <MockTopBar />

      {/* AI Orb */}
      <View style={{ paddingHorizontal: PAGE_PX, paddingTop: s(20) }}>
        <AiOrb size={s(56)} />
      </View>

      {/* Hero */}
      <View
        style={{
          paddingHorizontal: PAGE_PX,
          paddingTop: s(24),
          paddingBottom: s(32),
        }}
      >
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(28),
            lineHeight: s(38),
            letterSpacing: -0.7,
          }}
        >
          김민준 선생님,{"\n"}
          <Typography
            weight="semibold"
            style={{
              color: COLORS.primary700,
              fontSize: s(28),
              lineHeight: s(38),
              letterSpacing: -0.7,
            }}
          >
            순서대로
          </Typography>
          {" "}챙기시면 돼요
        </Typography>
        <View style={{ height: s(12) }} />
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.text.label.default }}
        >
          위에서부터 차근차근 진행하세요
        </Typography>
      </View>

      {/* Task 카드 — 각 카드는 ref + onPress 로 morph 트리거 */}
      <View
        style={{
          paddingHorizontal: PAGE_PX,
          paddingBottom: s(16),
          gap: s(10),
        }}
      >
        {TASKS.map((t, idx) => {
          const isSelected = selectedTaskId === t.id;
          return (
            <View
              key={t.id}
              ref={(r) => {
                cardRefs.current[t.id] = r;
              }}
              style={{ opacity: isSelected ? 0 : 1 }}
              pointerEvents={isSelected ? "none" : "auto"}
            >
              <TaskCard
                task={t}
                emphasis={idx === 0}
                onPress={() => handleCardPress(t)}
              />
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}

/* ─────────── AI Orb (그라디언트 구체) ─────────── */

function AiOrb({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        shadowColor: COLORS.primary500,
        shadowOpacity: 0.35,
        shadowRadius: s(14),
        shadowOffset: { width: 0, height: s(6) },
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={[COLORS.primary300, COLORS.primary500, COLORS.primary800]}
        start={{ x: 0.25, y: 0.15 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Ionicons
          name="sparkles"
          size={Math.round(size * 0.38)}
          color={COLORS.white}
        />
        <View
          style={{
            position: "absolute",
            top: size * 0.12,
            left: size * 0.16,
            width: size * 0.4,
            height: size * 0.18,
            borderRadius: size,
            backgroundColor: "rgba(255,255,255,0.4)",
          }}
        />
      </LinearGradient>
    </View>
  );
}

/* ─────────── Task Card (홈 리스트) ─────────── */

function TaskCard({
  task,
  emphasis,
  onPress,
}: {
  task: Task;
  emphasis: boolean;
  onPress: () => void;
}) {
  const urgency = URGENCY_META[task.urgency];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: s(20),
        backgroundColor: COLORS.white,
        paddingVertical: emphasis ? s(20) : s(16),
        paddingHorizontal: s(20),
        flexDirection: "row",
        alignItems: "flex-start",
        gap: s(12),
        shadowColor: emphasis ? COLORS.primary500 : "#0F1B33",
        shadowOpacity: emphasis ? 0.22 : 0.1,
        shadowRadius: emphasis ? s(22) : s(14),
        shadowOffset: { width: 0, height: emphasis ? s(8) : s(5) },
        elevation: emphasis ? 8 : 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
            height: s(18),
          }}
        >
          <View
            style={{
              width: s(7),
              height: s(7),
              borderRadius: s(3.5),
              backgroundColor: urgency.solid,
            }}
          />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: urgency.solid }}
          >
            {urgency.label}
          </Typography>
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography
            variant="label-02"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {task.timeLabel}
          </Typography>
        </View>

        {emphasis ? (
          <Typography
            weight="semibold"
            style={{
              color: COLORS.text.title.default,
              fontSize: s(20),
              lineHeight: s(28),
              letterSpacing: -0.4,
              marginTop: s(6),
            }}
          >
            {task.title}
          </Typography>
        ) : (
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default, marginTop: s(4) }}
          >
            {task.title}
          </Typography>
        )}

        {emphasis && (
          <View
            style={{
              marginTop: s(10),
              flexDirection: "row",
              alignItems: "center",
              gap: s(6),
            }}
          >
            <Ionicons name="sparkles" size={11} color={COLORS.primary700} />
            <Typography
              variant="label-01"
              weight="regular"
              style={{ color: COLORS.primary700, flex: 1 }}
            >
              {task.hint}
            </Typography>
          </View>
        )}
      </View>
      <View style={{ height: s(18), justifyContent: "center" }}>
        <Icon name="arrow-right-16" size={16} color={COLORS.gray[400]} />
      </View>
    </Pressable>
  );
}

/* ─────────── Morph Overlay (카드 → 풀스크린 새 페이지) ─────────── */

function DetailMorphOverlay({
  task,
  origin,
  progress,
  onClose,
}: {
  task: Task;
  origin: Rect;
  progress: Animated.Value;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const urgency = URGENCY_META[task.urgency];

  // 셸: 카드 위치/크기 → 풀스크린으로 interpolate
  const shellStyle = {
    position: "absolute" as const,
    top: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [origin.y, 0],
    }),
    left: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [origin.x, 0],
    }),
    width: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [origin.width, SCREEN_WIDTH],
    }),
    height: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [origin.height, SCREEN_HEIGHT],
    }),
    borderRadius: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [s(20), 0],
    }),
    backgroundColor: COLORS.white,
    overflow: "hidden" as const,
    shadowColor: COLORS.primary500,
    shadowOpacity: progress.interpolate({
      inputRange: [0, 0.6],
      outputRange: [0.14, 0],
    }),
    shadowRadius: s(20),
    shadowOffset: { width: 0, height: s(6) },
    elevation: 8,
  };

  // 헤더 padding-top: 카드 상태 → 풀스크린에서 safe-area 만큼 내려옴
  const headerPaddingTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [s(20), insets.top + s(16)],
  });

  // 풀스크린 콘텐츠 fade-in
  const detailOpacity = progress.interpolate({
    inputRange: [0.4, 0.95],
    outputRange: [0, 1],
  });

  // 닫기 버튼 fade-in
  const closeOpacity = progress.interpolate({
    inputRange: [0.6, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={shellStyle}>
      {/* 헤더 — 카드 콘텐츠 그대로, padding-top 만 morph */}
      <Animated.View
        style={{
          paddingTop: headerPaddingTop,
          paddingHorizontal: s(20),
          paddingBottom: s(20),
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
        >
          <View
            style={{
              width: s(7),
              height: s(7),
              borderRadius: s(3.5),
              backgroundColor: urgency.solid,
            }}
          />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: urgency.solid }}
          >
            {urgency.label}
          </Typography>
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography
            variant="label-02"
            weight="regular"
            style={{ color: COLORS.text.body.subtle }}
          >
            {task.timeLabel}
          </Typography>
        </View>
        <Typography
          weight="semibold"
          style={{
            color: COLORS.text.title.default,
            fontSize: s(20),
            lineHeight: s(28),
            letterSpacing: -0.4,
            marginTop: s(6),
          }}
        >
          {task.title}
        </Typography>
        <View
          style={{
            marginTop: s(10),
            flexDirection: "row",
            alignItems: "center",
            gap: s(6),
          }}
        >
          <Ionicons name="sparkles" size={11} color={COLORS.primary700} />
          <Typography
            variant="label-01"
            weight="regular"
            style={{ color: COLORS.primary700, flex: 1 }}
          >
            {task.hint}
          </Typography>
        </View>
      </Animated.View>

      {/* 디바이더 */}
      <Animated.View
        style={{
          height: 1,
          backgroundColor: COLORS.gray[100],
          opacity: detailOpacity,
        }}
      />

      {/* 풀스크린 액션 영역 */}
      <Animated.View
        style={{
          flex: 1,
          opacity: detailOpacity,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: s(24),
            paddingTop: s(20),
            paddingBottom: insets.bottom + s(24),
          }}
          showsVerticalScrollIndicator={false}
        >
          <ActionPanel task={task} />
        </ScrollView>
      </Animated.View>

      {/* 닫기 버튼 — 풀스크린일 때 우상단 */}
      <Animated.View
        style={{
          position: "absolute",
          top: insets.top + s(12),
          right: s(16),
          opacity: closeOpacity,
        }}
      >
        <Pressable onPress={onClose} hitSlop={8}>
          <View
            style={{
              width: s(36),
              height: s(36),
              borderRadius: s(18),
              backgroundColor: COLORS.gray[100],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={COLORS.text.title.default} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/* ─────────── Action Panels (task type별 분기) ─────────── */

function ActionPanel({ task }: { task: Task }) {
  switch (task.type) {
    case "session-prep":
      return <SessionPrepPanel />;
    case "missing-note":
      return <MissingNotePanel />;
    case "assessment-review":
      return <AssessmentReviewPanel />;
    case "guardian-followup":
      return <GuardianFollowupPanel />;
    case "case-prep":
      return <CasePrepPanel />;
  }
}

function SessionPrepPanel() {
  return (
    <View style={{ gap: s(16) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: s(8),
        }}
      >
        <Icon name="clock-16" size={14} color={COLORS.text.label.default} />
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.label.default }}
        >
          14:00 ~ 14:50 · 1번 상담실
        </Typography>
      </View>

      <View
        style={{
          backgroundColor: COLORS.bg.base,
          borderRadius: s(12),
          padding: s(14),
          gap: s(10),
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.text.label.default }}
        >
          지난 회기 요약
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.strong, lineHeight: s(20) }}
        >
          친구 관계 어려움을 호소했고 학교에서의 따돌림 경험을 처음 이야기한
          회기였어요. 다음 만남에서 이어서 다뤄야 할 주제가 있어요.
        </Typography>
        <Pressable
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.primary700 }}
          >
            지난 일지 전체 보기 →
          </Typography>
        </Pressable>
      </View>

      <PrimaryButton label="필드노트 켜고 시작" icon="mic" />
    </View>
  );
}

function MissingNotePanel() {
  return (
    <View style={{ gap: s(14) }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
      >
        <Ionicons name="sparkles" size={12} color={COLORS.primary700} />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          AI가 작성한 초안
        </Typography>
      </View>
      <View
        style={{
          backgroundColor: COLORS.bg.base,
          borderRadius: s(12),
          padding: s(14),
        }}
      >
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.text.body.strong, lineHeight: s(22) }}
        >
          오늘 회기에서는 학교 적응에 대한 이야기가 주를 이루었어요. 지난
          주에 비해 정서적 안정이 향상된 모습을 보였고, 친구 관계에서의 작은
          성공 경험을 적극적으로 공유했어요. 마무리 단계에서 다음 회기 목표로
          가족과의 대화 시도를 제안했어요.
        </Typography>
      </View>
      <View style={{ flexDirection: "row", gap: s(8) }}>
        <SecondaryButton label="수정" flex={1} />
        <PrimaryButton label="저장하기" flex={2} />
      </View>
    </View>
  );
}

function AssessmentReviewPanel() {
  return (
    <View style={{ gap: s(16) }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}
      >
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={COLORS.primary700}
        />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          MMPI-2 채점 완료
        </Typography>
      </View>

      <View style={{ gap: s(12) }}>
        <ScaleBar code="D" label="우울" value={65} />
        <ScaleBar code="Pt" label="강박" value={58} />
        <ScaleBar code="Sc" label="조현" value={62} />
      </View>

      <PrimaryButton label="보고서 작성하기" />
    </View>
  );
}

function ScaleBar({
  code,
  label,
  value,
}: {
  code: string;
  label: string;
  value: number;
}) {
  const barColor =
    value >= 65 ? COLORS.palette.red : COLORS.palette.orange;
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}
    >
      <Typography
        variant="label-01"
        weight="semibold"
        style={{ color: COLORS.text.label.default, width: s(22) }}
      >
        {code}
      </Typography>
      <Typography
        variant="label-01"
        weight="regular"
        style={{ color: COLORS.text.body.subtle, width: s(40) }}
      >
        {label}
      </Typography>
      <View
        style={{
          flex: 1,
          height: s(6),
          borderRadius: s(3),
          backgroundColor: COLORS.gray[100],
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${value}%`,
            height: "100%",
            backgroundColor: barColor,
            borderRadius: s(3),
          }}
        />
      </View>
      <Typography
        variant="label-01"
        weight="semibold"
        style={{
          color: COLORS.text.title.default,
          width: s(24),
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </View>
  );
}

function GuardianFollowupPanel() {
  return (
    <View style={{ gap: s(14) }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: s(8) }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          보호자 김혜진님
        </Typography>
        <Typography
          variant="label-02"
          weight="regular"
          style={{ color: COLORS.text.body.subtle }}
        >
          · 3일 전
        </Typography>
      </View>
      <View
        style={{
          backgroundColor: COLORS.bg.base,
          borderRadius: s(12),
          padding: s(14),
        }}
      >
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.text.body.strong, lineHeight: s(22) }}
        >
          안녕하세요 선생님, 회기 시간을 화요일로 바꿔도 될까요? 학교 일정이
          변경되어서요.
        </Typography>
      </View>
      <View
        style={{
          backgroundColor: COLORS.bg.base,
          borderRadius: s(12),
          padding: s(14),
          minHeight: s(80),
        }}
      >
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.text.placeholder }}
        >
          답장을 입력해주세요
        </Typography>
      </View>
      <PrimaryButton label="보내기" />
    </View>
  );
}

function CasePrepPanel() {
  return (
    <View style={{ gap: s(14) }}>
      <View style={{ flexDirection: "row", gap: s(8) }}>
        <MetaChip label="주 호소" value="시험 불안" />
        <MetaChip label="연령" value="중1" />
        <MetaChip label="보호자" value="동반" />
      </View>
      <View
        style={{
          backgroundColor: COLORS.bg.base,
          borderRadius: s(12),
          padding: s(14),
          gap: s(8),
        }}
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: COLORS.text.label.default }}
        >
          초기 상담일지 요약
        </Typography>
        <Typography
          variant="body-03"
          weight="regular"
          style={{ color: COLORS.text.body.strong, lineHeight: s(20) }}
        >
          신규 등록 시 학교 적응 및 시험 불안을 주된 호소로 보고했어요. 이전
          상담 경험은 없고, 보호자 동반 가능해요.
        </Typography>
      </View>
      <PrimaryButton label="사전 메모 작성" />
    </View>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: s(10),
        paddingHorizontal: s(12),
        borderRadius: s(10),
        backgroundColor: COLORS.bg.base,
        gap: s(2),
      }}
    >
      <Typography
        variant="label-02"
        weight="regular"
        style={{ color: COLORS.text.body.subtle }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ─────────── Action 버튼 / 입력 pill ─────────── */

function PrimaryButton({
  label,
  icon,
  flex,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  flex?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => ({
        flex,
        height: s(48),
        borderRadius: s(12),
        backgroundColor: COLORS.primary500,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: s(6),
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={16} color={COLORS.white} />}
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.white }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

function SecondaryButton({ label, flex }: { label: string; flex?: number }) {
  return (
    <Pressable
      style={({ pressed }) => ({
        flex,
        height: s(48),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[100],
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

