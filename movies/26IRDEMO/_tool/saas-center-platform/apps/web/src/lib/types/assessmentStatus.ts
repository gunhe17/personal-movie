import { formatUtcToKst } from '$lib/utils/date'

// 검사 현황 테이블 관련 타입 정의

export type AssessmentRowStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

// API에서 반환하는 상태값
export type CaseStatusAPI =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type OrganizationType = 'school' | 'institution' | 'individual'

export type Gender = 'male' | 'female'

// API에서 반환하는 성별값
export type GenderAPI = 'M' | 'F'

export function getGenderText(gender: Gender | GenderAPI | string): string {
  if (gender === 'male' || gender === 'M' || gender === 'MALE') return '남'
  if (gender === 'female' || gender === 'F' || gender === 'FEMALE') return '여'
  return gender
}

export function getGenderFullText(gender: Gender | GenderAPI | string): string {
  if (gender === 'male' || gender === 'M' || gender === 'MALE') return '남자'
  if (gender === 'female' || gender === 'F' || gender === 'FEMALE')
    return '여자'
  return gender
}

// 케이스 타입 (개인/단체)
export type CaseType = 'INDIVIDUAL' | 'ORGANIZATION' | null

// API 응답: 내담자 요약 (서버 목록/상세용)
export interface ClientSummaryForCase {
  client_id: string
  name: string
  client_code: string | null
  birth_date: string | null
  age: number | null
  gender: string | null
  /** 프로필 이미지 (업로드 또는 기본 아바타). 목록/상세 응답 모두 채워짐 */
  profile_image_url?: string | null
  /** 케이스 상세 응답에서만 채워짐 */
  email?: string | null
  phone?: string | null
  address?: string | null
  memo?: string | null
}

// API 응답: 검사 요약 (서버 목록용)
export interface AssessmentSummaryForCase {
  id: string
  code: string
  kor_name: string
  eng_name: string
  type: string
  duration: number | null
}

// 하위 호환: ClientSnapshot (단일 client_snapshot 형태)
export interface ClientSnapshot {
  age: number
  code: string
  name: string
  gender: GenderAPI
  birth_date: string
  guardian_phone?: string
}

// API 응답: 케이스 목록 항목 (서버 GET /assessment-cases)
export interface CaseData {
  case_id: string
  /** 하위 호환: case_id와 동일 (목록 응답에서 설정) */
  uid: string
  case_code: string
  status: string
  case_type: string
  created_at: string
  counselor_id: string
  counselor_name: string | null
  clients: ClientSummaryForCase[]
  assessments: AssessmentSummaryForCase[]
  assessment_names: string[]
  set_name: string | null
  institution_name: string | null
  scheduled_start: string | null
  room_name?: string | null
  completed_count: number
  total_count: number
  is_final_report_required?: boolean
  has_comprehensive_report?: boolean
  has_uninvoiced_sessions?: boolean
}

// 종합보고서 상태: 불필요 / 미작성 / 작성완료
export type ReportStatus = 'not_required' | 'pending' | 'done'

export interface AssessmentStatusRow {
  id: string
  status: AssessmentRowStatus
  clientName: string
  clientCode: string
  clientGender: Gender
  birthDate: string
  /** 내담자 프로필 이미지 (아바타) */
  clientProfileImageUrl?: string | null
  /** 케이스 참여 내담자 수 (2명 이상이면 "외 N명" + 툴팁) */
  clientCount: number
  /** 참여 내담자 목록 (툴팁용) */
  clientMembers: { name: string; gender: Gender; birthDate: string }[]
  reportStatus: ReportStatus
  staffName: string
  organization: string
  organizationType: OrganizationType
  assessments: string[]
  setName: string | null // 검사 세트 이름 (세트로 생성된 경우)
  assessmentUids: string[] // 검사 UID 목록
  hasOnlineLink: boolean // 온라인 검사/패키지 여부
  accessCode: string // 접속 코드
  registeredAt: string
  scheduledStart: string | null // 예약된 검사 일정 (포맷됨, 카드/하위호환용)
  scheduledDateLabel: string | null // 'YYYY-MM-DD' (셀 상단)
  scheduledTimeLabel: string | null // '(목) HH:mm' (셀 하단)
  scheduledDDay: string | null // 'D-3' | 'D-Day' | 'D+2'
  completedCount: number
  totalCount: number
  hasUninvoicedSessions: boolean // 미청구 회기 존재 여부
  resultSent?: boolean // 결과 전송 여부
}

export interface StatusBadgeConfig {
  text: string
  class: string
}

// 상태 배지 색은 Web_Design.md §Status Badge 정본 매핑(state-* 토큰)을 따른다.
// pending→gray · progress→blue · done→green · canceled→red
export const STATUS_BADGE_MAP: Record<AssessmentRowStatus, StatusBadgeConfig> =
  {
    pending: {
      text: '진행전',
      class: 'bg-state-pending-bg text-state-pending-text'
    },
    in_progress: {
      text: '진행중',
      class: 'bg-state-progress-bg text-state-progress-text'
    },
    completed: {
      text: '완료',
      class: 'bg-state-done-bg text-state-done-text'
    },
    cancelled: {
      text: '취소',
      class: 'bg-state-canceled-bg text-state-canceled-text'
    }
  }

