import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/shared/constants/theme';
import { useFieldNoteOrchestrator } from '@/features/field-note/useFieldNoteOrchestrator';
import { useRecordingHandlers } from '@/features/field-note/useRecordingHandlers';
import { useWaveformAnimation } from '@/features/field-note/useWaveformAnimation';
import { useRecordingTimeline } from '@/features/field-note/useRecordingTimeline';
import { useCompletedView } from '@/features/field-note/useCompletedView';
import { FieldNoteDetailSkeleton } from '@/features/field-note/components/FieldNoteDetailSkeleton';
import { NewScreen } from '@/features/field-note/components/NewScreen';
import { ResumeScreen } from '@/features/field-note/components/ResumeScreen';
import { ProcessingScreen } from '@/features/field-note/components/ProcessingScreen';
import { FailedScreen } from '@/features/field-note/components/FailedScreen';
import { CompletedScreen } from '@/features/field-note/components/CompletedScreen';
import { RecordingScreen } from '@/features/field-note/components/RecordingScreen';
import { PendingAnalysisScreen } from '@/features/field-note/components/PendingAnalysisScreen';
import { EmptyNoteScreen } from '@/features/field-note/components/EmptyNoteScreen';
import { useRunPipeline } from '@/features/field-note/hooks';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { effectiveDuration, nextChunkIndex, hasAnalyzableContent } from '@/features/field-note/utils';
import { useRecordingStore } from '@/features/field-note/recordingStore';
import { useDarkNavBarWhileMounted } from '@/features/field-note/useFieldNoteNavBar';

export interface FieldNoteDetailViewProps {
  /** 라우트에선 미지정(route params 사용), 오버레이 morph 에선 주입. */
  scheduleId?: string;
  fieldNoteId?: string;
  /** 뒤로가기 — 라우트면 router.back(미지정 시 orchestrator 기본), 오버레이면 역재생 닫기. */
  onClose?: () => void;
}

/**
 * 필드노트 상세/녹음 플로우 본문.
 *
 * `[scheduleId].tsx` 라우트와 목록 morph 오버레이가 **공용**으로 쓰는 뷰.
 * - 라우트: props 없이 렌더 → orchestrator 가 route params 로 동작, onBack=router.back.
 * - 오버레이: `fieldNoteId` + `onClose`(역재생 닫기) 주입.
 */
