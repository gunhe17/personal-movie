import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, AppState } from 'react-native';
import { showMicPermissionDeniedAlert } from '@/shared/utils/permissions';
import { useFieldNotePlatform } from './platform/context';
import {
  useFieldNote,
  useCreateFieldNote,
  useAddEntry,
  useUploadAudioChunk,
  useFinishRecording,
  useRecommendation,
  useDeleteFieldNote,
  useLinkableAssessmentTasks,
} from './hooks';
import { useRecorder } from './useRecorder';
import { useTimer } from './useTimer';
import { useWaveformAnimation } from './useWaveformAnimation';
import { useRecordingTimeline } from './useRecordingTimeline';
import { useSTTConfig } from './useSTTConfig';
import { useStreamingMode } from './useStreamingMode';
import { useRecordingStore } from './recordingStore';
import { useBackgroundProcessingStore } from './backgroundProcessingStore';
import { useScheduleList } from '@/features/schedule';
import { RecordingSheet, type RecordingContext } from './components/RecordingSheet';
import { RecordingConfirmModal, type RecordingConfirmModalProps } from './components/StopConfirmModal';
import type { STTMode } from './types';

/**
 * Quick mode 필드노트 녹음의 호스트 컴포넌트.
 * (main)/_layout에서 1회 마운트되어 어떤 화면에서도 녹음이 살아있게 한다.
 *
 * - 일정에 연결된 녹음(`/(main)/field-note/[scheduleId]` 페이지)은 별도 흐름이며
 *   여기서는 다루지 않는다 (Phase 1 범위).
 */
