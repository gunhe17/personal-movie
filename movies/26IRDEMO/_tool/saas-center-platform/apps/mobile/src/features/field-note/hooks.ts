import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFieldNote,
  getFieldNote,
  getFieldNoteBySchedule,
  getFieldNoteStatuses,
  getFieldNotesByTask,
  addEntry,
  uploadAudioChunk,
  finishRecording,
  retryPipeline,
  runPipeline,
  generateSummary,
  diarizeFieldNote,
  generateCounselingNote,
  linkSchedule,
  linkTask,
  getLinkableAssessmentTasks,
  updateSpeakerMap,
  getUnlinkedFieldNotes,
  getFieldNotes,
  getRecommendation,
  deleteFieldNote,
  getAudioDownloadUrl,
} from "./api";
import { POLLING_INTERVAL_MS, PRESIGNED_URL_CACHE_MS } from "./constants";
import type { ProcessingStatus } from "./types";

/** 필드노트 상세 쿼리 (processing 또는 recording 중 자동 폴링).
 * 외부 트리거(processingStatus/isRecording) 외에, 데이터의 summary_status='generating'
 * 인 동안에도 자동 폴링 — AI 분석 재생성 등 완료된 회기에서 후속 LLM 단계만 도는 경우 대응. */
export function useFieldNote(
  centerId: string | null,
  fieldNoteId: string | null,
  processingStatus?: ProcessingStatus,
  isRecording?: boolean,
) {
  const shouldPoll = processingStatus === "processing" || isRecording;

  return useQuery({
    queryKey: ["fieldNote", centerId, fieldNoteId],
    queryFn: () => getFieldNote(centerId!, fieldNoteId!),
    enabled: !!centerId && !!fieldNoteId,
    refetchInterval: (query) => {
      if (shouldPoll) return POLLING_INTERVAL_MS;
      const data = query.state.data;
      if (data?.summary_status === "generating") return POLLING_INTERVAL_MS;
      // 상담일지 자동 생성(processing) 중에도 폴링 — 완료 감지용
      if (data?.note_status === "processing") return POLLING_INTERVAL_MS;
      // 화자분리(유료 온디맨드) 진행 중에도 폴링 — 완료 시 화자별 대화로 갱신
      if (data?.diarization_status === "processing") return POLLING_INTERVAL_MS;
      return false;
    },
  });
}

/** 일정별 필드노트 조회 */
export function useFieldNoteBySchedule(
  centerId: string | null,
  scheduleId: string | null,
) {
  return useQuery({
    queryKey: ["fieldNote", "bySchedule", centerId, scheduleId],
    queryFn: () => getFieldNoteBySchedule(centerId!, scheduleId!),
    enabled: !!centerId && !!scheduleId,
    retry: false,
  });
}

/** 필드노트 상태 일괄 조회 (schedule_ids → {schedule_id: status} 맵) */
export function useFieldNoteStatuses(
  centerId: string | null,
  scheduleIds: string[],
) {
  return useQuery({
    queryKey: ["fieldNote", "statuses", centerId, scheduleIds],
    queryFn: () => getFieldNoteStatuses(centerId!, scheduleIds),
    enabled: !!centerId && scheduleIds.length > 0,
  });
}

/** 검사 항목(task)별 필드노트 목록 조회 (녹음중/분석중이면 자동 폴링) */
export function useFieldNotesByTask(
  centerId: string | null,
  taskId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["fieldNote", "byTask", centerId, taskId],
    queryFn: () => getFieldNotesByTask(centerId!, taskId!),
    enabled: !!centerId && !!taskId && enabled,
    refetchInterval: (query) => {
      const items = query.state.data;
      const active = items?.some(
        (i) =>
          i.status === "recording" ||
          i.processing_status === "processing",
      );
      return active ? POLLING_INTERVAL_MS : false;
    },
  });
}

