export interface CounselingCaseClient {
  client_id: string;
  name: string;
  client_code: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  profile_image_url: string | null;
}

export interface CounselingCaseItem {
  case_id: string;
  case_code: string;
  status: 'active' | 'completed' | 'cancelled';
  case_type: string;
  program_name: string | null;
  clients: CounselingCaseClient[];
  counselor_name: string | null;
  completed_sessions: number;
  scheduled_sessions: number;
  total_sessions: number;
  next_session_start: string | null;
  next_session_end: string | null;
  next_session_room_name: string | null;
  created_at: string;
}

export interface CounselingCaseListResponse {
  items: CounselingCaseItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CounselingCaseListParams {
  centerId: string;
  status?: string;
  page?: number;
  size?: number;
}

// ── 상세 응답 타입 ──

export type CounselingCaseStatus = 'active' | 'completed' | 'cancelled';

export type AttendanceStatus =
  | 'scheduled'
  | 'attended'
  | 'absent'
  | 'late'
  | 'excused'
  | 'no_show';

export type CounselingSessionStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

export interface CounselorSummary {
  counselor_id: string;
  counselor_name: string;
}

export interface SessionClientParticipant {
  session_participant_id: string;
  participant_type: 'client';
  participant_id: string;
  participant_name: string;
  attendance_status: AttendanceStatus;
  is_consumed: boolean;
  note: string | null;
  has_note: boolean;
}

export interface CounselingSessionDetail {
  session_id: string;
  session_number: number;
  schedule_id: string;
  start: string;
  end: string;
  room_id: string | null;
  room_name: string | null;
  status: CounselingSessionStatus;
  clients: SessionClientParticipant[];
  counselors: CounselorSummary[];
}

export interface SessionRule {
  pattern: string;
  day_of_week: string;
  start_time: string;
  duration_minutes: number;
}

export interface CounselingCaseDetailResponse {
  case_id: string;
  case_code: string;
  status: CounselingCaseStatus;
  chief_complaint: string | null;
  memo: string | null;
  total_sessions: number | null;
  session_rule: SessionRule | null;
  program_id: string;
  program_name: string;
  case_type: string;
  counselor_id: string;
  counselor_name: string;
  counselors: CounselorSummary[];
  /** 조회자의 담당 구분 — assistant(공동 상담사)는 열람만 가능, 관리자는 null */
  my_role: 'primary' | 'assistant' | null;
  clients: CounselingCaseClient[];
  sessions: CounselingSessionDetail[];
  first_session_start: string | null;
  room_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
