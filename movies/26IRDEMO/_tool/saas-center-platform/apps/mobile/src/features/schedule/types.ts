/** 일정 타입 (백엔드 ScheduleType 미러링) */
export type ScheduleType = 'assessment' | 'counseling' | 'meeting' | 'block';

/** 내담자 간략 정보 (목록 표시용) */
export interface ClientBrief {
  id: string;
  name: string;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
}

/** 일정 목록 아이템 (백엔드 ScheduleListItem 미러링) */
export interface ScheduleListItem {
  id: string;
  start: string;
  end: string;
  schedule_type: ScheduleType;
  room_name: string | null;
  counselor_name: string | null;
  client_names: string[];
  clients: ClientBrief[];
  title: string | null;
  program_name: string | null;
  session_status: string | null;
  // 그룹 일정에서 부분 출결 이슈 카운트 — 백엔드 미구현 시 undefined → 신호 표시 X
  partial_absent_count?: number;
  partial_no_show_count?: number;
  // 상담 케이스 식별자 — 카드 서브타이틀 "{case_code}의 N회기" 표시용 (백엔드 미구현 시 undefined → 숨김)
  case_code?: string | null;
  session_number?: number | null;
  // 검사 케이스 ID (assessment 아이템만) — 필드노트 홈에서 검사 task 지연 로드용
  case_id?: string | null;
  // 상담 회기 ID (counseling 아이템만) — 홈 카드에서 회기 상세로 경유 없이 직접 이동용
  session_id?: string | null;
}

/** 내담자 요약 (캘린더 표시용) */
export interface ClientSummary {
  client_id: string;
  client_name: string;
  attendance_status: string | null;
}

/** 검사 정보 */
export interface AssessmentInfo {
  code: string;
  kor_name: string;
}

/** 회기 요약 */
export interface SessionSummary {
  session_id: string;
  case_id: string | null;
  case_code: string | null;
  case_type: string | null;
  session_number: number | null;
  status: string | null;
  counselor_name: string | null;
  program_id?: string | null;
  program_name?: string | null;
  set_id?: string | null;
  set_name?: string | null;
  assessments: AssessmentInfo[];
  clients: ClientSummary[];
}

/** 일정 요약 (충돌 표시용) */
export interface ScheduleSummaryType {
  id: string;
  member_id: string | null;
  schedule_type: ScheduleType;
  title: string | null;
  start: string;
  end: string;
}

/** 일정 상세 응답 (백엔드 ScheduleDetailResponse 미러링) */
export interface ScheduleDetailResponse {
  id: string;
  center_id: string;
  member_id: string | null;
  schedule_type: ScheduleType;
  title: string | null;
  room_id: string | null;
  room_name: string | null;
  start: string;
  end: string;
  note: string | null;
  sessions: SessionSummary[];
  has_conflict: boolean;
  conflicting_schedules: ScheduleSummaryType[];
  created_at: string;
  updated_at: string;
}

/** 일정 타입 라벨 */
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  counseling: '상담',
  assessment: '검사',
  meeting: '회의',
  block: '블록',
};

/** 통합 세션 상태 (counseling/assessment 차이 정규화) */
export type NormalizedSessionStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

/**
 * 백엔드 세션 상태값을 통합 상태로 정규화.
 * - 상담: completed, no_show, cancelled
 * - 검사: attended, no_show, cancelled ('noshow'는 수렴 이전 legacy 수용)
 */
export function normalizeSessionStatus(status: string | null): NormalizedSessionStatus {
  if (!status) return 'scheduled';
  switch (status) {
    case 'completed':
    case 'attended':
      return 'completed';
    case 'no_show':
    case 'noshow':
      return 'no_show';
    case 'cancelled':
    case 'cancel':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}
