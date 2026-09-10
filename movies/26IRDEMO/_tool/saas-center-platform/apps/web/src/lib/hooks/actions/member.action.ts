/**
 * Member Actions
 * 멤버(담당자) 관련 API action 함수들
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 */

import {
  get,
  post,
  patch,
  put,
  deleteResource
} from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============ List Types (MemberListSummary 매칭) ============

export interface PersonSummary {
  name: string
  phone: string | null
  gender?: string | null
  email: string | null
}

export interface MemberListItem {
  id: string
  role_code: string
  role_name: string
  employment_type: string
  color: string | null
  memo: string | null
  is_active: boolean
  person: PersonSummary
  /** 프로필 이미지 URL (업로드 사진 또는 기본 아바타) */
  profile_image_url?: string | null
  /** 인증된 전문가 여부 (백엔드 정책 판정) */
  is_certified?: boolean
  /** 센터 등록 시점 (ISO UTC) */
  created_at: string
}

export interface MemberListResponse {
  items: MemberListItem[]
  total: number
  page: number
  size: number
  pages: number
}

// ============ Detail Types (MemberDetailResponse 매칭) ============

export interface PersonDetail {
  id: string
  name: string
  phone: string | null
  gender: string | null
  birth: string | null
  email: string | null
}

export interface MemberDetailResponse {
  id: string
  center_id: string
  person_id: string
  role_code: string
  role_name: string
  permissions_version: number
  employment_type: string
  hire_date: string | null
  profile_image_url: string | null
  memo: string | null
  careers: string[] | null
  educations: string[] | null
  certifications: string[] | null
  is_certified?: boolean
  created_at: string
  updated_at: string
  person: PersonDetail
}

// ============ Update Types (MemberWithPersonUpdate 매칭) ============

export interface UpdateMemberParams {
  centerId: string
  memberId: string
  // Member 필드
  role_code?: string
  employment_type?: string
  hire_date?: string
  memo?: string
  profile_image_url?: string
  careers?: string[]
  educations?: string[]
  certifications?: string[]
  // Person 필드
  name?: string
  phone?: string
  gender?: string
  birth?: string
}

// ============ Query Params ============

export interface GetMemberListParams {
  centerId: string
  page?: number
  size?: number
  search?: string
  role_code?: string
}

export interface GetMemberDetailParams {
  centerId: string
  memberId: string
}

export interface DeleteMemberParams {
  centerId: string
  memberId: string
}

// ============ Working Time Types (members/{id}/working-times 매칭) ============

export type WorkingTimeWeekday =
  | 'MON'
  | 'TUE'
  | 'WED'
  | 'THU'
  | 'FRI'
  | 'SAT'
  | 'SUN'

export interface MemberWorkingTimeItem {
  id: string
  center_id: string
  member_id: string
  weekday: WorkingTimeWeekday
  start_time: string | null // "HH:MM" or "HH:MM:SS"
  end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  created_at: string
  updated_at: string
}

export interface MemberWorkingTimeCreateItem {
  weekday: WorkingTimeWeekday
  start_time: string | null
  end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
}

export interface GetMemberWorkingTimesParams {
  centerId: string
  memberId: string
}

export interface BulkUpdateMemberWorkingTimesParams {
  centerId: string
  memberId: string
  items: MemberWorkingTimeCreateItem[]
}

// ============ Invitation Types (members/invitations 매칭) ============

export interface InvitationItem {
  name: string
  email: string
  role_code: string
  employment_type: string // FULLTIME | CONTRACT | FREELANCER (required)
}

export interface InvitationBulkRequest {
  centerId: string
  items: InvitationItem[]
}

export interface InvitationBulkResponse {
  total: number
  success_count: number
  failure_count: number
  results: {
    email: string
    success: boolean
    error: string | null
  }[]
}

export interface InvitationSummary {
  id: string
  name: string
  email: string
  role_code: string
  role_name: string
  employment_type: string | null
  member_id: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface InvitationListResponse {
  items: InvitationSummary[]
  total: number
  page: number
  size: number
  pages: number
}

export interface GetInvitationListParams {
  centerId: string
  status?: string
  page?: number
  size?: number
}

// ============ getMeMember ============
// GET /api/proxy/centers/{center_id}/me/member (접수/렌더링용 최소: id, name)

export interface MeMemberResponse {
  id: string
  name: string
}

export const getMeMember = (): Action<MeMemberResponse, MeMemberResponse> => ({
  key: ['getMeMember'],
  request: async (params: { centerId: string }): Promise<MeMemberResponse> => {
    if (!params.centerId) {
      throw new Error('centerId가 필요합니다.')
    }
    return get<MeMemberResponse>(`/centers/${params.centerId}/me/member`)
  }
})

// ============ getMemberList ============
// GET /api/proxy/centers/{center_id}/members

export const getMemberList = (): Action<
  MemberListResponse,
  MemberListResponse
> => ({
  key: ['getMemberList'],
  request: async (params: GetMemberListParams): Promise<MemberListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 0, size: 0, pages: 0 }
    }
    const query: Record<string, string | number | undefined> = {}
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size
    if (params.search) query.search = params.search
    if (params.role_code !== undefined) query.role_code = params.role_code
    return get<MemberListResponse>(`/centers/${params.centerId}/members`, query)
  }
})

