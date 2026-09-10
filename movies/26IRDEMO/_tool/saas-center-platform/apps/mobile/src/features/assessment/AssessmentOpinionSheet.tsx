import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from "react-native";
import RAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolateColor,
  FadeIn,
} from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BottomSheet } from "@/shared/components/ui/BottomSheet";
import {
  Typography,
  getTypographyStyle,
} from "@/shared/components/ui/Typography";
import { Icon } from "@/shared/components/icons";
import { COLORS } from "@/shared/constants/theme";
import { s } from "@/shared/utils/scale";
import { useToastStore, GlobalToastHost } from "@/features/toast";
import { useFieldNotesByTask, useFieldNote } from "@/features/field-note";
import type { FieldNoteAnalysis } from "@/features/field-note";
import { useUpdateTaskOpinion, useTaskStatusActions } from "./hooks";

export interface OpinionTask {
  id: string;
  assessmentId: string;
  assessmentName: string;
  opinion: string | null;
  status: string;
  cancelledReason: string | null;
}

/** 검사 분석(해석 아님 — verbatim·관찰·인용)을 소견 초안 scaffold 텍스트로 조립. */
function buildOpinionScaffold(a: FieldNoteAnalysis): string {
  const lines: string[] = [];
  const summary = (a.summary ?? "").trim();
  if (summary) lines.push(summary, "");
  for (const r of a.responses ?? []) {
    const prompt = r.prompt?.trim();
    const response = r.response?.trim();
    if (response)
      lines.push(prompt ? `· ${prompt}: ${response}` : `· ${response}`);
  }
  for (const o of a.observations ?? []) {
    if (o.text?.trim()) lines.push(`· (관찰) ${o.text.trim()}`);
  }
  for (const q of a.quotes ?? []) {
    if (q.text?.trim()) lines.push(`· "${q.text.trim()}"`);
  }
  return lines.join("\n").trim();
}

/** 칩 라벨 — "HTP (집-나무-사람)" → "HTP" */
function shortName(name: string): string {
  return name.split(" (")[0];
}

/** "검사 완료 + 소견 작성됨" — 칩의 다크/체크 표시와 뒤로 정렬의 기준 */
function isWritten(t: OpinionTask): boolean {
  return t.status === "completed" && !!t.opinion?.trim();
}

interface AssessmentOpinionSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  caseId: string | null;
  clientName?: string | null;
  tasks: OpinionTask[];
  initialTaskId?: string;
}