/** 필드노트 생성 mutation (scheduleId=회기 / taskId=검사 항목, 둘 다 없이도 가능) */
export function useCreateFieldNote(centerId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars?: { scheduleId?: string | null; taskId?: string | null }) =>
      createFieldNote(centerId!, vars?.scheduleId ?? null, vars?.taskId ?? null),
    onSuccess: (data) => {
      queryClient.setQueryData(["fieldNote", centerId, data.id], data);
      if (data.task_id) {
        queryClient.invalidateQueries({
          queryKey: ["fieldNote", "byTask", centerId, data.task_id],
        });
        // task에 노트가 생기면 연결 후보(linkable-tasks)에서 제외돼야 함 (백엔드 필터 동기화)
        queryClient.invalidateQueries({
          queryKey: ["linkableAssessmentTasks"],
          exact: false,
        });
      }
    },
  });
}

/** 메모/태그 추가 mutation */
export function useAddEntry(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      entry_type: "memo" | "tag";
      tag_category?: string | null;
      content: string;
      timestamp_seconds: number;
    }) => addEntry(centerId!, fieldNoteId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["fieldNote", centerId, fieldNoteId],
      });
    },
  });
}

/** 오디오 청크 업로드 mutation */
export function useUploadAudioChunk(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  return useMutation({
    mutationFn: (params: { fileUri: string; duration: number }) =>
      uploadAudioChunk(
        centerId!,
        fieldNoteId!,
        params.fileUri,
        params.duration,
      ),
  });
}

/** 녹음 종료 mutation */
export function useFinishRecording(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { totalDuration: number; skipPipeline?: boolean }) =>
      finishRecording(
        centerId!,
        fieldNoteId!,
        params.totalDuration,
        params.skipPipeline,
      ),
    onSuccess: (data) => {
      // 즉시 캐시 업데이트 — processing_status: "processing" 을 바로 반영
      // (invalidate refetch를 기다리면 그 사이에 stale 데이터로 screenMode가 꼬임)
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({ queryKey: ["fieldNote"], exact: false });
    },
  });
}

/** 파이프라인 재시도 mutation */
export function useRetryPipeline(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => retryPipeline(centerId!, fieldNoteId!),
    onSuccess: (data) => {
      // 즉시 캐시 업데이트 — processing_status: "processing" 반영
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({
        queryKey: ["fieldNote", centerId, fieldNoteId],
      });
    },
  });
}

/** 남은 파이프라인 전체 실행 mutation (transcribe → summary).
 * "저장만 하기" 또는 transcribe 만 된 노트의 분석 시작에 사용. 이미 완료된 step 은 백엔드가 스킵. */
export function useRunPipeline(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => runPipeline(centerId!, fieldNoteId!),
    onSuccess: () => {
      // processing_status='processing' 으로 즉시 반영. useFieldNote 폴링이 알아서 갱신.
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, processing_status: "processing" } : old,
      );
      queryClient.invalidateQueries({
        queryKey: ["fieldNote", centerId, fieldNoteId],
      });
    },
  });
}

/** AI 분석 생성/재생성 mutation.
 * 응답이 PipelineStepResponse(detail 아님)라서 캐시에 spread 하면 status 등이 깨진다.
 * 백엔드가 변경하는 두 필드만 명시적으로 즉시 반영 → useFieldNote 폴링이 곧 정확한 detail 로 덮어씀. */
export function useGenerateSummary(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateSummary(centerId!, fieldNoteId!),
    onSuccess: () => {
      // summary_status 만 즉시 'generating' 으로 → CompletedScreen 의 AI 탭이 로딩으로 전환.
      // processing_status 는 일부러 건드리지 않는다 — 건드리면 orchestrator screenMode 가
      // 'completed' 에서 'processing' 으로 빠져 ProcessingScreen 으로 화면 전환됨.
      // useFieldNote 폴링은 summary_status='generating' 자체 감지로 자동 작동.
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, summary_status: "generating" } : old,
      );
      queryClient.invalidateQueries({
        queryKey: ["fieldNote", centerId, fieldNoteId],
      });
    },
  });
}

