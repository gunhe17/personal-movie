export interface AssessmentCaseClient {
  client_id: string;
  name: string;
  client_code: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  profile_image_url: string | null;
}

export interface AssessmentDetail {
  id: string;
  code: string;
  kor_name: string;
  eng_name: string;
  assessment_type: string;
  duration: number | null;
}

export interface AssessmentCaseItem {
  case_id: string;
  case_code: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  case_type: 'individual' | 'group';
  created_at: string;
  counselor_id: string;
  counselor_name: string | null;
  clients: AssessmentCaseClient[];
  assessments: AssessmentDetail[];
  assessment_names: string[];
  institution_name: string | null;
  set_name: string | null;
  completed_count: number;
  total_count: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  room_id: string | null;
  room_name: string | null;
}

export interface AssessmentCaseListResponse {
  items: AssessmentCaseItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AssessmentCaseListParams {
  centerId: string;
  status?: string;
  page?: number;
  size?: number;
}

// ---------- Detail Types ----------

/** 검사 과제 상태 */
export type AssessmentTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'refused'
  | 'cancelled';

/** 실행 방법 */
export type ExecutionMethod = 'onsite' | 'online';

/** 담당 검사자 상세 */
export interface CounselorDetailForCase {
  member_id: string;
  name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  employment_type: string | null;
  hire_date: string | null;
  memo: string | null;
}

/** 멤버 요약 (보조 검사자) */
export interface MemberSummary {
  member_id: string;
  name: string;
}

/** 내담자 상세 (케이스 상세용) */
export interface ClientDetailForCase {
  client_id: string;
  name: string;
  client_code: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  memo: string | null;
  profile_image_url: string | null;
}

/** 검사 과제 요약 */
export interface AssessmentTaskSummary {
  id: string;
  assessment_id: string;
  assessment_code: string;
  assessment_name: string;
  status: AssessmentTaskStatus;
  execution_method: ExecutionMethod;
  progress: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
}

/** 검사 Task 단건 응답 (소견 포함) */
export interface AssessmentTaskResponse {
  id: string;
  case_id: string;
  assessment_id: string;
  center_id: string;
  execution_method: ExecutionMethod;
  process: Record<string, unknown>;
  status: AssessmentTaskStatus;
  report_payload: Record<string, unknown> | null;
  report_document_id: string | null;
  is_report_visible_to_guardian: boolean;
  opinion: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assessment: {
    id: string;
    code: string;
    kor_name: string;
    eng_name: string;
    assessment_type: string;
    duration: number | null;
  } | null;
}

/** 일정 요약 */
export interface ScheduleSummary {
  schedule_id: string;
  start: string;
  end: string;
  room_id: string | null;
  room_name: string | null;
  note: string | null;
}

/** 검사 세션 요약 */
export interface AssessmentSessionSummary {
  session_id: string;
  status: string;
  schedule: ScheduleSummary | null;
}

/** 기관 요약 */
export interface InstitutionSummary {
  institution_id: string;
  name: string;
  phone: string | null;
}

/** 검사 케이스 상세 응답 */
export interface AssessmentCaseDetailResponse {
  case_id: string;
  case_code: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  case_type: 'individual' | 'group';
  created_at: string;
  completed_at: string | null;
  tags: string[];
  is_final_report_required: boolean;

  counselor: CounselorDetailForCase;
  assistants: MemberSummary[];

  clients: ClientDetailForCase[];

  institution: InstitutionSummary | null;

  tasks: AssessmentTaskSummary[];

  sessions: AssessmentSessionSummary[];

  schedule: ScheduleSummary | null;

  set_id: string | null;
  set_name: string | null;
}
