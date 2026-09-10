import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFieldNotePlatform } from './platform/context';
// TODO(extraction): 스케줄 데이터 훅은 아직 포트로 빼지 않음 — platform/EXTRACTION.md 참고
import { useScheduleDetail, SCHEDULE_TYPE_LABELS } from '@/features/schedule';
import {
  useFieldNote,
  useFieldNoteBySchedule,
  useCreateFieldNote,
  useAddEntry,
  useUploadAudioChunk,
  useFinishRecording,
  useRetryPipeline,
  useLinkSchedule,
  useUpdateSpeakerMap,
  useRecommendation,
  useDeleteFieldNote,
} from './hooks';
import { useRecorder } from './useRecorder';
import { useTimer } from './useTimer';
import type { ProcessingStatus, FieldNoteDetailResponse } from './types';

export type ScreenMode =
  | 'new'
  | 'resume'
  | 'recording'
  | 'processing'
  | 'pending_analysis'
  | 'completed'
  | 'failed';

export interface FieldNoteOrchestration {
  // Route params
  scheduleId: string | undefined;
  isQuickMode: boolean;
  preloadFieldNoteId: string | undefined;
  // Navigation
  router: ReturnType<typeof useRouter>;
  onBack: () => void;
  // IDs
  centerId: string | null;
  fieldNoteId: string | null;
  setFieldNoteId: (id: string | null) => void;
  // Data
  fieldNote: FieldNoteDetailResponse | null | undefined;
  existingFieldNote: FieldNoteDetailResponse | null | undefined;
  effectiveFieldNote: FieldNoteDetailResponse | null;
  schedule: ReturnType<typeof useScheduleDetail>['data'];
  // Status
  processingStatus: ProcessingStatus;
  screenMode: ScreenMode;
  isLoadingExisting: boolean;
  isLoadingFieldNote: boolean;
  holdProcessingView: boolean;
  // Session info
  sessionInfo: string;
  // Core hooks
  recorder: ReturnType<typeof useRecorder>;
  timer: ReturnType<typeof useTimer>;
  // Mutations
  createMutation: ReturnType<typeof useCreateFieldNote>;
  addEntryMutation: ReturnType<typeof useAddEntry>;
  uploadMutation: ReturnType<typeof useUploadAudioChunk>;
  finishMutation: ReturnType<typeof useFinishRecording>;
  deleteMutation: ReturnType<typeof useDeleteFieldNote>;
  retryMutation: ReturnType<typeof useRetryPipeline>;
  linkMutation: ReturnType<typeof useLinkSchedule>;
  speakerMapMutation: ReturnType<typeof useUpdateSpeakerMap>;
  recommendMutation: ReturnType<typeof useRecommendation>;
  // Derived data
  audios: FieldNoteDetailResponse['audios'];
  entries: FieldNoteDetailResponse['entries'];
  // Completion animation
  onCompletionAnimationDone: () => void;
}

