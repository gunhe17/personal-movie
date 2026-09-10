import { get } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type {
  DashboardStats,
  ExamListParams,
  ExamListResponse
} from './types'

export function getExamList(): Action<ExamListResponse, ExamListResponse> {
  return {
    key: ['getExamList'],
    request: async (params?: ExamListParams) => {
      if (!params?.institutionId) {
        return { items: [], total: 0, page: 1, size: 20, pages: 1 }
      }
      const query: Record<string, string | number> = {
        page: params.page ?? 1,
        size: params.size ?? 20
      }
      if (params.status) query.status = params.status
      if (params.exam_type) query.exam_type = params.exam_type
      if (params.client_id) query.client_id = params.client_id
      if (params.search) query.search = params.search

      return await get<ExamListResponse>(
        `/institutions/${params.institutionId}/examinations`,
        query
      )
    }
  }
}

