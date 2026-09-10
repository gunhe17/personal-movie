/**
 * 상담 현황 테이블용 View Model
 */
import type {
  CounselingCaseItem,
  CounselingStatus,
  CounselingType
} from '$lib/types/counseling'
import type {
  PaginationType,
  RowPaginationRes
} from '$root/src/lib/types/apiResponse'
import { formatUtcToKst } from '$lib/utils/date'

// 그룹 상담 멤버 (호버 드롭다운용)
export interface CounselingMember {
  name: string
  birthDate: string
  gender: 'male' | 'female'
}

/**
 * 다음 상담 상태 (목록 셀 렌더용 구조화 정보)
 * - upcoming: 다가오는 회기 예정
 * - overdue: 예정 시각이 지났는데 아직 미처리(상태 변경 안 됨)
 * - unprocessed: 지난 예약 회기가 여러 건 쌓여 미처리
 * - needs_review: 예약 0 + 완료 회기 있음 → 연장/종결 확인 필요
 * - completed: 종결됨
 * - none: 예정된 회기 없음
 */
export type NextSessionKind =
  | 'upcoming'
  | 'overdue'
  | 'unprocessed'
  | 'needs_review'
  | 'completed'
  | 'none'

export interface NextSessionInfo {
  kind: NextSessionKind
  /** 'YYYY-MM-DD' (검사 일정 셀과 동일 포맷, upcoming/overdue에서만) */
  dateLabel: string | null
  /** '(목) HH:mm' — 요일+시간 (upcoming/overdue에서만) */
  timeLabel: string | null
  /** 'D-3' | 'D-Day' | 'D+2' (upcoming/overdue에서만) */
  dDayText: string | null
  /** unprocessed일 때 미처리 건수 */
  unprocessedCount: number
}

export interface CounselingStatusRow {
  id: string
  caseCode: string
  programType: string // 탭 필터용: 'initial_counseling' | 'program'
  programName: string // "초기상담" or 프로그램명
  caseType: string // 'individual' | 'group'
  clientName: string
  clientProfileImageUrl: string | null // 대표 내담자 프로필 이미지(업로드 또는 기본 아바타)
  clientBirthDate: string // 생년월일 (동명이인 구분용)
  clientGender: 'male' | 'female' // 성별 아이콘용
  clientCount: number // "외 N명" 표시용 (그룹 멤버 수)
  clientMembers: CounselingMember[] // 전체 내담자 (호버 드롭다운용)
  counselorName: string // 대표 상담사 이름
  counselorCount: number // 전체 활성 상담사 수 (대표 포함)
  counselorNames: string[] // 다중 상담사 지원
  currentSession: number
  scheduledSessions: number
  totalSessions: number
  nextSessionStart: string | null // 포맷된 날짜 (YYYY.MM.DD)
  dDayText: string // D-day 텍스트
  isWarning: boolean // 경고 표시 (종결 필요, 미처리 등)
  nextSession: NextSessionInfo // 구조화된 다음 상담 정보 (셀 렌더용)
  status: CounselingStatus
  hasUninvoicedSessions: boolean // 미청구 회기 존재 여부
  createdAt: string
}

// View Model용 타입 (UI에서 사용)
export interface CounselingVM {
  id: string
  status: string
  caseCode: string
  programType: string
  client_name: string
  client_code: string
  client_birth_date: string
  client_age: number
  clientProfileImageUrl: string | null // 대표 내담자 프로필 이미지(업로드 또는 기본 아바타)
  clientGender: 'male' | 'female'
  clientCount: number // "외 N명" 표시용
  case_type: CounselingType
  program_name: string
  counselor_name: string
  counselorNames: string[] // 다중 상담사 (카드에서 쉼표 결합)
  current_session: number
  scheduled_sessions: number
  total_sessions: number
  next_session_start: string | null
  nextSession: NextSessionInfo // 구조화된 다음 상담 정보 (카드 렌더용)
  hasUninvoicedSessions: boolean // 미청구 회기 존재 여부 (카드 청구 표시용)
  organization_name?: string
  group_members?: { name: string; avatar?: string }[]
  created_at: string
}

