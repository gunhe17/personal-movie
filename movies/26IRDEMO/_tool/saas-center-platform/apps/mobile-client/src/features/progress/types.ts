/** 센터가 전달한 회기 내용 — 임상 기록 원문이 아니라 읽는 사람 톤으로 옮긴 글 */
export interface SessionShare {
  text: string | null;
  published_at: string | null;
}

/** 상담 케이스의 개별 회기 */
export interface ProgressSession {
  session_id: string;
  round: number;
  scheduled_at: string | null;
  end_at: string | null;
  room_name: string | null;
  status: string;
  /** 센터가 전달한 회기 내용. 전달 전에는 null */
  share: SessionShare | null;
}

/** 상담 진행 현황 (케이스 단위) */
export interface CounselingProgress {
  case_id: string;
  center_id: string;
  center_name: string | null;
  counseling_type: string | null;
  counselor_name: string | null;
  total_sessions: number | null;
  completed_sessions: number;
  started_at: string | null;
  next_session_at: string | null;
  voucher_name: string | null;
  sessions: ProgressSession[];
}

/** 검사 케이스에 묶인 개별 검사 */
export interface AssessmentTaskItem {
  task_id: string;
  name: string;
  status: string;
  report_visible: boolean;
}

/** 검사 진행 현황 */
export interface AssessmentProgress {
  case_id: string;
  center_id: string;
  center_name: string;
  name: string;
  status: string;
  completed_count: number;
  total_count: number;
  report_visible: boolean;
  tasks: AssessmentTaskItem[];
}

/** GET /app/profiles/{id}/progress 응답 */
export interface ProfileProgress {
  counseling: CounselingProgress[];
  assessments: AssessmentProgress[];
}

/** GET /app/assessment-tasks/{id}/report 응답 */
export interface AssessmentReport {
  task_id: string;
  name: string;
  download_url: string;
  expires_in: number;
}
