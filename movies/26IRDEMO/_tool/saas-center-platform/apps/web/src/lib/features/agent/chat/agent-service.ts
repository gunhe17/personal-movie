/**
 * Agent Chat 서비스 — 채팅 비즈니스 로직 캡슐화 (v3 Pipeline).
 *
 * SSE 스트리밍, 대화 생성, 메시지 히스토리 로딩, resume 등
 * 모든 에이전트 채팅 동작을 캡슐화한다.
 * 글로벌 agentChatStore를 직접 사용한다.
 * centerId는 실행 시점에 requireCenterId()로 가져온다 (SSR 안전).
 */

import { replaceState } from '$app/navigation'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { agentChatStore } from '$lib/stores/agent.svelte'
import { mockAgent } from '$lib/features/agent-mock/store.svelte'
import type { QueryClient } from '@tanstack/svelte-query'
import { streamChat, streamResume } from './sse-client'
import {
  createAgentConversation,
  getAgentConversation,
  deleteAgentSession,
  patchAgentSession,
  type AgentInputPayload
} from '$lib/hooks/actions/agent.action'
import type { AgentSession } from './types'

export interface AgentServiceDeps {
  queryClient: QueryClient
}

export function createAgentService({ queryClient }: AgentServiceDeps) {
  const chat = agentChatStore

  const invalidateSessions = () =>
    queryClient.invalidateQueries({ queryKey: ['getAgentSessions'], exact: false })

  const invalidateCredit = () =>
    queryClient.invalidateQueries({ queryKey: ['getCreditBalance'], exact: false })

  let abortController: AbortController | null = null

  // ────────────────────────────────────────────
  // sendMessage — 2단계 흐름 (v3)
  // ────────────────────────────────────────────

  async function sendMessage(message: string) {
    const centerId = requireCenterId()

    chat.addUserMessage(message)
    chat.clearProgress()
    chat.waitingInput = null
    chat.isStreaming = true
    chat.beginTurn()

    abortController = new AbortController()

    try {
      // Step 1: 대화 없으면 생성
      let conversationId = chat.currentSessionId
      if (!conversationId) {
        const conv = await createAgentConversation().request({ centerId })
        conversationId = conv.id
        chat.currentSessionId = conversationId
        replaceState(`/agent/session/${conversationId}/conversation`, {})
      }

      // Step 2: stream
      // 촬영용 목이 켜져 있으면 서버 대신 스크립트를 재생한다 (mock-capture 스킬).
      // 같은 SSE 이벤트를 흘리므로 채팅 UI·page tool 배선은 실제 경로 그대로다.
      if (mockAgent.active) {
        await mockAgent.stream(
          (event) => chat.handleSSEEvent(event),
          () => {
            chat.isStreaming = false
            invalidateSessions()
          }
        )
        return
      }

      await streamChat(
        centerId,
        conversationId!,
        message,
        {
          onEvent: (event) => {
            chat.handleSSEEvent(event)
          },
          onDone: () => {
            chat.isStreaming = false
            invalidateSessions()
            invalidateCredit()
          },
          onError: (err) => {
            chat.isStreaming = false
            snackbarStore.error(err)
            invalidateCredit()
          }
        },
        abortController.signal
      )
    } catch (_e) {
      chat.isStreaming = false
    } finally {
      abortController = null
    }
  }

  // ────────────────────────────────────────────
  // sendInput — resume SSE (v3)
  // ────────────────────────────────────────────

  async function sendInput(input: AgentInputPayload) {
    const centerId = requireCenterId()
    const conversationId = chat.currentSessionId
    if (!conversationId) return

    chat.waitingInput = null

    if (input.message) {
      chat.addUserMessage(input.message, true)
    }

    chat.isStreaming = true
    chat.beginTurn()
    abortController = new AbortController()

    try {
      // 되물음 답변도 목이 이어받는다 — 시작(sendMessage)만 물리면 답변에서 서버로 새어나간다
      if (mockAgent.active) {
        await mockAgent.stream(
          (event) => chat.handleSSEEvent(event),
          () => {
            chat.isStreaming = false
            invalidateSessions()
          }
        )
        return
      }

      await streamResume(
        centerId,
        conversationId,
        {
          input: input.form_data ?? input.message ?? '',
          // is_form은 실제 dict 폼일 때만 (새 스택은 selection/text만 — form checkpoint 없음)
          is_form: !!input.form_data,
          // write_confirm 취소 = 구조화 플래그. gate 미실행·"취소했어요"로 종결
          cancelled: !!input.cancelled,
        },
        {
          onEvent: (event) => {
            chat.handleSSEEvent(event)
          },
          onDone: () => {
            chat.isStreaming = false
            invalidateSessions()
            invalidateCredit()
          },
          onError: (err) => {
            chat.isStreaming = false
            snackbarStore.error(err)
            invalidateCredit()
          }
        },
        abortController.signal
      )
    } catch (_e) {
      chat.isStreaming = false
    } finally {
      abortController = null
    }
  }

  // ────────────────────────────────────────────
  // loadSession — v3 (no turns)
  // ────────────────────────────────────────────

  async function loadSession(sessionId: string, _sessions?: AgentSession[]) {
    chat.startNewChat()
    try {
      const centerId = requireCenterId()

      // 상세(turns) 로딩 → events 재생으로 복원
      const detail = await getAgentConversation().request({ centerId, sessionId })
      chat.loadFromTurns(detail?.turns ?? [])

      chat.currentSessionId = sessionId
    } catch (e) {
      console.error('[loadSession] 대화 로딩 실패:', e)
      snackbarStore.error('대화를 불러올 수 없습니다.')
    }
  }

  // ────────────────────────────────────────────
  // 세션 삭제
  // ────────────────────────────────────────────

  async function renameSession(sessionId: string, title: string) {
    const t = title.trim()
    if (!t) return
    try {
      await patchAgentSession().request({
        centerId: requireCenterId(),
        sessionId,
        payload: { title: t }
      })
      invalidateSessions()
    } catch (_e) {
      snackbarStore.error('이름 변경에 실패했습니다.')
    }
  }

  async function removeSession(sessionId: string) {
    const centerId = requireCenterId()

    try {
      await deleteAgentSession().request({ centerId, sessionId })
      invalidateSessions()

      if (chat.currentSessionId === sessionId) {
        chat.startNewChat()
      }

      snackbarStore.success('세션이 삭제되었습니다.')
    } catch (_e) {
      snackbarStore.error('세션 삭제에 실패했습니다.')
    }
  }

  // ────────────────────────────────────────────
  // 유틸
  // ────────────────────────────────────────────

  function startNewChat() {
    cancelStream()
    chat.startNewChat()
  }

  function cancelStream() {
    if (abortController) {
      abortController.abort()
      abortController = null
      chat.isStreaming = false
    }
  }

  return {
    sendMessage,
    sendInput,
    loadSession,
    renameSession,
    removeSession,
    startNewChat,
    cancelStream,
  }
}
