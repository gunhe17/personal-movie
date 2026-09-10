import {
  deleteResource,
  get,
  patch,
  post,
  put
} from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

export type ClientRole = 'client' | 'guardian' | 'both'
export type ClientStatus = 'active' | 'inactive' | 'archived'

/** 내담자 보유 바우처 요약 (목록 셀/툴팁용) */
export interface ClientVoucherBrief {
  name: string
  remaining_sessions: number
  total_sessions: number
}

export interface ClientListItem {
  id: string
  name: string
  role: ClientRole | string
  phone?: string | null
  status?: ClientStatus | string
  birth_date?: string | null
  gender?: string | null
  /** 프로필 이미지 URL (업로드 사진 또는 성별 매칭 기본 아바타) */
  profile_image_url?: string | null
  memo?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** 다음 예정 회기 시작 시각 (sort=next_session 응답에서만 채워짐) */
  next_session_at?: string | null
  /** 보호자 관계 (엄마, 아빠 등) - 목록 표시용 */
  guardian_relationship?: string | null
  /** 보호자 이름 - 목록 표시용 */
  guardian_name?: string | null
  /** 가장 활성인 바우처 (목록 응답에서 채워짐) */
  voucher_primary?: ClientVoucherBrief | null
  /** 보유 바우처 개수 */
  voucher_count?: number
  /** 전체 보유 바우처 (툴팁용) */
  vouchers?: ClientVoucherBrief[]
}

export interface ClientListResponse {
  items: ClientListItem[]
  total: number
  page: number
  size: number
  pages: number
}

export interface GetClientListParams {
  centerId: string
  skip?: number
  limit?: number
  role?: ClientRole
  status?: ClientStatus
  gender?: string
  search?: string
  sort?: string
}

export const postCreateClient = () => ({
  key: ['postCreateClient'],
  request: async (request: {
    centerId: string
    payload: {
      role: ClientRole
      name: string
      birth_date?: string | null
      gender?: 'male' | 'female' | null
      phone?: string | null
      email?: string | null
      address?: string | null
      status?: ClientStatus
      memo?: string | null
      person_id?: string | null
    }
  }) => {
    const { centerId, payload } = request
    const response = await post<any>(`/centers/${centerId}/clients`, payload)
    return response
  }
})

/** 배치 등록 요청/응답 (서버 스키마와 동일) */
export interface BatchGuardianInput {
  existing_client_id?: string | null
  name: string
  birth_date?: string | null
  gender?: 'male' | 'female' | null
  phone?: string | null
  email?: string | null
  address?: string | null
  relation_type?: string
  relation_detail?: string | null
  is_primary: boolean
  memo?: string | null
}

export interface BatchChildInput {
  name: string
  birth_date: string
  gender: 'male' | 'female'
  phone?: string | null
  email?: string | null
  address?: string | null
  memo?: string | null
}

export interface BatchCreateClientsRequest {
  guardians: BatchGuardianInput[]
  children: BatchChildInput[]
}

export interface BatchRelationsSummary {
  client_relations: number
  sibling_relations: number
}

export interface BatchCreateClientsResponse {
  guardians: ClientListItem[]
  children: ClientListItem[]
  relations: BatchRelationsSummary
}

export const postBatchCreateClients = () => ({
  key: ['postBatchCreateClients'],
  request: async (request: {
    centerId: string
    payload: BatchCreateClientsRequest
  }) => {
    const { centerId, payload } = request
    const response = await post<BatchCreateClientsResponse>(
      `/centers/${centerId}/clients/batch`,
      payload
    )
    return response
  }
})

export interface ExcelClientRowInput {
  name: string
  birth_date: string
  gender: 'male' | 'female'
  guardian_name?: string | null
  guardian_relationship?: string | null
  guardian_gender?: string | null
  guardian_birth_date?: string | null
  guardian_phone?: string | null
}

export interface ExcelClientResult {
  index: number
  client: ClientListItem
  skipped: boolean
}

export interface BulkCreateFromExcelResponse {
  results: ExcelClientResult[]
  total: number
}

export const postBulkCreateFromExcel = () => ({
  key: ['postBulkCreateFromExcel'],
  request: async (params: {
    centerId: string
    clients: ExcelClientRowInput[]
  }) => {
    const { centerId, clients } = params
    const response = await post<BulkCreateFromExcelResponse>(
      `/centers/${centerId}/clients/import-from-excel`,
      { clients }
    )
    return response
  }
})

export const getClientList = (): Action<
  ClientListResponse,
  ClientListResponse