export function AssessmentOpinionSheet({
  visible,
  onClose,
  centerId,
  caseId,
  clientName,
  tasks,
  initialTaskId,
}: AssessmentOpinionSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // 칩 표시 순서(검사 id). 열릴 때 1회 고정 — "완료+소견작성"은 뒤로.
  // 세션 중 소견을 저장해도(=리패치) 칩이 튀지 않도록 순서는 얼리지 않는다.
  const [order, setOrder] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [reasonDrafts, setReasonDrafts] = useState<Map<string, string>>(
    new Map(),
  );
  const initRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const showToast = useToastStore((st) => st.show);
  const updateOpinion = useUpdateTaskOpinion(centerId, caseId);
  const { cancel } = useTaskStatusActions(centerId, caseId);
  const insets = useSafeAreaInsets();
  const { height: kbHeightSV } = useReanimatedKeyboardAnimation();

  const animatedBottomStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -kbHeightSV.value - insets.bottom),
  }));

  // 열릴 때 1회만 초기화 (상태 액션으로 tasks 가 refetch 돼도 입력값이 리셋되지 않게)
  useEffect(() => {
    if (!visible) {
      initRef.current = false;
      setOrder([]);
      return;
    }
    if (initRef.current || tasks.length === 0) return;
    initRef.current = true;

    const d = new Map<string, string>();
    const r = new Map<string, string>();
    tasks.forEach((t) => {
      d.set(t.id, t.opinion ?? "");
      r.set(t.id, t.cancelledReason ?? "");
    });
    setDrafts(d);
    setReasonDrafts(r);
    // 작성 완료된 검사는 뒤로 (안정 정렬 — 그 외 순서는 유지)
    const sorted = [...tasks].sort(
      (a, b) => Number(isWritten(a)) - Number(isWritten(b)),
    );
    setOrder(sorted.map((t) => t.id));
    const idx = initialTaskId
      ? Math.max(
          sorted.findIndex((t) => t.id === initialTaskId),
          0,
        )
      : 0;
    setCurrentIndex(idx);
  }, [visible, tasks, initialTaskId]);

  // 고정된 순서로 검사를 재배열 (소견 저장으로 리패치돼도 순서 유지)
  const orderedTasks = useMemo(() => {
    if (order.length === 0) return tasks;
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const result = order
      .map((id) => byId.get(id))
      .filter((t): t is OpinionTask => !!t);
    const known = new Set(order);
    for (const t of tasks) if (!known.has(t.id)) result.push(t);
    return result;
  }, [tasks, order]);

  const currentTask = orderedTasks[currentIndex];
  const currentText = currentTask ? (drafts.get(currentTask.id) ?? "") : "";
  const currentReason = currentTask
    ? (reasonDrafts.get(currentTask.id) ?? "")
    : "";

  const status = currentTask?.status ?? "pending";
  const isDone = status === "completed";
  const isCancelled = status === "cancelled";
  const isRefused = status === "refused";
  const isStopped = isCancelled || isRefused;
  const isChoice = !isDone && !isStopped;
  const mode = isChoice ? "choice" : isDone ? "done" : "stopped";

  // 현재 검사 필드노트 분석 → 소견 초안 prefill 소스
  const { data: fnNotes } = useFieldNotesByTask(
    centerId,
    currentTask?.id ?? null,
    visible,
  );
  const latestNoteId = fnNotes?.[0]?.id ?? null;
  const { data: fnDetail } = useFieldNote(centerId, latestNoteId);
  const analysis = fnDetail?.analysis ?? null;
  const hasDraftSource = !!(
    analysis &&
    ((analysis.responses?.length ?? 0) > 0 ||
      (analysis.observations?.length ?? 0) > 0 ||
      (analysis.quotes?.length ?? 0) > 0 ||
      (analysis.summary ?? "").trim())
  );

  const pullDraft = useCallback(() => {
    if (!analysis || !currentTask) return;
    const scaffold = buildOpinionScaffold(analysis);
    if (!scaffold) return;
    setDrafts((prev) => {
      const next = new Map(prev);
      const existing = (next.get(currentTask.id) ?? "").trim();
      next.set(
        currentTask.id,
        existing ? `${existing}\n\n${scaffold}` : scaffold,
      );
      return next;
    });
    showToast({
      type: "info",
      message: "분석 내용을 불러왔어요. 검토 후 저장하세요",
    });
  }, [analysis, currentTask, showToast]);

  // 초안 작성하기 — 항상 노출. 분석 없으면 스낵바로 안내(필드노트 연결 유도)
  const handleDraft = () => {
    if (hasDraftSource) {
      pullDraft();
    } else if (!latestNoteId) {
      showToast({
        type: "info",
        message: "이 검사에 연결된 필드노트가 없어요. 먼저 연결해 주세요",
      });
    } else {
      showToast({
        type: "info",
        message: "필드노트 분석이 끝나면 초안을 만들 수 있어요",
      });
    }
  };

  const updateDraft = useCallback(
    (text: string) => {
      if (!currentTask) return;
      setDrafts((prev) => new Map(prev).set(currentTask.id, text));
    },
    [currentTask],
  );
  const updateReason = useCallback(
    (text: string) => {
      if (!currentTask) return;
      setReasonDrafts((prev) => new Map(prev).set(currentTask.id, text));
    },
    [currentTask],
  );

  const savePending = updateOpinion.isPending || cancel.isPending;

  // 현재 검사의 소견/중단사유를 — 값이 바뀌었을 때만 — 저장 + 스낵바.
  // (저장 버튼 / 다른 칩 전환 / 시트 닫기 시 공통 호출)
  const persistTask = (task: OpinionTask | undefined) => {
    if (!task) return;
    const done = task.status === "completed";
    const cancelled = task.status === "cancelled";
    if (done) {
      const draft = (drafts.get(task.id) ?? "").trim();
      if (draft === (task.opinion ?? "").trim()) return;
      updateOpinion.mutate(
        { taskId: task.id, opinion: draft || null },
        {
          onSuccess: () =>
            showToast({ type: "info", message: "소견을 저장했어요" }),
          onError: () =>
            showToast({ type: "error", message: "저장 중 오류가 발생했어요" }),
        },
      );
    } else if (cancelled) {
      const reason = (reasonDrafts.get(task.id) ?? "").trim();
      if (reason === (task.cancelledReason ?? "").trim()) return;
      cancel.mutate(
        { taskId: task.id, reason: reason || null },
        {
          onSuccess: () =>
            showToast({ type: "info", message: "중단 사유를 저장했어요" }),
          onError: () =>
            showToast({ type: "error", message: "저장 중 오류가 발생했어요" }),
        },
      );
    }
  };

  // 다른 검사 칩으로 전환 — 현재 검사 저장 후 이동
  const switchTab = (idx: number) => {
    if (idx === currentIndex) return;
    persistTask(currentTask);
    setCurrentIndex(idx);
  };

  // 닫기 — 현재 검사 저장 후 닫기
  const closeWithSave = () => {
    persistTask(currentTask);
    onClose();
  };

  // 저장 — 현재 검사 저장 후, 검사가 여러 개면 다음 "소견 미작성" 검사로 이동.
  // 단일 검사이거나 모두 작성됐으면 닫음 / 현재에 머무름.
  const saveAndContinue = () => {
    persistTask(currentTask);
    if (orderedTasks.length <= 1) {
      onClose();
      return;
    }
    // 완료된 검사인데 소견이 아직 비어있는 다음 검사 (draft 기준 — 방금 저장분 반영)
    const needsOpinion = (t: OpinionTask | undefined) =>
      !!t && t.status === "completed" && !(drafts.get(t.id) ?? "").trim();
    const n = orderedTasks.length;
    for (let i = 1; i < n; i++) {
      const idx = (currentIndex + i) % n;
      if (needsOpinion(orderedTasks[idx])) {
        setCurrentIndex(idx);
        return;
      }
    }
    // 모두 작성됨 → 현재 검사에 머무름 (저장 토스트만)
  };

  if (tasks.length === 0) return null;

  const headerTitle = clientName ? `${clientName}의 검사 소견` : "검사 소견";

  return (
    <BottomSheet
      visible={visible}
      onClose={closeWithSave}
      fullHeight
      horizontalPadding={16}
    >
      <View style={{ flex: 1 }}>
        {/* 헤더 — 가운데 타이틀 + 우측 X (h48, py-[10px]) */}
        <View
          style={{
            height: s(48),
            paddingVertical: s(10),
            justifyContent: "center",
          }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            numberOfLines={1}
            style={{ color: COLORS.gray[900], textAlign: "center" }}
          >
            {headerTitle}
          </Typography>
          <TouchableOpacity
            onPress={closeWithSave}
            hitSlop={8}
            accessibilityLabel="닫기"
            accessibilityRole="button"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={22} color={COLORS.gray[600]} />
          </TouchableOpacity>
        </View>

        {/* 검사 칩 (h52, 간격 6) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, height: s(52) }}
          contentContainerStyle={{ gap: s(6), alignItems: "center" }}
        >
          {orderedTasks.map((t, idx) => (
            <Chip
              key={t.id}
              label={shortName(t.assessmentName)}
              active={idx === currentIndex}
              completed={isWritten(t)}
              stopped={t.status === "cancelled" || t.status === "refused"}
              onPress={() => switchTab(idx)}
            />
          ))}
        </ScrollView>

        {/* 검사 정보 + 본문 (py-2) */}
        <View style={{ flex: 1, paddingVertical: s(8) }}>
          {/* index + 검사명 */}
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[400], marginBottom: s(12) }}
          >
            {currentIndex + 1}/{orderedTasks.length}
          </Typography>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.gray[900], marginBottom: s(16) }}
          >
            {currentTask?.assessmentName}
          </Typography>

          {/* 본문 — 상태별 (상태 전환 시 부드럽게 크로스페이드).
              키보드 회피는 하단 footer 의 paddingBottom 만으로(=flex 본문이 자동으로 줄어듦).
              여기서 또 padding 을 주면 이중으로 줄어들어 검사명/소견 상단이 잘림. */}
          <View style={{ flex: 1 }}>
            <RAnimated.View
              key={`${currentTask?.id}-${mode}`}
              entering={FadeIn.duration(240)}
              style={{ flex: 1 }}
            >
              {isChoice && (
                <View
                  className="items-center justify-center"
                  style={{ paddingVertical: s(40), gap: s(8) }}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={28}
                    color={COLORS.gray[300]}
                  />
                  <Typography
                    variant="body-03"
                    style={{ color: COLORS.gray[400], textAlign: "center" }}
                  >
                    검사 상세에서 진행 여부를{"\n"}먼저 선택해 주세요
                  </Typography>
                </View>
              )}

              {isDone && (
                <ScrollView
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View
                    className="flex-row items-center justify-between"
                    style={{ marginBottom: s(8) }}
                  >
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.gray[600] }}
                    >
                      검사 소견
                    </Typography>
                    <TouchableOpacity
                      onPress={handleDraft}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="필드노트 분석에서 소견 초안 가져오기"
                    >
                      <LinearGradient
                        // fieldnote/gradient(블루 #5CCBFF→#C4C3FF→#D9C2FF) @ 12% opacity (1F ≈ 12%)
                        colors={["#5CCBFF1F", "#C4C3FF1F", "#D9C2FF1F"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          height: s(32),
                          borderRadius: s(8),
                          paddingHorizontal: s(10),
                          flexDirection: "row",
                          alignItems: "center",
                          gap: s(4),
                        }}
                      >
                        {/* 아이콘은 SVG 자체에 fieldnote/gradient 가 baked-in */}
                        <Icon name="double-diamond-16" size={16} />
                        <Typography
                          variant="label-01"
                          weight="semibold"
                          style={{ color: "#5B5FE0" }}
                        >
                          초안 작성하기
                        </Typography>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    ref={inputRef}
                    value={currentText}
                    onChangeText={updateDraft}
                    placeholder="직접 작성하거나, 필드노트로 초안을 생성해보세요."
                    placeholderTextColor={COLORS.gray[400]}
                    multiline
                    textAlignVertical="top"
                    maxLength={5000}
                    scrollEnabled={false}
                    style={{
                      padding: s(14),
                      minHeight: s(220),
                      fontSize: s(15),
                      lineHeight: s(24),
                      color: COLORS.gray[800],
                      letterSpacing: -0.41,
                      borderWidth: 1,
                      borderColor: COLORS.gray[200],
                      borderRadius: s(12),
                      // 배경 없음(테두리만) — 일지작성 시트와 통일
                      backgroundColor: 'transparent',
                    }}
                  />
                </ScrollView>
              )}

              {isStopped && (
                <View>
                  {/* 중단/거부 상태 행 — ✕ 빨간 원 + 라벨 (되돌리기 없음) */}
                  <View className="flex-row items-center" style={{ gap: s(8) }}>
                    <Icon name="cancel-red-circle-20" size={20} />
                    <Typography
                      variant="body-02"
                      weight="semibold"
                      style={{ color: COLORS.gray[900] }}
                    >
                      {isRefused ? "거부된 검사예요" : "중단된 검사예요"}
                    </Typography>
                  </View>

                  {/* 중단/거부 사유 — 빨간 톤 박스 */}
                  <View
                    style={{
                      marginTop: s(16),
                      borderRadius: s(12),
                      backgroundColor: "rgba(255,66,66,0.06)",
                      padding: s(14),
                      gap: s(6),
                    }}
                  >
                    <Typography
                      variant="label-01"
                      weight="semibold"
                      style={{ color: COLORS.error }}
                    >
                      {isRefused ? "거부 사유" : "중단 사유"}
                    </Typography>
                    <TextInput
                      value={currentReason}
                      onChangeText={updateReason}
                      editable={isCancelled}
                      placeholder="중단 사유를 입력해주세요"
                      placeholderTextColor={COLORS.gray[400]}
                      multiline
                      textAlignVertical="top"
                      maxLength={1000}
                      scrollEnabled={false}
                      style={{
                        minHeight: s(100),
                        padding: 0,
                        fontSize: s(15),
                        lineHeight: s(22),
                        color: COLORS.gray[800],
                        letterSpacing: -0.41,
                      }}
                    />
                  </View>
                </View>
              )}
            </RAnimated.View>
          </View>
        </View>

        {/* 하단 버튼 */}
        <RAnimated.View style={[{ paddingTop: s(8) }, animatedBottomStyle]}>
          <View className="flex-row" style={{ gap: s(8) }}>
            <TouchableOpacity
              onPress={closeWithSave}
              disabled={savePending}
              activeOpacity={0.7}
              className="items-center justify-center rounded-md border border-gray-200"
              style={{ width: s(122), paddingVertical: s(13) }}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.gray[600] }}
              >
                닫기
              </Typography>
            </TouchableOpacity>
            <SaveButton
              pending={savePending}
              disabled={savePending || !currentTask}
              onPress={saveAndContinue}
            />
          </View>
        </RAnimated.View>
      </View>

      {/* 시트(Modal) 위에 토스트가 보이도록 시트 안에서도 호스트 마운트 (elevated → 루트 중복 억제) */}
      <GlobalToastHost elevated />
    </BottomSheet>
  );
}

