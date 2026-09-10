import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, Image } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useCenterStore, usePermission } from "@/features/center";
import { useAssessmentCaseDetail, useCaseTasks } from "@/features/assessment";
import {
  AssessmentOpinionSheet,
  type OpinionTask,
} from "@/features/assessment/AssessmentOpinionSheet";
import type { AssessmentTaskSummary } from "@/features/assessment/types";
import { GENDER_LABELS } from "@/features/client";
import { parseDate } from "@/shared/utils/date";
import { COLORS } from "@/shared/constants/theme";
import { Typography } from "@/shared/components/ui/Typography";
import { GenderAgeMeta } from "@/shared/components/ui/GenderAgeMeta";
import { BadgeRound } from "@/shared/components/ui/BadgeRound";
import { SetBadge } from "@/shared/components/ui/Badge";
import { Icon, type IconName } from "@/shared/components/icons";
import { useDelayedSkeleton } from "@/shared/components/ui/Skeleton";
import { s } from "@/shared/utils/scale";
import {
  UnifiedBillingSheet,
  IssuedPaymentPrompt,
  type ClientCandidate,
  type IssuedBillable,
  BillableDetailSheet,
  useBillablesByRelated,
  resolveBillingState,
} from "@/features/billing";
import {
  getInitial,
  getProfileColor,
} from "../(tabs)/_components/client-variants/helpers";
import { AssessmentDetailSkeleton } from "./_components/AssessmentDetailSkeleton";

/** 메모 박스 배경 (입력 컨테이너와 동일 톤) */
const MEMO_BG = "#F5F7F8";

/** 청구 버튼 배경 — mint @ 10% (#00C3BC + 1A). 상담 상세 청구 버튼과 동일 지정값 */
const MINT_BG = "#00C3BC1A";

function formatScheduleDateTime(
  startIso: string,
  endIso: string | null,
): string {
  const start = parseDate(startIso);
  const base = format(start, "yyyy년 M월 d일 (E) HH:mm", { locale: ko });
  if (!endIso) return base;
  return `${base} - ${format(parseDate(endIso), "HH:mm")}`;
}