export function RecordingHost() {
  const { centerId, notify: showToast } = useFieldNotePlatform();

  const sheetVisible = useRecordingStore((s) => s.sheetVisible);
  const minimizeSheet = useRecordingStore((s) => s.minimizeSheet);
  const openSheet = useRecordingStore((s) => s.openSheet);

  // 녹음 대상 컨텍스트(좌상단 표기) — 연결된 scheduleId/taskId 를 캐시된 오늘 목록에서 풀어낸다.
  // id 가 있을 때만 조회(미연결 녹음은 컨텍스트 없음). 오늘 목록에 없으면(과거/이어녹음) null.
  const ctxScheduleId = useRecordingStore((s) => s.scheduleId);
  const ctxTaskId = useRecordingStore((s) => s.taskId);
  // 선택 시점에 보존한 컨텍스트 — 있으면 이걸 1순위로 쓴다(쿼리 재조회로 사라지지 않음).
  const pickedContext = useRecordingStore((s) => s.context);
  const ctxToday = useMemo(() => new Date(), []);
  const { data: ctxSchedules } = useScheduleList(ctxScheduleId ? centerId : null, ctxToday);
  const { data: ctxTasks } = useLinkableAssessmentTasks(ctxTaskId ? centerId : null);
  const recordingContext = useMemo<RecordingContext | null>(() => {
    if (pickedContext) return pickedContext;
    if (ctxScheduleId) {
      const sc = ctxSchedules?.find((x) => x.id === ctxScheduleId);
      if (sc) {
        const names = sc.client_names ?? [];
        const client =
          names.length === 0 ? '내담자' : names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0];
        return { client, sub: sc.program_name ?? null, kind: 'counseling' };
      }
    }
    if (ctxTaskId) {
      const t = ctxTasks?.find((x) => x.task_id === ctxTaskId);
      if (t) {
        return {
          client: t.client_name ?? '내담자',
          sub: t.assessment_kor_name ?? t.assessment_code ?? '검사',
          kind: 'assessment',
        };
      }
    }
    return null;
  }, [pickedContext, ctxScheduleId, ctxTaskId, ctxSchedules, ctxTasks]);

  const [fieldNoteId, setFieldNoteId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');
  // 종료/취소 확인 다이얼로그. 닫히는 애니메이션 동안 내용 깜빡임 방지용 lastDialogRef.
  const [confirmDialog, setConfirmDialog] = useState<'stop' | 'cancel' | null>(null);
  // 저장(+백그라운드 전사) 시작 요청 진행 중 — 확인 다이얼로그의 주 버튼을 스피너로 잠근다.
  const [finalizing, setFinalizing] = useState(false);
  const lastDialogRef = useRef<'stop' | 'cancel'>('stop');
  const stopElapsedRef = useRef(0);
  // 앱이 포그라운드인지 — 백그라운드로 인한 WS 끊김이 '기본 모드 전환' 폴백을 트리거하지 않게 가드.
  const appActiveRef = useRef(true);

  // ── STT 모드 (듀얼 모드) — 상태만 여기서 선언, effect 는 recorder 선언 후 ──
  const { data: sttConfig } = useSTTConfig();
  const serverSTTMode: STTMode = sttConfig?.stt_mode ?? 'whisper_chunk';
  const [activeSTTMode, setActiveSTTMode] = useState<STTMode>('whisper_chunk');

  // 스트리밍 모드 훅 — WebSocket 실패 시 chunk fallback
  const streaming = useStreamingMode({
    onFallbackToChunk: useCallback(() => {
      // 백그라운드로 인한 WS 끊김이면 폴백하지 않음 — 백그라운드 진입 시 녹음은 이미 일시정지됨.
      // (이 가드가 없으면 백그라운드만 갔다 와도 청크 모드로 전환되며 전사가 죽는 버그 발생)
      if (!appActiveRef.current) return;
      setActiveSTTMode('whisper_chunk');
      showToast({ type: 'info', message: '실시간 전사를 사용할 수 없어 기본 모드로 전환했어요' });
    }, [showToast]),
  });

  // 클라이언트가 onChunkReady 로 인지했지만 서버 폴링으로 아직 안 들어온 청크들.
  // 업로드 + presigned URL + audio record 생성 + 다음 폴링까지 ~1~4초 갭이 있어
  // 그동안 타임라인에 "전사 중..." 버블이 보이도록 즉시 표시한다.
  const [pendingClientChunks, setPendingClientChunks] = useState<
    { chunkIndex: number; duration: number; startedAt: number }[]
  >([]);
  // chunk_index → 청크 시작 시점(timer 초) 맵.
  // 청크 rotation 사이 dead time(50~300ms) 이 누적되어 audio.duration 누적이
  // timer 와 점점 어긋나는 문제를 timer 기반 startedAt 으로 해결.
  // 50분(~200청크) 녹음에서도 누적 오차 0 (각 청크 startedAt 이 독립적).
  const [chunkStartedAtMap, setChunkStartedAtMap] = useState<Record<number, number>>({});

  // Mutations
  const createMutation = useCreateFieldNote(centerId);
  const addEntryMutation = useAddEntry(centerId, fieldNoteId);
  const uploadMutation = useUploadAudioChunk(centerId, fieldNoteId);
  const finishMutation = useFinishRecording(centerId, fieldNoteId);
  const recommendMutation = useRecommendation(centerId, fieldNoteId);
  const deleteMutation = useDeleteFieldNote(centerId);

  // Recorder + timer
  // onChunkReady 콜백 안에서 timer.elapsed 를 읽어야 하지만 매 200ms 갱신이라
  // callback dep 으로 두면 callback 자체가 매번 재생성됨. ref 로 capture.
  const elapsedRef = useRef(0);
  const onChunkReady = useCallback(
    (fileUri: string, chunkIndex: number, duration: number) => {
      if (!fieldNoteId) return;
      // 1) 업로드 시작 — 서버에 audio record 가 생기고 transcript_status 가 갱신됨
      uploadMutation.mutate({ fileUri, duration });
      // 2) 청크 시작 시점 = (현재 elapsed) - duration. timer 기반이라 누적 오차 없음.
      //    음수 가드 — 첫 청크가 0 보다 약간 작게 계산되는 케이스 보호.
      const startedAt = Math.max(0, elapsedRef.current - duration);
      setChunkStartedAtMap((prev) => ({ ...prev, [chunkIndex]: startedAt }));
      // 3) 즉시 클라이언트 placeholder 추가 — 폴링이 따라잡으면 audios sync effect 에서 제거됨
      setPendingClientChunks((prev) => {
        if (prev.some((c) => c.chunkIndex === chunkIndex)) return prev;
        return [...prev, { chunkIndex, duration, startedAt }];
      });
    },
    [fieldNoteId, uploadMutation],
  );
  const recorder = useRecorder({ onChunkReady });
  const timer = useTimer();
  // timer.elapsed 가 갱신될 때마다 ref 동기화 — onChunkReady 가 ref 로 읽음.
  useEffect(() => {
    elapsedRef.current = timer.elapsed;
  }, [timer.elapsed]);

  // 서버 설정이 로드되면 activeSTTMode 동기화 (녹음 중이 아닐 때만)
  const isStreaming = activeSTTMode === 'aws_streaming';
  useEffect(() => {
    if (!recorder.isRecording && !recorder.isPaused && !streaming.isRecording) {
      setActiveSTTMode(serverSTTMode);
    }
  }, [serverSTTMode, recorder.isRecording, recorder.isPaused, streaming.isRecording]);

  // 현재 활성 레코더 상태 (스트리밍 모드면 streaming, 아니면 chunk recorder)
  const effectiveIsRecording = isStreaming ? streaming.isRecording : recorder.isRecording;
  const effectiveIsPaused = isStreaming ? streaming.isPaused : recorder.isPaused;
  const effectiveMeteringRef = isStreaming ? streaming.meteringRef : recorder.meteringRef;

  // Field note query (timeline용 — 녹음 중에만 폴링)
  const { data: fieldNote } = useFieldNote(
    centerId,
    fieldNoteId,
    'idle',
    effectiveIsRecording,
  );
  const audios = useMemo(() => fieldNote?.audios ?? [], [fieldNote?.audios]);
  const entries = useMemo(() => {
    const raw = fieldNote?.entries ?? [];
    return [...raw].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [fieldNote?.entries]);

  // REC 점 blink (waveform은 WaveformBars가 자체 처리)
  const waveform = useWaveformAnimation({
    isRecording: effectiveIsRecording,
    isPaused: effectiveIsPaused,
  });
  // 이번 녹음 세션의 시작 청크 index — 이어하기 시 resume.startChunkIndex.
  // 그 이전 청크(특히 스트리밍 파트: 개별 청크 전사가 영원히 안 도는 pending)는
  // '전사 중...' placeholder 를 띄우지 않기 위한 기준.
  const [sessionBaseChunkIndex, setSessionBaseChunkIndex] = useState(0);
  // 스트리밍 이어하기 — 라이브 자막 타임스탬프를 기존 녹음 길이(baseDuration)에서 잇는 오프셋.
  const [streamingTimeOffset, setStreamingTimeOffset] = useState(0);

  const recTimeline = useRecordingTimeline({
    audios,
    entries,
    isRecording: effectiveIsRecording,
    pendingClientChunks,
    chunkStartedAtMap,
    streamingUtterances: isStreaming ? streaming.utterances : undefined,
    currentPartial: isStreaming ? streaming.currentPartial : undefined,
    placeholderMinChunkIndex: sessionBaseChunkIndex,
    streamingTimeOffset,
  });

  // AI 상담 가이드는 백엔드에서 (1) 완료된 전사 또는 (2) 메모/태그 중 하나라도 있어야 동작.
  // 스트리밍 모드에서는 final utterance 가 있으면 전사 완료로 간주.
  const isAiGuideReady = useMemo(() => {
    const hasCompletedTranscript = audios.some(
      (a) => a.transcript_status === 'completed' && !!a.transcript,
    );
    const hasStreamingTranscript = streaming.utterances.some((u) => u.isFinal);
    return hasCompletedTranscript || hasStreamingTranscript || entries.length > 0;
  }, [audios, entries, streaming.utterances]);

  // 서버가 따라잡은 청크는 클라이언트 placeholder 에서 제거.
  // (서버 audio record 가 들어오면 그 쪽 placeholder/transcript 가 우선)
  useEffect(() => {
    if (pendingClientChunks.length === 0) return;
    const serverIndices = new Set(audios.map((a) => a.chunk_index));
    const remaining = pendingClientChunks.filter((c) => !serverIndices.has(c.chunkIndex));
    if (remaining.length !== pendingClientChunks.length) {
      setPendingClientChunks(remaining);
    }
  }, [audios, pendingClientChunks]);

  // 녹음 종료(완전 정지) 시 클라이언트 placeholder + chunk 시작 시점 맵 초기화.
  // 다음 녹음 세션에 stale 데이터 누수 방지.
  useEffect(() => {
    if (!recorder.isRecording && !recorder.isPaused) {
      if (pendingClientChunks.length > 0) setPendingClientChunks([]);
      if (Object.keys(chunkStartedAtMap).length > 0) setChunkStartedAtMap({});
    }
  }, [recorder.isRecording, recorder.isPaused, pendingClientChunks.length, chunkStartedAtMap]);

  // --- Sync state to store ---
  useEffect(() => {
    useRecordingStore.setState({
      isRecording: effectiveIsRecording,
      isPaused: effectiveIsPaused,
    });
  }, [effectiveIsRecording, effectiveIsPaused]);

  useEffect(() => {
    useRecordingStore.setState({ fieldNoteId });
  }, [fieldNoteId]);

  // 회기 연결 상태를 서버 값(fieldNote.schedule_id)으로 확정 — 녹음 중 연결(link)도 폴링으로 반영.
  // fieldNote 가 아직 로드 안 됐으면(undefined) 낙관적 값을 덮어쓰지 않는다.
  useEffect(() => {
    if (fieldNote?.schedule_id !== undefined) {
      useRecordingStore.setState({ scheduleId: fieldNote.schedule_id ?? null });
    }
  }, [fieldNote?.schedule_id]);

  // 검사 항목 연결도 서버 값(fieldNote.task_id)으로 확정.
  useEffect(() => {
    if (fieldNote?.task_id !== undefined) {
      useRecordingStore.setState({ taskId: fieldNote.task_id ?? null });
    }
  }, [fieldNote?.task_id]);

  // 정수 초 단위로만 elapsed 동기화 — 200ms 마다 동일한 값이면 setState 스킵
  useEffect(() => {
    const sec = Math.floor(timer.elapsed);
    if (useRecordingStore.getState().elapsed !== sec) {
      useRecordingStore.setState({ elapsed: sec });
    }
  }, [timer.elapsed]);

  // useRecorder/useTimer 가 매 렌더 새 객체를 반환해 actions 의 useCallback deps 가
  // 항상 변하던 문제 → store.setState 가 매 렌더 발동되며 FAB 구독자(MainLayout)와
  // 상호 리렌더 루프를 만들었음. ref 로 최신 의존성을 읽어 actions 자체는 안정 ref 유지.
  const recorderRef = useRef(recorder);
  const timerRef = useRef(timer);
  const createMutationRef = useRef(createMutation);
  const openSheetRef = useRef(openSheet);
  const streamingRef = useRef(streaming);
  const isStreamingRef = useRef(isStreaming);
  const finishMutationRef = useRef(finishMutation);
  const fieldNoteIdRef = useRef(fieldNoteId);
  recorderRef.current = recorder;
  timerRef.current = timer;
  createMutationRef.current = createMutation;
  openSheetRef.current = openSheet;
  streamingRef.current = streaming;
  isStreamingRef.current = isStreaming;
  finishMutationRef.current = finishMutation;
  fieldNoteIdRef.current = fieldNoteId;

  // 회기 전환 시 현재 녹음을 멈춘 뒤 시작할 회기 — 레코더가 완전히 idle 이 된 다음에
  // start 를 호출하기 위한 지연 큐 (stop 직후 recorder.isRecording 상태 지연으로 인한
  // start 가드 오작동 방지).
  const [pendingStartSchedule, setPendingStartSchedule] = useState<string | null>(null);

  // --- Actions ---
  const start = useCallback(
    async (
      resume?: { fieldNoteId: string; baseDuration: number; startChunkIndex: number },
      scheduleId?: string,
      taskId?: string,
      context?: RecordingContext | null,
    ) => {
      const recorder = recorderRef.current;
      const timer = timerRef.current;
      const createMutation = createMutationRef.current;
      const openSheet = openSheetRef.current;
      const streaming = streamingRef.current;
      const useStreaming = isStreamingRef.current;

      // 이미 녹음 중이면 시트만 열기
      if (recorder.isRecording || recorder.isPaused || streaming.isRecording) {
        openSheet();
        return;
      }

      // 권한 확인 — 스트리밍/청크 모두 마이크 권한 필요 (이어하기는 항상 chunk 레코더)
      const perm = useStreaming && !resume
        ? await streaming.ensurePermission()
        : await recorder.ensurePermission();
      if (!perm.granted) {
        showMicPermissionDeniedAlert(perm.canAskAgain);
        return;
      }

      // 선택 시점의 표시 컨텍스트를 보존(좌상단 표기). 노트 생성 후 그 항목이 linkable-tasks에서
      // 빠져도 컨텍스트가 유지되도록 쿼리 재조회에 의존하지 않는다.
      useRecordingStore.setState({ context: context ?? null });

      try {
        // 이어/추가 녹음 — 새 녹음과 동일하게 스트리밍(실시간 전사) 우선.
        // 서버가 새 세션의 오디오/전사를 기존 노트 뒤에 청크로 이어 붙인다
        // (per-chunk 상대시간 규약 — 파이프라인이 누적 오프셋으로 합성).
        if (resume) {
          setFieldNoteId(resume.fieldNoteId);
          // chunk 폴백 대비: 이번 세션 이전 청크는 '전사 중' placeholder 대상에서 제외.
          setSessionBaseChunkIndex(resume.startChunkIndex);

          if (useStreaming && streaming.isSupported) {
            // 라이브 자막 시간은 기존 녹음 길이에서 이어지도록 오프셋.
            setStreamingTimeOffset(resume.baseDuration);
            const ok = await streaming.startRecording(resume.fieldNoteId);
            if (ok) {
              timer.start(resume.baseDuration);
              openSheet();
              return;
            }
            // 스트리밍 실패 → 아래 chunk 폴백 (onFallbackToChunk 가 토스트/모드 전환 처리)
          }

          // chunk 폴백 — 모드 플래그도 chunk 로 전환해 effectiveIsRecording 이
          // 실제 레코더를 따라가게 한다(스트리밍으로 남으면 fieldNote 폴링·파형·타임라인이
          // 꺼져 새 청크 전사가 화면에 영원히 안 들어온다 — '전사 중...' 무한).
          // 녹음 종료 후 서버 설정 동기화 effect 가 원래 모드로 복원한다.
          setStreamingTimeOffset(0);
          setActiveSTTMode('whisper_chunk');
          const ok = await recorder.startRecording(resume.startChunkIndex);
          if (!ok) return;
          timer.start(resume.baseDuration);
          openSheet();
          return;
        }
        setSessionBaseChunkIndex(0);
        setStreamingTimeOffset(0);

        const result = await createMutation.mutateAsync({
          scheduleId: scheduleId ?? null,
          taskId: taskId ?? null,
        });
        setFieldNoteId(result.id);
        // 회기/검사 연결 상태를 낙관적으로 스토어에 반영 (이후 fieldNote 폴링이 서버 값으로 확정).
        useRecordingStore.setState({ scheduleId: scheduleId ?? null, taskId: taskId ?? null });

        if (useStreaming && streaming.isSupported) {
          // 스트리밍 모드: WebSocket + PCM 연속 녹음
          const ok = await streaming.startRecording(result.id);
          if (!ok) {
            // fallback 은 onFallbackToChunk 에서 처리됨 — chunk 모드로 시작
            const chunkOk = await recorder.startRecording();
            if (!chunkOk) return;
          }
        } else {
          // 청크 모드: 기존 방식
          const ok = await recorder.startRecording();
          if (!ok) return;
        }

        timer.start();
        openSheet();
      } catch (err) {
        const message = err instanceof Error ? err.message : '필드노트 생성에 실패했습니다';
        Alert.alert('오류', message);
      }
    },
    [],
  );

  const pause = useCallback(async () => {
    if (isStreamingRef.current) {
      streamingRef.current.pauseRecording();
    } else {
      await recorderRef.current.pauseRecording();
    }
    timerRef.current.pause();
  }, []);

  const resume = useCallback(async () => {
    if (isStreamingRef.current) {
      // 스트리밍 — WS 가 끊겼으면 내부에서 재연결+세션 재시작 후 재개 (await 로 완료 대기)
      await streamingRef.current.resumeRecording();
    } else {
      await recorderRef.current.resumeRecording();
    }
    timerRef.current.resume();
  }, []);

  const requestStop = useCallback(() => {
    const recorder = recorderRef.current;
    const streaming = streamingRef.current;
    const timer = timerRef.current;
    // 녹음을 일시정지하고 종료 시트 표시
    if (isStreamingRef.current) {
      streaming.pauseRecording();
    } else {
      void recorder.pauseRecording();
    }
    timer.pause();
    stopElapsedRef.current = timer.elapsed;
    setConfirmDialog('stop');
  }, []);

  // 취소(삭제) 요청 — 녹음을 일시정지하고 "취소할까요?(노트 삭제)" 확인 표시.
  const requestCancel = useCallback(() => {
    const recorder = recorderRef.current;
    const streaming = streamingRef.current;
    const timer = timerRef.current;
    if (isStreamingRef.current) {
      streaming.pauseRecording();
    } else {
      void recorder.pauseRecording();
    }
    timer.pause();
    stopElapsedRef.current = timer.elapsed;
    setConfirmDialog('cancel');
  }, []);

  // 회기 전환: 진행 중 녹음을 멈춰 분석으로 보내고(폐기 아님), 그 회기로 새 녹음 시작.
  // stop 직후 recorder.isRecording 상태가 즉시 false 가 아니라(React state 지연) start 가드가
  // 오작동할 수 있어, 실제 시작은 pendingStartSchedule 지연 큐(effect)에 맡긴다.
  const switchToSchedule = useCallback(async (scheduleId: string) => {
    const elapsed = timerRef.current.elapsed;
    if (isStreamingRef.current) {
      await streamingRef.current.stopRecording();
    } else {
      await recorderRef.current.stopRecording();
    }
    timerRef.current.stop();
    const prevId = fieldNoteIdRef.current;
    const prevSchedule = useRecordingStore.getState().scheduleId;
    setMemoText('');
    if (prevId) {
      try {
        await finishMutationRef.current.mutateAsync({ totalDuration: elapsed, skipPipeline: false });
        useBackgroundProcessingStore.getState().addJob({
          fieldNoteId: prevId,
          scheduleId: prevSchedule,
          label: '필드노트',
          startedAt: Date.now(),
        });
      } catch (err) {
        console.error('Failed to finalize on switch:', err);
      }
    }
    setFieldNoteId(null);
    useRecordingStore.setState({ scheduleId: null, taskId: null, context: null });
    // 레코더가 완전히 idle 이 된 뒤 새 회기 녹음 시작 (effect 가 처리).
    setPendingStartSchedule(scheduleId);
  }, []);

  // 스토어에 액션 주입 — actions 가 안정 ref 라 effect 는 마운트 1회만 실행
  useEffect(() => {
    useRecordingStore.setState({ start, pause, resume, requestStop, switchToSchedule });
  }, [start, pause, resume, requestStop, switchToSchedule]);

  // 백그라운드 진입 시 녹음 자동 일시정지 — 백그라운드에선 JS 정지로 스트리밍 WS 가 끊겨
  // 전사가 깨지고 타임스탬프가 어긋남. 깔끔히 멈추고(복귀 후 사용자가 이어하기) 어긋남을 방지.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        appActiveRef.current = true;
        return;
      }
      // background / inactive
      appActiveRef.current = false;
      const st = useRecordingStore.getState();
      if (st.isRecording && !st.isPaused) {
        void pause();
      }
    });
    return () => sub.remove();
  }, [pause]);

  // 회기 전환 지연 큐: 현재 녹음이 완전히 멈춘(idle) 뒤 예약된 회기로 새 녹음 시작.
  useEffect(() => {
    if (pendingStartSchedule && !effectiveIsRecording && !effectiveIsPaused) {
      const sid = pendingStartSchedule;
      setPendingStartSchedule(null);
      void start(undefined, sid);
    }
  }, [pendingStartSchedule, effectiveIsRecording, effectiveIsPaused, start]);

  // --- 확인 다이얼로그 핸들러 ---
  // 계속하기 / 오버레이 탭 — 녹음이 일시정지된 상태이므로 resume 처리(종료·취소 공통).
  const handleConfirmDismiss = useCallback(async () => {
    setConfirmDialog(null);
    if (isStreaming) {
      streaming.resumeRecording();
    } else {
      await recorder.resumeRecording();
    }
    timer.resume();
  }, [recorder, timer, isStreaming, streaming]);

  const finalizeRecording = useCallback(
    async (skipPipeline: boolean) => {
      // 다이얼로그는 닫지 않고 주 버튼을 스피너로 잠근 채로 저장(+전사 시작) 요청을 보낸다.
      setFinalizing(true);
      if (isStreaming) {
        await streaming.stopRecording();
      } else {
        await recorder.stopRecording();
      }
      timer.stop();
      const id = fieldNoteId;
      const elapsed = stopElapsedRef.current;
      setMemoText('');

      if (id) {
        try {
          // finishMutation 성공 시 ["fieldNote"] 프리픽스 전체가 invalidate 되어
          // 진입 화면(필드노트 홈·목록 = ["fieldNote","list",...])이 자동 갱신된다.
          await finishMutation.mutateAsync({ totalDuration: elapsed, skipPipeline });
          if (!skipPipeline) {
            // 전사·화자분리는 백그라운드로(auto_pipeline) — ProcessingHost 가 폴링해
            // 완료 토스트로 알린다. AI 분석(요약)은 여기서 안 돎: 상세에서 별도 온디맨드.
            // 상세로 이동하지 않으므로 진행 표시는 백그라운드 잡이 전담.
            useBackgroundProcessingStore.getState().addJob({
              fieldNoteId: id,
              scheduleId: null,
              label: '필드노트',
              startedAt: Date.now(),
            });
          }
        } catch (err) {
          console.error('Failed to finalize recording:', err);
          Alert.alert('오류', '녹음 종료에 실패했습니다.');
        }
        setFieldNoteId(null);
        useRecordingStore.setState({ scheduleId: null, taskId: null, context: null });
      }
      // 요청이 끝나면 다이얼로그를 닫고 녹음 시트도 그대로 내린다 (상세 이동 없음).
      setFinalizing(false);
      setConfirmDialog(null);
      minimizeSheet();
    },
    [recorder, timer, fieldNoteId, finishMutation, minimizeSheet, isStreaming, streaming],
  );

  // 취소 > 삭제 — 녹음 폐기(파일·노트 삭제). 이동 없이 시트만 닫고 초기화.
  const handleStopDelete = useCallback(async () => {
    setConfirmDialog(null);
    if (isStreaming) {
      streaming.cleanup();
    } else {
      await recorder.stopRecording();
    }
    timer.stop();
    const id = fieldNoteId;
    minimizeSheet();
    setMemoText('');
    setFieldNoteId(null);
    useRecordingStore.setState({ scheduleId: null, taskId: null, context: null });
    if (id) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err) {
        console.error('Failed to discard recording:', err);
      }
    }
  }, [recorder, timer, fieldNoteId, deleteMutation, minimizeSheet, isStreaming, streaming]);

  // 종료:
  //  - 분석 가능한 내용(완료된 전사 또는 메모) 있으면 → 분석 시작
  //  - 녹음된 청크는 있으나 아직 전사 전 → 분석 없이 저장(나중에 분석 가능)
  //  - 청크가 아예 없음(0초 등) → 저장할 게 없으니 폐기.
  //    빈 노트가 목록에 남거나 EmptyNoteScreen 으로 진입하는 것을 사전 차단.
  const handleStopConfirm = useCallback(() => {
    const hasAudio = audios.length > 0 || pendingClientChunks.length > 0 || streaming.utterances.length > 0;
    // 스트리밍 모드: 오디오가 서버에 저장되므로(WS finish / emergency save) 라이브 utterance 상태와
    // 무관하게 항상 파이프라인을 돌려 전사·분석한다. (utterance 가 비어도 저장된 오디오는 전사됨 —
    // 수동 '분석하기'가 되는 것과 동일 경로. 이걸 안 하면 자동 흐름이 pending 으로 잘못 빠짐.)
    if (isStreaming) {
      finalizeRecording(false);
    } else if (isAiGuideReady) {
      finalizeRecording(false);
    } else if (hasAudio) {
      finalizeRecording(true);
      showToast({ type: 'info', message: '음성이 없어 분석 없이 저장했어요' });
    } else {
      void handleStopDelete();
      showToast({ type: 'info', message: '녹음된 내용이 없어 저장하지 않았어요' });
    }
  }, [
    isStreaming,
    isAiGuideReady,
    audios.length,
    pendingClientChunks.length,
    streaming.utterances.length,
    finalizeRecording,
    handleStopDelete,
    showToast,
  ]);

  // --- AI 상담 가이드 ---
  // RecordingSheet 내부 morph 카드가 로딩/결과 UI를 관리하므로
  // 여기서는 mutation 호출 결과(recommendation 텍스트)만 반환.
  // 에러는 morph 컴포넌트가 catch 해서 Alert 표시.
  const handleRequestAiGuide = useCallback(async () => {
    if (!fieldNoteId) throw new Error('필드노트 ID가 없습니다');
    const result = await recommendMutation.mutateAsync();
    return result.recommendation;
  }, [fieldNoteId, recommendMutation]);

  // --- Memo handler ---
  const handleAddMemo = useCallback(() => {
    if (!memoText.trim() || !fieldNoteId) return;
    // timer.elapsed 는 녹음 시작 기준 누적 시간을 항상 보유 (일시정지 중에도
    // 마지막 값 유지). fieldNote.total_duration 으로 fallback 했더니 chunk
    // 업로드 완료 전이라 0 으로 들어가는 케이스가 있어서 timer.elapsed 만 사용.
    addEntryMutation.mutate({
      entry_type: 'memo',
      content: memoText.trim(),
      timestamp_seconds: timer.elapsed,
    });
    setMemoText('');
  }, [memoText, fieldNoteId, addEntryMutation, timer]);

  // 활성 상태가 아니면 시트도, 확인 다이얼로그도 렌더 안 함
  const isActive = effectiveIsRecording || effectiveIsPaused;
  if (!isActive && !sheetVisible && confirmDialog === null) return null;

  // 종료/취소 확인 다이얼로그 props — 닫히는 동안 내용 안정(lastDialogRef).
  if (confirmDialog) lastDialogRef.current = confirmDialog;
  const confirmModalProps: RecordingConfirmModalProps =
    lastDialogRef.current === 'cancel'
      ? {
          visible: confirmDialog !== null,
          title: '녹음을 취소할까요?',
          message: '지금까지 기록한 노트가 삭제돼요',
          confirmLabel: '취소하기',
          confirmTone: 'danger',
          onConfirm: handleStopDelete,
          onCancel: handleConfirmDismiss,
        }
      : {
          visible: confirmDialog !== null,
          title: '녹음을 종료할까요?',
          confirmLabel: '저장하고 종료하기',
          confirmTone: 'primary',
          confirmLoading: finalizing,
          onConfirm: handleStopConfirm,
          onCancel: handleConfirmDismiss,
        };

  return (
    <>
      <RecordingSheet
        visible={sheetVisible}
        context={recordingContext}
        isRecording={effectiveIsRecording}
        isPaused={effectiveIsPaused}
        timerFormatted={timer.formatted}
        elapsedSeconds={timer.elapsed}
        meteringRef={effectiveMeteringRef}
        recOpacity={waveform.recOpacity}
        recordingTimeline={recTimeline.recordingTimeline}
        recordingScrollRef={recTimeline.recordingScrollRef}
        memoText={memoText}
        setMemoText={setMemoText}
        onAddMemo={handleAddMemo}
        onRequestAiGuide={handleRequestAiGuide}
        aiGuideReady={isAiGuideReady}
        onPause={pause}
        onResume={resume}
        onStop={requestStop}
        onMinimize={minimizeSheet}
        onRequestCancel={requestCancel}
        confirmModal={confirmModalProps}
      />
      {/* Android 는 native window 분리가 가능하므로 top-level Modal 로 렌더.
          iOS 는 Modal-on-Modal 미지원 이슈로 RecordingSheet 내부에 overlay 로 렌더 (위에서 처리). */}
      {Platform.OS === 'android' && <RecordingConfirmModal {...confirmModalProps} />}
    </>
  );
}