> => ({
  key: ['getClientList'],
  request: async (params: GetClientListParams): Promise<ClientListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 0, size: 0, pages: 0 }
    }
    const query: Record<string, string | number | undefined> = {}
    if (params.skip !== undefined) query.skip = params.skip
    if (params.limit !== undefined) query.limit = params.limit
    if (params.role) query.role = params.role
    if (params.status) query.status = params.status
    if (params.gender) query.gender = params.gender
    if (params.search) query.search = params.search
    if (params.sort) query.sort = params.sort
    return get<ClientListResponse>(`/centers/${params.centerId}/clients`, query)
  }
})

export const getClientDetail = () => ({
  key: ['getClientDetail'],
  request: async (params: { centerId: string; clientId: string }) => {
    if (!params?.centerId || !params?.clientId) {
      return {} as any
    }
    const response = await get<any>(
      `/centers/${params.centerId}/clients/${params.clientId}`
    )
    return response
  }
})

export interface DocumentType {
  created_at: Date
  document: {
    created_at: Date
    file_size: number
    file_type: string
    id: string
    name: string
    original_name: string | null
    storage_path: string
  }
  mapping_id: string
  resource_type: string //타입 확인필요
}

export interface ClientDocumentResponse {
  items: DocumentType[]
  total: number
}

export const getClientDocuments = () => ({
  key: ['getClientDocuments'],
  request: async (params: { centerId: string; clientId: string }) => {
    if (!params?.centerId || !params?.clientId) {
      return {} as any
    }
    const response = await get<ClientDocumentResponse>(
      `/centers/${params.centerId}/clients/${params.clientId}/documents`
    )
    return response
  }
})

export interface CreateGuardianRelationParams {
  centerId: string
  client_id: string
  related_client_id: string
  relation_type: 'guardian'
  relation_detail?: string | null
  is_primary?: boolean
}

export const putUpdateClient = () => ({
  key: ['putUpdateClient'],
  request: async (params: {
    centerId: string
    clientId: string
    payload: {
      name?: string
      birth_date?: string | null
      gender?: 'male' | 'female'
      phone?: string | null
      address?: string | null
      memo?: string | null
      profile_image_url?: string | null
    }
  }) => {
    const { centerId, clientId, payload } = params
    return put<any>(`/centers/${centerId}/clients/${clientId}`, payload)
  }
})

export const createGuardianRelation = () => ({
  key: ['createGuardianRelation'],
  request: async (params: CreateGuardianRelationParams) => {
    const { centerId, client_id, ...rest } = params
    return post(`/centers/${centerId}/clients/${client_id}/relations`, {
      relation_category: 'guardian',
      ...rest
    })
  }
})

/** 배치 수정 요청/응답 (내담자 + 보호자 동시 수정) */
export interface GuardianUpdateInput {
  client_id?: string | null
  name: string
  birth_date?: string | null
  gender?: 'male' | 'female' | null
  phone?: string | null
  email?: string | null
  address?: string | null
  relation_detail?: string | null
  is_primary: boolean
  memo?: string | null
}

export interface BatchUpdateClientRequest {
  client: {
    name?: string
    birth_date?: string | null
    gender?: 'male' | 'female'
    phone?: string | null
    email?: string | null
    address?: string | null
    memo?: string | null
  }
  guardians: GuardianUpdateInput[]
}

export interface BatchUpdateChangesSummary {
  guardians_added: number
  guardians_updated: number
  guardians_removed: number
}

export interface BatchUpdateClientResponse {
  client: any
  guardians: any[]
  changes: BatchUpdateChangesSummary
}

export const putBatchUpdateClient = () => ({
  key: ['putBatchUpdateClient'],
  request: async (params: {
    centerId: string
    clientId: string
    payload: BatchUpdateClientRequest
  }) => {
    const { centerId, clientId, payload } = params
    return put<BatchUpdateClientResponse>(
      `/centers/${centerId}/clients/${clientId}/with-relations`,
      payload
    )
  }
})

/** 관계 조회 응답 */
export interface RelationResponse {
  id: string
  relation_category: 'guardian' | 'sibling'
  center_id: string
  client_id: string
  related_client_id: string
  /** 상대 이름 — 단건 상세를 따로 부르지 않고 이것으로 표시한다 */
  related_client_name?: string | null
  relation_type?: string | null
  is_primary?: boolean | null
  relation_detail?: string | null
  created_at: string
}

export const getClientRelations = () => ({
  key: ['getClientRelations'],
  request: async (params: {
    centerId: string
    clientId: string
    relationCategory?: string
  }) => {
    if (!params?.centerId || !params?.clientId) return []
    const query: Record<string, string> = {}
    if (params.relationCategory)
      query.relation_category = params.relationCategory
    return get<RelationResponse[]>(
      `/centers/${params.centerId}/clients/${params.clientId}/relations`,
      query
    )
  }
})

