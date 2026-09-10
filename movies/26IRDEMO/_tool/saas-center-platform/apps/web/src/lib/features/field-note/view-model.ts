/**
 * 필드노트 ViewModel
 *
 * API 응답 → UI 표현(라벨/색/타임라인/진행률)으로 변환.
 */

import type {
  FieldNoteAnalysis,
  FieldNoteAnalysisMoodPoint,
  FieldNoteAnalysisQuote,
  FieldNoteAudio,
  FieldNoteDetailResponse,
  FieldNoteEntry,
  ProcessingStatus,
  StepStatus,
  SummaryStatus
} from '$lib/hooks/actions/field-note.action'
import {
  FIELD_NOTE_STATUS_LABELS,
  PIPELINE_STEPS,
  PROCESSING_STATUS_LABELS,
  STATUS_DOT_COLORS,
  STEP_STATUS_LABELS
} from './constants'

export interface SpeakerSegment {
  speaker: string
  text: string
  /** 세그먼트 시작 시각(초). refined/diarized 전사에서만 존재하고 청크 폴백에선 누적 duration */
  startSeconds?: number
  endSeconds?: number
}

export interface TimelineItem {
  kind: 'transcript' | 'entry' | 'silence'
  timestamp_seconds: number | null
  speaker: string | null
  content: string
  entry_type?: string | null
  tag_category?: string | null
  /** 침묵 구간 지속 시간(초) — kind === 'silence'일 때만 */
  silence_duration?: number
}

export interface PipelineStepVM {
  key: string
  label: string
  status: StepStatus
  isActive: boolean
}

export interface FieldNoteVM {
  id: string
  scheduleId: string | null
  status: 'empty' | 'recording' | 'processing' | 'completed' | 'failed'
  statusLabel: string
  processingStatusLabel: string
  processingStatus: ProcessingStatus
  isProcessing: boolean
  isFailed: boolean
  isCompleted: boolean
  summary: string | null
  hasSummary: boolean
  /** 구조화 분석 — AI 분석 탭의 키워드·정서 흐름·의미 있는 발화 */
  analysis: FieldNoteAnalysis | null
  /** 분석 탭 본문 = narrative(확장 요약) 우선, 없으면 summary */
  analysisNarrative: string | null
  summaryStatus: SummaryStatus
  isSummaryGenerating: boolean
  speakerMap: Record<string, string>
  segments: SpeakerSegment[]
  entries: FieldNoteEntry[]
  timeline: TimelineItem[]
  pipelineSteps: PipelineStepVM[]
  totalDuration: number
  totalDurationLabel: string
  audios: FieldNoteDetailResponse['audios']
  failedStep: string | null
  updatedAt: string
  // ── AI 분석 탭 구조화 데이터 (analysis) ──
  /**
   * 요약 카드 본문. narrative(회기 흐름 확장 요약) → analysis.summary → 평문 summary 순.
   * 모바일 AIAnalysisView와 같은 폴백 순서를 쓴다(구버전 노트엔 narrative가 없다).
   */
  summaryBody: string | null
  keywords: string[]
  moodFlow: FieldNoteAnalysisMoodPoint[]
  keyQuotes: FieldNoteAnalysisQuote[]
}

function parseSpeakerMap(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* noop */
  }
  return {}
}

function parseSegments(raw: string | null): SpeakerSegment[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const segments: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.segments)
        ? parsed.segments
        : []
    if (segments.length > 0) {
      return segments
        .map((seg: any) => ({
          speaker: String(seg?.speaker ?? ''),
          text: String(seg?.text ?? '').trim(),
          startSeconds:
            typeof seg?.start === 'number'
              ? seg.start
              : typeof seg?.startSeconds === 'number'
                ? seg.startSeconds
                : undefined,
          endSeconds:
            typeof seg?.end === 'number'
              ? seg.end
              : typeof seg?.endSeconds === 'number'
                ? seg.endSeconds
                : undefined
        }))
        .filter((s) => s.text)
    }
    if (typeof parsed === 'string') {
      return [{ speaker: '', text: parsed }]
    }
  } catch {
    return [{ speaker: '', text: raw }]
  }
  return []
}

/** 전사 선택 우선순위: refined_transcript > audios[0].diarized_transcript > 청크별 transcript 누적 */
function selectTranscriptSegments(
  refined: string | null,
  audios: FieldNoteAudio[]
): SpeakerSegment[] {
  const refinedSegs = parseSegments(refined)
  if (refinedSegs.length > 0) return refinedSegs

  if (audios.length > 0) {
    const diarizedSegs = parseSegments(audios[0].diarized_transcript)
    if (diarizedSegs.length > 0) return diarizedSegs
  }

  // 폴백: 청크별 원문 transcript를 누적 duration으로 시간 부여
  const chunkSegs: SpeakerSegment[] = []
  let accumulated = 0
  const sorted = [...audios]
    .filter((a) => a.transcript)
    .sort((a, b) => a.chunk_index - b.chunk_index)
  for (const a of sorted) {
    chunkSegs.push({
      speaker: '',
      text: (a.transcript ?? '').trim(),
      startSeconds: accumulated
    })
    accumulated += a.duration ?? 0
  }
  return chunkSegs
}

