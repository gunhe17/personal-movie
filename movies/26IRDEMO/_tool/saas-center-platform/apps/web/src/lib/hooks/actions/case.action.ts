import type { Page, PaginationRes } from '../../types/apiResponse'
import type {
  CaseData,
  ClientSummaryForCase
} from '../../types/assessmentStatus'
import { get, post, patch, deleteResource } from '$lib/services/api/instances'

/**
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨.
 */

// ========== 서버 목록 응답 (GET /centers/{center_id}/assessment-cases) ==========
export interface AssessmentCaseListResponseServer {
  items: Array<Omit<CaseData, 'uid'> & { case_id: string }>
  total: number
  page: number
  size: number
  pages: number
}

// ========== 케이스 생성 (개별/일괄은 접수 페이지에서 사용) ==========
export interface CreateIndividualAssessmentPayload {
  client_id: string
  assessment_ids: string[]
  is_final_report_required?: boolean
  has_schedule?: boolean
  scheduled_start?: string
  scheduled_end?: string
  counselor_id: string
  assistant_ids?: string[]
  room_id?: string
  memo?: string
  institution_id?: string
  set_id?: string
  tags?: string[]
}

export interface CreateIndividualAssessmentRequest {
  centerId: string
  payload: CreateIndividualAssessmentPayload
}

export interface CreateIndividualAssessmentResponse {
  case_id: string
  case_code: string
  session_id: string | null
  schedule_id: string | null
  created_at: string
  /** 일정 충돌 등 경고 메시지 (접수는 성공). 스낵바로 노출. */
  warnings?: string[]
}

export interface CreateBatchAssessmentPayload {
  client_ids: string[]
  institution_id?: string
  assessment_ids: string[]
  is_final_report_required?: boolean
  has_schedule?: boolean
  scheduled_start?: string
  scheduled_end?: string
  counselor_id: string
  assistant_ids?: string[]
  room_id?: string
  memo?: string
  set_id?: string
  tags?: string[]
}

export interface CreateBatchAssessmentRequest {
  centerId: string
  payload: CreateBatchAssessmentPayload
}

export interface CreateBatchAssessmentResponse {
  schedule_id: string | null
  case_ids: string[]
  total_count: number
  created_at: string
}

// ========== 케이스 상세 (GET /assessment-cases/{case_id}) ==========
export interface CaseDetail {
  case_id: string
  case_code: string
  status: string
  case_type: string
  created_at: string
  completed_at: string | null
  tags: string[]
  is_final_report_required: boolean
  counselor: {
    member_id: string
    name: string
    birth_date?: string | null
    email?: string | null
    phone?: string | null
    employment_type?: string | null
    hire_date?: string | null
    memo?: string | null
  }
  assistants: { member_id: string; name: string }[]
  /** 조회자의 담당 구분 — assistant(참여 검사자)는 열람만 가능, 관리자는 null */
  my_role?: 'primary' | 'assistant' | null
  clients: ClientSummaryForCase[]
  institution: {
    institution_id: string
    name: string
    phone: string | null
  } | null
  tasks: {
    id: string
    assessment_id: string
    assessment_code: string
    assessment_name: string
    status: string
    execution_method: string
    progress: Record<string, unknown>
    completed_at: string | null
    created_at: string
    belongs_to_set: boolean
  }[]
  schedule: {
    schedule_id: string
    start: string
    end: string
    room_id: string | null
    memo: string | null
    is_cancelled: boolean
    cancel_reason: string | null
    session_id: string | null
  } | null
  set_id: string | null
  set_name: string | null
}

export interface GetCaseResponse {
  data: CaseDetail
}

