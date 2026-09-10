import { useEffect, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useCenterStore, usePermission } from "@/features/center";
import {
  useCaseTasks,
  useAssessmentCaseDetail,
  useTaskStatusActions,
} from "@/features/assessment";
import {
  AssessmentOpinionSheet,
  type OpinionTask,
} from "@/features/assessment/AssessmentOpinionSheet";
import {
  useFieldNotesByTask,
  useFieldNote,
  useUnlinkedFieldNotes,
  useLinkNoteToTask,
  type FieldNoteResponse,
} from "@/features/field-note";
import {
  UnifiedBillingSheet,
  IssuedPaymentPrompt,
  type ClientCandidate,
  type IssuedBillable,
  BillableDetailSheet,
  useBillablesByRelated,
  resolveBillingState,
} from "@/features/billing";
import { useToastStore } from "@/features/toast";
import { parseDate } from "@/shared/utils/date";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { Icon, type IconName } from "@/shared/components/icons";
import { BottomSheet } from "@/shared/components/ui/BottomSheet";
import { DecisionMorph } from "@/shared/components/ui/DecisionMorph";
import { s } from "@/shared/utils/scale";

const BOX_BG = "#F5F7F8";

/** 청구 버튼 배경 — mint @ 10% (#00C3BC + 1A). 상담 회기 청구 버튼과 동일 */
const MINT_BG = "#00C3BC1A";

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분 ${ss}초`;
}

export default function AssessmentTaskScreen() {
  const { caseId, taskId } = useLocalSearchParams<{
    caseId: string;
    taskId: string;
  }>();
  const router = useRouter();
  const centerId = useCenterStore((st) => st.centerId);
  // 청구는 권한 기반 노출 — read|write:billing 없으면 청구 UI·쿼리 숨김
  const { can } = usePermission();
  const canBilling = can("read:billing") || can("write:billing");
  const insets = useSafeAreaInsets();

  const [opinionOpen, setOpinionOpen] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);

  const { data: tasks, isLoading } = useCaseTasks(centerId, caseId ?? null);
  const task = useMemo(
    () => tasks?.find((t) => t.id === taskId) ?? null,
    [tasks, taskId],
  );

  // 소견 시트용 — 케이스 전체 검사(칩) + 내담자명
  const { data: caseDetail } = useAssessmentCaseDetail(
    centerId,
    caseId ?? null,
  );
  const clientName = caseDetail?.clients?.[0]?.name ?? null;
  const opinionTasks: OpinionTask[] = useMemo(
    () =>
      (tasks ?? []).map((t) => ({
        id: t.id,
        assessmentId: t.assessment_id,
        assessmentName: t.assessment?.kor_name ?? "검사",
        opinion: t.opinion ?? null,
        status: t.status,
        cancelledReason:
          (t.process?.["cancelled_reason"] as string | undefined) ?? null,
      })),
    [tasks],
  );

  const assessmentName = task?.assessment?.kor_name ?? "검사";
  const isOnline = task?.execution_method === "online";
  const categoryLabel = isOnline ? "온라인 검사" : "오프라인 검사";
  const opinion = task?.opinion?.trim() ?? "";
  const hasReport = !!task?.report_document_id;

  const showToast = useToastStore((st) => st.show);

  // 클릭 즉시 카드/액션이 바뀌도록 낙관적(optimistic) 상태로 우선 반영 (서버 round-trip 대기 제거).
  // 실패 시 null 로 되돌리고, 서버 상태가 새로 도착하면(refetch) 자동으로 해제(reconcile).
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  useEffect(() => {
    setOptimisticStatus(null);
  }, [task?.status]);

  // 진행 여부 상태별 카드 분기
  // submitted(되돌리기 시 completed→submitted)는 다시 "진행 여부 선택"으로 노출
  const taskStatus = optimisticStatus ?? task?.status;
  const isChoiceState =
    taskStatus === "pending" ||
    taskStatus === "in_progress" ||
    taskStatus === "submitted";
  const isCompletedState = taskStatus === "completed";
  const isCancelledState = taskStatus === "cancelled";
  const isRefusedState = taskStatus === "refused";
  const isStoppedState = isCancelledState || isRefusedState;

  const { complete, revert, cancel, rollback } = useTaskStatusActions(
    centerId,
    caseId ?? null,
  );
  const actionPending =
    complete.isPending ||
    cancel.isPending ||
    revert.isPending ||
    rollback.isPending;

  const handleComplete = () => {
    if (!task) return;
    setOptimisticStatus("completed");
    complete.mutate(
      { assessmentId: task.assessment_id },
      { onError: () => setOptimisticStatus(null) },
    );
  };
  const handleStop = () => {
    if (!task) return;
    setOptimisticStatus("cancelled");
    cancel.mutate(
      { taskId: task.id, reason: null },
      { onError: () => setOptimisticStatus(null) },
    );
  };
  const handleRevert = () => {
    if (!task) return;
    // completed → submitted (다시 진행 여부 선택 카드)
    setOptimisticStatus("submitted");
    revert.mutate(
      { assessmentId: task.assessment_id },
      { onError: () => setOptimisticStatus(null) },
    );
  };
  const handleRollback = () => {
    if (!task) return;
    // 중단/거부 → 이전 진행 상태(pending·in_progress·submitted 모두 "선택" 카드). 정확한 값은 refetch로 정리.
    setOptimisticStatus("submitted");
    rollback.mutate(
      { taskId: task.id },
      { onError: () => setOptimisticStatus(null) },
    );
  };

  // 중단 사유 입력 — 현재 task 의 cancelled_reason 과 동기화
  const cancelledReason =
    (task?.process?.["cancelled_reason"] as string | undefined) ?? "";
  const [reasonDraft, setReasonDraft] = useState("");
  useEffect(() => {
    setReasonDraft(cancelledReason);
  }, [cancelledReason]);
  const handleSaveReason = () => {
    if (!task) return;
    cancel.mutate(
      { taskId: task.id, reason: reasonDraft.trim() || null },
      {
        onSuccess: () =>
          showToast({ type: "info", message: "중단 사유를 저장했어요" }),
        onError: () =>
          showToast({ type: "error", message: "저장 중 오류가 발생했어요" }),
      },
    );
  };

  // 청구 (완료 카드)
  const { data: caseBillables } = useBillablesByRelated({
    centerId: canBilling ? centerId : null,
    relatedType: ["assessment_session", "assessment_case"],
    relatedCaseId: caseId ?? null,
  });
  const billable = caseBillables?.[0];
  const billingState = resolveBillingState(billable);
  const [billingTarget, setBillingTarget] = useState<{
    initialClientId: string;
  } | null>(null);
  const [issuedBillable, setIssuedBillable] = useState<IssuedBillable | null>(
    null,
  );
  const [billDetailOpen, setBillDetailOpen] = useState(false);
  const billingClients: ClientCandidate[] = useMemo(() => {
    if (!caseDetail) return [];
    const sessionId = caseDetail.sessions?.[0]?.session_id;
    const sessionStart = caseDetail.schedule?.start ?? caseDetail.created_at;
    return caseDetail.clients.map((c) => ({
      client: {
        id: c.client_id,
        name: c.name,
        gender: c.gender,
        age: c.age,
        program: assessmentName,
      },
      sessions: sessionId
        ? [
            {
              id: sessionId,
              start: sessionStart,
              sessionNumber: 1,
              status: "scheduled",
              billed:
                caseBillables?.some((b) => b.client_id === c.client_id) ??
                false,
            },
          ]
        : [],
    }));
  }, [caseDetail, caseBillables, assessmentName]);
  const handleBilling = () => {
    if (billingState === "none") {
      const first = caseDetail?.clients?.[0];
      if (first) setBillingTarget({ initialClientId: first.client_id });
    } else {
      setBillDetailOpen(true);
    }
  };
  const billingLabel =
    billingState === "none"
      ? "청구서 발행"
      : billingState === "pending"
        ? "청구 확인"
        : "청구 완료";

  // ─ 검사별 필드노트 (1:1) ─ online 은 녹음 대상 아님
  const fnEligible = !!task && !isOnline;
  const { data: fnItems } = useFieldNotesByTask(
    centerId,
    taskId ?? null,
    fnEligible,
  );
  const noteId = useMemo(
    () => fnItems?.find((n) => !!n.id)?.id ?? null,
    [fnItems],
  );
  const { data: note } = useFieldNote(centerId, noteId);

  const openReport = () =>
    router.push({
      pathname: "/(main)/assessment/report",
      params: {
        documentId: task?.report_document_id ?? "",
        taskName: assessmentName,
      },
    });

  const openNote = () => {
    if (noteId) router.push(`/(main)/field-note/_quick?fieldNoteId=${noteId}`);
  };

  // 연결: 미연결 필드노트 목록을 불러와 이 검사에 연결
  const { data: unlinkedNotes, isLoading: unlinkedLoading } =
    useUnlinkedFieldNotes(linkSheetOpen ? centerId : null);
  const linkMutation = useLinkNoteToTask(centerId, taskId ?? null);
  const handleLink = (fieldNoteId: string) => {
    linkMutation.mutate(fieldNoteId, {
      onSuccess: () => setLinkSheetOpen(false),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center bg-background px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
      </View>

      {!task && isLoading && <View className="flex-1" />}

      {!task && !isLoading && (
        <View className="flex-1 items-center justify-center gap-2 px-5">
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={COLORS.gray[300]}
          />
          <Typography variant="body-03" className="text-gray-400">
            검사 항목을 불러올 수 없어요
          </Typography>
        </View>
      )}

      {task && (
        <ScrollView
          className="flex-1"
          // 배경 흰색 → 하단 바운스 흰색. 상단은 회색 zone + 아래 회색 View로 처리.
          style={{ backgroundColor: COLORS.white }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* 상단 바운스 시 회색 유지 — 콘텐츠 위로 확장된 회색 배경 */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -600,
              left: 0,
              right: 0,
              height: 600,
              backgroundColor: COLORS.bg.base,
            }}
          />
          {/* 상단 회색 zone — 제목 + 상태 카드 (ScrollView가 흰색이라 명시) */}
          <View style={{ backgroundColor: COLORS.bg.base }}>
          {/* 상단 Gray Zone — 제목 + 결과 보고서 */}
          <View
            className="flex-row items-start px-4 py-6"
            style={{ gap: s(12) }}
          >
            <View style={{ flex: 1, gap: s(4) }}>
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.gray[600] }}
              >
                {categoryLabel}
              </Typography>
              <Typography
                variant="headline-02"
                weight="semibold"
                style={{ color: "#1D2227" }}
              >
                {assessmentName}
              </Typography>
            </View>
            <TouchableOpacity
              onPress={hasReport ? openReport : undefined}
              disabled={!hasReport}
              activeOpacity={0.7}
              accessibilityLabel="결과 보고서 보기"
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasReport }}
              style={{
                // 버튼 size L (design.md §3): height 44 · 좌우 16 · radius 10 · gap 4
                flexDirection: "row",
                alignItems: "center",
                gap: s(4),
                height: s(44),
                paddingHorizontal: s(16),
                borderRadius: s(10),
                backgroundColor: hasReport ? COLORS.white : COLORS.gray[100],
                ...(hasReport
                  ? {
                      shadowColor: "#000",
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }
                  : {}),
              }}
            >
              <Icon
                name="report-w-20"
                size={20}
                color={hasReport ? COLORS.primary : COLORS.gray[400]}
              />
              <Typography
                variant="body-02"
                weight="medium"
                className={hasReport ? "text-gray-800" : "text-gray-400"}
              >
                결과 보고서
              </Typography>
            </TouchableOpacity>
          </View>

          {/* 진행 여부 상태 카드 — 선택 / 완료 / 중단 분기 */}
          {(isChoiceState || isCompletedState || isStoppedState) && (
            <View
              style={{
                marginHorizontal: s(16),
                // 상태 카드 ↔ 아래 필드노트/검사소견 영역 갭
                marginBottom: s(24),
                backgroundColor: COLORS.white,
                borderRadius: s(20),
                paddingHorizontal: s(20),
                paddingVertical: s(20),
              }}
            >
              {/* 진행 결정 morph — 선택(완료/중단) ↔ 결과(완료/중단된 검사) — 회기 상세와 동일 인터랙션 */}
              <DecisionMorph
                isSelect={isChoiceState}
                options={[
                  {
                    key: "complete",
                    label: "완료",
                    resultLabel: "완료된 검사예요",
                    iconName: "complete-check-circle-20",
                  },
                  {
                    key: "stop",
                    label: "중단",
                    resultLabel: isRefusedState ? "거부된 검사예요" : "중단된 검사예요",
                    iconName: "cancel-red-circle-20",
                  },
                ]}
                resultKey={isCompletedState ? "complete" : "stop"}
                moveDurations={[220, 440]}
                selectDisabled={actionPending}
                revertDisabled={actionPending}
                onSelect={(key) =>
                  key === "complete" ? handleComplete() : handleStop()
                }
                onRevert={isCompletedState ? handleRevert : handleRollback}
              />

              {/* 완료 — 청구하기 (결과 행은 morph 가 렌더) */}
              {isCompletedState && (
                <>
                  {canBilling && (
                    <TouchableOpacity
                      onPress={handleBilling}
                      activeOpacity={0.7}
                      accessibilityLabel={billingLabel}
                      accessibilityRole="button"
                      className="flex-row items-center justify-center"
                      style={{
                        marginTop: s(16),
                        gap: s(4),
                        height: s(44),
                        borderRadius: s(10),
                        backgroundColor: MINT_BG,
                      }}
                    >
                      <Icon
                        name={
                          billingState === "completed"
                            ? "green-check-16"
                            : "mint-charge-16"
                        }
                        size={16}
                      />
                      <Typography
                        variant="body-03"
                        weight="medium"
                        style={{ color: COLORS.gray[600] }}
                      >
                        {billingLabel}
                      </Typography>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* 중단 — 중단 사유 (결과 행은 morph 가 렌더) */}
              {isStoppedState && (
                <>
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
                      중단 사유
                    </Typography>
                    <TextInput
                      value={reasonDraft}
                      onChangeText={setReasonDraft}
                      editable={isCancelledState}
                      placeholder="중단 사유를 입력해주세요"
                      placeholderTextColor={COLORS.gray[400]}
                      multiline
                      textAlignVertical="top"
                      maxLength={1000}
                      style={{
                        minHeight: s(44),
                        padding: 0,
                        fontSize: s(15),
                        lineHeight: s(22),
                        color: COLORS.gray[800],
                        letterSpacing: -0.41,
                      }}
                    />
                  </View>
                  {isCancelledState && (
                    <View
                      className="flex-row justify-end"
                      style={{ marginTop: s(12) }}
                    >
                      <TouchableOpacity
                        onPress={handleSaveReason}
                        disabled={actionPending}
                        activeOpacity={0.7}
                        accessibilityLabel="확인"
                        accessibilityRole="button"
                        style={{
                          paddingHorizontal: s(20),
                          paddingVertical: s(10),
                          borderRadius: s(10),
                          backgroundColor: COLORS.gray[100],
                        }}
                      >
                        <Typography
                          variant="body-02"
                          weight="medium"
                          style={{ color: COLORS.gray[600] }}
                        >
                          확인
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          </View>
          {/* /상단 회색 zone */}

          {/* 흰 시트 — 필드노트 + 소견 (중단/거부 시 숨김) */}
          {!isStoppedState && (
            <View
              className="px-4 py-7"
              style={{
                flexGrow: 1,
                backgroundColor: COLORS.white,
                borderTopLeftRadius: s(24),
                borderTopRightRadius: s(24),
              }}
            >
              {/* 필드노트 */}
              {fnEligible && (
                <View>
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    className="text-gray-900"
                    style={{ marginBottom: s(12) }}
                  >
                    필드노트
                  </Typography>
                  {note ? (
                    <TouchableOpacity
                      onPress={openNote}
                      activeOpacity={0.7}
                      accessibilityLabel="필드노트 보기"
                      accessibilityRole="button"
                      className="flex-row items-center"
                      style={{
                        backgroundColor: BOX_BG,
                        borderRadius: s(12),
                        padding: s(16),
                        gap: s(12),
                      }}
                    >
                      <View style={{ flex: 1, gap: s(4) }}>
                        <Typography
                          variant="body-02"
                          weight="semibold"
                          className="text-gray-900"
                        >
                          필드노트 1
                        </Typography>
                        <View
                          className="flex-row items-center"
                          style={{ gap: s(8) }}
                        >
                          <Typography
                            variant="label-01"
                            className="text-gray-500"
                          >
                            {format(
                              parseDate(note.created_at),
                              "yyyy. MM. dd",
                              {
                                locale: ko,
                              },
                            )}
                          </Typography>
                          <View
                            style={{
                              width: 1,
                              height: s(10),
                              backgroundColor: COLORS.gray[300],
                            }}
                          />
                          <Typography
                            variant="label-01"
                            className="text-gray-500"
                          >
                            {formatDuration(note.total_duration)}
                          </Typography>
                        </View>
                      </View>
                      <Icon
                        name="arrow-right"
                        size={16}
                        color={COLORS.gray[300]}
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setLinkSheetOpen(true)}
                      activeOpacity={0.7}
                      accessibilityLabel="필드노트 연결"
                      accessibilityRole="button"
                      className="flex-row items-center"
                      style={{
                        backgroundColor: BOX_BG,
                        borderRadius: s(12),
                        padding: s(16),
                        gap: s(10),
                      }}
                    >
                      <Ionicons
                        name="link"
                        size={18}
                        color={COLORS.fieldnote}
                      />
                      <Typography
                        variant="body-02"
                        weight="medium"
                        style={{ flex: 1, color: COLORS.gray[600] }}
                      >
                        필드노트를 불러와 연결하세요
                      </Typography>
                      <Icon
                        name="arrow-right"
                        size={16}
                        color={COLORS.gray[300]}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* 검사 소견 */}
              <View style={{ marginTop: fnEligible ? s(28) : 0 }}>
                <Typography
                  variant="title-01"
                  weight="semibold"
                  className="text-gray-900"
                  style={{ marginBottom: s(12) }}
                >
                  검사 소견
                </Typography>
                <TouchableOpacity
                  onPress={() => setOpinionOpen(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={opinion ? "소견 수정하기" : "소견 작성하기"}
                  style={{
                    backgroundColor: BOX_BG,
                    borderRadius: s(12),
                    padding: s(16),
                    minHeight: s(96),
                  }}
                >
                  {opinion ? (
                    <Typography
                      variant="body-02-reading"
                      weight="regular"
                      className="text-gray-900"
                    >
                      {opinion}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body-02-reading"
                      weight="regular"
                      style={{ color: "#AAB2BE" }}
                    >
                      검사 소견을 작성해주세요
                    </Typography>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* 소견 작성/수정 버튼 (하단 고정) — 중단/거부 시 숨김 */}
      {task && !isStoppedState && (
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingHorizontal: s(20),
            paddingTop: s(12),
            paddingBottom: insets.bottom + s(12),
          }}
        >
          <TouchableOpacity
            onPress={() => setOpinionOpen(true)}
            activeOpacity={0.8}
            accessibilityLabel={opinion ? "소견 수정하기" : "소견 작성하기"}
            accessibilityRole="button"
            style={{
              // 소견 수정(이미 작성됨) = Secondary, 신규 작성 = Primary
              backgroundColor: opinion
                ? COLORS.button.secondary["bg-default"]
                : COLORS.button.primary["bg-default"],
              borderRadius: s(12),
              paddingVertical: s(15),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="body-02"
              weight="medium"
              style={{
                color: opinion
                  ? COLORS.button.secondary["text-default"]
                  : COLORS.button.primary["text-default"],
              }}
            >
              {opinion ? "소견 수정하기" : "소견 작성하기"}
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* 소견 작성 시트 */}
      <AssessmentOpinionSheet
        visible={opinionOpen}
        onClose={() => setOpinionOpen(false)}
        centerId={centerId}
        caseId={caseId ?? null}
        clientName={clientName}
        tasks={opinionTasks}
        initialTaskId={task?.id}
      />

      {/* 청구 발행 시트 */}
      <UnifiedBillingSheet
        visible={billingTarget !== null}
        onClose={() => setBillingTarget(null)}
        centerId={centerId}
        caseId={caseId ?? ""}
        caseType="assessment"
        clients={billingClients}
        initialClientId={billingTarget?.initialClientId}
        tasks={(tasks ?? []).map((t) => ({
          assessmentId: t.assessment_id,
          assessmentName: t.assessment?.kor_name ?? "검사",
        }))}
        onIssued={setIssuedBillable}
      />

      <IssuedPaymentPrompt
        issued={issuedBillable}
        centerId={centerId}
        onDone={() => setIssuedBillable(null)}
      />

      {/* 청구 상세 시트 */}
      <BillableDetailSheet
        visible={billDetailOpen}
        onClose={() => setBillDetailOpen(false)}
        centerId={centerId}
        billableId={billable?.id ?? null}
      />

      {/* 필드노트 연결 시트 — 미연결 목록에서 선택 */}
      <BottomSheet
        visible={linkSheetOpen}
        onClose={() => setLinkSheetOpen(false)}
      >
        <View style={{ paddingHorizontal: s(20), paddingBottom: s(8) }}>
          <Typography
            variant="headline-02"
            weight="semibold"
            className="text-gray-900"
            style={{ marginBottom: s(4) }}
          >
            필드노트 연결
          </Typography>
          <Typography
            variant="body-03"
            className="text-gray-500"
            style={{ marginBottom: s(16) }}
          >
            이 검사에 연결할 필드노트를 선택하세요
          </Typography>

          {unlinkedLoading ? (
            <View style={{ paddingVertical: s(32) }}>
              <Typography
                variant="body-03"
                className="text-center text-gray-400"
              >
                불러오는 중…
              </Typography>
            </View>
          ) : !unlinkedNotes || unlinkedNotes.length === 0 ? (
            <View
              className="items-center justify-center"
              style={{ paddingVertical: s(40), gap: s(8) }}
            >
              <Ionicons name="mic-outline" size={40} color={COLORS.gray[300]} />
              <Typography variant="body-03" className="text-gray-400">
                연결할 필드노트가 없어요
              </Typography>
            </View>
          ) : (
            <View style={{ gap: s(8) }}>
              {unlinkedNotes.map((fn) => (
                <UnlinkedNoteRow
                  key={fn.id}
                  note={fn}
                  disabled={linkMutation.isPending}
                  onPress={() => handleLink(fn.id)}
                />
              ))}
            </View>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

/** 연결 시트의 미연결 필드노트 행 */
function UnlinkedNoteRow({
  note,
  disabled,
  onPress,
}: {
  note: FieldNoteResponse;
  disabled: boolean;
  onPress: () => void;
}) {
  const preview = note.summary?.trim() || note.refined_transcript?.trim() || "";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel="필드노트 연결"
      accessibilityRole="button"
      className="flex-row items-center"
      style={{
        backgroundColor: BOX_BG,
        borderRadius: s(12),
        padding: s(16),
        gap: s(12),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, gap: s(4) }}>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
          >
            {format(parseDate(note.created_at), "yyyy. MM. dd", { locale: ko })}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(10),
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography variant="label-01" className="text-gray-500">
            {formatDuration(note.total_duration)}
          </Typography>
        </View>
        {!!preview && (
          <Typography
            variant="label-01"
            numberOfLines={1}
            className="text-gray-500"
          >
            {preview}
          </Typography>
        )}
      </View>
      <Icon name="arrow-right" size={16} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}
