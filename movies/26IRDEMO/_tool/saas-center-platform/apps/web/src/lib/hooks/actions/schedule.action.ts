/**
 * Schedule Actions
 * 스케줄 관련 API action 함수들
 */

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

export type ScheduleCaseType = 'assessment' | 'counseling' | 'meeting' | 'block'

export type ScheduleClientBrief = {
  id: string
  name: string
  gender: 'male' | 'female' | null
  birth_date: string | null
}

export type ScheduleType = {
  client_names: string[]
  clients: ScheduleClientBrief[]
  /** 대표 담당자 1명 (schedule.member_id 기준, 타일 색상/필터용) */
  counselor_name: string
  counselor_color: string | null
  /** 전체 담당자 이름 (그룹 상담 등 다중 지원, 호버 툴팁용). 대표 포함. */
  counselor_names?: string[]
  end: Date
  has_conflict: boolean
  id: string
  title: string
  program_name: string | null
  room_name: string
  schedule_type: ScheduleCaseType
  start: Date
  session_status: string | null
}

export type MappedSchedule = {
  client: string
  counselor_color: string | null
  date: Date
  end_at: string
  end_at_origin: Date
  id: string
  manager: string
  title: string
  program_name: string | null
  room: string
  schedule_type: ScheduleCaseType
  start_at: string
  start_at_origin: Date
  status: boolean
  session_status: string | null
}

export type ScheduleMapType = Record<string, MappedSchedule[]>

// 스케줄 생성 응답 타입
export interface CreateScheduleResponse {
  id: string
}

// ============ getScheduleList ============

export const getScheduleList = () => ({
  key: ['getScheduleList'],
  request: async (request: {
    center_id: string
    start_date?: string
    end_date?: string
    counselor_ids: string[]
    client_ids: string[]
    schedule_types: string[]
  }) => {
    const {
      center_id,
      start_date,
      end_date,
      counselor_ids,
      client_ids,
      schedule_types
    } = request
    const queryParams = new URLSearchParams()
    if (start_date) queryParams.append('start', start_date)
    if (end_date) queryParams.append('end', end_date)
    if (counselor_ids?.length) {
      counselor_ids.forEach((id) => queryParams.append('member_id', id))
    }
    if (client_ids?.length) {
      client_ids.forEach((id) => queryParams.append('client_ids', id))
    }
    if (schedule_types?.length) {
      schedule_types.forEach((type) =>
        queryParams.append('schedule_types', type)
      )
    }
    const response = await get<ScheduleType[]>(
      `centers/${center_id}/schedules?${queryParams}`
    )

    return response
  }
})

export interface SessionCounselorInfo {
  counselor_id: string
  counselor_name: string
}

export interface ScheduleSessionDetailResponse {
  session_id: string
  case_code: string
  case_id: string
  case_type: 'individual' | 'group'
  session_number: number
  /** @deprecated 대표 1명 이름. 신규 코드는 counselors 사용 */
  counselor_name: string
  /** 세션의 모든 담당자 (그룹 상담 다중 지원) */
  counselors: SessionCounselorInfo[]
  cancel_reason?: string | null
  program_id?: string | null
  set_id?: string | null
  set_name?: string | null
  assessments: {
    id?: string | null
    code: string
    kor_name: string
    belongs_to_set?: boolean
  }[]
  clients: {
    client_id: string
    client_name: string
    attendance_status: string
  }[]
}

export interface ScheduleDetailResponse {
  id: string
  center_id: string
  member_id: string
  schedule_type: ScheduleCaseType
  title: string
  room_id: string
  room_name: string
  start: Date
  end: Date
  memo: string
  sessions: ScheduleSessionDetailResponse[]
  has_conflict: boolean
  conflicting_schedules: ConflictingScheduleSummary[]
  created_at: Date
  updated_at: Date | null
}

