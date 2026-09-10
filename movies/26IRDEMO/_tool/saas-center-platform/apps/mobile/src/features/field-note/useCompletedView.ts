import { useState, useRef, useMemo, useCallback } from 'react';
import { TextInput, ScrollView, Share } from 'react-native';
import {
  buildTimeline,
  buildShareableText,
  parseSpeakerMap,
  type TimelineItem,
} from './timeline';
import { useAudioPlayer } from './useAudioPlayer';
import { getAudioDownloadUrl } from './api';
import { formatTime } from './utils';
import type { FieldNoteDetailResponse, FieldNoteAudio, FieldNoteEntry } from './types';

interface UseCompletedViewParams {
  centerId: string | null;
  fieldNoteId: string | null;
  fieldNote: FieldNoteDetailResponse | null | undefined;
  existingFieldNote: FieldNoteDetailResponse | null | undefined;
  sessionInfo: string;
  speakerMapMutation: { mutate: (map: Record<string, string>) => void };
}

export interface CompletedViewData {
  // Timeline
  timelineItems: TimelineItem[];
  transcriptScrollRef: React.RefObject<ScrollView | null>;
  // Audio
  audioPlayer: ReturnType<typeof useAudioPlayer>;
  totalDurationFormatted: string;
  // Speaker editing
  editingSpeaker: string | null;
  speakerNameInput: string;
  speakerNameRef: React.RefObject<TextInput | null>;
  speakerMap: Record<string, string> | null;
  handleSpeakerLabelPress: (speaker: string) => void;
  handleSpeakerNameSave: () => void;
  setEditingSpeaker: (speaker: string | null) => void;
  setSpeakerNameInput: (text: string) => void;
  // Summary
  summaryExpanded: boolean;
  setSummaryExpanded: (v: boolean) => void;
  // Share / Copy
  handleShare: () => Promise<void>;
  handleCopy: () => Promise<boolean>;
}

export function useCompletedView({
  centerId,
  fieldNoteId,
  fieldNote,
  existingFieldNote,
  sessionInfo,
  speakerMapMutation,
}: UseCompletedViewParams): CompletedViewData {
  // --- Speaker map ---
  const rawSpeakerMap = fieldNote?.speaker_map ?? existingFieldNote?.speaker_map ?? null;
  const speakerMap = useMemo(() => parseSpeakerMap(rawSpeakerMap), [rawSpeakerMap]);

  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [speakerNameInput, setSpeakerNameInput] = useState('');
  const speakerNameRef = useRef<TextInput>(null);

  const handleSpeakerLabelPress = useCallback((speaker: string) => {
    setEditingSpeaker(speaker);
    setSpeakerNameInput(speakerMap?.[speaker] ?? '');
    setTimeout(() => speakerNameRef.current?.focus(), 100);
  }, [speakerMap]);

  const handleSpeakerNameSave = useCallback(() => {
    if (!editingSpeaker) return;
    const newMap = { ...(speakerMap ?? {}), [editingSpeaker]: speakerNameInput.trim() };
    if (!speakerNameInput.trim()) delete newMap[editingSpeaker];
    speakerMapMutation.mutate(newMap);
    setEditingSpeaker(null);
    setSpeakerNameInput('');
  }, [editingSpeaker, speakerNameInput, speakerMap, speakerMapMutation]);

  // --- Audio & Timeline data ---
  const audios: FieldNoteAudio[] = useMemo(() => {
    return fieldNote?.audios ?? existingFieldNote?.audios ?? [];
  }, [fieldNote?.audios, existingFieldNote?.audios]);

  const entries: FieldNoteEntry[] = useMemo(() => {
    const raw = fieldNote?.entries ?? existingFieldNote?.entries ?? [];
    return [...raw].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  }, [fieldNote?.entries, existingFieldNote?.entries]);

  // --- Audio Player (연속 재생) ---
  const audioChunks = useMemo(() => {
    return [...audios]
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map(a => ({ id: a.id, chunkIndex: a.chunk_index, duration: a.duration }));
  }, [audios]);

  const getAudioUrl = useCallback(async (audioId: string) => {
    if (!centerId || !fieldNoteId) throw new Error('missing ids');
    const result = await getAudioDownloadUrl(centerId, fieldNoteId, audioId);
    return result.download_url;
  }, [centerId, fieldNoteId]);

  const audioPlayer = useAudioPlayer({ chunks: audioChunks, getUrl: getAudioUrl });

  // --- Integrated Timeline (completed view) ---
  const refinedTranscript = fieldNote?.refined_transcript ?? existingFieldNote?.refined_transcript ?? null;
  const timelineItems = useMemo(() => {
    return buildTimeline(audios, entries, refinedTranscript);
  }, [audios, entries, refinedTranscript]);

  // 활성 행 하이라이트/자동 스크롤은 CompletedScreen 이 재생 위치 스토어
  // (usePlaybackPositionStore) 구독으로 직접 처리한다 — 매 틱 훅 호스트 리렌더 방지.
  const transcriptScrollRef = useRef<ScrollView>(null);

  // --- Share / Copy ---
  const buildText = useCallback(() => {
    const summary = fieldNote?.summary ?? existingFieldNote?.summary ?? null;
    return buildShareableText(timelineItems, summary, sessionInfo, speakerMap);
  }, [timelineItems, fieldNote?.summary, existingFieldNote?.summary, sessionInfo, speakerMap]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: buildText() });
    } catch {
      // user cancelled
    }
  }, [buildText]);

  const handleCopy = useCallback(async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(buildText());
      return true;
    } catch {
      return false;
    }
  }, [buildText]);

  // --- Total duration ---
  const totalDurationFormatted = useMemo(() => {
    const dur = fieldNote?.total_duration ?? existingFieldNote?.total_duration ?? 0;
    return formatTime(dur);
  }, [fieldNote?.total_duration, existingFieldNote?.total_duration]);

  // --- Summary ---
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  return {
    timelineItems,
    transcriptScrollRef,
    audioPlayer,
    totalDurationFormatted,
    editingSpeaker,
    speakerNameInput,
    speakerNameRef,
    speakerMap,
    handleSpeakerLabelPress,
    handleSpeakerNameSave,
    setEditingSpeaker,
    setSpeakerNameInput,
    summaryExpanded,
    setSummaryExpanded,
    handleShare,
    handleCopy,
  };
}