// 상태 변환 함수
export function mapApiStatusToVM(
  status: CounselingStatus
): CounselingVM['status'] {
  const statusMap: Record<CounselingStatus, CounselingVM['status']> = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  }
  return statusMap[status]
}

export const mapRowPaginationToPagination = (
  pagination?: RowPaginationRes<unknown>
): PaginationType | undefined => {
  if (!pagination) return undefined
  return {
    page: pagination.page,
    size: pagination.size,
    page_size: pagination.size,
    total: pagination.total,
    filtered_total: pagination.total,
    total_pages: pagination.pages
  }
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

/**
 * 다음 상담 날짜 포맷 (UTC ISO → KST 'YYYY-MM-DD')
 * 검사 일정 셀(AssessmentCaseTable)과 동일한 날짜 표기로 통일
 */
function formatNextSessionDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const label = formatUtcToKst(dateStr, 'YYYY-MM-DD')
  return label || null
}

/**
 * 다음 상담 시간 포맷 (UTC ISO → KST '(목) HH:mm')
 * 검사 일정 셀의 하단 시간 줄과 같은 위치에, 요일을 더해 표시
 */
function formatNextSessionTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  const label = formatUtcToKst(dateStr, '(d) HH:mm')
  return label || null
}

// API 데이터를 VM으로 변환
export const mapCounselingToVM = (data: CounselingCaseItem): CounselingVM => {
  const mainClient = data.clients[0]
  return {
    id: data.case_id,
    caseCode: data.case_code,
    programType: data.program_name,
    client_code: data.case_code,
    case_type: data.case_type,
    program_name: data.program_name,
    client_name: data.clients[0]?.name ?? '',
    client_birth_date: mainClient?.birth_date ?? '',
    client_age: mainClient?.age ?? 0,
    clientProfileImageUrl: mainClient?.profile_image_url ?? null,
    clientGender: toGender(mainClient?.gender),
    clientCount: Math.max(data.clients.length, 1),
    counselor_name: data.counselor_name,
    counselorNames:
      data.counselor_names && data.counselor_names.length > 0
        ? data.counselor_names
        : [data.counselor_name],
    current_session: data.completed_sessions,
    scheduled_sessions: data.scheduled_sessions,
    total_sessions: data.total_sessions,
    next_session_start: data.next_session_start
      ? formatDate(data.next_session_start)
      : null,
    nextSession: computeNextSession(data),
    hasUninvoicedSessions: data.has_uninvoiced_sessions ?? false,
    status: data.status,
    organization_name: undefined,
    group_members: data.clients,
    created_at: formatDate(data.created_at)
  }
}

/**
 * D-day 텍스트 계산
 */
function calcDDayText(dateStr: string | null): string {
  if (!dateStr) return '-'
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return '-'
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

function isDateOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return target.getTime() < today.getTime()
}

// 성별 문자열(API 다양한 형태) → Gender 정규화
function toGender(gender: string | null | undefined): 'male' | 'female' {
  return gender === 'F' || gender === 'female' ? 'female' : 'male'
}

/**
 * 다음 상담 상태 계산 (테이블·카드 공용)
 * next_session_start(UTC datetime)와 회기 카운트로 셀 렌더용 구조를 만든다.
 */