export const getScheduleDetail = () => ({
  key: ['getScheduleDetail'],
  request: async (request: { center_id: string; schedule_id: string }) => {
    const { center_id, schedule_id } = request
    const response = await get<ScheduleDetailResponse>(
      `centers/${center_id}/schedules/${schedule_id}`
    )
    return response
  }
})

// ============ createSchedule (검사 접수 등) ============
export interface ChangeScheduleRequest {
  center_id: string
  schedule_id: string
  end?: string
  member_id?: string
  start?: string
  title?: string
  room_id?: string | null
  memo?: string
}

export const patchChangeSchedule = () => ({
  key: ['patchChangeSchedule'],
  request: async (request: ChangeScheduleRequest) => {
    const { center_id, schedule_id, ...payload } = request
    const url = `/centers/${center_id}/schedules/${schedule_id}`
    const response = await patch<CreateScheduleResponse>(url, payload)
    return response
  }
})

// ============ deleteSchedule ============
// 기존 호환성: scheduleId만 전달하거나 { center_id, schedule_id } 객체로 전달 가능

type DeleteScheduleRequest = { center_id: string; schedule_id: string }

export const deleteSchedule = () => ({
  key: ['deleteSchedule'],
  request: async (request: DeleteScheduleRequest) => {
    const { center_id, schedule_id } = request
    const response = await deleteResource<any>(
      `/centers/${center_id}/schedules/${schedule_id}`
    )
    return response
  }
})

export interface OperationScheduleRequest {
  end: string
  center_id: string
  member_id: string
  memo: string
  room_id: string
  schedule_type: string
  start: string
  title: string
}

export const postCreateOperationSchedule = () => ({
  key: ['postCreateOperationSchedule'],
  request: async (request: OperationScheduleRequest) => {
    const { center_id, ...payload } = request
    const response = await post(`/centers/${center_id}/schedules`, payload)
    return response
  }
})

// ============ validateBatchSchedules ============

export interface BatchScheduleValidationRequest {
  center_id: string
  start_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  duration_minutes: number
  room_id: string
  /** 담당자 Member ID (선택). 제공 시 담당자 중복까지 경고로 감지 */
  member_id?: string | null
  recurrence: {
    pattern: 'daily' | 'weekly' | 'monthly'
    interval: number
    count?: number
    until?: string // YYYY-MM-DD
    days_of_week?: string[]
    monthly_repeat_types?: string[]
  }
}

export interface ConflictingScheduleSummary {
  id: string
  title: string | null
  start: string
  end: string
  schedule_type: string
  room_id?: string | null
  room_name: string | null
  member_id?: string | null
  /**
   * 충돌 사유. 백엔드에서 요청 축(room/member)과 실제 일정을 비교해 결정.
   * - 'room': 장소 겹침
   * - 'member': 담당자 겹침 (장소는 다를 수 있음)
   * - 'both': 장소·담당자 모두 겹침
   */
  conflict_reason?: 'room' | 'member' | 'both'
}

export interface ScheduleConflictDetail {
  session_number: number
  date: string
  conflicting_schedules: ConflictingScheduleSummary[]
}

export interface BatchScheduleValidationResponse {
  has_conflicts: boolean
  total_schedules: number
  conflicts: ScheduleConflictDetail[]
  /** conflicts가 상한에 의해 잘렸는지 여부 */
  truncated?: boolean
  /** 상한 초과로 잘려나간 회차 수 */
  truncated_count?: number
  schedule_dates: string[]
}

export const postValidateBatchSchedules = () => ({
  key: ['postValidateBatchSchedules'],
  request: async (
    request: BatchScheduleValidationRequest
  ): Promise<BatchScheduleValidationResponse> => {
    const { center_id, ...payload } = request
    // post()의 반환 타입은 ApiResponse<T>이지만 프록시가 FastAPI 응답을 그대로 전달하므로
    // 실제 값은 BatchScheduleValidationResponse 자체임
    const response = await post(
      `/centers/${center_id}/schedules/validate-recurring`,
      payload
    )
    return response as unknown as BatchScheduleValidationResponse
  }
})

// ============================================================================
// 단건 일정 충돌 검증
// ============================================================================

