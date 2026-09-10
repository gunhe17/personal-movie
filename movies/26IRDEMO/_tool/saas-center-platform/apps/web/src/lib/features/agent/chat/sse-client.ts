/**
 * SSE POST 클라이언트 — fetch + ReadableStream 기반.
 *
 * EventSource는 GET만 지원하므로 POST body를 보내려면
 * fetch → response.body.getReader() 방식을 사용한다.
 * SvelteKit 프록시를 경유하며 쿠키 인증을 포함한다.
 *
 * v3: URL에 conversationId를 포함하며 session_id body 필드를 제거.
 */

import type { SSEEvent } from './types'

export interface SSECallbacks {
  onEvent: (event: SSEEvent) => void
  onDone: () => void
  onError: (error: string) => void
}

/**
 * 에이전트 채팅 스트리밍 요청 (v3).
 *
 * @param centerId        센터 ID
 * @param conversationId  대화 ID (사전 생성 필수)
 * @param message         사용자 메시지
 * @param callbacks       SSE 이벤트 콜백
 * @param signal          취소용 AbortSignal (선택)
 */
export async function streamChat(
  centerId: string,
  conversationId: string,
  message: string,
  callbacks: SSECallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = `/api/proxy/centers/${centerId}/assistant/conversations/${conversationId}/stream`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message }),
      signal
    })
  } catch (err) {
    if (signal?.aborted) return
    callbacks.onError('서버에 연결할 수 없습니다.')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 429) {
      try { callbacks.onError(JSON.parse(text).detail) }
      catch { callbacks.onError('AI 크레딧이 부족합니다. 관리자에게 문의하거나 사용량을 확인해주세요.') }
    } else {
      callbacks.onError(`요청 실패 (${response.status}): ${text || '알 수 없는 오류'}`)
    }
    return
  }

  await readSSEStream(response, callbacks, signal)
}

/**
 * 대기 중인 대화에 사용자 입력을 스트리밍으로 전달 (v3).
 */
export async function streamResume(
  centerId: string,
  conversationId: string,
  input: { input: string | Record<string, unknown>; is_form: boolean; cancelled?: boolean },
  callbacks: SSECallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = `/api/proxy/centers/${centerId}/assistant/conversations/${conversationId}/resume`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
      signal
    })
  } catch (err) {
    if (signal?.aborted) return
    callbacks.onError('서버에 연결할 수 없습니다.')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 429) {
      try { callbacks.onError(JSON.parse(text).detail) }
      catch { callbacks.onError('AI 크레딧이 부족합니다. 관리자에게 문의하거나 사용량을 확인해주세요.') }
    } else {
      callbacks.onError(`요청 실패 (${response.status}): ${text || '알 수 없는 오류'}`)
    }
    return
  }

  await readSSEStream(response, callbacks, signal)
}

// ========== 내부 헬퍼 ==========

/**
 * ReadableStream에서 SSE 이벤트를 파싱하는 공통 로직.
 * data: prefix + [DONE] 시그널 패턴.
 */
async function readSSEStream(
  response: Response,
  callbacks: SSECallbacks,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError('스트림을 읽을 수 없습니다.')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 프로토콜: 이벤트는 빈 줄(\n\n)로 구분
      const parts = buffer.split('\n\n')
      // 마지막 요소는 아직 완성되지 않았을 수 있으므로 버퍼에 유지
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        // "data: " 접두사 제거
        for (const line of trimmed.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6) // "data: " 이후

          // 스트림 종료 시그널
          if (payload === '[DONE]') {
            callbacks.onDone()
            return
          }

          try {
            const event: SSEEvent = JSON.parse(payload)
            callbacks.onEvent(event)
            // 한 TCP 청크에 tool_result+다수 delta가 몰리면 동기 처리되어
            // 한 프레임에 표·답이 같이 그려진다. 이벤트 경계에서 paint 양보.
            if (
              event.type === 'step_tool_result' ||
              event.type === 'completion_delta'
            ) {
              await new Promise<void>((r) => requestAnimationFrame(() => r()))
            }
          } catch {
            // JSON 파싱 실패 — 무시 (불완전 데이터)
          }
        }
      }
    }

    // reader가 정상 종료되었지만 [DONE]을 받지 못한 경우
    callbacks.onDone()
  } catch (err) {
    if (signal?.aborted) return
    callbacks.onError('스트림 읽기 중 오류가 발생했습니다.')
  } finally {
    reader.releaseLock()
  }
}