export function useFieldNoteOrchestrator(
  opts?: { scheduleId?: string; fieldNoteId?: string },
): FieldNoteOrchestration {
  // 라우트(`[scheduleId]`)에선 route params 로, 오버레이(목록 morph)에선 opts 로 주입.
  const params = useLocalSearchParams<{ scheduleId?: string; fieldNoteId?: string }>();
  const rawScheduleId = opts?.scheduleId ?? params.scheduleId;
  const preloadFieldNoteId = opts?.fieldNoteId ?? params.fieldNoteId;
  const router = useRouter();
  const { centerId } = useFieldNotePlatform();

  const scheduleId = rawScheduleId === '_quick' ? undefined : rawScheduleId;
  const isQuickMode = !scheduleId;

  // --- State ---
  const [fieldNoteId, setFieldNoteId] = useState<string | null>(preloadFieldNoteId ?? null);

  // --- Processing view minimum display time ---
  const processingEnteredAt = useRef<number | null>(null);
  const [holdProcessingView, setHoldProcessingView] = useState(false);
  const PROCESSING_MIN_DISPLAY_MS = 2500;

  // --- Completion animation hold ---
  const completionDoneRef = useRef(false);
  const [completionAnimating, setCompletionAnimating] = useState(false);
  const onCompletionAnimationDone = useCallback(() => {
    // ProcessingScreen 완료 애니메이션 종료 — 즉시 핸드오프.
    // (분석이 MIN_DISPLAY 보다 빨리 끝나면, hold 타이머가 뒤늦게 completionAnimating 을
    //  다시 켜서 ProcessingScreen 이 opacity 0 인 채 멈추는 "검정 화면" 레이스가 있었음.)
    completionDoneRef.current = true;
    setCompletionAnimating(false);
    setHoldProcessingView(false);
    processingEnteredAt.current = null;
  }, []);

  // --- Schedule info ---
  const { data: schedule } = useScheduleDetail(centerId, scheduleId ?? null);

  // --- 기존 필드노트 확인 ---
  const { data: existingFieldNote, isLoading: isLoadingExisting } = useFieldNoteBySchedule(centerId, scheduleId ?? null);

  useEffect(() => {
    if (existingFieldNote?.id && !fieldNoteId) {
      setFieldNoteId(existingFieldNote.id);
    }
  }, [existingFieldNote?.id, fieldNoteId]);

  // --- Field note data (polling when processing or recording) ---
  const [liveProcessingStatus, setLiveProcessingStatus] = useState<ProcessingStatus>('idle');
  const [isActivelyRecording, setIsActivelyRecording] = useState(false);
  const { data: fieldNote, isLoading: isLoadingFieldNote } = useFieldNote(centerId, fieldNoteId, liveProcessingStatus, isActivelyRecording);

  const processingStatus: ProcessingStatus =
    (fieldNote?.processing_status ?? existingFieldNote?.processing_status ?? 'idle') as ProcessingStatus;

  useEffect(() => {
    setLiveProcessingStatus(processingStatus);
  }, [processingStatus]);

  // Track processing view entry time & hold for minimum display duration.
  // When processing completes, start completion animation hold to keep
  // ProcessingScreen visible during the exit animation sequence.
  useEffect(() => {
    if (processingStatus === 'processing') {
      if (processingEnteredAt.current === null) {
        processingEnteredAt.current = Date.now();
        completionDoneRef.current = false; // 새 처리 사이클 시작 — done 플래그 리셋
        setHoldProcessingView(true);
      }
    } else if (processingEnteredAt.current !== null) {
      const elapsed = Date.now() - processingEnteredAt.current;
      const remaining = PROCESSING_MIN_DISPLAY_MS - elapsed;

      const startCompletionAnim = () => {
        setHoldProcessingView(false);
        processingEnteredAt.current = null;
        // 이미 완료 애니메이션이 끝났으면(빠른 완료) 다시 켜지 않음 — 검정 화면 방지.
        if (processingStatus === 'completed' && !completionDoneRef.current) {
          setCompletionAnimating(true);
        }
      };

      if (remaining > 0) {
        const timeout = setTimeout(startCompletionAnim, remaining);
        return () => clearTimeout(timeout);
      } else {
        startCompletionAnim();
      }
    }
  }, [processingStatus]);

  // --- Mutations ---
  const createMutation = useCreateFieldNote(centerId);
  const addEntryMutation = useAddEntry(centerId, fieldNoteId);
  const uploadMutation = useUploadAudioChunk(centerId, fieldNoteId);
  const finishMutation = useFinishRecording(centerId, fieldNoteId);
  const deleteMutation = useDeleteFieldNote(centerId);
  const retryMutation = useRetryPipeline(centerId, fieldNoteId);
  const linkMutation = useLinkSchedule(centerId, fieldNoteId);
  const speakerMapMutation = useUpdateSpeakerMap(centerId, fieldNoteId);
  const recommendMutation = useRecommendation(centerId, fieldNoteId);

  // --- Timer ---
  const timer = useTimer();

  // --- Recorder ---
  const onChunkReady = useCallback(
    (fileUri: string, _chunkIndex: number, duration: number) => {
      if (fieldNoteId) {
        uploadMutation.mutate({ fileUri, duration });
      }
    },
    [fieldNoteId, uploadMutation],
  );

  const recorder = useRecorder({ onChunkReady });

  useEffect(() => {
    setIsActivelyRecording(recorder.isRecording);
  }, [recorder.isRecording]);

  // --- Effective field note ---
  const effectiveFieldNote = existingFieldNote ?? fieldNote ?? null;

  // --- Screen mode ---
  // 녹음+전사가 끝난 회기(status='completed')에서 AI 분석(summary)만 다시 도는 케이스는
  // ProcessingScreen 으로 화면 전환하지 않고 CompletedScreen 안 AI 탭에서 로딩만 표시.
  // (summary 단계는 transcribe 이후라 'generating' 자체가 전사는 끝났다는 신호.)
  const isPostCompletionSummaryRun =
    effectiveFieldNote?.status === 'completed' &&
    (effectiveFieldNote?.summary_status === 'generating' ||
      effectiveFieldNote?.summary_status === 'failed');

  // "저장만 하기" 로 종료된 노트 — 녹음은 끝났지만 전사/분석이 안 됨.
  // CompletedScreen 의 탭 3개는 의미 없으므로 PendingAnalysisScreen 으로 분기.
  // 전사 존재 판정 — 화자분리 결과(diarized_transcript)도 전사로 인정한다.
  // transcribe 스텝은 diarized_transcript 만 채우고 plain transcript 는 비워두므로,
  // diarized 를 안 보면 화자분리 성공한 노트가 '아직 분석 안 됨'으로 잘못 빠진다.
  const hasTranscript =
    !!effectiveFieldNote?.refined_transcript ||
    !!effectiveFieldNote?.audios?.some(
      (a) => !!a.diarized_transcript || (a.transcript_status === 'completed' && !!a.transcript),
    );
  // "아직 분석 안 됨" — 전사도 없고 요약도 없을 때만. 요약이 한번 생성됐으면(빈 내용이라도)
  // CompletedScreen 으로 가야 함(안 그러면 분석 후에도 pending 으로 되돌아오는 루프).
  const isPendingAnalysis =
    effectiveFieldNote?.status === 'completed' &&
    !hasTranscript &&
    effectiveFieldNote?.summary_status !== 'completed' &&
    effectiveFieldNote?.processing_status !== 'processing' &&
    effectiveFieldNote?.processing_status !== 'failed';

  const screenMode: ScreenMode = useMemo(() => {
    if (recorder.isRecording || recorder.isPaused) return 'recording';
    if (!effectiveFieldNote) return 'new';
    if (isPostCompletionSummaryRun) return 'completed';
    if (processingStatus === 'processing' || holdProcessingView || completionAnimating) return 'processing';
    if (processingStatus === 'failed') return 'failed';
    if (isPendingAnalysis) return 'pending_analysis';
    if (effectiveFieldNote.status === 'completed') return 'completed';
    return 'resume';
  }, [
    effectiveFieldNote,
    recorder.isRecording,
    recorder.isPaused,
    processingStatus,
    holdProcessingView,
    completionAnimating,
    isPostCompletionSummaryRun,
    isPendingAnalysis,
  ]);

  // Auto-resume 제거됨 — 사용자가 ResumeScreen 에서 [이어서 녹음] / [분석하기] 명시적 선택.
  // 자동 녹음 재개는 의도치 않은 마이크 활성화 및 화면 전환을 일으켜 위험.

  // --- Session info text ---
  const sessionInfo = useMemo(() => {
    if (!schedule) return '';
    const clients = schedule.sessions
      .flatMap((s: { clients: { client_name: string }[] }) => s.clients.map((c) => c.client_name))
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    const typeLabel = SCHEDULE_TYPE_LABELS[schedule.schedule_type] || '';
    const sessionNum = schedule.sessions[0]?.session_number;
    const parts = [...clients, typeLabel];
    if (sessionNum) parts.push(`회기 ${sessionNum}`);
    return parts.join(' · ');
  }, [schedule]);

  const onBack = useCallback(() => router.back(), [router]);

  // --- Derived data ---
  const audios = useMemo(() => {
    return fieldNote?.audios ?? existingFieldNote?.audios ?? [];
  }, [fieldNote?.audios, existingFieldNote?.audios]);

  const entries = useMemo(() => {
    const raw = fieldNote?.entries ?? existingFieldNote?.entries ?? [];
    return [...raw].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [fieldNote?.entries, existingFieldNote?.entries]);

  return {
    scheduleId,
    isQuickMode,
    preloadFieldNoteId,
    router,
    onBack,
    centerId,
    fieldNoteId,
    setFieldNoteId,
    fieldNote,
    existingFieldNote,
    effectiveFieldNote,
    schedule,
    processingStatus,
    screenMode,
    isLoadingExisting,
    isLoadingFieldNote,
    holdProcessingView,
    sessionInfo,
    recorder,
    timer,
    createMutation,
    addEntryMutation,
    uploadMutation,
    finishMutation,
    deleteMutation,
    retryMutation,
    linkMutation,
    speakerMapMutation,
    recommendMutation,
    audios,
    entries,
    onCompletionAnimationDone,
  };
}
