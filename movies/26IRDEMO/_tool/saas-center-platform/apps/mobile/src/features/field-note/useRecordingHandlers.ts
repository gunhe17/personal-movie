import { useState, useRef, useCallback } from 'react';
import { TextInput, Alert } from 'react-native';
import { showMicPermissionDeniedAlert } from '@/shared/utils/permissions';
import { MIN_RECORDING_DURATION_SECONDS, TAG_CATEGORY_LABELS } from './constants';
import { effectiveDuration, nextChunkIndex } from './utils';
import type { TagCategory, FieldNoteDetailResponse, RecentMemo } from './types';

interface UseRecordingHandlersParams {
  scheduleId: string | undefined;
  fieldNoteId: string | null;
  setFieldNoteId: (id: string | null) => void;
  existingFieldNote: FieldNoteDetailResponse | null | undefined;
  effectiveFieldNote: FieldNoteDetailResponse | null;
  fieldNote: FieldNoteDetailResponse | null | undefined;
  recorder: {
    ensurePermission: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
    startRecording: (startChunkIndex?: number) => Promise<boolean>;
    pauseRecording: () => Promise<void>;
    resumeRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
  };
  timer: {
    elapsed: number;
    start: (initialSeconds?: number) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    isRunning: boolean;
  };
  createMutation: { mutateAsync: (vars?: { scheduleId?: string | null; taskId?: string | null }) => Promise<{ id: string }>; isPending: boolean };
  addEntryMutation: { mutate: (data: { entry_type: 'memo' | 'tag'; content: string; timestamp_seconds: number; tag_category?: string | null }) => void };
  finishMutation: { mutateAsync: (data: { totalDuration: number; skipPipeline: boolean }) => Promise<unknown> };
  deleteMutation: { mutateAsync: (id: string) => Promise<unknown> };
  recommendMutation: { mutateAsync: () => Promise<{ recommendation: string }> };
  onBack: () => void;
}

export interface RecordingHandlers {
  handleStart: () => Promise<void>;
  handlePause: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleStopSheetClose: () => Promise<void>;
  handleStopConfirm: () => Promise<void>;
  handleStopSaveOnly: () => Promise<void>;
  handleStopDelete: () => Promise<void>;
  handleStartAdditional: () => Promise<void>;
  handleAddMemo: () => void;
  handleOpenMemo: () => void;
  handleCloseMemo: () => void;
  handleAddTag: (category: TagCategory) => void;
  handleRequestRecommendation: () => Promise<void>;
  // State
  memoText: string;
  setMemoText: (text: string) => void;
  showMemo: boolean;
  setShowMemo: (v: boolean) => void;
  memoInputRef: React.RefObject<TextInput | null>;
  stopSheet: 'normal' | 'short' | null;
  setStopSheet: (v: 'normal' | 'short' | null) => void;
  recommendationText: string | null;
  showRecommendation: boolean;
  setShowRecommendation: (v: boolean) => void;
  recentMemo: RecentMemo | null;
}