export function computeNextSession(data: CounselingCaseItem): NextSessionInfo {
  const isCompleted = data.status === 'completed'
  // 예약된 회기가 있지만 모두 과거 → 미처리
  const hasOverdueSessions =
    !isCompleted && data.scheduled_sessions > 0 && !data.next_session_start
  // 예약 0 + 완료 있음 + 미종결 → 연장/종결 확인 필요
  const needsClose =
    !isCompleted &&
    !hasOverdueSessions &&
    data.scheduled_sessions === 0 &&
    data.completed_sessions > 0 &&
    !data.next_session_start
  const overdue = isDateOverdue(data.next_session_start)

  if (isCompleted) {
    return {
      kind: 'completed',
      dateLabel: null,
      timeLabel: null,
      dDayText: null,
      unprocessedCount: 0
    }
  }
  if (hasOverdueSessions) {
    return {
      kind: 'unprocessed',
      dateLabel: null,
      timeLabel: null,
      dDayText: null,
      unprocessedCount: data.scheduled_sessions
    }
  }
  if (needsClose) {
    return {
      kind: 'needs_review',
      dateLabel: null,
      timeLabel: null,
      dDayText: null,
      unprocessedCount: 0
    }
  }
  if (overdue) {
    return {
      kind: 'overdue',
      dateLabel: formatNextSessionDate(data.next_session_start),
      timeLabel: formatNextSessionTime(data.next_session_start),
      dDayText: calcDDayText(data.next_session_start),
      unprocessedCount: 0
    }
  }
  if (data.next_session_start) {
    return {
      kind: 'upcoming',
      dateLabel: formatNextSessionDate(data.next_session_start),
      timeLabel: formatNextSessionTime(data.next_session_start),
      dDayText: calcDDayText(data.next_session_start),
      unprocessedCount: 0
    }
  }
  return {
    kind: 'none',
    dateLabel: null,
    timeLabel: null,
    dDayText: null,
    unprocessedCount: 0
  }
}

export const mapCounselingToRow = (
  data: CounselingCaseItem
): CounselingStatusRow => {
  const nextSession = computeNextSession(data)

  // 하위호환 필드 (기존 셀/소비처가 참조할 수 있어 유지)
  const isWarning =
    nextSession.kind === 'overdue' ||
    nextSession.kind === 'unprocessed' ||
    nextSession.kind === 'needs_review'
  const dDayText =
    nextSession.kind === 'completed'
      ? '상담 완료'
      : nextSession.kind === 'unprocessed'
        ? `미처리 ${nextSession.unprocessedCount}건`
        : nextSession.kind === 'needs_review'
          ? '연장 여부 확인'
          : (nextSession.dDayText ?? '-')
  const nextSessionStart =
    nextSession.kind === 'completed'
      ? '상담 완료'
      : nextSession.kind === 'unprocessed'
        ? `미처리 ${nextSession.unprocessedCount}건`
        : nextSession.kind === 'needs_review'
          ? '연장 여부 확인'
          : data.next_session_start
            ? formatDate(data.next_session_start)
            : null

  return {
    id: data.case_id,
    caseCode: data.case_code,
    programType: data.program_name,
    programName: data.program_name,
    caseType: data.case_type,
    clientName: data.clients[0]?.name ?? '',
    clientProfileImageUrl: data.clients[0]?.profile_image_url ?? null,
    clientBirthDate: data.clients[0]?.birth_date ?? '',
    clientGender: toGender(data.clients[0]?.gender),
    clientCount: Math.max(data.clients.length, 1),
    clientMembers: data.clients.map((c) => ({
      name: c.name ?? '',
      birthDate: c.birth_date ?? '',
      gender: toGender(c.gender)
    })),
    counselorName: data.counselor_name,
    counselorCount: data.counselor_count ?? 1,
    counselorNames:
      data.counselor_names && data.counselor_names.length > 0
        ? data.counselor_names
        : [data.counselor_name],
    currentSession: data.completed_sessions,
    scheduledSessions: data.scheduled_sessions,
    totalSessions: data.total_sessions,
    nextSessionStart,
    dDayText,
    isWarning,
    nextSession,
    status: data.status,
    hasUninvoicedSessions: data.has_uninvoiced_sessions ?? false,
    createdAt: formatDate(data.created_at)
  }
}

/**
 * CounselingData[] -> CounselingStatusRow[] 변환
 */
export function mapCounselingsToRows(
  list: CounselingCaseItem[]
): CounselingStatusRow[] {
  return list.map(mapCounselingToRow)
}
