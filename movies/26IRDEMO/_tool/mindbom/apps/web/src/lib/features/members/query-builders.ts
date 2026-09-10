import { get } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type { MemberListResponse } from './types'

export function getMemberList(): Action<MemberListResponse, MemberListResponse> {
  return {
    key: ['getMemberList'],
    request: async (params?: {
      institutionId: string
      page?: number
      size?: number
      search?: string
      role?: string
    }) => {
      if (!params?.institutionId) {
        return { items: [], total: 0, page: 1, size: 20, pages: 1 }
      }
      const query = new URLSearchParams()
      if (params.page) query.set('page', String(params.page))
      if (params.size) query.set('size', String(params.size))
      if (params.search) query.set('search', params.search)
      if (params.role) query.set('role', params.role)

      const qs = query.toString()
      const url = `/institutions/${params.institutionId}/members${qs ? `?${qs}` : ''}`
      return await get<MemberListResponse>(url)
    }
  }
}