export const postClientTransition = () => ({
  key: ['postClientTransition'],
  request: async (params: {
    centerId: string
    clientId: string
    status: ClientStatus | string
  }) => {
    const { centerId, clientId } = params
    // 호출부가 UI 표기(대문자 'ACTIVE')를 넘기는 경우가 있어 소문자로 정규화한다.
    // 정규화 없이 비교하면 활성화 요청이 deactivate로 떨어져 400(잘못된 상태 전이)이 난다.
    const status = String(params.status ?? '').toLowerCase()
    const verb =
      status === 'active'
        ? 'activate'
        : status === 'archived'
          ? 'archive'
          : 'deactivate'
    return post<any>(`/centers/${centerId}/clients/${clientId}/${verb}`, {})
  }
})

// 내담자 삭제 (soft delete — 백엔드가 deleted_at 설정, 목록에서 제외됨)
export const deleteClient = () => ({
  key: ['deleteClient'],
  request: async (params: { centerId: string; clientId: string }) => {
    const { centerId, clientId } = params
    return deleteResource<any>(`/centers/${centerId}/clients/${clientId}`)
  }
})

// ============ 중복 체크 (엑셀 일괄 등록 프리뷰용) ============

export interface DuplicateClientItem {
  name: string
  birth_date: string | null
  guardian_phone?: string | null
  guardian_birth_date?: string | null
}

export interface MatchedClientInfo {
  id: string
  name: string
  birth_date: string | null
  phone: string | null
  created_at: string
}

export interface DuplicateClientResult {
  index: number
  clientId: string // store의 client.id (삭제 후에도 추적용)
  duplicate_level: 'high' | 'low' | 'none'
  matched_client: MatchedClientInfo | null
}

export interface ValidateDuplicateClientsResponse {
  results: DuplicateClientResult[]
}

export const postValidateDuplicateClients = () => ({
  key: ['postValidateDuplicateClients'],
  request: async (params: {
    centerId: string
    clients: DuplicateClientItem[]
  }) => {
    const { centerId, clients } = params
    const response = await post<ValidateDuplicateClientsResponse>(
      `/centers/${centerId}/clients/validate-duplicates`,
      { clients }
    )
    return response
  }
})

// ============ 내담자 활동 지표 (상세 좌측 요약 대시보드) ============

/** 이번 달 세션 지표 (완료/예정 분해 + 지난달 대비) */
export interface ClientMonthlySessionMetric {
  completed: number
  scheduled: number
  total: number
  /** 지난 달 전체 세션 수 (증감 비교용) */
  prev_total: number
}

export interface ClientMetricsResponse {
  /** 참여 중인 상담 케이스 누적 수 */
  counseling_case_count: number
  /** 참여 중인 검사 케이스 누적 수 */
  assessment_case_count: number
  /** 이번 달(KST) 상담 세션 지표 */
  counseling: ClientMonthlySessionMetric
  /** 이번 달(KST) 검사 세션 지표 */
  assessment: ClientMonthlySessionMetric
}

const EMPTY_CLIENT_METRIC: ClientMonthlySessionMetric = {
  completed: 0,
  scheduled: 0,
  total: 0,
  prev_total: 0
}

export const getClientMetrics = (): Action<
  ClientMetricsResponse,
  ClientMetricsResponse
> => ({
  key: ['getClientMetrics'],
  request: async (params: {
    centerId: string | null | undefined
    clientId: string
  }): Promise<ClientMetricsResponse> => {
    if (!params.centerId || !params.clientId) {
      return {
        counseling_case_count: 0,
        assessment_case_count: 0,
        counseling: { ...EMPTY_CLIENT_METRIC },
        assessment: { ...EMPTY_CLIENT_METRIC }
      }
    }
    return get<ClientMetricsResponse>(
      `/centers/${params.centerId}/clients/${params.clientId}/metrics`
    )
  }
})

export interface DuplicateCheckItem {
  name: string
  birth_date: string | null
  guardian_phone?: string | null
  guardian_birth_date?: string | null
}

export interface MatchedClientInfo {
  id: string
  name: string
  birth_date: string | null
  phone: string | null
  created_at: string
}

export interface DuplicateCheckResult {
  index: number
  clientId: string // store의 client.id (삭제 후에도 추적용)
  duplicate_level: 'high' | 'low' | 'none'
  matched_client: MatchedClientInfo | null
}

export interface DuplicateCheckResponse {
  results: DuplicateCheckResult[]
}

export const postDuplicateCheck = () => ({
  key: ['postDuplicateCheck'],
  request: async (params: {
    centerId: string
    clients: DuplicateCheckItem[]
  }) => {
    const { centerId, clients } = params
    const response = await post<DuplicateCheckResponse>(
      `/centers/${centerId}/clients/validate-duplicates`,
      { clients }
    )
    return response
  }
})
