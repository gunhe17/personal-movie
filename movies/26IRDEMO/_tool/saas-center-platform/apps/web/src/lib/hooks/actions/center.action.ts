/**
 * Center Actions
 * 센터 관련 API action 함수들
 *
 * SvelteKit 프록시 라우트를 통해 처리
 */

import {
  get,
  patch,
  put,
  post,
  deleteResource
} from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ─── 센터 목록 ───

export interface Center {
  id: string
  name: string
  code?: string
  logo_url?: string
  [key: string]: unknown
}

export interface CenterApplication {
  id: string
  name: string
  status: string
  created_at: string
}

export interface CentersResponse {
  centers: Center[]
  applications: CenterApplication[]
  total: number
  page: number
  size: number
  pages: number
}

export const getCenters = (): Action<CentersResponse, CentersResponse> => ({
  key: ['getCenters'],
  request: async (params?: {
    skip?: number
    limit?: number
  }): Promise<CentersResponse> => {
    const query: Record<string, number> = {}
    if (params?.skip !== undefined) query.skip = params.skip
    if (params?.limit !== undefined) query.limit = params.limit

    return get<CentersResponse>('/centers', query)
  }
})

// ─── 센터 등록 신청 ───

export interface CenterApplicationCreateParams {
  name: string
  phone?: string | null
  address?: AddressInfo | null
  description?: string | null
  business_registration_number?: string | null
  representative_name?: string | null
}

export const postCenterApplication = () => ({
  key: ['postCenterApplication'],
  request: async (params: CenterApplicationCreateParams) => {
    return await post<CenterApplication>('/centers/applications/', params)
  }
})

export interface CenterApplicationListResponse {
  items: CenterApplication[]
  total: number
  page: number
  size: number
  pages: number
}

export const getCenterApplications = () => ({
  key: ['getCenterApplications'],
  request: async (params?: {
    status_filter?: string
    skip?: number
    limit?: number
  }) => {
    return get<CenterApplicationListResponse>('/centers/applications/', params)
  }
})

export const approveCenterApplication = () => ({
  key: ['approveCenterApplication', 'getCenterApplications'],
  request: async (params: { applicationId: string }) => {
    return post<any>(`/centers/applications/${params.applicationId}/approve/`)
  }
})

// ─── 센터 상세 ───

export interface AddressInfo {
  zip_code: string | null
  address: string | null
  detail: string | null
}

export interface CenterDetailResponse {
  id: string
  name: string
  code: string
  phone: string | null
  address: AddressInfo | null
  description: string | null
  logo_url: string | null
  image_urls: string[] | null
  business_registration_number: string | null
  representative_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CenterUpdateParams {
  centerId: string
  name?: string
  phone?: string | null
  address?: AddressInfo | null
  description?: string | null
  logo_url?: string | null
  image_urls?: string[] | null
  business_registration_number?: string | null
  representative_name?: string | null
}

export const getCenterDetail = (): Action<
  CenterDetailResponse,
  CenterDetailResponse
> => ({
  key: ['getCenterDetail'],
  request: async (params: {
    centerId: string
  }): Promise<CenterDetailResponse> => {
    if (!params.centerId) return {} as CenterDetailResponse
    return get<CenterDetailResponse>(`/centers/${params.centerId}`)
  }
})

export const patchCenterDetail = () => ({
  key: ['patchCenterDetail', 'getCenterDetail'],
  request: async (params: CenterUpdateParams) => {
    const { centerId, ...body } = params
    return await patch<any>(`/centers/${centerId}`, body)
  }
})

// ─── 센터 탈퇴 ───

export interface LeaveCenterParams {
  centerId: string
}

export interface LeaveCenterResponse {
  message: string
}

// ============ deleteLeaveCenter ============
// DELETE /api/proxy/centers/{center_id}/members/me/leave (204 응답)

export const deleteLeaveCenter = () => ({
  key: ['deleteLeaveCenter', 'getMe', 'getCenters'],
  request: async (params: LeaveCenterParams): Promise<void> => {
    await deleteResource(`/centers/${params.centerId}/members/me/leave`)
  }
})

// ─── 영업시간 ───

export type WeekdayEnum = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export interface OperatingTimeSummary {
  id: string
  weekday: WeekdayEnum
  open_time: string | null
  close_time: string | null
  break_start_time: string | null
  break_end_time: string | null
}

export interface OperatingTimeCreateItem {
  weekday: WeekdayEnum
  open_time: string | null
  close_time: string | null
  break_start_time?: string | null
  break_end_time?: string | null
}

export const getOperatingTimes = (): Action<
  OperatingTimeSummary[],
  OperatingTimeSummary[]
> => ({
  key: ['getOperatingTimes'],
  request: async (params: {
    centerId: string
  }): Promise<OperatingTimeSummary[]> => {
    if (!params.centerId) return []
    return get<OperatingTimeSummary[]>(
      `/centers/${params.centerId}/operating-times/`
    )
  }
})

export const putOperatingTimes = () => ({
  key: ['putOperatingTimes', 'getOperatingTimes'],
  request: async (params: {
    centerId: string
    items: OperatingTimeCreateItem[]
  }) => {
    return await put<any>(`/centers/${params.centerId}/operating-times/`, {
      items: params.items
    })
  }
})

// ─── 비영업시간 (정기휴일) ───

export interface NonOperatingTimeResponse {
  id: string
  center_id: string
  year: number | null
  month: number | null
  day: number | null
  month_week: number | null
  weekday: WeekdayEnum | null
  start_time: string | null
  end_time: string | null
  effective_from: string
  effective_to: string | null
  reason: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface NonOperatingTimeCreateParams {
  centerId: string
  year?: number | null
  month?: number | null
  day?: number | null
  month_week?: number | null
  weekday?: WeekdayEnum | null
  start_time?: string | null
  end_time?: string | null
  effective_from?: string | null
  effective_to?: string | null
  reason: string
}

export const getNonOperatingTimes = (): Action<
  NonOperatingTimeResponse[],
  NonOperatingTimeResponse[]
> => ({
  key: ['getNonOperatingTimes'],
  request: async (params: {
    centerId: string
  }): Promise<NonOperatingTimeResponse[]> => {
    if (!params.centerId) return []
    return get<NonOperatingTimeResponse[]>(
      `/centers/${params.centerId}/non-operating-times/`,
      { active_only: true }
    )
  }
})

export const postNonOperatingTime = () => ({
  key: ['postNonOperatingTime', 'getNonOperatingTimes'],
  request: async (params: NonOperatingTimeCreateParams) => {
    const { centerId, ...body } = params
    return await post<any>(`/centers/${centerId}/non-operating-times/`, body)
  }
})

export const deleteNonOperatingTime = () => ({
  key: ['deleteNonOperatingTime', 'getNonOperatingTimes'],
  request: async (params: { centerId: string; nonOperatingTimeId: string }) => {
    return await deleteResource<any>(
      `/centers/${params.centerId}/non-operating-times/${params.nonOperatingTimeId}`
    )
  }
})