// ============ getMemberDetail ============
// GET /api/proxy/centers/{center_id}/members/{member_id}

export const getMemberDetail = (): Action<
  MemberDetailResponse,
  MemberDetailResponse
> => ({
  key: ['getMemberDetail'],
  request: async (
    params: GetMemberDetailParams
  ): Promise<MemberDetailResponse> => {
    if (!params.centerId || !params.memberId) {
      return {} as MemberDetailResponse
    }
    return get<MemberDetailResponse>(
      `/centers/${params.centerId}/members/${params.memberId}`
    )
  }
})

// ============ getMemberCredentials ============
// GET /api/proxy/centers/{center_id}/members/{member_id}/credentials

export interface MemberCredentialsLegacy {
  educations: string[]
  careers: string[]
  certifications: string[]
}

export interface MemberCredentialsResponse {
  structured: import('./credential.action').Credential[]
  legacy: MemberCredentialsLegacy
  is_self: boolean
}

export interface GetMemberCredentialsParams {
  centerId: string
  memberId: string
}

export const getMemberCredentials = (): Action<
  MemberCredentialsResponse,
  MemberCredentialsResponse
> => ({
  key: ['getMemberCredentials'],
  request: async (
    params: GetMemberCredentialsParams
  ): Promise<MemberCredentialsResponse> => {
    if (!params.centerId || !params.memberId) {
      return {
        structured: [],
        legacy: { educations: [], careers: [], certifications: [] },
        is_self: false
      }
    }
    return get<MemberCredentialsResponse>(
      `/centers/${params.centerId}/members/${params.memberId}/credentials`
    )
  }
})

// ============ getMemberMetrics ============
// GET /api/proxy/centers/{center_id}/members/{member_id}/metrics

/** 이번 달 세션 지표 (완료/예정 분해 + 지난달 대비) */
export interface MonthlySessionMetric {
  completed: number
  scheduled: number
  total: number
  /** 지난 달 전체 세션 수 (증감 비교용) */
  prev_total: number
}

export interface MemberMetricsResponse {
  /** 담당 케이스의 활성 내담자 수 (중복 제거) */
  assigned_clients_count: number
  /** 이번 달(KST) 상담 세션 지표 */
  counseling: MonthlySessionMetric
  /** 이번 달(KST) 검사 세션 지표 */
  assessment: MonthlySessionMetric
}

const EMPTY_METRIC: MonthlySessionMetric = {
  completed: 0,
  scheduled: 0,
  total: 0,
  prev_total: 0
}

export const getMemberMetrics = (): Action<
  MemberMetricsResponse,
  MemberMetricsResponse
> => ({
  key: ['getMemberMetrics'],
  request: async (
    params: GetMemberDetailParams
  ): Promise<MemberMetricsResponse> => {
    if (!params.centerId || !params.memberId) {
      return {
        assigned_clients_count: 0,
        counseling: { ...EMPTY_METRIC },
        assessment: { ...EMPTY_METRIC }
      }
    }
    return get<MemberMetricsResponse>(
      `/centers/${params.centerId}/members/${params.memberId}/metrics`
    )
  }
})

// ============ updateMember ============
// PATCH /api/proxy/centers/{center_id}/members/{member_id}

export const updateMember = () => ({
  key: ['updateMember', 'getMemberList', 'getMemberDetail'],
  request: async (
    params: UpdateMemberParams
  ): Promise<MemberDetailResponse> => {
    const { centerId, memberId, ...body } = params
    const res = await patch<MemberDetailResponse>(
      `/centers/${centerId}/members/${memberId}`,
      body
    )
    return (
      (res as { data?: MemberDetailResponse }).data ??
      (res as unknown as MemberDetailResponse)
    )
  }
})

// ============ updateMyMember ============
// PATCH /api/proxy/centers/{center_id}/me/member (본인 전용, admin 필드 없음)

export interface UpdateMyMemberParams {
  centerId: string
  name?: string
  phone?: string
  gender?: string
  birth?: string
  profile_image_url?: string
  careers?: string[]
  educations?: string[]
  certifications?: string[]
}

export const updateMyMember = () => ({
  key: ['updateMyMember', 'getMemberDetail'],
  request: async (
    params: UpdateMyMemberParams
  ): Promise<MemberDetailResponse> => {
    const { centerId, ...body } = params
    const res = await patch<MemberDetailResponse>(
      `/centers/${centerId}/me/member`,
      body
    )
    return (
      (res as { data?: MemberDetailResponse }).data ??
      (res as unknown as MemberDetailResponse)
    )
  }
})

