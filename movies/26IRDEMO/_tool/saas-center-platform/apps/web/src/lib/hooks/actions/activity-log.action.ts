/**
 * Activity Log Actions
 * 감사 로그(활동 로그) 관련 API action 함수
 */

import { get } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============ Types ============

export interface ActivityLogItem {
  id: string
  event_name: string
  center_id: string
  actor_id: string
  actor_name: string | null
  category: string
  action: string
  entity_type: string
  entity_id: string
  summary: string
  ip_address: string | null
  user_agent: string | null
  extra: Record<string, unknown> | null
  changes: ActivityLogChange[]
  created_at: string
}

export interface ActivityLogChange {
  id: string
  action: string
  entity_type: string
  entity_id: string
  summary: string
  extra: Record<string, unknown> | null
}

export interface ActivityLogListResponse {
  items: ActivityLogItem[]
  total: number
  page: number
  size: number
  pages: number
}

// ============ Params ============

export interface GetActivityLogsParams {
  centerId: string
  category?: string
  action?: string
  entity_type?: string
  date_from?: string
  date_to?: string
  page?: number
  size?: number
}

// ============ Actions ============

export const getActivityLogs = (): Action<ActivityLogListResponse, ActivityLogListResponse> => ({
  key: ['getActivityLogs'],
  request: async (params: GetActivityLogsParams): Promise<ActivityLogListResponse> => {
    if (!params.centerId) return { items: [], total: 0, page: 1, size: 20, pages: 0 }

    const query: Record<string, string | number> = {}
    if (params.category) query.category = params.category
    if (params.action) query.action = params.action
    if (params.entity_type) query.entity_type = params.entity_type
    if (params.date_from) query.date_from = params.date_from
    if (params.date_to) query.date_to = params.date_to
    if (params.page) query.page = params.page
    if (params.size) query.size = params.size

    return get<ActivityLogListResponse>(
      `/centers/${params.centerId}/activity-logs`,
      query,
    )
  },
})