export function useRecordingHandlers({
  scheduleId,
  fieldNoteId,
  setFieldNoteId,
  existingFieldNote,
  effectiveFieldNote,
  fieldNote,
  recorder,
  timer,
  createMutation,
  addEntryMutation,
  finishMutation,
  deleteMutation,
  recommendMutation,
  onBack,
}: UseRecordingHandlersParams): RecordingHandlers {
  const [memoText, setMemoText] = useState('');
  const [showMemo, setShowMemo] = useState(false);
  const [stopSheet, setStopSheet] = useState<'normal' | 'short' | null>(null);
  const [recommendationText, setRecommendationText] = useState<string | null>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recentMemo, setRecentMemo] = useState<RecentMemo | null>(null);
  const stopElapsedRef = useRef(0);
  const memoInputRef = useRef<TextInput>(null);
  const recentMemoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStart = useCallback(async () => {
    // 권한 사전 체크 — 거부 시 createMutation으로 빈 필드노트가 생성되는 것을 방지
    const perm = await recorder.ensurePermission();
    if (!perm.granted) {
      showMicPermissionDeniedAlert(perm.canAskAgain);
      return;
    }

    try {
      if (existingFieldNote?.id) {
        setFieldNoteId(existingFieldNote.id);
        const ok = await recorder.startRecording(nextChunkIndex(existingFieldNote.audios));
        if (!ok) return;
        timer.start(effectiveDuration(existingFieldNote));
        return;
      }

      const result = await createMutation.mutateAsync({ scheduleId: scheduleId ?? null });
      setFieldNoteId(result.id);
      const ok = await recorder.startRecording();
      if (!ok) return;
      timer.start();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 409 && existingFieldNote?.id) {
          setFieldNoteId(existingFieldNote.id);
          const ok = await recorder.startRecording(nextChunkIndex(existingFieldNote.audios));
          if (!ok) return;
          timer.start(effectiveDuration(existingFieldNote));
          return;
        }
      }
      const message = err instanceof Error ? err.message : '필드노트 생성에 실패했습니다';
      Alert.alert('오류', message);
    }
  }, [scheduleId, createMutation, recorder, timer, existingFieldNote, setFieldNoteId]);

  const handlePause = useCallback(async () => {
    await recorder.pauseRecording();
    timer.pause();
  }, [recorder, timer]);

  const handleResume = useCallback(async () => {
    await recorder.resumeRecording();
    timer.resume();
  }, [recorder, timer]);

  const handleStop = useCallback(async () => {
    await recorder.pauseRecording();
    timer.pause();
    stopElapsedRef.current = timer.elapsed;
    setStopSheet(timer.elapsed < MIN_RECORDING_DURATION_SECONDS ? 'short' : 'normal');
  }, [recorder, timer]);

  const handleStopSheetClose = useCallback(async () => {
    setStopSheet(null);
    await recorder.resumeRecording();
    timer.resume();
  }, [recorder, timer]);

  const handleStopConfirm = useCallback(async () => {
    setStopSheet(null);
    await recorder.stopRecording();
    timer.stop();
    if (fieldNoteId) {
      try {
        await finishMutation.mutateAsync({ totalDuration: stopElapsedRef.current, skipPipeline: false });
      } catch (err) {
        console.error('Failed to finish recording:', err);
        Alert.alert('오류', '녹음 종료에 실패했습니다. 다시 시도해주세요.');
      }
    }
  }, [recorder, timer, fieldNoteId, finishMutation]);

  const handleStopSaveOnly = useCallback(async () => {
    setStopSheet(null);
    await recorder.stopRecording();
    timer.stop();
    if (fieldNoteId) {
      try {
        await finishMutation.mutateAsync({ totalDuration: stopElapsedRef.current, skipPipeline: true });
      } catch (err) {
        console.error('Failed to save recording:', err);
        Alert.alert('오류', '녹음 저장에 실패했습니다. 다시 시도해주세요.');
      }
    }
  }, [recorder, timer, fieldNoteId, finishMutation]);

  const handleStopDelete = useCallback(async () => {
    setStopSheet(null);
    await recorder.stopRecording();
    timer.stop();
    if (fieldNoteId) {
      await deleteMutation.mutateAsync(fieldNoteId);
    }
    onBack();
  }, [recorder, timer, fieldNoteId, deleteMutation, onBack]);

  const handleStartAdditional = useCallback(async () => {
    const target = effectiveFieldNote;
    if (!target?.id) return;

    const perm = await recorder.ensurePermission();
    if (!perm.granted) {
      showMicPermissionDeniedAlert(perm.canAskAgain);
      return;
    }

    try {
      setFieldNoteId(target.id);
      const ok = await recorder.startRecording(nextChunkIndex(target.audios));
      if (!ok) return;
      timer.start(effectiveDuration(target));
    } catch {
      Alert.alert('오류', '녹음을 시작할 수 없습니다.');
    }
  }, [effectiveFieldNote, recorder, timer, setFieldNoteId]);

  const handleAddMemo = useCallback(() => {
    if (!memoText.trim() || !fieldNoteId) return;
    const timestamp = timer.isRunning
      ? timer.elapsed
      : effectiveDuration(fieldNote ?? existingFieldNote);

    // 메모 추가
    addEntryMutation.mutate({
      entry_type: 'memo',
      content: memoText.trim(),
      timestamp_seconds: timestamp,
    });

    // 최근 추가된 메모 정보 표시
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const timestampStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    setRecentMemo({
      content: memoText.trim(),
      timestamp: timestampStr,
    });

    // 이전 타임아웃 클리어
    if (recentMemoTimeoutRef.current) {
      clearTimeout(recentMemoTimeoutRef.current);
    }

    // 2초 후 최근 메모 정보 숨기기
    recentMemoTimeoutRef.current = setTimeout(() => {
      setRecentMemo(null);
    }, 2000);

    setMemoText('');
    // setShowMemo(false) 제거 - 연속해서 메모를 작성할 수 있도록 오버레이 유지
  }, [memoText, fieldNoteId, addEntryMutation, timer, fieldNote, existingFieldNote]);

  const handleOpenMemo = useCallback(() => {
    // 오버레이 열 때 이전 타이머 클리어
    if (recentMemoTimeoutRef.current) {
      clearTimeout(recentMemoTimeoutRef.current);
      recentMemoTimeoutRef.current = null;
    }
    setShowMemo(true);
    setTimeout(() => memoInputRef.current?.focus(), 100);
  }, []);

  const handleCloseMemo = useCallback(() => {
    // 오버레이 닫을 때 타이머 클리어 및 상태 초기화
    if (recentMemoTimeoutRef.current) {
      clearTimeout(recentMemoTimeoutRef.current);
      recentMemoTimeoutRef.current = null;
    }
    setRecentMemo(null);
    setShowMemo(false);
  }, []);

  const handleRequestRecommendation = useCallback(async () => {
    try {
      const result = await recommendMutation.mutateAsync();
      setRecommendationText(result.recommendation);
      setShowRecommendation(true);
    } catch {
      Alert.alert('알림', '아직 전사된 내용이 없습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, [recommendMutation]);

  const handleAddTag = useCallback(
    (category: TagCategory) => {
      if (!fieldNoteId) return;
      const timestamp = timer.isRunning
        ? timer.elapsed
        : effectiveDuration(fieldNote ?? existingFieldNote);
      addEntryMutation.mutate({
        entry_type: 'tag',
        tag_category: category,
        content: TAG_CATEGORY_LABELS[category],
        timestamp_seconds: timestamp,
      });
    },
    [fieldNoteId, addEntryMutation, timer, fieldNote, existingFieldNote],
  );

  return {
    handleStart,
    handlePause,
    handleResume,
    handleStop,
    handleStopSheetClose,
    handleStopConfirm,
    handleStopSaveOnly,
    handleStopDelete,
    handleStartAdditional,
    handleAddMemo,
    handleOpenMemo,
    handleCloseMemo,
    handleAddTag,
    handleRequestRecommendation,
    memoText,
    setMemoText,
    showMemo,
    setShowMemo,
    memoInputRef,
    stopSheet,
    setStopSheet,
    recommendationText,
    showRecommendation,
    setShowRecommendation,
    recentMemo,
  };
}
