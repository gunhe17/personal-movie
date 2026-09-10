/** 세션 상태 */
export type SessionStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

/** 참여자 유형 */
export type ParticipantType = 'client' | 'counselor';

/** 출석 상태 */
export type AttendanceStatus =
  | 'scheduled'
  | 'attended'
  | 'absent'
  | 'late'
  | 'excused'
  | 'no_show';

/** 상담 세션 응답 */
export interface CounselingSessionResponse {
  id: string;
  center_id: string;
  counseling_case_id: string;
  schedule_id: string;
  status: SessionStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 세션 목록 아이템 */
export interface CounselingSessionSummary {
  id: string;
  schedule_id: string;
  status: SessionStatus;
  created_at: string;
}

/** 세션 목록 응답 */
export interface CounselingSessionListResponse {
  items: CounselingSessionSummary[];
  total: number;
}

/** 세션 참여자 응답 */
export interface SessionParticipantResponse {
  id: string;
  center_id: string;
  session_id: string;
  participant_type: ParticipantType;
  participant_id: string;
  participant_name: string | null;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
  attendance_status: AttendanceStatus;
  is_consumed: boolean;
  attended_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 출석 상태 변경 요청 */
export interface UpdateAttendanceParams {
  attendance_status?: AttendanceStatus;
  is_consumed?: boolean;
  note?: string | null;
}
