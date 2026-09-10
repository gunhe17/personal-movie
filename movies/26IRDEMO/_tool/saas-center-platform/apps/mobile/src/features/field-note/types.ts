/** 필드노트 상태 */
export type FieldNoteStatus = 'recording' | 'paused' | 'completed';

/** STT 상태 */
export type TranscriptStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** 파이프라인 상태 */
export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'failed' | 'skipped';

/** 파이프라인 단계 */
export type ProcessingStep = 'transcribing' | 'refining' | 'summarizing' | 'generating_note' | null;

/** 엔트리 타입 */
export type EntryType = 'memo' | 'tag';

/** 태그 카테고리 */
export type TagCategory = 'observation' | 'behavior' | 'emotion' | 'other';

/** 요약 상태 */
export type SummaryStatus = 'none' | 'generating' | 'completed' | 'failed';

/** 화자분리 상태 (유료 온디맨드) */
export type DiarizationStatus = 'none' | 'processing' | 'completed' | 'failed';

/** 오디오 청크 응답 */
export interface FieldNoteAudio {
  id: string;
  field_note_id: string;
  chunk_index: number;
  storage_path: string;
  duration: number;
  transcript: string | null;
  transcript_status: TranscriptStatus;
  diarized_transcript: string | null;
  stt_model_used: string | null;
  created_at: string;
}

/** 메모/태그 응답 */
export interface FieldNoteEntry {
  id: string;
  field_note_id: string;
  entry_type: EntryType;
  tag_category: TagCategory | null;
  content: string;
  timestamp_seconds: number;
  created_at: string;
}

/** 리스트 응답에 동봉되는 schedule 핵심 정보 (application handler 가 enrich). */
export interface FieldNoteScheduleBrief {
  schedule_id: string;
  start: string;
  schedule_type: string;
  client_names: string[];
  program_name: string | null;
  room_name: string | null;
  session_status: string | null;
}

/** 리스트 응답에 동봉되는 검사 task 핵심 정보 (task_id 연결 노트일 때 enrich). */
export interface FieldNoteTaskBrief {
  task_id: string;
  client_name: string | null;
  assessment_kor_name: string | null;
  assessment_code: string | null;
  case_id: string | null;
  case_code: string | null;
  room_name: string | null;
  task_status: string | null;
}

/** AI 분석 탭 — 주목 지점 (t초 → 재생 점프) */
export interface FieldNoteAnalysisHighlight {
  t: number;
  text: string;
}

/** 검사 렌즈 — 검사자 질문↔내담자 반응 쌍 (t로 재생 점프) */
export interface FieldNoteAnalysisResponse {
  t: number;
  prompt: string;
  response: string;
}

/** 상담 렌즈 — 정서 흐름 타임라인의 한 지점 (t로 재생 점프) */
export interface FieldNoteAnalysisMoodPoint {
  t: number;
  mood: string;
  /** 그 정서가 나온 계기·맥락 (없으면 빈 문자열) */
  trigger?: string;
}

/** 상담 렌즈 — 의미 있는 발화(내담자 verbatim) + 짚는 이유 (t로 재생 점프) */
export interface FieldNoteAnalysisQuote {
  t: number;
  quote: string;
  /** 왜 주목할 만한지 한 줄 (해석 아님) */
  note?: string;
}

/** 상담 렌즈 — 다음 회기에 살펴볼/확인할 지점 (제안형) */
export interface FieldNoteAnalysisFollowUp {
  point: string;
  reason?: string;
}

/** AI 분석 탭 구조화 데이터 (요약 스텝에서 생성).
 * 상담 렌즈(narrative/keywords/issues/mood_flow/key_quotes/follow_ups)와
 * 검사 렌즈(responses/observations/quotes)를 함께 담되,
 * 채워지는 쪽은 노트 종류(task_id 유무)에 따라 다름 — 데이터 있는 섹션만 렌더. */
