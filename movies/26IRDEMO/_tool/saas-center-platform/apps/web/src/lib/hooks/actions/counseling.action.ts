import type {
  CounselingCaseBaseDetail,
  CounselingCaseItem,
  CounselingDetailData,
  CounselingSessionNote,
  SessionStatus
} from '$lib/types/counseling'
import type {
  Action,
  ApiResponse,
  RowPaginationRes
} from '$lib/types/apiResponse'

import { deleteResource, get, patch, post } from '$lib/services/api/instances'

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

type RecurrencePattern = 'weekly' | 'biweekly' | 'monthly'

export type CreateCounselingRequestType = {
  center_id: string
  case: {
    chief_complaint: string
    client_ids: string[]
    counselor_ids: string[]
    program_id: string
    memo: string
  }
  sessions: {
    dates: string[] // ISO 날짜+시간 배열
    start_time: string // "HH:MM"
    end_time: string // "HH:MM"
    room_id: string
    /** 세션(스케줄)에 저장될 메모 — 일정 상세에서 표시됨 */
    memo?: string
    session_rule?: {
      recurrence: {
        pattern: string
        interval: number
        days_of_week?: string[]
        alternating_days_of_week?: string[]
      }
      duration_minutes: number
      room_id: string
      start_time: string
    }
  }
}

export type GetCounselingsRequest = {
  centerId: string
  queryParams: {
    search?: string
    size?: number
    sort?: 'asc' | 'desc'
    page?: number
    status?: string
    counselingType?: string
    counselorIds?: string[]
    counselorId?: string
    clientId?: string
    startDate?: string
    endDate?: string
    signal?: string
  }
}

// ============================================================
// 상담 목록 조회
// ============================================================

export const getCounselingsByCenterId = () => ({
  key: ['getCounselingsByCenterId'],
  request: async (request: GetCounselingsRequest) => {
    const queryParams = new URLSearchParams()
    const {
      search,
      size,
      sort,
      page,
      status,
      counselingType,
      counselorIds,
      clientId,
      startDate,
      endDate,
      signal
    } = request.queryParams
    if (request.centerId) {
      queryParams.append('center_id', request.centerId)
    }
    if (status && status !== 'all') {
      queryParams.append('status', status)
    }
    if (page) {
      queryParams.append('page', page.toString())
    }
    if (size) {
      queryParams.append('size', size.toString())
    }
    if (sort) {
      queryParams.append('sort', sort)
    }
    if (counselingType && counselingType !== 'all') {
      queryParams.append('counseling_type', counselingType)
    }
    if (search) {
      queryParams.append('client_name', search)
    }
    if (counselorIds) {
      queryParams.append('counselor_id', counselorIds.join(','))
    }
    if (clientId) {
      queryParams.append('client_id', clientId)
    }
    if (startDate) {
      queryParams.append('start_date', startDate)
    }
    if (endDate) {
      queryParams.append('end_date', endDate)
    }
    if (signal) {
      queryParams.append('signal', signal)
    }

    const response = await get<RowPaginationRes<CounselingCaseItem>>(
      `centers/${request.centerId}/counseling?${queryParams}`
    )
    return response
  }
})

// ============================================================
// 미처리 회기 조회 (대시보드 시그널 — 예약 시간이 지났는데 정리 안 된 회기)
// ============================================================

export interface UnprocessedSession {
  session_id: string
  case_id: string
  case_code: string
  session_number: number | null
  program_name: string | null
  client_names: string[]
  counselor_name: string | null
  start: string
  end: string
  room_name: string | null
}

export interface UnprocessedSessionListResponse {
  items: UnprocessedSession[]
  total: number
}

const emptyUnprocessedSessions: UnprocessedSessionListResponse = {
  items: [],
  total: 0
}

export const getUnprocessedSessions = () => ({
  key: ['getUnprocessedSessions'],
  request: async (request: {
    centerId: string | null | undefined
    size?: number
  }): Promise<UnprocessedSessionListResponse> => {
    if (!request.centerId) return emptyUnprocessedSessions
    const query = request.size ? `?size=${request.size}` : ''
    return await get<UnprocessedSessionListResponse>(
      `/centers/${request.centerId}/counseling/sessions/unprocessed${query}`
    )
  }
})