// ============ deleteMember ============
// DELETE /api/proxy/centers/{center_id}/members/{member_id}

export const deleteMember = () => ({
  key: ['deleteMember', 'getMemberList'],
  request: async (params: DeleteMemberParams): Promise<void> => {
    await deleteResource(
      `/centers/${params.centerId}/members/${params.memberId}`
    )
  }
})

// ============ getMemberWorkingTimes ============
// GET /api/proxy/centers/{center_id}/members/{member_id}/working-times

export const getMemberWorkingTimes = (): Action<
  MemberWorkingTimeItem[],
  MemberWorkingTimeItem[]
> => ({
  key: ['getMemberWorkingTimes'],
  request: async (
    params: GetMemberWorkingTimesParams
  ): Promise<MemberWorkingTimeItem[]> => {
    if (!params.centerId || !params.memberId) {
      return []
    }
    return get<MemberWorkingTimeItem[]>(
      `/centers/${params.centerId}/members/${params.memberId}/working-times`
    )
  }
})

// ============ bulkUpdateMemberWorkingTimes ============
// PUT /api/proxy/centers/{center_id}/members/{member_id}/working-times

export const bulkUpdateMemberWorkingTimes = () => ({
  key: ['bulkUpdateMemberWorkingTimes', 'getMemberWorkingTimes'],
  request: async (
    params: BulkUpdateMemberWorkingTimesParams
  ): Promise<MemberWorkingTimeItem[]> => {
    const res = await put<MemberWorkingTimeItem[]>(
      `/centers/${params.centerId}/members/${params.memberId}/working-times`,
      { items: params.items }
    )
    return (
      (res as { data?: MemberWorkingTimeItem[] }).data ??
      (res as unknown as MemberWorkingTimeItem[])
    )
  }
})

// ============ getInvitationList ============
// GET /api/proxy/centers/{center_id}/members/invitations

export const getInvitationList = (): Action<
  InvitationListResponse,
  InvitationListResponse
> => ({
  key: ['getInvitationList'],
  request: async (
    params: GetInvitationListParams
  ): Promise<InvitationListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 0, size: 0, pages: 0 }
    }
    const query: Record<string, string | number | undefined> = {}
    if (params.status) query.status = params.status
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size
    return get<InvitationListResponse>(
      `/centers/${params.centerId}/members/invitations`,
      query
    )
  }
})

// ============ createMemberInvitation ============
// POST /api/proxy/centers/{center_id}/members/invitations (단일 초대 생성)

export interface CreateMemberInvitationParams {
  centerId: string
  name: string
  email: string
  role_code: string
  employment_type: string // FULLTIME | CONTRACT | FREELANCER
}

export interface MemberInvitationResponse {
  id: string
  center_id: string
  name: string
  email: string
  role_code: string
  role_name: string
  employment_type: string | null
  expires_at: string
  created_at: string
}

export const createMemberInvitation = () => ({
  key: ['createMemberInvitation', 'getInvitationList'],
  request: async (
    params: CreateMemberInvitationParams
  ): Promise<MemberInvitationResponse> => {
    const res = await post<MemberInvitationResponse>(
      `/centers/${params.centerId}/members/invitations`,
      {
        name: params.name,
        email: params.email,
        role_code: params.role_code,
        employment_type: params.employment_type
      }
    )
    return (
      (res as { data?: MemberInvitationResponse }).data ??
      (res as unknown as MemberInvitationResponse)
    )
  }
})

// ============ acceptMemberInvitation ============
// POST /api/proxy/centers/{center_id}/members/invitations/{invitation_id}/accept (JWT 필요)

export interface AcceptMemberInvitationParams {
  centerId: string
  invitationId: string
}

export const acceptMemberInvitation = () => ({
  key: ['acceptMemberInvitation', 'getMemberList', 'getInvitationList'],
  request: async (
    params: AcceptMemberInvitationParams
  ): Promise<MemberInvitationResponse> => {
    const res = await post<MemberInvitationResponse>(
      `/centers/${params.centerId}/members/invitations/${params.invitationId}/accept`,
      {}
    )
    return (
      (res as { data?: MemberInvitationResponse }).data ??
      (res as unknown as MemberInvitationResponse)
    )
  }
})

export const postActivateMember = () => ({
  key: ['postActivateMember'],
  request: async (params: { centerId: string; memberId: string }) => {
    const { centerId, memberId } = params
    return post<any>(`/centers/${centerId}/members/${memberId}/activate`)
  }
})

export const postDeactivateMember = () => ({
  key: ['postDeactivateMember'],
  request: async (params: { centerId: string; memberId: string }) => {
    const { centerId, memberId } = params
    return post<any>(`/centers/${centerId}/members/${memberId}/deactivate`)
  }
})
