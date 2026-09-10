import { useRef, useMemo } from 'react';
import { FlatList } from 'react-native';
import type { FieldNoteAudio, FieldNoteEntry } from './types';

/** 라이브 전사에 표시(렌더)하는 최대 행 수 — 긴 세션(1.5h+, 수백~수천 발화)에서도 리스트
 *  갱신·리오픈 비용을 n과 무관하게 일정하게 묶는다. 전체 전사는 서버 저장본(상세)에 보존. */
const MAX_LIVE_ROWS = 300;

export type RecordingTimelineItem =
  | {
      kind: 'transcript';
      text: string;
      seconds: number;
      endSeconds: number;
      chunkIndex: number;
      isPlaceholder: boolean;
      /** 청크는 완료됐지만 transcript 가 비어있는 경우 — 무음 또는 마이크 미입력 */
      isSilent?: boolean;
    }
  | { kind: 'entry'; entry: FieldNoteEntry; seconds: number };

/**
 * 업로드는 시작됐지만 서버 audio record 가 아직 폴링으로 안 들어온 청크.
 * RecordingHost 가 onChunkReady 시점에 즉시 push, 서버가 따라잡으면 pop.
 */
export interface PendingClientChunk {
  chunkIndex: number;
  duration: number;
  /** 청크가 시작된 timer.elapsed 시점(초) — timeline 표시 시간으로 사용 */
  startedAt: number;
}

/** 스트리밍 모드 발화 (aws_streaming 전용) */
export interface StreamingUtterance {
  text: string;
  startSeconds: number | null;
  endSeconds: number | null;
  isFinal: boolean;
}

interface UseRecordingTimelineParams {
  audios: FieldNoteAudio[];
  entries: FieldNoteEntry[];
  isRecording: boolean;
  /** 클라이언트가 onChunkReady 로 인지한 청크들 — 서버 도달 전 즉시 placeholder 노출용 */
  pendingClientChunks?: PendingClientChunk[];
  /**
   * chunk_index → 청크 시작 시점(timer 초) 맵.
   * 녹음 중에는 RecordingHost 가 채워줘서 timeline 시간이 timer 와 정확히 일치.
   * 페이지 새로 진입 시(map 비어있음) audio.duration 누적으로 자동 fallback.
   */
  chunkStartedAtMap?: Record<number, number>;
  /** 스트리밍 모드 발화 목록 (aws_streaming 전용) */
  streamingUtterances?: StreamingUtterance[];
  /** 현재 partial 텍스트 (aws_streaming 전용) */
  currentPartial?: string;
  /**
   * '전사 중...' placeholder 를 띄울 최소 chunk_index — 이어/추가 녹음 시 이번 세션의
   * 시작 index. 그 이전 청크(옛 스트리밍 파트 등)는 개별 청크 전사가 돌지 않아
   * pending 이 영원히 풀리지 않으므로 placeholder 대상에서 제외한다.
   */
  placeholderMinChunkIndex?: number;
  /**
   * 스트리밍 발화 타임스탬프 오프셋(초) — 이어/추가 녹음 시 기존 녹음 길이(baseDuration).
   * AWS 세션 타임스탬프는 세션 시작 기준 0부터라, 표시 시간을 노트 전체 타임라인에 잇는다.
   */
  streamingTimeOffset?: number;
}

interface UseRecordingTimelineReturn {
  recordingTimeline: RecordingTimelineItem[];
  recordingScrollRef: React.RefObject<FlatList<RecordingTimelineItem> | null>;
}

