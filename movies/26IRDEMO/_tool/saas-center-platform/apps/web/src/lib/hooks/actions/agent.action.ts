/**
 * Agent API 액션 (v3)
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨.
 * SSE 스트리밍은 별도 sse-client.ts에서 처리하므로 여기에 포함하지 않음.
 *
 * v3 변경: URL 경로 agents/conversations → agent/conversations
 */

import type { AgentSession, AssistantConversationDetail } from '$lib/features/agent/chat/types'
import { get, postRaw, patch, deleteResource } from '$lib/services/api/instances'

// ========== 대화 생성 POST /centers/{center_id}/assistant/conversations ==========

export const createAgentConversation = () => ({
  key: ['createAgentConversation'],
  request: async (request: { centerId: string }) => {
    return postRaw<AgentSession>(
      `/centers/${request.centerId}/assistant/conversations`,
      {}
    )
  }
})

// ========== 세션 목록 GET /centers/{center_id}/assistant/conversations ==========

export type AgentSessionListResponse = {
  items: AgentSession[]
  total: number
  page: number
  size: number
  pages: number
}

export const getAgentSessions = () => ({
  key: ['getAgentSessions'],
  request: async (request: {
    centerId: string | null | undefined
    page?: number
    pageSize?: number
  }): Promise<AgentSessionListResponse> => {
    if (!request.centerId) {
      return { items: [], total: 0, page: 1, size: 0, pages: 0 }
    }
    const query: Record<string, string | number> = {}
    if (request.page != null) query.page = request.page
    if (request.pageSize != null) query.page_size = request.pageSize
    return get<AgentSessionListResponse>(
      `/centers/${request.centerId}/assistant/conversations`,
      query
    )
  }
})

// ========== 대화 상세(복원) GET /centers/{center_id}/assistant/conversations/{conversation_id} ==========

export const getAgentConversation = () => ({
  key: ['getAgentConversation'],
  request: async (request: {
    centerId: string | null | undefined
    sessionId: string
  }): Promise<AssistantConversationDetail | null> => {
    if (!request.centerId) {
      return null
    }
    return get<AssistantConversationDetail>(
      `/centers/${request.centerId}/assistant/conversations/${request.sessionId}`
    )
  }
})

// ========== 사용자 입력 전달 (resume) ==========

export interface AgentInputPayload {
  message?: string | null
  form_data?: Record<string, unknown> | null
  is_selection?: boolean
  cancelled?: boolean
}

// ========== 세션 제목 수정 PATCH /centers/{center_id}/assistant/conversations/{session_id} ==========

export const patchAgentSession = () => ({
  key: ['patchAgentSession', 'getAgentSessions'],
  request: async (request: {
    centerId: string | null | undefined
    sessionId: string
    payload: { title: string }
  }) => {
    if (!request.centerId) {
      return null as unknown as AgentSession
    }
    const res = await patch<AgentSession>(
      `/centers/${request.centerId}/assistant/conversations/${request.sessionId}`,
      request.payload
    )
    return (res as { data?: AgentSession }).data ?? (res as unknown as AgentSession)
  }
})

// ========== 토큰 사용량 GET /centers/{center_id}/assistant/conversations/{conversation_id}/tokens ==========

export interface AgentTokenUsage {
  calls: number
  input_tokens: number
  output_tokens: number
}

export const getAgentConversationTokens = () => ({
  key: ['getAgentConversationTokens'],
  request: async (request: {
    centerId: string
    conversationId: string
  }): Promise<AgentTokenUsage | null> => {
    if (!request.centerId || !request.conversationId) return null
    return get<AgentTokenUsage>(
      `/centers/${request.centerId}/assistant/conversations/${request.conversationId}/tokens`
    )
  }
})

// ========== 세션 삭제 DELETE /centers/{center_id}/assistant/conversations/{session_id} ==========

export const deleteAgentSession = () => ({
  key: ['deleteAgentSession', 'getAgentSessions'],
  request: async (request: {
    centerId: string | null | undefined
    sessionId: string
  }) => {
    if (!request.centerId) {
      return null
    }
    const res = await deleteResource<void>(
      `/centers/${request.centerId}/assistant/conversations/${request.sessionId}`
    )
    return res
  }
})