// ========== Task 상세/상태/리포트 ==========
export interface TaskDetail {
  case_id: string
  assessment_id: string
  center_id: string
  execution_method: string
  process: Record<string, unknown>
  status: string
  report_payload: Record<string, unknown> | null
  is_report_visible_to_guardian: boolean
  opinion: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface GetTaskRequest {
  centerId: string
  caseId: string
  assessmentId: string
}

export interface TaskRefusePayload {
  reason?: string | null
}

export interface TaskCancelPayload {
  reason?: string | null
}

/** Task(검사) 단건 취소 요청 — 백엔드 POST /centers/{id}/tasks/{task_id}/cancel */
export interface CancelTaskRequest {
  centerId: string
  taskId: string
  payload?: TaskCancelPayload
}

export interface UpdateTaskStatusRequest {
  centerId: string
  caseId: string
  assessmentId: string
  payload?: TaskRefusePayload | TaskCancelPayload
}

export interface TaskReportResponse {
  case_id: string
  assessment_id: string
  report_payload: Record<string, unknown> | null
  is_report_visible_to_guardian: boolean
  completed_at: string | null
}

// ========== 케이스 수정 (PATCH, 백엔드 AssessmentCaseUpdate와 동일) ==========
export interface ScheduleUpdateInput {
  has_schedule: boolean
  scheduled_start?: string | null
  scheduled_end?: string | null
  room_id?: string | null
  memo?: string | null
}

export interface UpdateCasePayload {
  /** 담당 검사자 ID (member_id) */
  counselor_id?: string | null
  /** 하위 호환 */
  assigned_specialist_uid?: string
  /** 검사 ID 목록 */
  assessment_ids?: string[] | null
  /** 검사 세트 ID */
  set_id?: string | null
  /** 내담자 ID 목록 */
  client_ids?: string[] | null
  /** 보조 검사자 ID 목록 */
  assistant_ids?: string[] | null
  /** 기관 ID */
  institution_id?: string | null
  /** 태그 */
  tags?: string[] | null
  /** 종합보고서 필요 여부 */
  is_final_report_required?: boolean | null
  /** 하위 호환 */
  require_final_report?: boolean
  /** 일정 수정 정보 */
  schedule?: ScheduleUpdateInput | null
}

export interface UpdateCaseRequest {
  centerId: string
  caseId: string
  currentAccount?: string
  currentPerson?: string
  payload: UpdateCasePayload
}

export interface UpdateCaseResponse {
  data: { uid: string }
}

// ========== 목록 조회 GET /centers/{center_id}/assessment-cases ==========
const emptyCasesResponse: PaginationRes<CaseData> = {
  data: [],
  pagination: { page: 1, size: 10, total: 0, total_pages: 0 }
}

export const getCasesByCenterId = () => ({
  key: ['getCases'],
  request: async (request: {
    centerId: string | null | undefined
    queryParams: {
      search?: string
      size?: number
      sort?: string
      page?: number
      status?: string
      counselor_id?: string
      case_type?: string
      date_from?: string
      date_to?: string
      has_schedule?: boolean
    }
  }) => {
    if (!request.centerId) {
      return emptyCasesResponse
    }
    const {
      search,
      size,
      page,
      status,
      counselor_id,
      sort,
      case_type,
      date_from,
      date_to,
      has_schedule
    } = request.queryParams
    const query: Record<string, string | number | boolean | undefined> = {}
    if (status && status !== 'all') query.status = status
    if (page != null) query.page = page
    if (size != null) query.size = size
    if (counselor_id) query.counselor_id = counselor_id
    if (search) query.search = search
    if (sort) query.sort = sort
    if (case_type) query.case_type = case_type
    if (date_from) query.date_from = date_from
    if (date_to) query.date_to = date_to
    if (has_schedule != null) query.has_schedule = has_schedule
    const responseData = await get<AssessmentCaseListResponseServer>(
      `/centers/${request.centerId}/assessment-cases`,
      query
    )
    const out: PaginationRes<CaseData> = {
      data: responseData.items.map(
        (i) => ({ ...i, uid: i.case_id }) as CaseData
      ),
      pagination: {
        page: responseData.page,
        size: responseData.size,
        total: responseData.total,
        total_pages: responseData.pages
      }
    }
    return out
  }
})

// ========== 무한 스크롤(그리드 뷰) 전용 목록 ==========
// getCasesByCenterId 와 동일 엔드포인트지만, infiniteQueryBuilder 가 요구하는
// 정본 Page<CaseData>({ items, total, page, size, pages }) 형태를 그대로 반환한다.
// (테이블 뷰가 쓰는 getCasesByCenterId 는 {data, pagination} 형태라 손대지 않는다.)
const emptyCasesPage: Page<CaseData> = {
  items: [],
  total: 0,
  page: 1,
  size: 0,
  pages: 0
}

export const getCasesPageByCenterId = () => ({
  key: ['getCases'],
  request: async (request: {
    centerId: string | null | undefined
    queryParams: {
      search?: string
      size?: number
      sort?: string
      page?: number
      status?: string
      counselor_id?: string
      case_type?: string
      date_from?: string
      date_to?: string
      has_schedule?: boolean
    }
  }): Promise<Page<CaseData>> => {
    if (!request.centerId) {
      return emptyCasesPage
    }
    const {
      search,
      size,
      page,
      status,
      counselor_id,
      sort,
      case_type,
      date_from,
      date_to,
      has_schedule
    } = request.queryParams
    const query: Record<string, string | number | boolean | undefined> = {}
    if (status && status !== 'all') query.status = status
    if (page != null) query.page = page
    if (size != null) query.size = size
    if (counselor_id) query.counselor_id = counselor_id
    if (search) query.search = search
    if (sort) query.sort = sort
    if (case_type) query.case_type = case_type
    if (date_from) query.date_from = date_from
    if (date_to) query.date_to = date_to
    if (has_schedule != null) query.has_schedule = has_schedule
    const responseData = await get<AssessmentCaseListResponseServer>(
      `/centers/${request.centerId}/assessment-cases`,
      query
    )
    return {
      items: responseData.items.map(
        (i) => ({ ...i, uid: i.case_id }) as CaseData
      ),
      total: responseData.total,
      page: responseData.page,
      size: responseData.size,
      pages: responseData.pages
    }
  }
})

// ========== 내담자별 목록 GET /centers/{center_id}/assessment-cases/by-client/{client_id} ==========
// 일반 목록과 동일한 AssessmentCaseListItem 형태(배열, 페이지네이션 없음)를 반환한다.
// uid를 붙여 CaseData로 정규화 → mapAssessmentToHistory 재사용.
export const getAssessmentCasesByClient = () => ({
  key: ['getAssessmentCasesByClient'],
  request: async (request: {
    centerId: string | null | undefined
    clientId: string
    status?: string
  }): Promise<CaseData[]> => {
    if (!request.centerId || !request.clientId) return []
    const query = request.status ? { status: request.status } : undefined
    const items = await get<AssessmentCaseListResponseServer['items']>(
      `/centers/${request.centerId}/assessment-cases/by-client/${request.clientId}`,
      query
    )
    return items.map((i) => ({ ...i, uid: i.case_id }) as CaseData)
  }
})

// ========== 상세 조회 GET /centers/{center_id}/assessment-cases/{case_id} ==========
export const getCaseById = () => ({
  key: ['getCaseById'],
  request: async (request: {
    centerId: string | null | undefined
    caseId: string
  }) => {
    const { centerId, caseId } = request
    if (!centerId) {
      return { data: null } as unknown as GetCaseResponse
    }
    try {
      const body = await get<CaseDetail>(
        `/centers/${centerId}/assessment-cases/${caseId}`
      )
      return { data: body ?? null } as GetCaseResponse
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const status = (err as { response?: { status?: number } }).response
          ?.status
        if (status === 404 || status === 204) {
          return { data: null } as unknown as GetCaseResponse
        }
      }
      throw err
    }
  }
})