/** 화자분리 (유료 온디맨드) mutation.
 * status='started' 일 때만 diarization_status='processing' 으로 즉시 반영 →
 * useFieldNote 폴링(diarization_status==='processing')이 완료까지 추적해 화자별 대화로 갱신.
 * insufficient_credit/already_done 등은 캐시를 건드리지 않는다(호출부에서 토스트 처리). */
export function useDiarize(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => diarizeFieldNote(centerId!, fieldNoteId!),
    onSuccess: (data) => {
      if (data.status === "started") {
        queryClient.setQueryData(
          ["fieldNote", centerId, fieldNoteId],
          (old: Record<string, unknown> | undefined) =>
            old ? { ...old, diarization_status: "processing" } : old,
        );
        queryClient.invalidateQueries({
          queryKey: ["fieldNote", centerId, fieldNoteId],
        });
      }
    },
  });
}

/** 상담일지 초안 자동 생성 mutation.
 * generateSummary 패턴과 동일 — note_status 만 즉시 'processing' 으로 반영하고
 * useFieldNote 폴링(note_status==='processing')이 완료까지 추적한다.
 * 응답 status 가 'started' 가 아니면(회기 미연결·내담자 없음 등) 캐시를 건드리지 않는다. */
export function useGenerateCounselingNote(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteTemplateType?: string) =>
      generateCounselingNote(centerId!, fieldNoteId!, noteTemplateType),
    onSuccess: (data) => {
      if (data.status === "started") {
        queryClient.setQueryData(
          ["fieldNote", centerId, fieldNoteId],
          (old: Record<string, unknown> | undefined) =>
            old ? { ...old, note_status: "processing" } : old,
        );
        queryClient.invalidateQueries({
          queryKey: ["fieldNote", centerId, fieldNoteId],
        });
      }
    },
  });
}

/** note_status 가 processing→completed 로 전환되는 순간을 감지해
 * 상담일지 캐시(myCounselingNotes/counselingNotes)를 무효화 + onComplete 콜백 실행.
 * 자동 생성을 트리거한 화면에서 useFieldNote 의 note_status 를 넘겨 구독한다. */
export function useCounselingNoteGenerationComplete(
  noteStatus: string | null | undefined,
  handlers?: { onComplete?: () => void; onFailed?: () => void },
) {
  const queryClient = useQueryClient();
  const prev = useRef(noteStatus);

  useEffect(() => {
    const was = prev.current;
    prev.current = noteStatus;
    if (was !== "processing") return;
    if (noteStatus === "completed") {
      queryClient.invalidateQueries({ queryKey: ["myCounselingNotes"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["counselingNotes"], exact: false });
      handlers?.onComplete?.();
    } else if (noteStatus === "failed") {
      handlers?.onFailed?.();
    }
  }, [noteStatus]);
}

/** 화자 이름 매핑 업데이트 mutation */
export function useUpdateSpeakerMap(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (speakerMap: Record<string, string>) =>
      updateSpeakerMap(centerId!, fieldNoteId!, speakerMap),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...data } : data,
      );
    },
  });
}

/** 회기 연결 mutation */
export function useLinkSchedule(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      linkSchedule(centerId!, fieldNoteId!, scheduleId),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({ queryKey: ["fieldNote"], exact: false });
    },
  });
}

/** 검사 항목(task) 연결 mutation — 검사별 필드노트 */
export function useLinkTask(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      linkTask(centerId!, fieldNoteId!, taskId),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["fieldNote", centerId, fieldNoteId],
        (old: Record<string, unknown> | undefined) =>
          old ? { ...old, ...data } : data,
      );
      queryClient.invalidateQueries({ queryKey: ["fieldNote"], exact: false });
      queryClient.invalidateQueries({
        queryKey: ["linkableAssessmentTasks"],
        exact: false,
      });
    },
  });
}