export default function AssessmentCaseDetailScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const centerId = useCenterStore((st) => st.centerId);
  const { can } = usePermission();
  const canBilling = can("read:billing") || can("write:billing");
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // 다른 화면(필드노트 링크 시트 등)에서 task 연결/녹음이 바뀐 뒤 이 화면으로 돌아오면
  // by-task 칩이 stale 로 남아 '녹음'(미연결)으로 보이는 문제 → 포커스 시 갱신.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({
        queryKey: ["fieldNote", "byTask"],
        exact: false,
      });
    }, [queryClient]),
  );

  const {
    data: detail,
    isLoading,
    isError,
    refetch,
  } = useAssessmentCaseDetail(centerId, caseId ?? null);

  // task 상세 (소견 미리보기용)
  const { data: taskDetails } = useCaseTasks(centerId, caseId ?? null);
  const opinionByTaskId = useMemo(() => {
    const map = new Map<string, string | null>();
    taskDetails?.forEach((t) => map.set(t.id, t.opinion ?? null));
    return map;
  }, [taskDetails]);

  // 소견 작성 시트 — 케이스의 전체 task를 칩으로 전환하며 작성 (task.tsx와 동일 시트)
  const [opinionOpen, setOpinionOpen] = useState(false);
  const opinionTasks: OpinionTask[] = useMemo(
    () =>
      (taskDetails ?? []).map((t) => ({
        id: t.id,
        assessmentId: t.assessment_id,
        assessmentName: t.assessment?.kor_name ?? "검사",
        opinion: t.opinion ?? null,
        status: t.status,
        cancelledReason:
          (t.process?.["cancelled_reason"] as string | undefined) ?? null,
      })),
    [taskDetails],
  );

  // 청구
  const { data: caseBillables } = useBillablesByRelated({
    centerId,
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
  const [detailOpen, setDetailOpen] = useState(false);

  const billingClients: ClientCandidate[] = useMemo(() => {
    if (!detail) return [];
    const sessionId = detail.sessions?.[0]?.session_id;
    const sessionStart = detail.schedule?.start ?? detail.created_at;
    const programName =
      detail.set_name || detail.tasks?.[0]?.assessment_name || null;

    return detail.clients.map((c) => ({
      client: {
        id: c.client_id,
        name: c.name,
        gender: c.gender,
        age: c.age,
        program: programName,
        profileImageUrl: c.profile_image_url,
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
  }, [detail, caseBillables]);

  const handleBilling = () => {
    if (billingState === "none") {
      const firstClient = detail?.clients?.[0];
      if (firstClient) {
        setBillingTarget({ initialClientId: firstClient.client_id });
      }
    } else {
      setDetailOpen(true);
    }
  };

  // 검사 진행도 (완료된 task 개수) — 요약 카드 "N/M" 표기
  const totalTasks = detail?.tasks.length ?? 0;
  const completedTasks = useMemo(
    () =>
      detail?.tasks.filter(
        (t) => t.status === "completed" || t.status === "submitted",
      ).length ?? 0,
    [detail],
  );

  // 검사명 (세트 있으면 세트, 없으면 첫 검사 외 N건)
  const assessmentDisplay = useMemo<{ hasSet: boolean; name: string }>(() => {
    if (!detail) return { hasSet: false, name: "-" };
    if (detail.set_name) return { hasSet: true, name: detail.set_name };
    const names = detail.tasks.map((t) => t.assessment_name).filter(Boolean);
    if (names.length === 0) return { hasSet: false, name: "-" };
    if (names.length === 1) return { hasSet: false, name: names[0] };
    return { hasSet: false, name: `${names[0]} 외 ${names.length - 1}건` };
  }, [detail]);

  // 검사는 1:1 — 요약 카드에 쓸 대표 내담자
  const client = detail?.clients?.[0] ?? null;
  const clientGenderLabel = client?.gender
    ? (GENDER_LABELS[client.gender] ?? client.gender)
    : null;

  // 오프라인 / 온라인 검사 그룹
  const offlineTasks = useMemo(
    () => detail?.tasks.filter((t) => t.execution_method !== "online") ?? [],
    [detail],
  );
  const onlineTasks = useMemo(
    () => detail?.tasks.filter((t) => t.execution_method === "online") ?? [],
    [detail],
  );

  const openTask = (taskId: string) =>
    router.push({
      pathname: "/(main)/assessment/task",
      params: { caseId: caseId ?? "", taskId },
    });

  // 콜드 로딩에서만 스켈레톤(빠른 로딩 깜빡임 방지)
  const showSkeleton = useDelayedSkeleton(isLoading);

  const renderTask = (task: AssessmentTaskSummary, isLast: boolean) => (
    <TaskRow
      key={task.id}
      task={task}
      opinion={opinionByTaskId.get(task.id) ?? null}
      isLast={isLast}
      onPress={() => openTask(task.id)}
    />
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: COLORS.bg.base }}
      edges={["top"]}
    >
      {/* 헤더 — 뒤로가기 (정체성은 요약 카드로 이동) */}
      <View
        className="h-[52px] flex-row items-center px-5"
        style={{ backgroundColor: COLORS.bg.base }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
      </View>

      {showSkeleton && <AssessmentDetailSkeleton />}
      {isLoading && !showSkeleton && <View className="flex-1" />}

      {isError && !isLoading && (
        <View className="flex-1 items-center justify-center gap-2 px-5">
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={COLORS.gray[300]}
          />
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-600"
          >
            불러올 수 없습니다
          </Typography>
          <Typography variant="body-03" className="text-center text-gray-400">
            네트워크 연결을 확인하고 다시 시도해주세요.
          </Typography>
          <TouchableOpacity
            onPress={() => refetch()}
            activeOpacity={0.7}
            accessibilityLabel="다시 시도"
            accessibilityRole="button"
            className="mt-2 rounded-md bg-primary px-5 py-2"
          >
            <Typography
              variant="body-03"
              weight="semibold"
              className="text-white"
            >
              다시 시도
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {detail && !isLoading && (
        <ScrollView
          // 배경 흰색 → 하단 바운스(overscroll)가 흰색. 상단 바운스는 아래 회색 View로 덮음.
          style={{ backgroundColor: COLORS.white }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {/* 상단 바운스 시 회색이 보이도록 — 콘텐츠 위로 확장된 회색 배경(요약 Zone과 연결) */}
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
          {/* ────────── 상단 Gray Zone — 요약 카드 ────────── */}
          <View
            style={{
              backgroundColor: COLORS.bg.base,
              paddingTop: s(12),
              paddingBottom: s(20),
              paddingHorizontal: s(20),
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: s(20),
                padding: s(20),
              }}
            >
              {/* 검사 코드 — 최상단 caption (정체성과 12) */}
              {detail.case_code && (
                <Typography
                  variant="label-01"
                  weight="regular"
                  numberOfLines={1}
                  style={{ color: COLORS.gray[500], marginBottom: s(12) }}
                >
                  {detail.case_code}
                </Typography>
              )}
              {/* 내담자 정체성 */}
              {client && (
                <View className="flex-row items-center" style={{ gap: s(8) }}>
                  <ClientAvatar
                    seed={client.client_id}
                    name={client.name}
                    size={28}
                    imageUrl={client.profile_image_url}
                  />
                  <View
                    className="flex-1 flex-row items-center"
                    style={{ gap: s(8) }}
                  >
                    <Typography
                      variant="title-01"
                      weight="semibold"
                      numberOfLines={1}
                      style={{ flexShrink: 1, color: COLORS.gray[900] }}
                    >
                      {client.name}
                    </Typography>
                    <GenderAgeMeta genderLabel={clientGenderLabel} age={client.age} size="lg" />
                  </View>
                </View>
              )}

              {/* 검사명 + 진행도 — 정체성과 16 */}
              <View className="flex-row items-center" style={{ gap: s(8), marginTop: s(16) }}>
                {assessmentDisplay.hasSet && <SetBadge />}
                <Typography
                  variant="body-01"
                  weight="semibold"
                  numberOfLines={1}
                  style={{ flexShrink: 1, color: COLORS.gray[900] }}
                >
                  {assessmentDisplay.name}
                </Typography>
                {totalTasks > 0 && (
                  <Typography
                    variant="body-03"
                    weight="regular"
                    style={{ color: COLORS.gray[500] }}
                  >
                    {completedTasks}/{totalTasks}
                  </Typography>
                )}
              </View>

              {/* 일정 / 장소 — 검사명과 8, 행 사이 4 */}
              <View style={{ gap: s(4), marginTop: s(8) }}>
                <SummaryRow
                  icon="time-20"
                  label="일정"
                  value={
                    detail.schedule
                      ? formatScheduleDateTime(
                          detail.schedule.start,
                          detail.schedule.end,
                        )
                      : "아직 일정이 정해지지 않았어요"
                  }
                  muted={!detail.schedule}
                />
                <SummaryRow
                  icon="location-20"
                  label="장소"
                  value={detail.schedule?.room_name ?? "미정"}
                  muted={!detail.schedule?.room_name}
                />
              </View>

              {/* 메모 — 일정/장소와 16 */}
              <View
                style={{
                  backgroundColor: MEMO_BG,
                  borderRadius: s(12),
                  padding: s(14),
                  height: s(90),
                  gap: s(4),
                  marginTop: s(16),
                }}
              >
                <Typography variant="label-01" className="text-gray-500">
                  메모
                </Typography>
                {detail.schedule?.memo ? (
                  <Typography
                    variant="body-02-reading"
                    weight="regular"
                    className="text-gray-900"
                  >
                    {detail.schedule.memo}
                  </Typography>
                ) : (
                  <Typography
                    variant="body-02-reading"
                    weight="regular"
                    className="text-gray-400"
                  >
                    작성된 메모가 없어요
                  </Typography>
                )}
              </View>

              {/* 청구하기 — hero 카드 하단 (상담 청구 버튼과 동일 디자인) */}
              {canBilling && (
                <TouchableOpacity
                  onPress={handleBilling}
                  activeOpacity={0.7}
                  style={{
                    marginTop: s(16),
                    width: "100%",
                    height: s(44),
                    backgroundColor: MINT_BG,
                    borderRadius: s(10),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: s(4),
                  }}
                  accessibilityLabel={
                    billingState === "none"
                      ? "청구하기"
                      : billingState === "pending"
                        ? "청구 확인"
                        : "청구 완료"
                  }
                  accessibilityRole="button"
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
                    {billingState === "none"
                      ? "청구하기"
                      : billingState === "pending"
                        ? "청구 확인"
                        : "청구 완료"}
                  </Typography>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ────────── 하단 White Zone — 검사 목록 ────────── */}
          <View
            style={{
              // 리스트가 짧아도 흰 영역이 남은 높이를 채워 아래 회색 배경이 안 보이게
              flexGrow: 1,
              backgroundColor: COLORS.white,
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              paddingTop: s(24),
              paddingBottom: s(32),
              paddingHorizontal: s(20),
            }}
          >
            {/* 섹션 헤더 */}
            <View
              className="flex-row items-baseline"
              style={{ gap: s(6), marginBottom: s(16) }}
            >
              <Typography
                variant="title-01"
                weight="semibold"
                className="text-gray-900"
              >
                검사
              </Typography>
              <Typography variant="body-03" className="text-gray-400">
                {totalTasks}
              </Typography>
            </View>

            {totalTasks === 0 && (
              <Typography variant="body-03" className="py-3 text-gray-400">
                등록된 검사가 없어요
              </Typography>
            )}

            {/* 오프라인 검사 */}
            {offlineTasks.length > 0 && (
              <View
                style={{ marginBottom: onlineTasks.length > 0 ? s(24) : 0 }}
              >
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ marginBottom: s(4), color: COLORS.gray[600] }}
                >
                  오프라인 검사
                </Typography>
                {offlineTasks.map((task, i) =>
                  renderTask(task, i === offlineTasks.length - 1),
                )}
              </View>
            )}

            {/* 온라인 검사 */}
            {onlineTasks.length > 0 && (
              <View>
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ marginBottom: s(4), color: COLORS.gray[600] }}
                >
                  온라인 검사
                </Typography>
                {onlineTasks.map((task, i) =>
                  renderTask(task, i === onlineTasks.length - 1),
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ─── 소견 작성 푸터 (하단 고정) ─── */}
      {detail && opinionTasks.length > 0 && (
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
            style={{
              backgroundColor: "#4486FF",
              borderRadius: s(12),
              paddingVertical: s(15),
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel="소견 작성하기"
            accessibilityRole="button"
          >
            <Typography variant="body-02" weight="medium" className="text-white">
              소견 작성하기
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* 검사 청구 발행 시트 */}
      <UnifiedBillingSheet
        visible={billingTarget !== null}
        onClose={() => setBillingTarget(null)}
        centerId={centerId}
        caseId={caseId ?? ""}
        caseType="assessment"
        clients={billingClients}
        initialClientId={billingTarget?.initialClientId}
        tasks={detail?.tasks.map((t) => ({
          assessmentId: t.assessment_id,
          assessmentName: t.assessment_name,
        }))}
        onIssued={setIssuedBillable}
      />

      <IssuedPaymentPrompt
        issued={issuedBillable}
        centerId={centerId}
        onDone={() => setIssuedBillable(null)}
      />

      {/* 검사 청구 상세 시트 */}
      <BillableDetailSheet
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        centerId={centerId}
        billableId={billable?.id ?? null}
      />

      {/* 소견 작성 시트 — 케이스 전체 task */}
      <AssessmentOpinionSheet
        visible={opinionOpen}
        onClose={() => setOpinionOpen(false)}
        centerId={centerId}
        caseId={caseId ?? null}
        clientName={detail?.clients?.[0]?.name ?? null}
        tasks={opinionTasks}
      />
    </SafeAreaView>
  );
}

// ---------- 내부 컴포넌트 ----------

/** 내담자 아바타 — 프로필 이미지 우선, 실패/없으면 이니셜(사람별 고정 색) */
function ClientAvatar({
  seed,
  name,
  size,
  imageUrl,
}: {
  seed: string;
  name: string;
  size: number;
  imageUrl?: string | null;
}) {
  const color = getProfileColor(seed);
  const [imgError, setImgError] = useState(false);
  const showImage = !!imageUrl && !imgError;
  return (
    <View
      style={{
        width: s(size),
        height: s(size),
        borderRadius: s(size / 2),
        backgroundColor: color.bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={{ width: s(size), height: s(size) }}
          onError={() => setImgError(true)}
        />
      ) : (
        <Typography variant="body-01" weight="semibold" style={{ color: color.fg }}>
          {getInitial(name)}
        </Typography>
      )}
    </View>
  );
}

/** 요약 카드 일정/장소 행 — 아이콘 + 라벨(고정폭) + 값 */
function SummaryRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: IconName;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <View
        className="flex-row items-center"
        style={{ width: s(50), gap: s(4) }}
      >
        <Icon name={icon} size={20} color={COLORS.icon.tertiary} />
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.gray[600] }}
        >
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="regular"
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: s(12),
          color: muted ? COLORS.gray[400] : COLORS.gray[900],
        }}
      >
        {value}
      </Typography>
    </View>
  );
}

// 상태 태그 색 — 상담 회기 상태 배지와 동일한 tag.* 토큰 사용(톤 통일).
const TASK_STATUS_LABEL: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  in_progress: {
    label: "진행중",
    bg: COLORS.tag.blue.bg,
    fg: COLORS.tag.blue.fg,
  },
  submitted: {
    label: "제출됨",
    bg: COLORS.tag.amber.bg,
    fg: COLORS.tag.amber.fg,
  },
  completed: {
    label: "완료",
    bg: COLORS.tag.green.bg,
    fg: COLORS.tag.green.fg,
  },
  refused: {
    label: "거부",
    bg: COLORS.tag.red.bg,
    fg: COLORS.tag.red.fg,
  },
  cancelled: {
    label: "중단",
    bg: COLORS.tag.red.bg,
    fg: COLORS.tag.red.fg,
  },
};

/** 검사 항목 상태 뱃지 — 예정(pending)은 노출 안 함 (이미지처럼 깔끔하게) */
function TaskStatusBadge({ status }: { status: string }) {
  const m = TASK_STATUS_LABEL[status];
  if (!m) return null;
  return (
    <BadgeRound bg={m.bg} color={m.fg}>
      {m.label}
    </BadgeRound>
  );
}

/** 검사 항목 행 — 이름 + 소견 미리보기 + 상태 뱃지 + chevron. 탭 → 검사 항목 페이지 */
function TaskRow({
  task,
  opinion,
  isLast,
  onPress,
}: {
  task: AssessmentTaskSummary;
  opinion: string | null;
  isLast: boolean;
  onPress: () => void;
}) {
  const opinionText = opinion?.trim();
  const subtitle = opinionText || "검사 소견을 작성해주세요";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${task.assessment_name} 상세`}
      accessibilityRole="button"
      className="flex-row items-center"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
        paddingVertical: s(14),
        gap: s(10),
      }}
    >
      <View style={{ flex: 1, gap: s(3) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {task.assessment_name}
        </Typography>
        <Typography
          variant="label-01"
          numberOfLines={1}
          style={{ color: opinionText ? COLORS.gray[500] : COLORS.gray[400] }}
        >
          {subtitle}
        </Typography>
      </View>
      <TaskStatusBadge status={task.status} />
      <Icon name="arrow-right" size={16} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}