// ========== Task 목록 조회 GET /centers/{center_id}/assessment-cases/{case_id}/tasks ==========
export interface TaskListAssessmentInfo {
  code: string
  kor_name: string
  workflow_type: string
  definition: Record<string, unknown>
  external_url: string | null
}

export interface TaskListItem {
  id: string
  case_id: string
  assessment_id: string
  center_id: string
  execution_method: string
  process: Record<string, unknown>
  status: string
  report_payload: Record<string, unknown> | null
  report_document_id: string | null
  is_report_visible_to_guardian: boolean
  opinion: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assessment: TaskListAssessmentInfo | null
}

export const getTasksByCaseId = () => ({
  key: ['getTasksByCaseId', 'getCaseById'],
  request: async (request: {
    centerId: string | null | undefined
    caseId: string
    execution_method?: string
  }) => {
    const { centerId, caseId, execution_method } = request
    if (!centerId || !caseId) {
      return [] as TaskListItem[]
    }
    const query = execution_method != null ? { execution_method } : undefined
    return get<TaskListItem[]>(
      `/centers/${centerId}/assessment-cases/${caseId}/tasks`,
      query
    )
  }
})

export const getTaskById = () => ({
  key: ['getTaskById', 'getCaseById'],
  request: async (request: GetTaskRequest) => {
    const { centerId, caseId, assessmentId } = request
    return get<TaskDetail>(
      `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}`
    )
  }
})

/** external_service 제출: report_document_id로 보고서 연결 (이미 업로드된 문서 ID) */
export interface SubmitTaskRequest {
  centerId: string
  taskId: string
  payload: {
    workflow_type: 'external_service'
    report_document_id: string
    report_payload?: Record<string, unknown>
  }
}