// API 상태값 → UI 상태값 변환 (서버는 소문자 반환)
export const STATUS_API_MAP: Record<string, AssessmentRowStatus> = {
  PENDING: 'pending',
  pending: 'pending',
  IN_PROGRESS: 'in_progress',
  processing: 'in_progress',
  submitted: 'in_progress',
  COMPLETED: 'completed',
  completed: 'completed',
  CANCELLED: 'cancelled',
  cancelled: 'cancelled'
}

// API 성별값 → UI 성별값 변환
export const GENDER_API_MAP: Record<string, Gender> = {
  M: 'male',
  F: 'female',
  male: 'male',
  female: 'female'
}

// 케이스 타입 → 조직 타입 변환
export function caseTypeToOrganizationType(
  caseType: CaseType | string | null,
  organizationName: string | null
): OrganizationType {
  const t = String(caseType || '').toUpperCase()
  if (t === 'INDIVIDUAL' || !t) {
    return 'individual'
  }
  if (organizationName?.includes('학교')) {
    return 'school'
  }
  return 'institution'
}

// 생년월일 포맷팅 (2018-01-16 → 2018-01-16)
export function formatBirthDate(birthDate: string): string {
  if (!birthDate) return ''
  const date = new Date(birthDate)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 접수일 포맷팅 (ISO UTC → KST YYYY.MM.DD HH:mm)
export function formatRegisteredAt(isoDate: string): string {
  if (!isoDate) return ''
  return formatUtcToKst(isoDate, 'YYYY.MM.DD HH:mm')
}

// 검사 일정 날짜 (ISO UTC → KST 'YYYY-MM-DD')
export function formatScheduleDate(isoDate: string | null): string | null {
  if (!isoDate) return null
  return formatUtcToKst(isoDate, 'YYYY-MM-DD') || null
}

// 검사 일정 시간 (ISO UTC → KST '(목) HH:mm')
export function formatScheduleTime(isoDate: string | null): string | null {
  if (!isoDate) return null
  return formatUtcToKst(isoDate, '(d) HH:mm') || null
}

// D-day 텍스트 ('D-3' | 'D-Day' | 'D+2')
export function calcScheduleDDay(isoDate: string | null): string | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff === 0) return 'D-Day'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

// CaseData (서버 목록 항목) → AssessmentStatusRow 변환
export function mapCaseToAssessmentRow(
  caseData: CaseData,
  assessmentNames?: string[],
  options?: { hasOnlineLink?: boolean }
): AssessmentStatusRow {
  const firstClient = caseData.clients?.[0]
  const statusKey = caseData.status || ''
  const status =
    STATUS_API_MAP[statusKey] ??
    STATUS_API_MAP[statusKey.toUpperCase()] ??
    'pending'
  const reportStatus: ReportStatus = !caseData.is_final_report_required
    ? 'not_required'
    : caseData.has_comprehensive_report
      ? 'done'
      : 'pending'
  return {
    id: caseData.uid || caseData.case_id,
    status,
    clientName: firstClient?.name ?? '-',
    clientCode: firstClient?.client_code ?? '',
    clientGender:
      (firstClient?.gender &&
        GENDER_API_MAP[firstClient.gender as GenderAPI]) ||
      'male',
    birthDate: firstClient?.birth_date ?? '',
    clientProfileImageUrl: firstClient?.profile_image_url ?? null,
    clientCount: caseData.clients?.length ?? 0,
    clientMembers: (caseData.clients ?? []).map((c) => ({
      name: c.name,
      gender:
        (c.gender && GENDER_API_MAP[c.gender as GenderAPI]) ||
        ('male' as const),
      birthDate: c.birth_date ?? ''
    })),
    reportStatus,
    staffName: caseData.counselor_name ?? '-',
    organization: caseData.institution_name ?? '-',
    organizationType: caseTypeToOrganizationType(
      caseData.case_type,
      caseData.institution_name
    ),
    assessments: assessmentNames ?? caseData.assessment_names ?? [],
    setName: caseData.set_name ?? null,
    assessmentUids: caseData.assessments?.map((a) => a.id) ?? [],
    hasOnlineLink: options?.hasOnlineLink ?? false,
    accessCode: caseData.case_code,
    registeredAt: formatRegisteredAt(caseData.created_at),
    scheduledStart: caseData.scheduled_start
      ? formatRegisteredAt(caseData.scheduled_start)
      : null,
    scheduledDateLabel: formatScheduleDate(caseData.scheduled_start),
    scheduledTimeLabel: formatScheduleTime(caseData.scheduled_start),
    scheduledDDay: calcScheduleDDay(caseData.scheduled_start),
    completedCount: caseData.completed_count ?? 0,
    totalCount: caseData.total_count ?? 0,
    hasUninvoicedSessions: caseData.has_uninvoiced_sessions ?? false,
    resultSent: false
  }
}
