export {
  useFieldNote,
  useFieldNoteBySchedule,
  useFieldNoteStatuses,
  useFieldNotesByTask,
  useCreateFieldNote,
  useAddEntry,
  useUploadAudioChunk,
  useFinishRecording,
  useRetryPipeline,
  useLinkSchedule,
  useLinkNoteToTask,
  useUpdateSpeakerMap,
  useUnlinkedFieldNotes,
  useFieldNotes,
  useGenerateSummary,
  useGenerateCounselingNote,
  useCounselingNoteGenerationComplete,
  useRunPipeline,
  useRecommendation,
  useDeleteFieldNote,
  useAudioDownloadUrl,
} from './hooks';

export {
  createFieldNote,
  getFieldNote,
  getFieldNoteBySchedule,
  getFieldNoteStatuses,
  addEntry,
  uploadAudioChunk,
  finishRecording,
  retryPipeline,
  generateCounselingNote,
  linkSchedule,
  getUnlinkedFieldNotes,
  deleteFieldNote,
  getAudioDownloadUrl,
} from './api';

export { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS, CHUNK_INTERVAL_SECONDS, POLLING_INTERVAL_MS, WAVEFORM_BAR_COUNT, PROCESSING_STEP_LABELS, MIN_RECORDING_DURATION_SECONDS } from './constants';

export { useRecordingStore } from './recordingStore';

export {
  buildTimeline,
  buildShareableText,
  getSpeakerColor,
  getSpeakerLabel,
  parseSpeakerMap,
  extractSpeakers,
} from './timeline';

export type {
  FieldNoteStatus,
  TranscriptStatus,
  ProcessingStatus,
  ProcessingStep,
  SummaryStatus,
  EntryType,
  TagCategory,
  FieldNoteAudio,
  FieldNoteEntry,
  FieldNoteResponse,
  FieldNoteDetailResponse,
  FieldNoteStatusItem,
  FieldNoteAnalysis,
  FieldNoteAnalysisHighlight,
  FieldNoteAnalysisResponse,
  AudioUploadResponse,
} from './types';

export type { TimelineItem, SpeakerSegment } from './timeline';

export { DK } from './theme';
export { formatSeconds, formatTime } from './utils';

export { LinkFieldNoteSheet } from './components/LinkFieldNoteSheet';

// 플랫폼 포트 — 호스트 앱이 의존성을 주입하는 경계.
// 추출 시 mainApp 어댑터만 교체하면 된다. (platform/EXTRACTION.md 참고)
export { MainAppFieldNotePlatformProvider } from './platform/mainApp';
export { useFieldNotePlatform } from './platform/context';
export type { FieldNotePlatform } from './platform/types';