/** 특정 검사(task)에 선택한 필드노트를 연결 — 검사 상세에서 목록→연결 흐름 */
export function useLinkNoteToTask(
  centerId: string | null,
  taskId: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldNoteId: string) =>
      linkTask(centerId!, fieldNoteId, taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fieldNote"], exact: false });
      queryClient.invalidateQueries({
        queryKey: ["linkableAssessmentTasks"],
        exact: false,
      });
    },
  });
}

/** 연결 가능한 검사 task 목록 (진행중 케이스 onsite·미완료) */
export function useLinkableAssessmentTasks(centerId: string | null) {
  return useQuery({
    queryKey: ["linkableAssessmentTasks", centerId],
    queryFn: () => getLinkableAssessmentTasks(centerId!),
    enabled: !!centerId,
  });
}

/** AI 상담 추천 mutation */
export function useRecommendation(
  centerId: string | null,
  fieldNoteId: string | null,
) {
  return useMutation({
    mutationFn: () => getRecommendation(centerId!, fieldNoteId!),
  });
}

/** 필드노트 삭제 mutation */
export function useDeleteFieldNote(centerId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fieldNoteId: string) =>
      deleteFieldNote(centerId!, fieldNoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fieldNote"], exact: false });
      // 노트 삭제(취소)로 task가 다시 연결 후보가 되도록 linkable-tasks 갱신
      queryClient.invalidateQueries({
        queryKey: ["linkableAssessmentTasks"],
        exact: false,
      });
    },
  });
}

/** 오디오 청크 다운로드 URL 조회 */
export function useAudioDownloadUrl(
  centerId: string | null,
  fieldNoteId: string | null,
  audioId: string | null,
) {
  return useQuery({
    queryKey: ["fieldNote", "audioUrl", centerId, fieldNoteId, audioId],
    queryFn: () => getAudioDownloadUrl(centerId!, fieldNoteId!, audioId!),
    enabled: !!centerId && !!fieldNoteId && !!audioId,
    staleTime: PRESIGNED_URL_CACHE_MS,
  });
}

/** 미연결 필드노트 목록 조회 (processing 중인 항목이 있으면 자동 폴링) */
export function useUnlinkedFieldNotes(
  centerId: string | null,
  params?: { analysis_state?: string },
) {
  const query = useQuery({
    queryKey: ["fieldNote", "unlinked", centerId, params],
    queryFn: () => getUnlinkedFieldNotes(centerId!, params),
    enabled: !!centerId,
    refetchInterval: (query) => {
      const data = query.state.data as
        | Awaited<ReturnType<typeof getUnlinkedFieldNotes>>
        | undefined;
      if (!data) return false;
      const hasProcessing = data.some(
        (fn) => fn.processing_status === "processing",
      );
      return hasProcessing ? POLLING_INTERVAL_MS : false;
    },
  });
  return query;
}

/** 전체 필드노트 목록 조회 (연결+미연결). processing/generating 항목 자동 폴링. */
export function useFieldNotes(
  centerId: string | null,
  params?: { linked?: boolean; link_type?: 'schedule' | 'task' | 'none'; analysis_state?: string; page?: number; size?: number },
) {
  return useQuery({
    queryKey: ["fieldNote", "list", centerId, params],
    queryFn: () => getFieldNotes(centerId!, params),
    enabled: !!centerId,
    refetchInterval: (query) => {
      const data = query.state.data as
        | Awaited<ReturnType<typeof getFieldNotes>>
        | undefined;
      if (!data) return false;
      const hasActive = data.items.some(
        (fn) =>
          fn.processing_status === "processing" ||
          fn.summary_status === "generating",
      );
      return hasActive ? POLLING_INTERVAL_MS : false;
    },
  });
}
