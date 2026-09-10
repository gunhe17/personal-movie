/** 노트 내용 구조 (JSONB content 필드) */
export interface NoteContent {
  mood: string | null;
  main_topic: string | null;
  intervention: string[] | null;
  progress: string | null;
  homework: string | null;
  next_goal: string | null;
  raw_notes: string | null;
  private_notes: string | null;
}

/** 상담 노트 응답 */
export interface CounselingNoteResponse {
  id: string;
  center_id: string;
  counseling_session_id: string;
  client_id: string;
  content: NoteContent;
  summary: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
}

/** 상담 노트 생성 요청 */
export interface CounselingNoteCreateRequest {
  client_id: string;
  content: Partial<NoteContent>;
  summary?: string | null;
}

/** 상담 노트 수정 요청 */
export interface CounselingNoteUpdateRequest {
  content?: Partial<NoteContent>;
  summary?: string | null;
}

/** 상담일지 목록 필터 상태 */
export type MyNotesStatus = 'all' | 'written' | 'missing';

/** 상담일지 목록 항목 (내정보 → 상담일지 리스트) */
export interface MyCounselingNoteItem {
  note_id: string | null; // 작성된 노트 id (미작성이면 null)
  counseling_session_id: string; // 카드 탭 시 시트 진입에 필요
  client_id: string; // 카드 탭 시 시트 진입에 필요
  client_name: string | null;
  program_name: string | null;
  session_start: string | null; // 회기 날짜 (ISO)
  schedule_id: string | null; // 회기의 일정 ID (연결된 필드노트 조회용)
  summary: string | null; // 요약 1줄 (미작성이면 null)
  is_written: boolean;
  created_at: string | null; // 작성일 (미작성이면 null)
  // ─── 카드 디스플레이용 (백엔드 미구현 시 undefined → 자동 숨김) ───
  session_end?: string | null; // 회기 종료 (ISO) — "14:00 ~ 15:00" 시간 범위 표시용
  room_name?: string | null; // 상담실명
  client_gender?: string | null; // 'male' | 'female' — 내담자 성별
  client_age?: number | null; // 내담자 만 나이
}

/** 상담일지 목록 응답 */
export interface MyCounselingNotesResponse {
  items: MyCounselingNoteItem[];
  total: number;
}

/** 상담일지 목록 조회 파라미터 */
export interface MyNotesParams {
  status?: MyNotesStatus;
  keyword?: string; // 내담자 이름 검색 (서버)
  skip?: number;
  limit?: number;
}
