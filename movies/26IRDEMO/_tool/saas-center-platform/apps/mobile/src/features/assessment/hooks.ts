import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAssessmentCaseList,
  getAssessmentCaseDetail,
  getCaseTasks,
  updateTaskOpinion,
  completeTask,
  revertTask,
  cancelTask,
  refuseTask,
  rollbackTask,
  getDocumentDownloadUrl,
} from "./api";

export function useAssessmentCaseList(
  centerId: string | null,
  status?: string,
  size = 50,
) {
  return useQuery({
    queryKey: ["assessmentCaseList", centerId, status, size],
    queryFn: () =>
      getAssessmentCaseList({
        centerId: centerId!,
        status: status || undefined,
        size,
      }),
    enabled: !!centerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAssessmentCaseDetail(
  centerId: string | null,
  caseId: string | null,
) {
  return useQuery({
    queryKey: ["assessmentCaseDetail", centerId, caseId],
    queryFn: () => getAssessmentCaseDetail(centerId!, caseId!),
    enabled: !!centerId && !!caseId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCaseTasks(centerId: string | null, caseId: string | null) {
  return useQuery({
    queryKey: ["assessmentCaseTasks", centerId, caseId],
    queryFn: () => getCaseTasks(centerId!, caseId!),
    enabled: !!centerId && !!caseId,
    staleTime: 60 * 1000,
  });
}

export function useDocumentDownloadUrl(
  centerId: string | null,
  documentId: string | null,
) {
  return useQuery({
    queryKey: ["documentDownloadUrl", centerId, documentId],
    queryFn: () => getDocumentDownloadUrl(centerId!, documentId!),
    enabled: !!centerId && !!documentId,
    // presigned URL은 1시간 유효 — 만료 전 재사용
    staleTime: 50 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
  });
}

export function useUpdateTaskOpinion(
  centerId: string | null,
  caseId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      opinion,
    }: {
      taskId: string;
      opinion: string | null;
    }) => updateTaskOpinion(centerId!, taskId, opinion),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["assessmentCaseTasks", centerId, caseId],
      });
      queryClient.invalidateQueries({
        queryKey: ["assessmentCaseDetail", centerId, caseId],
      });
    },
  });
}

/** 검사 항목 상태 변경 (중단·거부·되돌리기) — 완료/삭제는 web 전용 */
export function useTaskStatusActions(
  centerId: string | null,
  caseId: string | null,
) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["assessmentCaseTasks", centerId, caseId],
    });
    queryClient.invalidateQueries({
      queryKey: ["assessmentCaseDetail", centerId, caseId],
    });
  };

  const complete = useMutation({
    mutationFn: ({ assessmentId }: { assessmentId: string }) =>
      completeTask(centerId!, caseId!, assessmentId),
    onSettled: invalidate,
  });

  const revert = useMutation({
    mutationFn: ({ assessmentId }: { assessmentId: string }) =>
      revertTask(centerId!, caseId!, assessmentId),
    onSettled: invalidate,
  });

  const cancel = useMutation({
    mutationFn: ({
      taskId,
      reason,
    }: {
      taskId: string;
      reason: string | null;
    }) => cancelTask(centerId!, taskId, reason),
    onSettled: invalidate,
  });

  const refuse = useMutation({
    mutationFn: ({
      assessmentId,
      reason,
    }: {
      assessmentId: string;
      reason: string;
    }) => refuseTask(centerId!, caseId!, assessmentId, reason),
    onSettled: invalidate,
  });

  const rollback = useMutation({
    mutationFn: ({ taskId }: { taskId: string }) =>
      rollbackTask(centerId!, taskId),
    onSettled: invalidate,
  });

  return { complete, revert, cancel, refuse, rollback };
}