export function FieldNoteDetailView({
  scheduleId,
  fieldNoteId: fieldNoteIdProp,
  onClose,
}: FieldNoteDetailViewProps) {
  useDarkNavBarWhileMounted();
  const orchestration = useFieldNoteOrchestrator({
    scheduleId,
    fieldNoteId: fieldNoteIdProp,
  });

  // 뒤로가기 — 오버레이면 onClose(역재생), 아니면 orchestrator 기본(router.back)
  const back = onClose ?? orchestration.onBack;

  // 공통 삭제 — 노트 폐기 후 닫기 (ResumeScreen / EmptyNoteScreen 공용)
  const deleteNote = useCallback(async () => {
    const id = orchestration.fieldNoteId ?? orchestration.effectiveFieldNote?.id;
    if (!id) return;
    try {
      await orchestration.deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete field note:', err);
    }
    back();
  }, [
    orchestration.fieldNoteId,
    orchestration.effectiveFieldNote?.id,
    orchestration.deleteMutation,
    back,
  ]);

  const handlers = useRecordingHandlers({
    scheduleId: orchestration.scheduleId,
    fieldNoteId: orchestration.fieldNoteId,
    setFieldNoteId: orchestration.setFieldNoteId,
    existingFieldNote: orchestration.existingFieldNote,
    effectiveFieldNote: orchestration.effectiveFieldNote,
    fieldNote: orchestration.fieldNote,
    recorder: orchestration.recorder,
    timer: orchestration.timer,
    createMutation: orchestration.createMutation,
    addEntryMutation: orchestration.addEntryMutation,
    finishMutation: orchestration.finishMutation,
    deleteMutation: orchestration.deleteMutation,
    recommendMutation: orchestration.recommendMutation,
    onBack: back,
  });

  const runPipelineMutation = useRunPipeline(
    orchestration.centerId,
    orchestration.fieldNoteId,
  );

  const waveform = useWaveformAnimation({
    isRecording: orchestration.recorder.isRecording,
    isPaused: orchestration.recorder.isPaused,
  });

  const recTimeline = useRecordingTimeline({
    audios: orchestration.audios,
    entries: orchestration.entries,
    isRecording: orchestration.recorder.isRecording,
  });

  const completedView = useCompletedView({
    centerId: orchestration.centerId,
    fieldNoteId: orchestration.fieldNoteId,
    fieldNote: orchestration.fieldNote,
    existingFieldNote: orchestration.existingFieldNote,
    sessionInfo: orchestration.sessionInfo,
    speakerMapMutation: orchestration.speakerMapMutation,
  });

  // Quick mode 자동 녹음 시작 (NewScreen 의 "시작" 단계 스킵)
  const autoStartTriggered = useRef(false);
  useEffect(() => {
    if (
      orchestration.isQuickMode &&
      !orchestration.preloadFieldNoteId &&
      orchestration.screenMode === 'new' &&
      !autoStartTriggered.current
    ) {
      autoStartTriggered.current = true;
      handlers.handleStart();
    }
  }, [
    orchestration.isQuickMode,
    orchestration.preloadFieldNoteId,
    orchestration.screenMode,
    handlers,
  ]);

  const isLoadingPreload =
    orchestration.isQuickMode &&
    !!orchestration.preloadFieldNoteId &&
    orchestration.isLoadingFieldNote;
  const isLoadingDetail =
    (!orchestration.isQuickMode && orchestration.isLoadingExisting) ||
    isLoadingPreload;
  // 스켈레톤 깜빡임 방지 게이트 — 훅이라 조건부 return 보다 위에서 무조건 호출.
  const showDetailSkeleton = useDelayedSkeleton(isLoadingDetail);
  if (isLoadingDetail) {
    // delay 창(짧은 로딩)엔 스켈레톤 대신 다크 빈 화면 → 번쩍임 방지. 뒤로가기 chrome 은 유지.
    return showDetailSkeleton ? (
      <FieldNoteDetailSkeleton onBack={back} />
    ) : (
      <View style={{ flex: 1, backgroundColor: COLORS.fieldnoteDark.bg }} />
    );
  }

  const isAutoStarting =
    orchestration.isQuickMode &&
    !orchestration.preloadFieldNoteId &&
    orchestration.screenMode === 'new' &&
    (!autoStartTriggered.current || orchestration.createMutation.isPending);
  if (isAutoStarting) {
    return (
      <LinearGradient
        colors={[COLORS.fieldnoteDark.card, COLORS.fieldnoteDark.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.fieldnoteDark.accent} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // 오디오 청크가 없는 노트는 transcribe 가 항상 실패("No audio chunks found")한다.
  // 분석/재시도 진입을 막고 삭제만 안내한다. (녹음 중/재개 상태는 제외 — 청크가 차오르는 중)
  const isEmptyNote =
    orchestration.audios.length === 0 &&
    orchestration.entries.length === 0 &&
    (orchestration.screenMode === 'completed' ||
      orchestration.screenMode === 'pending_analysis' ||
      orchestration.screenMode === 'failed');
  if (isEmptyNote) {
    return <EmptyNoteScreen onDelete={deleteNote} onBack={back} />;
  }

  switch (orchestration.screenMode) {
    case 'processing':
      return (
        <ProcessingScreen
          sessionInfo={orchestration.sessionInfo}
          processingStatus={orchestration.processingStatus}
          processingStep={orchestration.fieldNote?.processing_step ?? orchestration.existingFieldNote?.processing_step ?? null}
          isQuickMode={orchestration.isQuickMode}
          onBack={back}
          onCompletionAnimationDone={orchestration.onCompletionAnimationDone}
        />
      );

    case 'failed':
      return (
        <FailedScreen
          sessionInfo={orchestration.sessionInfo}
          failedStep={orchestration.fieldNote?.failed_step ?? orchestration.existingFieldNote?.failed_step}
          onRetry={() => orchestration.retryMutation.mutate()}
          isRetrying={orchestration.retryMutation.isPending}
          onBack={back}
        />
      );

    case 'pending_analysis': {
      const fn = orchestration.effectiveFieldNote;
      return (
        <PendingAnalysisScreen
          sessionInfo={orchestration.sessionInfo}
          totalDuration={effectiveDuration(fn)}
          onStartAnalysis={() => runPipelineMutation.mutate()}
          isStarting={runPipelineMutation.isPending}
          onBack={back}
        />
      );
    }

    case 'completed':
      return (
        <CompletedScreen
          sessionInfo={orchestration.sessionInfo}
          fieldNote={orchestration.fieldNote}
          existingFieldNote={orchestration.existingFieldNote}
          fieldNoteId={orchestration.fieldNoteId}
          entries={orchestration.entries}
          audios={orchestration.audios}
          completedView={completedView}
          onBack={back}
          onDelete={deleteNote}
          onStartAdditional={() => {
            const id = orchestration.fieldNoteId;
            if (!id) return;
            back();
            void useRecordingStore.getState().start({
              fieldNoteId: id,
              baseDuration: effectiveDuration(orchestration.effectiveFieldNote),
              startChunkIndex: nextChunkIndex(orchestration.effectiveFieldNote?.audios),
            });
          }}
        />
      );

    case 'new':
      return (
        <NewScreen
          sessionInfo={orchestration.sessionInfo}
          isQuickMode={orchestration.isQuickMode}
          onStart={handlers.handleStart}
          isStarting={orchestration.createMutation.isPending}
          onBack={back}
        />
      );

    case 'resume': {
      const fn = orchestration.effectiveFieldNote;
      const canAnalyze = hasAnalyzableContent(fn);
      const handleFinalize = async () => {
        if (!orchestration.fieldNoteId) return;
        try {
          await orchestration.finishMutation.mutateAsync({
            totalDuration: fn?.total_duration ?? 0,
            skipPipeline: false,
          });
        } catch (err) {
          console.error('Failed to finalize from resume:', err);
        }
      };
      return (
        <ResumeScreen
          sessionInfo={orchestration.sessionInfo}
          totalDuration={effectiveDuration(fn)}
          isPaused={fn?.status === 'paused'}
          canAnalyze={canAnalyze}
          onResume={() => {
            const id = orchestration.fieldNoteId ?? fn?.id;
            if (!id) return;
            back();
            void useRecordingStore.getState().start({
              fieldNoteId: id,
              baseDuration: effectiveDuration(fn),
              startChunkIndex: nextChunkIndex(fn?.audios),
            });
          }}
          onFinalize={handleFinalize}
          isFinalizing={orchestration.finishMutation.isPending}
          onDelete={deleteNote}
          onBack={back}
        />
      );
    }

    case 'recording':
      return (
        <RecordingScreen
          sessionInfo={orchestration.sessionInfo}
          isQuickMode={orchestration.isQuickMode}
          isRecording={orchestration.recorder.isRecording}
          isPaused={orchestration.recorder.isPaused}
          timerFormatted={orchestration.timer.formatted}
          meteringRef={orchestration.recorder.meteringRef}
          recOpacity={waveform.recOpacity}
          recordingTimeline={recTimeline.recordingTimeline}
          recordingScrollRef={recTimeline.recordingScrollRef}
          handlers={handlers}
          isRecommending={orchestration.recommendMutation.isPending}
          onBack={back}
        />
      );
  }

  return null;
}