const AnimatedText = RAnimated.createAnimatedComponent(Text);

/** 검사 칩 — 선택/완료/중단 상태 색을 부드럽게 전환 */
function Chip({
  label,
  active,
  completed,
  stopped,
  onPress,
}: {
  label: string;
  active: boolean;
  completed: boolean;
  stopped: boolean;
  onPress: () => void;
}) {
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, p]);

  // 비활성 상태 색 — 완료=다크/체크, 중단=빨강 톤, 그 외=기본
  const inactiveBg = completed ? COLORS.gray[800] : COLORS.white;
  const inactiveBorder = completed
    ? COLORS.gray[800]
    : stopped
      ? "#FF424233"
      : COLORS.gray[200];
  const inactiveText = completed
    ? COLORS.white
    : stopped
      ? "#FF4242"
      : COLORS.gray[600];

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      p.value,
      [0, 1],
      [inactiveBg, COLORS.primary50],
    ),
    borderColor: interpolateColor(p.value, [0, 1], [inactiveBorder, "#4486FF"]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [inactiveText, "#4486FF"]),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <RAnimated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: s(4),
            height: s(32),
            paddingHorizontal: s(12),
            borderRadius: s(20),
            borderWidth: 1,
          },
          boxStyle,
        ]}
      >
        {completed && (
          <Ionicons name="checkmark" size={13} color={COLORS.success} />
        )}
        <AnimatedText
          numberOfLines={1}
          style={[
            getTypographyStyle("label-01", active ? "semibold" : "medium"),
            textStyle,
          ]}
        >
          {label}
        </AnimatedText>
      </RAnimated.View>
    </Pressable>
  );
}

/** 저장 버튼 — 누를 때 탱글탱글 스프링 바운스 */
function SaveButton({
  pending,
  disabled,
  onPress,
}: {
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <RAnimated.View style={[{ flex: 1 }, aStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, {
            damping: 7,
            stiffness: 220,
            mass: 0.6,
          });
        }}
        className="items-center justify-center rounded-md"
        style={{
          paddingVertical: s(13),
          backgroundColor: disabled ? COLORS.gray[300] : "#4486FF",
        }}
        accessibilityRole="button"
        accessibilityLabel="저장"
      >
        {pending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography variant="body-02" weight="medium" className="text-white">
            저장
          </Typography>
        )}
      </Pressable>
    </RAnimated.View>
  );
}
