/**
 * 통합 타임라인 빌더 유틸리티
 *
 * 전사(audios) + 메모/태그(entries) + 화자 분리(diarized) 데이터를
 * 시간순으로 통합하여 타임라인 아이템 배열로 변환합니다.
 */
import type { FieldNoteAudio, FieldNoteEntry, TagCategory } from './types';
import { TAG_CATEGORY_LABELS } from './constants';

// --- Types ---

/** 화자 분리 세그먼트 (OpenAI diarized_json 응답) */
export interface DiarizedSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

/** 화자 분리 전사 결과 (gpt-4o-transcribe-diarize 응답) */
export interface DiarizedTranscript {
  text: string;
  segments?: DiarizedSegment[];
}

/** 화자별 발화 세그먼트 */
export interface SpeakerSegment {
  speaker: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/** 통합 타임라인 아이템 */
export type TimelineItem =
  | { type: 'speaker'; speaker: string; text: string; startSeconds: number; endSeconds: number }
  | { type: 'transcript'; text: string; startSeconds: number }
  | { type: 'memo'; content: string; timestampSeconds: number }
  | { type: 'tag'; category: TagCategory; label: string; timestampSeconds: number };

// --- Speaker colors ---

const SPEAKER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: 'rgba(37,110,244,0.15)', text: '#85aff9', label: '화자 A' },
  B: { bg: 'rgba(168,85,247,0.15)', text: '#c4a5f7', label: '화자 B' },
  C: { bg: 'rgba(34,197,94,0.15)', text: '#7dd3a1', label: '화자 C' },
  D: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf6a', label: '화자 D' },
};

const DEFAULT_SPEAKER_COLOR = { bg: 'rgba(255,255,255,0.08)', text: '#aab2be', label: '화자' };

export function getSpeakerColor(speaker: string) {
  return SPEAKER_COLORS[speaker] ?? DEFAULT_SPEAKER_COLOR;
}

/** 화자 라벨 반환 (speakerMap이 있으면 매핑된 이름 우선) */
export function getSpeakerLabel(speaker: string, speakerMap?: Record<string, string> | null): string {
  if (speakerMap?.[speaker]) return speakerMap[speaker];
  return SPEAKER_COLORS[speaker]?.label ?? `화자 ${speaker}`;
}

/** JSON 문자열을 speaker_map 객체로 파싱 */
export function parseSpeakerMap(json: string | null | undefined): Record<string, string> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** refined_transcript에서 고유 화자 목록 추출 */
export function extractSpeakers(refinedTranscript: string | null): string[] {
  const segments = parseSegmentsJson(refinedTranscript);
  if (!segments) return [];
  const speakers = new Set<string>();
  for (const seg of segments) {
    if (seg.speaker) speakers.add(seg.speaker);
  }
  return Array.from(speakers).sort();
}

// --- Core functions ---

/**
 * diarized_json의 segments를 SpeakerSegment로 변환
 */
export function toSpeakerSegments(segments: DiarizedSegment[]): SpeakerSegment[] {
  return segments.map((seg) => ({
    speaker: seg.speaker,
    text: seg.text.trim(),
    startSeconds: seg.start,
    endSeconds: seg.end,
  }));
}

/**
 * 화자 분리 JSON 문자열을 파싱
 */
function parseDiarizedTranscript(json: string | null): DiarizedTranscript | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as DiarizedTranscript;
  } catch {
    return null;
  }
}

/**
 * JSON 문자열을 세그먼트 배열로 파싱
 */