export interface FieldNoteAnalysis {
  /** 목록 식별용 짧은 제목 (15자 내외, 요약 스텝에서 생성). 구버전 노트는 없음. */
  title?: string | null;
  /** 목록 미리보기용 짧은 1문장 */
  summary: string | null;
  // 상담 렌즈
  /** 분석 탭 본문 — 회기 흐름 3-5문장(확장 요약). 구버전 노트는 없음 → summary 폴백 */
  narrative?: string | null;
  keywords: string[];
  issues: string[];
  /** legacy 단발 정서(구버전 노트) — 신버전은 mood_flow 사용 */
  mood: string | null;
  /** 시점별 정서 흐름 */
  mood_flow?: FieldNoteAnalysisMoodPoint[];
  /** 의미 있는 발화 */
  key_quotes?: FieldNoteAnalysisQuote[];
  /** 살펴볼 지점 */
  follow_ups?: FieldNoteAnalysisFollowUp[];
  highlights: FieldNoteAnalysisHighlight[];
  // 검사 렌즈 (해석 금지 — 정리·위치 찾기)
  responses?: FieldNoteAnalysisResponse[];
  observations?: FieldNoteAnalysisHighlight[];
  quotes?: FieldNoteAnalysisHighlight[];
}

/** 필드노트 기본 응답 */
export interface FieldNoteResponse {
  id: string;
  center_id: string;
  schedule_id: string | null;
  /** 검사 항목(task) 연결 id. 검사별 필드노트일 때만 채워짐. */
  task_id: string | null;
  author_id: string;
  /** 작성자별 생성 순번 (1부터). 미연결 카드·홈 최근 노트 라벨("필드노트 N")용. */
  note_number: number | null;
  status: FieldNoteStatus;
  total_duration: number;
  // 파이프라인
  processing_status: ProcessingStatus;
  processing_step: ProcessingStep;
  failed_step: string | null;
  refined_transcript: string | null;
  refinement_model: string | null;
  transcribe_status: string;
  refine_status: string;
  // 화자분리 (유료 온디맨드) 상태
  diarization_status: DiarizationStatus;
  note_status: string;
  // 화자 매핑
  speaker_map: string | null;
  // AI 요약
  summary: string | null;
  summary_status: SummaryStatus;
  summary_generated_at: string | null;
  summary_model: string | null;
  // AI 분석 탭 구조화 데이터 (없으면 summary 평문 폴백)
  analysis: FieldNoteAnalysis | null;
  // 리스트 응답에서만 채워짐 (schedule_id 가 있을 때).
  schedule?: FieldNoteScheduleBrief | null;
  // 리스트 응답에서만 채워짐 (task_id 가 있을 때 — 검사 연결 노트).
  task?: FieldNoteTaskBrief | null;
  created_at: string;
  updated_at: string;
}

/** 필드노트 상세 응답 (audios + entries 포함) */
export interface FieldNoteDetailResponse extends FieldNoteResponse {
  audios: FieldNoteAudio[];
  entries: FieldNoteEntry[];
}

/** 필드노트 상태 (일괄 조회용) */
export interface FieldNoteStatusItem {
  id: string | null;
  schedule_id: string | null;
  task_id: string | null;
  status: FieldNoteStatus;
  processing_status: ProcessingStatus;
}

/** 필드노트 연결 가능한 검사 task (진행중 케이스 onsite·미완료) */
export interface LinkableAssessmentTask {
  task_id: string;
  case_id: string;
  case_code: string | null;
  client_name: string;
  assessment_code: string | null;
  assessment_kor_name: string | null;
  execution_method: string;
  task_status: string;
  created_at: string;
  /** 검사 세션(일정) 예약 시각. 없으면 null. */
  session_start: string | null;
}

/** 오디오 업로드 응답 */
export interface AudioUploadResponse {
  id: string;
  chunk_index: number;
  storage_path: string;
  duration: number;
  transcript_status: TranscriptStatus;
  created_at: string;
}

/** 최근 메모 (녹음 화면 표시용) */
export interface RecentMemo {
  content: string;
  timestamp: string;
}

// ── Streaming STT 타입 ──

/** STT 모드 (서버 설정) */
export type STTMode = 'whisper_chunk' | 'aws_streaming';

/** 서버 → 클라이언트 스트리밍 메시지 */
export interface StreamingPartialMessage {
  type: 'partial';
  text: string;
  stability: number;
  timestamp_seconds: number | null;
}

export interface StreamingFinalMessage {
  type: 'final';
  text: string;
  start_seconds: number | null;
  end_seconds: number | null;
}

export type StreamingServerMessage =
  | StreamingPartialMessage
  | StreamingFinalMessage
  | { type: 'session_started'; session_id: string }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'finished'; audio_storage_path: string; total_duration: number }
  | { type: 'error'; code: string; message: string };