/** 진입점(일지 상단 블록·검사 상세 버튼)이 쓰는 필드노트 상태 */
export type FieldNoteEntryStatus = 'none' | 'processing' | 'failed' | 'completed'

/**
 * by-schedule 응답 → 진입점 상태.
 *
 * 판정 기준은 mapStatus와 같아야 한다: **녹음 상태와 파이프라인 상태는 다른 축**이다.
 *   status            = 녹음 자체 (recording / paused / completed)
 *   processing_status = 후처리 (idle / processing / completed / failed / skipped)
 * 녹음은 끝났는데 후처리가 아직 idle인 필드노트가 정상적으로 존재한다(전문가앱이 녹음만 올린 상태).
 * 옛 구현은 processing_status만 보고 idle을 'none'으로 떨어뜨려, 녹음이 있는데도 일지에서
 * 필드노트 진입점(자세히·초안 생성)이 통째로 사라졌다.
 */
export function mapToEntryStatus(
  data: Pick<
    FieldNoteDetailResponse,
    'status' | 'processing_status'
  > | null | undefined
): FieldNoteEntryStatus {
  if (!data) return 'none'
  // 녹음 중·일시정지는 전문가앱이 알린다 — 웹은 쓸 수 있는 것만 보여준다
  if (data.status === 'recording' || data.status === 'paused') return 'none'
  if (data.processing_status === 'failed') return 'failed'
  if (data.processing_status === 'processing') return 'processing'
  // completed · idle · skipped = 대화를 열 수 있고 초안도 만들 수 있는 상태
  return 'completed'
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function mapStatus(
  fieldNote: FieldNoteDetailResponse
): FieldNoteVM['status'] {
  if (fieldNote.status === 'recording' || fieldNote.status === 'paused') {
    return 'recording'
  }
  if (fieldNote.processing_status === 'failed') return 'failed'
  if (fieldNote.processing_status === 'processing') return 'processing'
  if (fieldNote.processing_status === 'completed') return 'completed'
  // completed but skipped pipeline
  if (
    fieldNote.status === 'completed' &&
    fieldNote.processing_status === 'skipped'
  ) {
    return 'completed'
  }
  // completed recording, idle pipeline (녹음만 완료, 후처리 미시작)
  return 'completed'
}

function buildPipelineSteps(fn: FieldNoteDetailResponse): PipelineStepVM[] {
  const stepToStatus: Record<string, StepStatus> = {
    transcribe: fn.transcribe_status,
    refine: fn.refine_status,
    summary: (fn.summary_status === 'generating'
      ? 'processing'
      : fn.summary_status === 'completed'
        ? 'completed'
        : fn.summary_status === 'failed'
          ? 'failed'
          : 'none') as StepStatus,
    counseling_note: fn.note_status
  }
  const activeKey = (() => {
    const step = fn.processing_step
    if (step === 'transcribing') return 'transcribe'
    if (step === 'refining') return 'refine'
    if (step === 'summarizing') return 'summary'
    if (step === 'generating_note') return 'counseling_note'
    return null
  })()
  return PIPELINE_STEPS.map(({ key, label }) => ({
    key,
    label,
    status: stepToStatus[key] ?? 'none',
    isActive: activeKey === key
  }))
}

function parseSilenceMarkers(raw: string | null): TimelineItem[] {
  if (!raw) return []
  try {
    const markers: { type: string; start: number; end: number; duration: number }[] = JSON.parse(raw)
    return markers
      .filter((m) => m.type === 'silence')
      .map((m) => ({
        kind: 'silence' as const,
        timestamp_seconds: m.start,
        speaker: null,
        content: `${m.duration.toFixed(1)}초 침묵`,
        silence_duration: m.duration
      }))
  } catch {
    return []
  }
}

function buildTimeline(
  segments: SpeakerSegment[],
  entries: FieldNoteEntry[],
  nonverbalMarkersRaw: string | null = null
): TimelineItem[] {
  // speaker 는 원본 id 를 그대로 보존한다. 화면에서 저장된 매핑/세션 참가자 후보를
  // 조합해 실제 표시 이름으로 변환하려면 원본 id 가 필요하기 때문.
  const transcriptItems: TimelineItem[] = segments.map((seg) => ({
    kind: 'transcript',
    timestamp_seconds: seg.startSeconds ?? null,
    speaker: seg.speaker || null,
    content: seg.text
  }))
  const entryItems: TimelineItem[] = entries.map((e) => ({
    kind: 'entry',
    timestamp_seconds: e.timestamp_seconds,
    speaker: null,
    content: e.content,
    entry_type: e.entry_type,
    tag_category: e.tag_category
  }))
  const silenceItems = parseSilenceMarkers(nonverbalMarkersRaw)
  const items = [...transcriptItems, ...entryItems, ...silenceItems]
  // 타임스탬프가 있는 항목은 시간순, 없는 항목은 원래 순서 유지(전사 먼저, entry는 시간순 뒤에)
  const hasAnyTimestamp = items.some((it) => it.timestamp_seconds != null)
  if (hasAnyTimestamp) {
    items.sort((a, b) => {
      const ta = a.timestamp_seconds ?? Number.POSITIVE_INFINITY
      const tb = b.timestamp_seconds ?? Number.POSITIVE_INFINITY
      return ta - tb
    })
  }
  return items
}

/**
 * 요약 카드 본문 선택 — narrative(확장 요약) > analysis.summary > 평문 summary.
 * 구버전 노트는 analysis 자체가 없으므로 마지막 폴백이 항상 살아 있어야 한다.
 */
function pickSummaryBody(
  analysis: FieldNoteAnalysis | null,
  fallback: string | null
): string | null {
  const narrative = (analysis?.narrative ?? '').trim()
  if (narrative) return narrative
  const short = (analysis?.summary ?? '').trim()
  if (short) return short
  const plain = (fallback ?? '').trim()
  return plain || null
}

export function mapToFieldNoteVM(
  fieldNote: FieldNoteDetailResponse
): FieldNoteVM {
  const speakerMap = parseSpeakerMap(fieldNote.speaker_map)
  const segments = selectTranscriptSegments(
    fieldNote.refined_transcript,
    fieldNote.audios ?? []
  )
  const entries = fieldNote.entries ?? []
  const status = mapStatus(fieldNote)
  const analysis = fieldNote.analysis ?? null

  // processingStatus가 idle이어도 실제 콘텐츠(요약/전사)가 있으면 '분석 완료'로 보정
  const hasSummary = !!fieldNote.summary && fieldNote.summary_status === 'completed'
  const hasContent = hasSummary || segments.length > 0
  const effectiveProcessingStatus: ProcessingStatus =
    (fieldNote.processing_status === 'idle' || fieldNote.processing_status === 'skipped') && hasContent
      ? 'completed'
      : fieldNote.processing_status

  return {
    id: fieldNote.id,
    scheduleId: fieldNote.schedule_id,
    status,
    statusLabel: FIELD_NOTE_STATUS_LABELS[fieldNote.status] ?? '-',
    processingStatus: effectiveProcessingStatus,
    processingStatusLabel:
      PROCESSING_STATUS_LABELS[effectiveProcessingStatus] ?? '-',
    isProcessing: effectiveProcessingStatus === 'processing',
    isFailed: effectiveProcessingStatus === 'failed',
    isCompleted:
      effectiveProcessingStatus === 'completed' ||
      effectiveProcessingStatus === 'skipped',
    summary: fieldNote.summary,
    hasSummary,
    analysis,
    analysisNarrative: analysis?.narrative?.trim() || fieldNote.summary,
    summaryStatus: fieldNote.summary_status,
    isSummaryGenerating: fieldNote.summary_status === 'generating',
    speakerMap,
    segments,
    entries,
    timeline: buildTimeline(segments, entries, fieldNote.nonverbal_markers),
    pipelineSteps: buildPipelineSteps(fieldNote),
    totalDuration: fieldNote.total_duration,
    totalDurationLabel: formatDuration(fieldNote.total_duration),
    audios: fieldNote.audios ?? [],
    failedStep: fieldNote.failed_step,
    updatedAt: fieldNote.updated_at,
    summaryBody: pickSummaryBody(analysis, fieldNote.summary),
    keywords: analysis?.keywords ?? [],
    // 빈 mood/quote 항목은 렌더 자리를 비워 리스트가 어그러지므로 여기서 걸러낸다
    moodFlow: (analysis?.mood_flow ?? []).filter((p) => !!p?.mood),
    keyQuotes: (analysis?.key_quotes ?? []).filter((q) => !!q?.quote)
  }
}

/** 세션 리스트 뱃지용 상태 → 색상 */
export function statusDotColor(
  status: ProcessingStatus | null | undefined
): string {
  if (!status) return ''
  return STATUS_DOT_COLORS[status] ?? ''
}

export function stepStatusLabel(status: StepStatus): string {
  return STEP_STATUS_LABELS[status] ?? '-'
}