function parseSegmentsJson(json: string | null): DiarizedSegment[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * 통합 타임라인 구성
 *
 * 우선순위: refined_transcript > diarized_transcript > chunk transcript
 * entries(메모/태그)는 항상 시간순으로 삽입됩니다.
 */
export function buildTimeline(
  audios: FieldNoteAudio[],
  entries: FieldNoteEntry[],
  refinedTranscript?: string | null,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // 1. 우선순위에 따라 전사 데이터 선택
  const refinedSegments = parseSegmentsJson(refinedTranscript ?? null);

  // 모든 chunk 의 diarized_transcript 를 누적 offset 적용해 하나의 segments 배열로 합침.
  // (이전: audios[0] 만 사용 → 청크 2 부터의 화자 분리가 사라짐)
  const sortedAudios = [...audios].sort(
    (a, b) => a.chunk_index - b.chunk_index,
  );
  const allDiarizedSegments: SpeakerSegment[] = [];
  {
    let offset = 0;
    for (const audio of sortedAudios) {
      const parsed = parseDiarizedTranscript(audio.diarized_transcript);
      if (parsed?.segments?.length) {
        for (const seg of parsed.segments) {
          allDiarizedSegments.push({
            speaker: seg.speaker,
            text: seg.text.trim(),
            startSeconds: (seg.start ?? 0) + offset,
            endSeconds: (seg.end ?? 0) + offset,
          });
        }
      }
      offset += audio.duration;
    }
  }

  if (refinedSegments) {
    // 최우선: LLM 보정된 전사본
    for (const seg of refinedSegments) {
      items.push({
        type: 'speaker',
        speaker: seg.speaker || 'A',
        text: seg.text?.trim() || '',
        startSeconds: seg.start || 0,
        endSeconds: seg.end || 0,
      });
    }
  } else if (allDiarizedSegments.length > 0) {
    // 차선: 화자 분리 원본 (모든 청크 누적)
    for (const seg of allDiarizedSegments) {
      items.push({
        type: 'speaker',
        speaker: seg.speaker,
        text: seg.text,
        startSeconds: seg.startSeconds,
        endSeconds: seg.endSeconds,
      });
    }
  } else {
    // 폴백: 청크별 plain transcript (화자 분리 없음 — 하위 호환)
    const transcriptAudios = sortedAudios.filter((a) => a.transcript);
    let accumulatedDuration = 0;
    for (const audio of transcriptAudios) {
      items.push({
        type: 'transcript',
        text: audio.transcript!,
        startSeconds: accumulatedDuration,
      });
      accumulatedDuration += audio.duration;
    }
  }

  // 2. 메모/태그 추가
  for (const entry of entries) {
    if (entry.entry_type === 'tag' && entry.tag_category) {
      items.push({
        type: 'tag',
        category: entry.tag_category as TagCategory,
        label: TAG_CATEGORY_LABELS[entry.tag_category as TagCategory] ?? entry.tag_category,
        timestampSeconds: entry.timestamp_seconds,
      });
    } else {
      items.push({
        type: 'memo',
        content: entry.content,
        timestampSeconds: entry.timestamp_seconds,
      });
    }
  }

  // 3. 시간순 정렬
  items.sort((a, b) => {
    const timeA = 'startSeconds' in a ? a.startSeconds : a.timestampSeconds;
    const timeB = 'startSeconds' in b ? b.startSeconds : b.timestampSeconds;
    return timeA - timeB;
  });

  return items;
}

/**
 * 타임라인을 공유용 텍스트로 변환
 */
export function buildShareableText(
  items: TimelineItem[],
  summary: string | null,
  sessionInfo: string,
  speakerMap?: Record<string, string> | null,
): string {
  const lines: string[] = [];

  if (sessionInfo) {
    lines.push(`[${sessionInfo}]`);
    lines.push('');
  }

  if (summary) {
    lines.push('--- AI 요약 ---');
    lines.push(summary);
    lines.push('');
  }

  lines.push('--- 타임라인 ---');
  for (const item of items) {
    switch (item.type) {
      case 'speaker': {
        const label = getSpeakerLabel(item.speaker, speakerMap);
        const ts = formatTimestamp(item.startSeconds);
        lines.push(`[${ts}] ${label}: ${item.text}`);
        break;
      }
      case 'transcript': {
        const ts = formatTimestamp(item.startSeconds);
        lines.push(`[${ts}] ${item.text}`);
        break;
      }
      case 'memo': {
        const ts = formatTimestamp(item.timestampSeconds);
        lines.push(`[${ts}] memo: ${item.content}`);
        break;
      }
      case 'tag': {
        const ts = formatTimestamp(item.timestampSeconds);
        lines.push(`[${ts}] #${item.label}`);
        break;
      }
    }
  }

  return lines.join('\n');
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
