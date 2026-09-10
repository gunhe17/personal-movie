/**
 * Page Tool Executor — SSE step_tool_call 이벤트 처리.
 *
 * page.navigate: 표준 SvelteKit `goto(path)` 한 줄로 이동.
 * 기타 page tool: registry에서 핸들러를 찾아 실행 (registry가 핸들러 등록 race를 폴링으로 흡수).
 *
 * 직렬 큐: page.navigate 완료 전 도착한 page tool 이벤트는 큐에 쌓이고,
 * navigate 완료 후 순서대로 실행된다.
 */

import { goto } from '$app/navigation'
import { agentChatStore } from '$lib/stores/agent.svelte'
import { pageToolRegistry, type PageToolResult } from './registry'

/** 직렬 실행 큐 — navigate 중 도착하는 후속 tool을 대기시킨다. */
let _queue: Promise<void> = Promise.resolve()

/**
 * SSE conversation_page_tool_call 이벤트를 처리한다.
 * agent-service의 onEvent 콜백에서 fire-and-forget으로 호출.
 *
 * 내부적으로 직렬 큐에 넣어 page.navigate가 끝난 뒤
 * page.set_fields 등이 실행되도록 보장한다.
 */
export async function handlePageToolCall(
  _sessionId: string,
  _requestId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  // 큐에 체이닝하여 직렬 실행 보장
  _queue = _queue.then(() => _executePageTool(toolName, args))
  await _queue
}

async function _executePageTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  if (toolName === 'page.navigate') {
    await executeNavigate(args)
  } else {
    await pageToolRegistry.execute(toolName, args)
  }
}

async function executeNavigate(args: Record<string, unknown>): Promise<PageToolResult> {
  let path = args.path as string
  if (!path) return { result: 'path가 필요합니다.', is_error: true }
  // 절대 경로 보장 (LLM이 슬래시 없이 보낼 수 있음)
  if (!path.startsWith('/')) path = '/' + path

  // 이전 페이지 page tool 핸들러 해제 (충돌 방지)
  pageToolRegistry.unregisterAll()

  // Agent navigate 신호 — 도착 페이지의 모달/form 에 ShineBorder 효과 적용
  agentChatStore.agentNavigateActive = true
  // afterNavigate 가 이 navigate 자체를 deactivation 트리거로 잡지 않도록 1회 skip 예약
  agentChatStore.skipNavCount = agentChatStore.skipNavCount + 1

  try {
    await goto(path)
    return { result: JSON.stringify({ navigated: path }), is_error: false }
  } catch (e) {
    // 실패 시 효과 즉시 끔 + skip 예약 롤백
    agentChatStore.agentNavigateActive = false
    agentChatStore.skipNavCount = Math.max(0, agentChatStore.skipNavCount - 1)
    return { result: `페이지 이동 실패: ${(e as Error).message}`, is_error: true }
  }
}