export function useRecordingTimeline({
  audios,
  entries,
  isRecording,
  pendingClientChunks = [],
  chunkStartedAtMap = {},
  streamingUtterances = [],
  currentPartial = '',
  placeholderMinChunkIndex = 0,
  streamingTimeOffset = 0,
}: UseRecordingTimelineParams): UseRecordingTimelineReturn {
  const recordingScrollRef = useRef<FlatList<RecordingTimelineItem>>(null);

  const isStreamingMode = streamingUtterances.length > 0 || currentPartial.length > 0;

  const recordingTimeline = useMemo(() => {
    const items: RecordingTimelineItem[] = [];

    // ── 기존 청크의 전사(이전 세션들) — 스트리밍/청크 모드 공통 ──
    // 이어/추가 녹음 시 이전에 전사된 내용이 사라지지 않게 항상 렌더한다.
    // 규약: 청크 diarized_transcript = 그 세션의 상대시간 → chunk_index 순 누적 duration
    // 오프셋 합성(buildTimeline·서버 merge_chunk_transcripts 와 동일).
    // chunkIndex 키 충돌 방지: 세그먼트 행은 -1000 부터 내려가는 고유 음수 인덱스 사용
    // (라이브 utterance 의 0.. / 실제 청크 index / partial 의 -1 과 안 겹침).
    //
    // 스트리밍 모드에선 "이번 녹음 세션 이전" 청크만 — 백그라운드 복귀 등으로 현재 녹음의
    // 일부가 서버에 청크로 보존(evict-save)되면 그 내용은 화면의 utterance 에 이미 있어,
    // 청크 전사까지 그리면 같은 내용이 이중 표시된다.
    const sortedAudios = [...audios].sort((a, b) => a.chunk_index - b.chunk_index);
    const diarizedChunkIndices = new Set<number>();
    {
      let acc = 0;
      let segSeq = 0;
      for (const audio of sortedAudios) {
        if (isStreamingMode && audio.chunk_index >= placeholderMinChunkIndex) {
          acc += audio.duration ?? 0;
          continue;
        }
        if (audio.diarized_transcript) {
          try {
            const parsed = JSON.parse(audio.diarized_transcript) as {
              segments?: { text?: string; start?: number; end?: number }[];
            };
            for (const seg of parsed.segments ?? []) {
              const segText = seg.text?.trim();
              if (!segText) continue;
              const start = (seg.start ?? 0) + acc;
              items.push({
                kind: 'transcript',
                text: segText,
                seconds: start,
                endSeconds: (seg.end ?? seg.start ?? 0) + acc,
                chunkIndex: -1000 - segSeq++,
                isPlaceholder: false,
              });
            }
            diarizedChunkIndices.add(audio.chunk_index);
          } catch {
            // 파싱 실패 — 해당 청크는 아래 청크 모드 일반 경로에서 처리
          }
        }
        acc += audio.duration ?? 0;
      }
    }

    if (isStreamingMode) {
      // ── 스트리밍 모드: utterance 기반 타임라인 ──
      // final utterance 를 transcript 아이템으로 변환
      streamingUtterances.forEach((utt, idx) => {
        if (!utt.isFinal) return;
        // 이어/추가 녹음 — 세션 상대 타임스탬프를 기존 녹음 길이만큼 오프셋해 잇는다.
        const startSec = (utt.startSeconds ?? 0) + streamingTimeOffset;
        const endSec = (utt.endSeconds ?? utt.startSeconds ?? 0) + streamingTimeOffset;
        items.push({
          kind: 'transcript',
          text: utt.text,
          seconds: startSec,
          endSeconds: endSec,
          chunkIndex: idx, // utterance index 를 키로 사용
          isPlaceholder: false,
        });
      });

      // 현재 partial 텍스트가 있으면 placeholder 로 표시 — 항상 맨 뒤(기존 전사·발화 뒤)에.
      if (currentPartial.length > 0) {
        const lastEnd = Math.max(
          streamingTimeOffset,
          ...items.filter((i) => i.kind === 'transcript').map((i) => i.seconds),
        );
        items.push({
          kind: 'transcript',
          text: currentPartial,
          seconds: lastEnd + 0.01, // 마지막 아이템 뒤에 배치
          endSeconds: lastEnd + 0.01,
          chunkIndex: -1, // partial 전용 인덱스
          isPlaceholder: true,
        });
      }
    } else {
      // ── 청크 모드: 기존 로직 유지 (diarized 로 이미 렌더한 청크는 제외) ──
      const completedAudios = sortedAudios.filter(
        (a) => a.transcript_status === 'completed',
      );

      let fallbackAcc = 0;
      const resolveStart = (chunkIndex: number, duration: number): number => {
        const mapped = chunkStartedAtMap[chunkIndex];
        if (typeof mapped === 'number') {
          return mapped;
        }
        const value = fallbackAcc;
        fallbackAcc += duration;
        return value;
      };

      for (const audio of completedAudios) {
        if (diarizedChunkIndices.has(audio.chunk_index)) {
          // 위에서 세그먼트로 렌더 완료 — fallback 오프셋 누적만 진행.
          resolveStart(audio.chunk_index, audio.duration);
          continue;
        }
        const text = audio.transcript?.trim() ?? '';
        const isSilent = text.length === 0;
        const startedAt = resolveStart(audio.chunk_index, audio.duration);
        items.push({
          kind: 'transcript',
          text: isSilent ? '조용한 구간이에요' : text,
          seconds: startedAt,
          endSeconds: startedAt + audio.duration,
          chunkIndex: audio.chunk_index,
          isPlaceholder: false,
          isSilent,
        });
      }

      const serverChunkIndices = new Set(audios.map((a) => a.chunk_index));

      const placeholderChunks = [...audios]
        .filter(
          (a) =>
            (a.transcript_status === 'pending' || a.transcript_status === 'processing') &&
            a.chunk_index >= placeholderMinChunkIndex,
        )
        .sort((a, b) => a.chunk_index - b.chunk_index);

      for (const audio of placeholderChunks) {
        const startedAt = resolveStart(audio.chunk_index, audio.duration);
        items.push({
          kind: 'transcript',
          text: '전사 중...',
          seconds: startedAt,
          endSeconds: startedAt + audio.duration,
          chunkIndex: audio.chunk_index,
          isPlaceholder: true,
        });
      }

      const clientOnlyChunks = pendingClientChunks
        .filter((c) => !serverChunkIndices.has(c.chunkIndex))
        .sort((a, b) => a.chunkIndex - b.chunkIndex);

      for (const chunk of clientOnlyChunks) {
        items.push({
          kind: 'transcript',
          text: '전사 중...',
          seconds: chunk.startedAt,
          endSeconds: chunk.startedAt + chunk.duration,
          chunkIndex: chunk.chunkIndex,
          isPlaceholder: true,
        });
      }
    }

    // 메모/태그 추가 (두 모드 공통)
    for (const entry of entries) {
      items.push({ kind: 'entry', entry, seconds: entry.timestamp_seconds });
    }

    // 시간순 정렬
    items.sort((a, b) => a.seconds - b.seconds);
    // 라이브 표시는 최근 MAX_LIVE_ROWS 개만 — 긴 세션에서도 리스트/리오픈 비용 일정 유지.
    // (보통 녹음 중엔 최근 발화만 본다. 전체 전사는 서버 저장본/상세에서 확인.)
    return items.length > MAX_LIVE_ROWS ? items.slice(-MAX_LIVE_ROWS) : items;
  }, [audios, entries, pendingClientChunks, chunkStartedAtMap, isStreamingMode, streamingUtterances, currentPartial, placeholderMinChunkIndex, streamingTimeOffset]);

  // auto-scroll 은 RecordingSheet 의 FlatList onContentSizeChange 한 곳에서만 처리한다.
  // (여기서 추가로 scrollToEnd 하면 두 애니메이션이 충돌해 스크롤이 끊겨 — 중복 제거.)

  return { recordingTimeline, recordingScrollRef };
}
