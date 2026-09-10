/**
 * Program Actions
 * 상담 프로그램 관련 API action 함수들
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 */

import { get, post, patch, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============================================================
// 타입 정의
// ============================================================

export type ProgramType = 'INDIVIDUAL' | 'GROUP'

export interface ProgramMemberSummary {
  member_id: string
  name: string
}

/** 목록 조회 시 아이템 */
export interface ProgramListItem {
  id: string
  name: string
  program_type: ProgramType
  price: number
  duration_minutes: number
  is_active: boolean
  members: ProgramMemberSummary[]
}

/** 프로그램 상세 (전체 필드) */
export interface ProgramDetail {
  id: string
  center_id: string
  name: string
  program_type: ProgramType
  description: string | null
  price: number
  duration_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 목록 조회 응답 */
export interface ProgramListResponse {
  items: ProgramListItem[]
  total: number
  page: number
  size: number
  pages: number
}

/** 목록 조회 파라미터 */
export interface GetProgramListParams {
  centerId: string
  page?: number
  size?: number
}

/** 프로그램 생성 파라미터 */
export interface CreateProgramParams {
  centerId: string
  name: string
  member_ids: string[]
  program_type: ProgramType
  description?: string | null
  price: number
  duration_minutes: number
}

/** 프로그램 수정 파라미터 */
export interface UpdateProgramParams {
  centerId: string
  programId: string
  name?: string
  program_type?: ProgramType
  description?: string | null
  duration_minutes?: number
  price?: number
  is_active?: boolean
  /** 전달 시 담당자 전체 교체 (빈 배열이면 전원 해제) */
  member_ids?: string[]
}

/** 프로그램 삭제 파라미터 */
export interface DeleteProgramParams {
  centerId: string
  programId: string
}

/** 프로그램 담당자 배정 파라미터 */
export interface AssignProgramMembersParams {
  centerId: string
  programId: string
  member_ids: string[]
}

/** 프로그램 담당자 해제 파라미터 */
export interface UnassignProgramMemberParams {
  centerId: string
  programId: string
  memberId: string
}

// ============================================================
// 상담 프로그램 목록 조회
// GET /api/proxy/centers/{center_id}/programs
// ============================================================

export const getProgramList = (): Action<ProgramListResponse, ProgramListResponse> => ({
  key: ['getProgramList'],
  request: async (
    params: GetProgramListParams
  ): Promise<ProgramListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0, page: 0, size: 0, pages: 0 }
    }

    const query: Record<string, number> = {}
    if (params.page !== undefined) query.page = params.page
    if (params.size !== undefined) query.size = params.size

    return get<ProgramListResponse>(
      `/centers/${params.centerId}/programs`,
      query
    )
  }
})

// ============================================================
// 상담 프로그램 생성
// POST /api/proxy/centers/{center_id}/programs
// ============================================================

export const createProgram = () => ({
  key: ['createProgram', 'getProgramList'],
  request: async (params: CreateProgramParams): Promise<ProgramDetail> => {
    const res = await post<ProgramDetail>(
      `/centers/${params.centerId}/programs`,
      {
        name: params.name,
        member_ids: params.member_ids,
        program_type: params.program_type,
        description: params.description ?? null,
        price: params.price,
        duration_minutes: params.duration_minutes
      }
    )
    return (res as { data?: ProgramDetail }).data ?? (res as unknown as ProgramDetail)
  }
})

// ============================================================
// 상담 프로그램 수정
// PATCH /api/proxy/centers/{center_id}/programs/{program_id}
// ============================================================

export const updateProgram = () => ({
  key: ['updateProgram', 'getProgramList'],
  request: async (params: UpdateProgramParams): Promise<ProgramDetail> => {
    const body: Record<string, unknown> = {}
    if (params.name !== undefined) body.name = params.name
    if (params.program_type !== undefined)
      body.program_type = params.program_type
    if (params.description !== undefined) body.description = params.description
    if (params.duration_minutes !== undefined)
      body.duration_minutes = params.duration_minutes
    if (params.price !== undefined) body.price = params.price
    if (params.is_active !== undefined) body.is_active = params.is_active
    if (params.member_ids !== undefined) body.member_ids = params.member_ids

    const res = await patch<ProgramDetail>(
      `/centers/${params.centerId}/programs/${params.programId}`,
      body
    )
    return (res as { data?: ProgramDetail }).data ?? (res as unknown as ProgramDetail)
  }
})

// ============================================================
// 상담 프로그램 삭제
// DELETE /api/proxy/centers/{center_id}/programs/{program_id}
// ============================================================

export const deleteProgram = () => ({
  key: ['deleteProgram', 'getProgramList'],
  request: async (params: DeleteProgramParams): Promise<void> => {
    await deleteResource(
      `/centers/${params.centerId}/programs/${params.programId}`
    )
  }
})