export interface SingleScheduleValidationRequest {
  center_id: string
  room_id: string
  start: string
  end: string
  /** 담당자 Member ID (선택). 제공 시 담당자 중복까지 경고로 감지 */
  member_id?: string | null
}

export interface SingleScheduleValidationResponse {
  has_conflicts: boolean
  conflicting_schedules: ConflictingScheduleSummary[]
}

export const postValidateSingleSchedule = () => ({
  key: ['postValidateSingleSchedule'],
  request: async (
    request: SingleScheduleValidationRequest
  ): Promise<SingleScheduleValidationResponse> => {
    const { center_id, ...payload } = request
    const response = await post(
      `/centers/${center_id}/schedules/validate`,
      payload
    )
    return response as unknown as SingleScheduleValidationResponse
  }
})

// ============================================================================
// 멀티 날짜 일정 충돌 검증
// ============================================================================

export interface DatesScheduleValidationRequest {
  center_id: string
  dates: string[] // ISO datetime strings
  start_time: string // HH:MM
  end_time: string // HH:MM
  room_id: string
  exclude_schedule_id?: string // 수정 시 자기 자신 제외
  /** 담당자 Member ID (선택). 제공 시 담당자 중복까지 경고로 감지 */
  member_id?: string | null
}

export interface DatesScheduleValidationResponse {
  has_conflicts: boolean
  total_schedules: number
  conflicts: ScheduleConflictDetail[]
  /** conflicts가 상한에 의해 잘렸는지 여부 */
  truncated?: boolean
  /** 상한 초과로 잘려나간 날짜 수 */
  truncated_count?: number
}

export const postValidateDatesSchedules = () => ({
  key: ['postValidateDatesSchedules'],
  request: async (
    request: DatesScheduleValidationRequest
  ): Promise<DatesScheduleValidationResponse> => {
    const { center_id, ...payload } = request
    const response = await post(
      `/centers/${center_id}/schedules/validate-dates`,
      payload
    )
    return response as unknown as DatesScheduleValidationResponse
  }
})

// ============ 일정 변경 요청 (내담자 앱 → 센터 승인) ============

export type ScheduleChangeRequestStatus = 'pending' | 'approved' | 'rejected'

export interface ScheduleChangeRequestItem {
  id: string
  center_id: string
  schedule_id: string
  client_id: string
  client_name: string | null
  // 내담자 표시 최소 단위(아바타 + 이름 + 생년월일|성별) — 화면 공통 규격
  client_birth_date: string | null
  client_gender: string | null
  client_profile_image_url: string | null
  title: string | null
  program_name: string | null
  session_number: number | null
  room_name: string | null
  counselor_name: string | null
  current_start: string
  current_end: string
  requested_start: string
  requested_end: string
  reason: string | null
  status: ScheduleChangeRequestStatus
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

export const getScheduleChangeRequests = () => ({
  key: ['getScheduleChangeRequests'],
  request: async (request: {
    center_id: string
    status?: ScheduleChangeRequestStatus
  }) => {
    const { center_id, status } = request
    const query = status ? `?status=${status}` : ''
    const response = await get<ScheduleChangeRequestItem[]>(
      `/centers/${center_id}/schedule-change-requests${query}`
    )
    return response
  }
})

export const postApproveScheduleChangeRequest = () => ({
  key: ['postApproveScheduleChangeRequest'],
  request: async (request: { center_id: string; request_id: string }) => {
    const { center_id, request_id } = request
    return await post(
      `/centers/${center_id}/schedule-change-requests/${request_id}/approve`,
      {}
    )
  }
})

export const postRejectScheduleChangeRequest = () => ({
  key: ['postRejectScheduleChangeRequest'],
  request: async (request: {
    center_id: string
    request_id: string
    reason: string
  }) => {
    const { center_id, request_id, reason } = request
    return await post(
      `/centers/${center_id}/schedule-change-requests/${request_id}/reject`,
      { reason }
    )
  }
})