export const submitTask = () => ({
  key: ['submitTask', 'getCaseById', 'getTasksByCaseId'],
  request: async (request: SubmitTaskRequest) => {
    const { centerId, taskId, payload } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/tasks/${taskId}/submit`,
      payload
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

export const completeTask = () => ({
  key: ['completeTask', 'getCaseById', 'getTaskById'],
  request: async (request: UpdateTaskStatusRequest) => {
    const { centerId, caseId, assessmentId } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/complete`,
      {}
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

export const revertTask = () => ({
  key: ['revertTask', 'getCaseById', 'getTaskById'],
  request: async (request: UpdateTaskStatusRequest) => {
    const { centerId, caseId, assessmentId } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/revert`,
      {}
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

export const refuseTask = () => ({
  key: ['refuseTask', 'getCaseById', 'getTaskById'],
  request: async (request: UpdateTaskStatusRequest) => {
    const { centerId, assessmentId, payload } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/tasks/${assessmentId}/refuse`,
      payload ?? {}
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

export const cancelTask = () => ({
  key: ['cancelTask', 'getCaseById', 'getTasksByCaseId'],
  request: async (request: CancelTaskRequest) => {
    const { centerId, taskId, payload } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/tasks/${taskId}/cancel`,
      payload ?? {}
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

// ========== Task 취소 철회 POST /centers/{center_id}/tasks/{task_id}/revert-cancel ==========
export interface RollbackTaskRequest {
  centerId: string
  taskId: string
}

export const revertCancelTask = () => ({
  key: ['revertCancelTask', 'getCaseById', 'getTasksByCaseId'],
  request: async (request: RollbackTaskRequest) => {
    const { centerId, taskId } = request
    const res = await post<TaskDetail>(
      `/centers/${centerId}/tasks/${taskId}/revert-cancel`,
      {}
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})

export const getTaskReport = () => ({
  key: ['getTaskReport', 'getTaskById', 'getCaseById'],
  request: async (request: GetTaskRequest) => {
    const { centerId, caseId, assessmentId } = request
    return get<TaskReportResponse>(
      `/centers/${centerId}/assessment-cases/${caseId}/tasks/${assessmentId}/report`
    )
  }
})

// ========== 케이스 완료 POST /centers/{center_id}/assessment-cases/{case_id}/complete ==========
export interface CompleteCaseRequest {
  centerId: string
  caseId: string
}

export const completeCase = () => ({
  key: ['completeCase', 'getCases', 'getCaseById'],
  request: async (request: CompleteCaseRequest) => {
    const { centerId, caseId } = request
    const res = await post<{ case_id: string; status: string }>(
      `/centers/${centerId}/assessment-cases/${caseId}/complete`,
      {}
    )
    return (
      (res as { data?: { case_id: string; status: string } }).data ??
      (res as unknown as { case_id: string; status: string })
    )
  }
})

// ========== 케이스 취소 POST /centers/{center_id}/assessment-cases/{case_id}/cancel ==========
export interface CancelCaseRequest {
  centerId: string
  caseId: string
}

export const cancelCase = () => ({
  key: ['cancelCase', 'getCases'],
  request: async (request: CancelCaseRequest) => {
    const { centerId, caseId } = request
    const res = await post<{ case_id: string; status: string }>(
      `/centers/${centerId}/assessment-cases/${caseId}/cancel`,
      {}
    )
    return (
      (res as { data?: { case_id: string; status: string } }).data ??
      (res as unknown as { case_id: string; status: string })
    )
  }
})

// ========== 케이스 롤백 POST /centers/{center_id}/assessment-cases/{case_id}/revert-cancel ==========
export interface RollbackCaseRequest {
  centerId: string
  caseId: string
}

export const revertCancelCase = () => ({
  key: ['revertCancelCase', 'getCases'],
  request: async (request: RollbackCaseRequest) => {
    const { centerId, caseId } = request
    const res = await post<{ case_id: string; status: string }>(
      `/centers/${centerId}/assessment-cases/${caseId}/revert-cancel`,
      {}
    )
    return (
      (res as { data?: { case_id: string; status: string } }).data ??
      (res as unknown as { case_id: string; status: string })
    )
  }
})

// ========== 케이스 생성 (레거시/접수 페이지용 - 서버는 /individual, /batch 사용) ==========
// ========== 접수 생성 (실제 서버 계약: /individual, /batch) ==========
export const createIndividualAssessmentCase = () => ({
  key: ['createIndividualAssessmentCase', 'getCases', 'getCaseStatusCounts'],
  request: async (request: CreateIndividualAssessmentRequest) => {
    const { centerId, payload } = request
    const res = await post<CreateIndividualAssessmentResponse>(
      `/centers/${centerId}/assessment-cases/individual`,
      payload
    )
    return (
      (res as { data?: CreateIndividualAssessmentResponse }).data ??
      (res as unknown as CreateIndividualAssessmentResponse)
    )
  }
})

export const createBatchAssessmentCase = () => ({
  key: ['createBatchAssessmentCase', 'getCases', 'getCaseStatusCounts'],
  request: async (request: CreateBatchAssessmentRequest) => {
    const { centerId, payload } = request
    const res = await post<CreateBatchAssessmentResponse>(
      `/centers/${centerId}/assessment-cases/batch`,
      payload
    )
    return (
      (res as { data?: CreateBatchAssessmentResponse }).data ??
      (res as unknown as CreateBatchAssessmentResponse)
    )
  }
})

// ========== 케이스 수정 PATCH /centers/{center_id}/assessment-cases/{case_id} ==========
export const updateCase = () => ({
  key: ['updateCase', 'getCases', 'getCaseById'],
  request: async (request: UpdateCaseRequest & { force?: boolean }) => {
    const { centerId, caseId, currentAccount, currentPerson, payload, force } =
      request
    const qs = new URLSearchParams()
    if (currentAccount) qs.set('current_account', currentAccount)
    if (currentPerson) qs.set('current_person', currentPerson)
    if (force != null) qs.set('force', String(force))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const body: Record<string, unknown> = { ...payload }
    if (payload.assigned_specialist_uid !== undefined)
      body.counselor_id = payload.assigned_specialist_uid
    if (payload.require_final_report !== undefined)
      body.is_final_report_required = payload.require_final_report
    delete body.assigned_specialist_uid
    delete body.require_final_report
    if (payload.assessment_ids != null) {
      body.assessment_ids = Array.isArray(payload.assessment_ids)
        ? payload.assessment_ids
        : []
    }
    if (payload.assistant_ids != null) {
      body.assistant_ids = Array.isArray(payload.assistant_ids)
        ? payload.assistant_ids
        : []
    }
    const res = await patch<UpdateCaseResponse>(
      `/centers/${centerId}/assessment-cases/${caseId}${suffix}`,
      body
    )
    return (
      (res as { data?: UpdateCaseResponse }).data ??
      (res as unknown as UpdateCaseResponse)
    )
  }
})

// ========== 상태별 개수 (서버 미제공 - 클라이언트에서 목록으로 계산) ==========
export interface CaseStatusCounts {
  total: number
  pending: number
  processing: number
  completed: number
  cancelled: number
}

export interface GetCaseStatusCountsResponse {
  data: CaseStatusCounts
}

export const getCaseStatusCounts = () => ({
  key: ['getCaseStatusCounts'],
  request: async (_request: { centerId: string }) => {
    return {
      data: { total: 0, pending: 0, processing: 0, completed: 0, cancelled: 0 }
    } as GetCaseStatusCountsResponse
  }
})

// ========== 케이스 삭제 DELETE /centers/{center_id}/assessment-cases/{case_id} ==========
export interface DeleteCaseRequest {
  centerId: string
  caseId: string
}

export const deleteCase = () => ({
  key: ['deleteCase', 'getCases'],
  request: async (request: DeleteCaseRequest) => {
    const { centerId, caseId } = request
    const res = await deleteResource<{ case_id: string }>(
      `/centers/${centerId}/assessment-cases/${caseId}`
    )
    return res
  }
})

// ========== Task 삭제 DELETE /centers/{center_id}/tasks/{task_id} ==========
export interface DeleteTaskRequest {
  centerId: string
  taskId: string
}

export const deleteTask = () => ({
  key: ['deleteTask', 'getCases', 'getTasksByCaseId'],
  request: async (request: DeleteTaskRequest) => {
    const { centerId, taskId } = request
    const res = await deleteResource<{ task_id: string }>(
      `/centers/${centerId}/tasks/${taskId}`
    )
    return res
  }
})

// ========== 검사자 소견 수정 PATCH /centers/{center_id}/tasks/{task_id}/opinion ==========
export interface UpdateTaskOpinionRequest {
  centerId: string
  taskId: string
  opinion: string | null
}

export const updateTaskOpinion = () => ({
  key: ['updateTaskOpinion', 'getTasksByCaseId', 'getTaskById', 'getCaseById'],
  request: async (request: UpdateTaskOpinionRequest) => {
    const { centerId, taskId, opinion } = request
    const res = await patch<TaskDetail>(
      `/centers/${centerId}/tasks/${taskId}/opinion`,
      { opinion }
    )
    return (res as { data?: TaskDetail }).data ?? (res as unknown as TaskDetail)
  }
})