// ============================================================
// 상담 단건 조회
// ============================================================

export interface GetCounselingByIdRequest {
  centerId: string
  counselingId: string
}

// ============================================================
// 상담 상세 조회 (세션 포함)
// ============================================================

export interface GetCounselingDetailRequest {
  centerId: string
  counselingId: string
}

export interface GetCounselingDetailResponse {
  data: CounselingDetailData
}

export const getCounselingDetailById = () => ({
  key: ['getCounselingDetailById'],
  request: async (request: GetCounselingDetailRequest) => {
    const { centerId, counselingId } = request
    const response = await get<CounselingCaseBaseDetail>(
      `/centers/${centerId}/counseling/${counselingId}`
    )
    return response
  }
})

// ============================================================
// 상담 생성
// ============================================================

export const postCreateCounseling = () => ({
  key: ['postCreateCounseling'],
  request: async (request: CreateCounselingRequestType) => {
    const { center_id, ...rest } = request
    const response = await post<{
      case_id: string
      case_code: string
      total_sessions: number
      warnings?: string[]
    }>(`centers/${center_id}/counseling/intake`, rest)
    return response
  }
})

// ============================================================
// 상담 수정
// ============================================================

export interface UpdateCounselingPayload {
  counselor_uid?: string
  total_sessions?: number
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export interface UpdateCounselingRequest {
  centerId: string
  counselingId: string
  payload: UpdateCounselingPayload
}

// 레거시 대문자 status → 백엔드 CaseStatus enum (active | completed | cancelled)
const CASE_STATUS_MAP: Record<
  NonNullable<UpdateCounselingPayload['status']>,
  'active' | 'completed' | 'cancelled'
> = {
  PENDING: 'active',
  IN_PROGRESS: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

export const updateCounseling = () => ({
  key: ['updateCounseling', 'getCounselings', 'getCounselingById'],
  request: async (request: UpdateCounselingRequest) => {
    const { centerId, counselingId, payload } = request
    // 레거시 payload({counselor_uid,total_sessions,status}) → CounselingCaseUpdateWithReschedule
    const body: {
      counselor_id?: string
      total_sessions?: number
      status?: 'active' | 'completed' | 'cancelled'
    } = {}
    if (payload.counselor_uid !== undefined)
      body.counselor_id = payload.counselor_uid
    if (payload.total_sessions !== undefined)
      body.total_sessions = payload.total_sessions
    if (payload.status !== undefined)
      body.status = CASE_STATUS_MAP[payload.status]
    const response = await patch<{ data: { uid: string } }>(
      `/centers/${centerId}/counseling/cases/${counselingId}`,
      body
    )
    return response
  }
})

// ============================================================
// 세션 수정
// ======================

export interface UpdateCounselingSessionRequest {
  centerId: string
  sessionId: string
  payload: UpdateCounselingSessionPayload
}

export interface UpdateCounselingSessionPayload {
  status?: SessionStatus
}

export interface UpdateCounselingSessionResponse {
  id: string
  center_id: string
  counseling_case_id: string
  schedule_id: string
  status: SessionStatus
  completed_at: Date | null // ISO datetime
  created_at: Date // ISO datetime
  updated_at: Date // ISO datetime
}

export const updateCounselingSession = () => ({
  key: ['updateCounselingSession'],
  request: async (request: UpdateCounselingSessionRequest) => {
    const { centerId, sessionId, payload } = request
    const response = await patch<UpdateCounselingSessionResponse>(
      `/centers/${centerId}/counseling/sessions/${sessionId}`,
      payload
    )
    return response
  }
})

// ============================================================
// 세션 수정
// ======================

export interface UpdateCounselingSessionRequest {
  centerId: string
  sessionId: string
  payload: UpdateCounselingSessionPayload
}

export interface UpdateCounselingSessionPayload {
  status?: SessionStatus
}

export interface UpdateCounselingSessionResponse {
  id: string
  center_id: string
  counseling_case_id: string
  schedule_id: string
  status: SessionStatus
  completed_at: Date | null // ISO datetime
  created_at: Date // ISO datetime
  updated_at: Date // ISO datetime
}

// ============================================================
// 세션 일지 조회
// ======================

export interface SessionNoteListRequest {
  centerId: string
  sessionId: string
}

export interface SessionNoteListResponse {
  id: string
  center_id: string
  counseling_case_id: string
  schedule_id: string
  status: SessionStatus
  completed_at: Date | null // ISO datetime
  created_at: Date // ISO datetime
  updated_at: Date // ISO datetime
}

export const getSessionNoteList = () => ({
  key: ['getSessionNoteList'],
  request: async (request: SessionNoteListRequest) => {
    const { centerId, sessionId } = request
    const response = await get<CounselingSessionNote[]>(
      `/centers/${centerId}/counseling/sessions/${sessionId}/notes`
    )
    return response
  }
})

// ============================================================
// 세션 일지 생성
// ======================

export interface SessionNoteCreateRequest {
  centerId: string
  sessionId: string
  payload: SessionNotePayload
}

export interface SessionNoteModifyRequest {
  centerId: string
  noteId: string
  payload: SessionNotePayload
}

export interface SessionNotePayload {
  content: {
    main_topic?: string // 상담 목표
    progress?: string // 진행 내용
    next_goal?: string // 다음 상담 내용
    private_notes?: string // 개인 메모
    homework?: string
    intervention?: string[]
    mood?: string
    raw_notes?: string
  }
  summary: string
}

export const postCreateSessionNote = () => ({
  key: ['postCreateSessionNote'],
  request: async (request: SessionNoteCreateRequest) => {
    const { centerId, sessionId, payload } = request
    const response = await post<CounselingSessionNote[]>(
      `/centers/${centerId}/counseling/sessions/${sessionId}/notes`,
      { ...payload }
    )
    return response
  }
})

// ============================================================
// 세션 일지 수정
// ======================

export const patchModifySessionNote = () => ({
  key: ['patchModifySessionNote'],
  request: async (request: SessionNoteModifyRequest) => {
    const { centerId, noteId, payload } = request
    const response = await patch<CounselingSessionNote[]>(
      `/centers/${centerId}/counseling/notes/${noteId}`,
      { ...payload }
    )
    return response
  }
})

// ============================================================
// 내 상담일지 목록 (본인 작성 + 미작성 페어, GET /counseling/notes)
// ============================================================

export type MyNotesStatusFilter = 'all' | 'written' | 'missing'

export interface MyCounselingNoteItem {
  note_id: string | null
  counseling_session_id: string
  counseling_case_id: string | null
  client_id: string
  client_name: string | null
  client_gender: string | null
  /** 'YYYY-MM-DD' — 목록 표기 규격(생년월일 | 성별) */
  client_birth_date: string | null
  client_profile_image_url: string | null
  client_age: number | null
  program_name: string | null
  /** 'INDIVIDUAL' | 'GROUP' — 개별/그룹 구분 */
  program_type: string | null
  session_start: string | null
  session_end: string | null
  schedule_id: string | null
  room_name: string | null
  summary: string | null
  /** 목록 카드 미리보기 — 본문 앞부분(개인 메모 제외). 미작성이면 null */
  preview: string | null
  is_written: boolean
  created_at: string | null
}

export interface MyCounselingNotesResponse {
  items: MyCounselingNoteItem[]
  total: number
  page: number
  size: number
  pages: number
}

export type MyNotesProgramTypeFilter = 'all' | 'INDIVIDUAL' | 'GROUP'

export interface MyCounselingNotesRequest {
  centerId: string
  status: MyNotesStatusFilter
  keyword?: string
  /** 'all'이거나 미지정이면 전체 유형 (쿼리에 싣지 않는다) */
  programType?: MyNotesProgramTypeFilter
  skip: number
  limit: number
}

export const getMyCounselingNotes = () => ({
  key: ['getMyCounselingNotes'],
  request: async (request: MyCounselingNotesRequest) => {
    const { centerId, status, keyword, programType, skip, limit } = request
    if (!centerId) {
      return {
        items: [],
        total: 0,
        page: 1,
        size: limit,
        pages: 0
      } as MyCounselingNotesResponse
    }
    const response = await get<MyCounselingNotesResponse>(
      `/centers/${centerId}/counseling/notes`,
      {
        status,
        ...(keyword ? { keyword } : {}),
        ...(programType && programType !== 'all'
          ? { program_type: programType }
          : {}),
        skip,
        limit
      }
    )
    return response
  }
})

// ============================================================
// 상담 케이스 수정 (PATCH /counseling/cases/{case_id})
// ============================================================

export interface RescheduleSettings {
  pattern: 'weekly' | 'biweekly'
  day_of_week: string
  start_time: string // HH:MM:SS
  duration_minutes: number
  room_id?: string
  start_date: string // YYYY-MM-DD
  remaining_sessions_count: number
}

export interface PatchCounselingCaseRequest {
  centerId: string
  counselingId: string
  status?: string
  counselor_id?: string
  chief_complaint?: string
  memo?: string
  total_sessions?: number
  reschedule_settings?: RescheduleSettings
}

export const patchCounselingCase = () => ({
  key: ['patchCounselingCase'],
  request: async (request: PatchCounselingCaseRequest) => {
    const { centerId, counselingId, ...payload } = request
    const response = await patch<{ data: { uid: string } }>(
      `/centers/${centerId}/counseling/cases/${counselingId}`,
      payload
    )
    return response
  }
})

// ============================================================
// 세션 삭제
// ============================================================

export interface DeleteCounselingSessionRequest {
  centerId: string
  sessionId: string
}

export const deleteCounselingSession = () => ({
  key: ['deleteCounselingSession'],
  request: async (request: DeleteCounselingSessionRequest) => {
    const { centerId, sessionId } = request
    return await deleteResource(
      `/centers/${centerId}/counseling/sessions/${sessionId}`
    )
  }
})

// ============================================================
// 상담 삭제
// ============================================================

export interface DeleteCounselingRequest {
  centerId: string
  counselingId: string
}

export const deleteCounseling = () => ({
  key: ['deleteCounseling'],
  request: async (request: DeleteCounselingRequest) => {
    const { centerId, counselingId } = request
    const response = await deleteResource(
      `/centers/${centerId}/counseling/cases/${counselingId}`
    )
    return response
  }
})

// ============================================================
// 상담 취소
// ============================================================

export interface CancelCounselingRequest {
  centerId: string
  counselingId: string
}

export const cancelCounseling = () => ({
  key: ['cancelCounseling', 'getCounselings'],
  request: async (request: CancelCounselingRequest) => {
    const { centerId, counselingId } = request
    // 케이스 전용 cancel 라우트 없음 — PATCH /cases/{id} 로 status=cancelled 전이
    const response = await patch<{ data: { uid: string } }>(
      `/centers/${centerId}/counseling/cases/${counselingId}`,
      { status: 'cancelled' }
    )
    return response
  }
})

// ============================================================
// 상담 세션 취소
// ============================================================

export interface CancelCounselingSessionRequest {
  centerId: string
  sessionId: string
  cancelReason?: string
}

export const cancelCounselingSession = () => ({
  key: ['cancelCounselingSession'],
  request: async (request: CancelCounselingSessionRequest) => {
    const { centerId, sessionId, cancelReason } = request
    const response = await post(
      `/centers/${centerId}/counseling/sessions/${sessionId}/cancel`,
      { cancel_reason: cancelReason ?? null }
    )
    return response
  }
})

export const revertCancelCounselingSession = () => ({
  key: ['revertCancelCounselingSession'],
  request: async (request: { centerId: string; sessionId: string }) => {
    const { centerId, sessionId } = request
    return await post(
      `/centers/${centerId}/counseling/sessions/${sessionId}/revert-cancel`
    )
  }
})

// ============================================================
// 세션 참여자 수정 (참석 상태 변경)
// ============================================================

export interface UpdateSessionParticipantRequest {
  centerId: string
  sessionParticipantId: string
  payload: { attendance_status?: string; is_consumed?: boolean; memo?: string }
}

export const updateSessionParticipant = () => ({
  key: ['updateSessionParticipant'],
  request: async (request: UpdateSessionParticipantRequest) => {
    const { centerId, sessionParticipantId, payload } = request
    return await patch(
      `/centers/${centerId}/counseling/session-participants/${sessionParticipantId}`,
      payload
    )
  }
})

// ============================================================
// 세션 참여자 추가
// ============================================================

export interface AddSessionParticipantsRequest {
  centerId: string
  sessionId: string
  payload: {
    client_ids?: string[]
    counselor_ids?: string[]
  }
}

export const postAddSessionParticipants = () => ({
  key: ['postAddSessionParticipants'],
  request: async (request: AddSessionParticipantsRequest) => {
    const { centerId, sessionId, payload } = request
    return await post(
      `/centers/${centerId}/counseling/sessions/${sessionId}/participants`,
      payload
    )
  }
})

// ============================================================
// 세션 참여자 제거
// ============================================================

export interface DeleteSessionParticipantRequest {
  centerId: string
  sessionParticipantId: string
}

export const deleteSessionParticipant = () => ({
  key: ['deleteSessionParticipant'],
  request: async (request: DeleteSessionParticipantRequest) => {
    const { centerId, sessionParticipantId } = request
    return await deleteResource(
      `/centers/${centerId}/counseling/session-participants/${sessionParticipantId}`
    )
  }
})

// ============================================================
// 나의 상담 조회
// ============================================================

export interface MyCounselingSummary {
  total_completed: number
  individual_completed: number
  group_completed: number
  last_session_date: string | null
}

export interface ClientSummaryForCase {
  client_id: string
  name: string
  client_code: string | null
  birth_date: string | null
  age: number | null
  gender: string | null
}

export interface MyCounselingCaseItem {
  case_id: string
  case_code: string
  status: string
  case_type: string
  program_name: string | null
  clients: ClientSummaryForCase[]
  counselor_name: string | null
  completed_sessions: number
  total_sessions: number
  created_at: string
}

export interface MyCounselingResponse {
  summary: MyCounselingSummary
  items: MyCounselingCaseItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface GetMyCounselingRequest {
  centerId: string
  status?: string
  page?: number
  size?: number
  sort?: 'asc' | 'desc'
}

export const getMyCounselingLogs = () => ({
  key: ['getMyCounselingLogs'],
  request: async (request: GetMyCounselingRequest) => {
    const { centerId, status, page, size, sort } = request
    const queryParams = new URLSearchParams()
    if (status) queryParams.append('status', status)
    if (page) queryParams.append('page', page.toString())
    if (size) queryParams.append('size', size.toString())
    if (sort) queryParams.append('sort', sort)

    const query = queryParams.toString()
    const response = await get<MyCounselingResponse>(
      `/centers/${centerId}/counseling/me${query ? `?${query}` : ''}`
    )
    return response
  }
})

// ============================================================
// 회기 일괄 수정
// ============================================================

export interface BulkUpdateSessionsPayload {
  session_ids: string[]
  start?: string // HH:MM
  end?: string // HH:MM
  day_offset?: number // 날짜 이동 (일 단위, 예: +1 = 하루 뒤로)
  room_id?: string | null
  member_id?: string
  client_ids?: string[] | null
  counselor_ids?: string[] | null
}

export interface BulkUpdateSessionsRequest {
  centerId: string
  payload: BulkUpdateSessionsPayload
}

export interface BulkUpdateSessionsResponse {
  updated_count: number
  warnings: string[]
}

export interface BulkSessionConflict {
  date_kst: string // "YYYY-MM-DD HH:MM"
  session_id: string
  conflicting_titles: string[]
}

export interface BulkSessionValidateResponse {
  has_conflicts: boolean
  conflicts: BulkSessionConflict[]
}

export const postValidateBulkUpdateSessions = () => ({
  key: ['postValidateBulkUpdateSessions'],
  request: async (
    request: BulkUpdateSessionsRequest
  ): Promise<BulkSessionValidateResponse> => {
    const { centerId, payload } = request
    const response = await post<BulkSessionValidateResponse>(
      `/centers/${centerId}/counseling/sessions/batch-update/validate`,
      payload
    )
    return response as unknown as BulkSessionValidateResponse
  }
})

export const patchBulkUpdateSessions =
  (): Action<BulkUpdateSessionsResponse> => ({
    key: ['patchBulkUpdateSessions'],
    request: async (request: BulkUpdateSessionsRequest) => {
      const { centerId, payload } = request
      const response = await patch<BulkUpdateSessionsResponse>(
        `/centers/${centerId}/counseling/sessions/batch-update`,
        payload
      )
      return response as unknown as ApiResponse<BulkUpdateSessionsResponse>
    }
  })

// ============================================================
// 세션 회기 생성
// ======================

export const postCreateSession = () => ({
  key: ['postCreateSession'],
  request: async (request: any) => {
    const { centerId, payload } = request
    const response = await post<any[]>(
      `/centers/${centerId}/counseling/sessions`,
      { ...payload }
    )
    return response
  }
})

// ============================================================
// 케이스 참여자 추가
// ============================================================

export interface AddCaseParticipantRequest {
  centerId: string
  caseId: string
  payload: { participant_id: string; participant_type: string }
}

export const postAddCaseParticipant = () => ({
  key: ['postAddCaseParticipant'],
  request: async (request: AddCaseParticipantRequest) => {
    const { centerId, caseId, payload } = request
    return await post(
      `/centers/${centerId}/counseling/${caseId}/participants`,
      payload
    )
  }
})

// ============================================================
// 케이스 참여자 제거
// ============================================================

export interface DeleteCaseParticipantRequest {
  centerId: string
  caseId: string
  participantId: string
}

export const deleteCaseParticipant = () => ({
  key: ['deleteCaseParticipant'],
  request: async (request: DeleteCaseParticipantRequest) => {
    const { centerId, caseId, participantId } = request
    return await deleteResource(
      `/centers/${centerId}/counseling/${caseId}/participants/${participantId}`
    )
  }
})

// ============================================================
// 회기 일괄 추가 (규칙대로)
// ============================================================

export interface AddSessionsResponse {
  created_count: number
  total_sessions: number
  warnings: string[]
}

export interface AddSessionsRequest {
  centerId: string
  caseId: string
  // 모드 1: 규칙대로
  count?: number
  // 모드 2: 직접 선택
  dates?: string[]
  start_time?: string
  end_time?: string
  room_id?: string
  counselor_ids?: string[]
  client_ids?: string[]
}

export const postAddSessionsToCase = () => ({
  key: ['postAddSessionsToCase'],
  request: async (
    request: AddSessionsRequest
  ): Promise<AddSessionsResponse> => {
    const { centerId, caseId, ...payload } = request
    const response = await post<AddSessionsResponse>(
      `/centers/${centerId}/counseling/cases/${caseId}/add-sessions`,
      { case_id: caseId, ...payload }
    )
    return response as unknown as AddSessionsResponse
  }
})

// ============================================================
// 상담 케이스 통합 수정 (CounselingCaseEditModal 전용)
// ============================================================

export interface ApplyCaseEditsRequest {
  centerId: string
  caseId: string
  payload: {
    client_ids: string[]
    counselor_ids: string[]
    room_id: string | null
    start_time: string // HH:MM (KST)
    end_time: string // HH:MM (KST)
    session_dates: string[] // YYYY-MM-DD (KST)
    sync_clients_to_scheduled_sessions: boolean
  }
}

export interface ApplyCaseEditsResponse {
  case_id: string
  clients_added: number
  clients_removed: number
  sessions_added: number
  sessions_removed: number
  sessions_updated: number
  warnings: string[]
}

export const postApplyCaseEdits = () => ({
  key: ['postApplyCaseEdits'],
  request: async (
    request: ApplyCaseEditsRequest
  ): Promise<ApplyCaseEditsResponse> => {
    const { centerId, caseId, payload } = request
    const response = await post<ApplyCaseEditsResponse>(
      `/centers/${centerId}/counseling/cases/${caseId}/apply-edits`,
      payload
    )
    return response as unknown as ApplyCaseEditsResponse
  }
})
