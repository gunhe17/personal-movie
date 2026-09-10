import type { CounselingVM } from '../features/counseling/status/view-model'
import type { SessionNotePayload } from '../hooks/actions/counseling.action'

export type CounselingStatus = 'active' | 'completed' | 'cancelled' | string

export type CounselingType = '프로그램' | '개별' | string

export interface CounselingClientSnapshot {
  name: string
  code: string
  birth_date: string
  age: number
  gender: 'M' | 'F'
  guardian_phone: string
}

export interface CounselingCounselorSnapshot {
  name: string
}

export interface CounselingGroupMember {
  uid: string
  name: string
  avatar?: string
}

export interface CounselingData {
  uid: string
  center_uid: string
  counseling_code: string

  // 내담자 정보
  client_uid: string
  client_snapshot: CounselingClientSnapshot

  // 상담 유형 및 그룹 멤버
  counseling_type: CounselingType
  group_members?: CounselingGroupMember[]

  // 프로그램 정보
  program_uid: string
  program_name: string

  // 담당자 정보
  counselor_uid: string
  counselor_snapshot: CounselingCounselorSnapshot

  // 회기 정보
  current_session: number
  total_sessions: number

  // 기관 정보
  organization_name?: string | null

  // 상태
  status: CounselingStatus

  // 타임스탬프
  created_at: string
  updated_at: string | null
  completed_at?: string | null
}

export type CounselingCaseItem = {
  case_id: string
  case_code: string
  status: CounselingStatus
  case_type: CounselingType
  program_name: string
  title: string
  clients: CaseClient[]
  counselor_name: string
  counselor_count: number
  counselor_names?: string[]
  completed_sessions: number
  scheduled_sessions: number
  total_sessions: number
  next_session_start: string | null
  next_session_room_name?: string | null
  room_name?: string | null
  has_uninvoiced_sessions?: boolean
  created_at: string
}

export type CaseClient = {
  client_id: string
  name: string
  client_code: string | null
  birth_date: string | null
  age: number | null
  gender: string | null
  profile_image_url?: string | null
}

// 생년월일 표기는 전 화면 YYYY-MM-DD 단일 규격 (ClientBirthGender와 동일)
export function formatBirthDate(birthDate: string): string {
  if (!birthDate) return ''
  return birthDate.replace(/\./g, '-')
}

// ============ Session (회기) Types ============

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface SessionData {
  uid: string
  counseling_uid: string
  session_number: number
  scheduled_date: string
  scheduled_time?: string
  status: SessionStatus
  has_memo: boolean
  has_journal: boolean
  memo?: string
  journal?: string
  created_at: string
  updated_at: string | null
}

export interface SessionVM {
  uid: string
  sessionNumber: number
  scheduledDate: string
  scheduledTime?: string
  status: SessionStatus
  hasMemo: boolean
  hasJournal: boolean
}

export function mapSessionToVM(data: SessionData): SessionVM {
  return {
    uid: data.uid,
    sessionNumber: data.session_number,
    scheduledDate: data.scheduled_date,
    scheduledTime: data.scheduled_time,
    status: data.status,
    hasMemo: data.has_memo,
    hasJournal: data.has_journal
  }
}

// ============ Counseling Detail Types ============

export interface CounselingDetailData extends CounselingData {
  sessions: SessionData[]
  counseling_time?: string
  counseling_place?: string
  support_program?: string
  last_session_date?: string
}

export type SessionRule = {
  recurrence: {
    pattern: 'daily' | 'weekly' | 'monthly'
    interval: number
    count?: number
    until?: string
    days_of_week?: string[]
    monthly_repeat_types?: string[]
  }
  duration_minutes: number
  room_id: string
  start_time: string
}

export type CounselingCaseBaseDetail = {
  case_id: string
  case_code: string
  status: 'active' | 'completed' | 'inactive' | string
  chief_complaint: string
  memo: string
  total_sessions: number
  session_rule: SessionRule | null
  program_id: string
  program_name: string
  case_type: 'individual' | 'group' | string
  counselor_id: string
  counselor_name: string
  counselors: SessionCounselor[]
  /** 조회자의 담당 구분 — assistant(부담당)는 열람만 가능, 관리자는 null */
  my_role: 'primary' | 'assistant' | null
  clients: CaseClient[]
  sessions: CounselingSession[]
  first_session_start: string // ISO datetime
  room_name: string
  created_at: string // ISO datetime
  updated_at: string // ISO datetime
  completed_at: string | null
}

export interface CounselingSession {
  session_id: string
  session_number: number
  schedule_id: string
  start: Date // ISO datetime
  end: Date // ISO datetime
  room_id: string
  room_name: string
  status: SessionStatus
  clients: SessionParticipant[]
  counselors: SessionCounselor[]
}

export interface CounselingSessionNote extends SessionNotePayload {
  id: string
  center_id: string
  counseling_session_id: string
  client_id: string
  author_id: string
  created_at: Date
  updated_at: Date | null
}

export interface SessionParticipant {
  session_participant_id: string
  participant_type: 'client'
  participant_id: string
  participant_name: string
  attendance_status:
    | 'scheduled'
    | 'attended'
    | 'absent'
    | 'late'
    | 'excused'
    | 'no_show'
    | string
  is_consumed: boolean
  memo: string | null
  has_note: boolean
}

export interface SessionCounselor {
  counselor_id: string
  counselor_name: string
}

export interface CounselingDetailVM extends Omit<CounselingVM, 'clientGender'> {
  sessions: SessionVM[]
  counselingTime?: string
  counselingPlace?: string
  supportProgram?: string
  lastSessionDate?: string
  clientGender: 'MALE' | 'FEMALE'
  clientGuardianPhone: string
}

export function mapCounselingDetailToVM(data: CounselingCaseBaseDetail): any {
  return {
    counselingTime: 'data.counseling_time',
    counselingPlace: 'data.counseling_place',
    supportProgram: 'data.support_program',
    lastSessionDate: 'data.last_session_date',
    clientGender: 'MALE',
    clientGuardianPhone: 'data.client_snapshot.guardian_phone'
  }
}

// ============ Journal (상담일지) Types ============

export interface JournalFormData {
  goal: string // 상담 목표 → main_topic
  progress: string // 진행 내용 → progress
  nextPlan: string // 다음 상담 내용 → next_goal
  privateMemo: string // 개인 메모 → private_notes
  opinion: string // 종합 소견 → summary (UI 비노출 유지)
}

// ============ Session Edit Modal Types ============

export interface SessionEditFormData {
  sessionId: string
  clientIds: string[]
  counselorId: string
  placeId: string
}
