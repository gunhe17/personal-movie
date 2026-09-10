/**
 * Agent Chat 글로벌 Store — 페이지 이동에도 상태가 유지되는 싱글턴.
 *
 * 메시지 목록, 스트리밍 상태, 세션 ID, 입력 대기(checkpoint), Tool 결과를 반응형 관리.
 * navigate 후에도 SSE 이벤트 처리가 계속된다.
 */

import type {
  ChatMessage,
  SSEEvent,
  ViewProgress,
  WaitingInput,
  AssistantTurnRecord
} from '$lib/features/agent/chat/types'
import { extractCheckpointWaiting } from '$lib/features/agent/chat/view-model'
import { handlePageToolCall } from '$lib/features/agent/page-tools'
import { randomId } from '$lib/utils/generator'

function createAgentChatStore() {
  let messages = $state<ChatMessage[]>([])
  let viewProgress = $state<ViewProgress | null>(null)
  let isStreaming = $state(false)
  let currentSessionId = $state<string | null>(null)
  let waitingInput = $state<WaitingInput | null>(null)
  let streamingMessageId = $state<string | null>(null)
  let isAgentControlling = $state(false)
  let floatingPosition = $state<{ x: number; y: number } | null>(null)
  // agent navigate 직후 모달/form에 ShineBorder 효과를 적용하기 위한 활성화 플래그.
  // 사용자가 모달을 닫거나 다른 페이지로 이동하면 false 로 복귀.
  let agentNavigateActive = $state(false)
  // afterNavigate 가 agent 자신의 navigate 를 deactivation 트리거로 잡지 않도록
  // 1회씩 skip 하기 위한 카운터. executor 가 increment, layout 의 afterNavigate 가 consume.
  let skipNavCount = $state(0)
  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  // prefill page tool은 즉시 실행하지 않고 큐잉 — 답변 스트림을 다 보여준 뒤 이동 (flush는 conversation_done)
  let pendingPageTools: { tool: string; args: Record<string, unknown> }[] = []
  let pageToolTimer: ReturnType<typeof setTimeout> | null = null
  // 리빌이 끝나기를 기다리는 page tool — 마지막 글자에서 startPageToolTimer() 가 집어간다
  let flushPending: { tool: string; args: Record<string, unknown> }[] | null = null
  // 히스토리 일괄 마운트 직후 1프레임 — 메시지 등장 모션 억제
  let suppressEnterMotion = $state(false)
  // 타자기 리빌 — 도착 속도와 무관하게 흘려보낸다. done 이후에도 남은 글자는 같은 가속 곡선으로 계속 흘림.
  let revealTimer: ReturnType<typeof setTimeout> | null = null
  let revealTarget = ''
  let revealShown = 0
  let revealMsgId = $state<string | null>(null)

  // 답변의 **마지막 글자가 떨어진 순간부터** 이만큼 두고 이동한다.
  // conversation_done 기준이 아니다 — 리빌(타자기)은 스트림보다 느릴 수 있어서,
  // done에서 재면 글자가 아직 흐르는 중에 화면이 갈아끼워진다.
  const PAGE_TOOL_DELAY_MS = 1000
  const REVEAL_START_MS = 30   // 첫 REVEAL_RAMP_CHARS 자까지 글자당 지연
  const REVEAL_MIN_MS = 4      // 가속 후 도달하는 최소 지연(바닥)
  const REVEAL_RAMP_CHARS = 20 // 이 글자 수까지는 REVEAL_START_MS 고정
  const REVEAL_RAMP_SPAN = 30  // 이후 이만큼 진행하며 REVEAL_MIN_MS까지 선형 가속

  function revealDelay(pos: number): number {
    if (pos < REVEAL_RAMP_CHARS) return REVEAL_START_MS
    const t = Math.min(1, (pos - REVEAL_RAMP_CHARS) / REVEAL_RAMP_SPAN)
    return REVEAL_START_MS - t * (REVEAL_START_MS - REVEAL_MIN_MS)
  }

  /** 리빌이 끝난 뒤 PAGE_TOOL_DELAY_MS 를 세고 page tool 을 실행한다 */
  function startPageToolTimer() {
    const calls = flushPending
    if (!calls) return
    flushPending = null
    if (pageToolTimer) clearTimeout(pageToolTimer)
    pageToolTimer = setTimeout(() => {
      pageToolTimer = null
      for (const c of calls) {
        void handlePageToolCall(currentSessionId ?? '', '', c.tool, c.args)
      }
    }, PAGE_TOOL_DELAY_MS)
  }

  function flushPageToolsSoon() {
    if (pendingPageTools.length === 0) return
    flushPending = pendingPageTools
    pendingPageTools = []
    // 글자가 아직 흐르는 중이면 여기서 세지 않는다 — 마지막 글자를 뿌린 scheduleReveal 이 건다.
    // 남은 시간을 추정해서 더하면 실제 리빌 종료와 어긋난다(실측 0.5 설정에 0.69초).
    if (revealShown >= revealTarget.length) startPageToolTimer()
  }

  // ────────────────────────────────────────────
  // 메시지 조작
  // ────────────────────────────────────────────

  function addUserMessage(content: string, isAnswer: boolean = false) {
    if (isAnswer && streamingMessageId) {
      // checkpoint 답변 -> 현재 에이전트 메시지에 answer 세그먼트 추가
      messages = messages.map((m) => {
        if (m.id !== streamingMessageId) return m
        const segments = [...(m.segments ?? [])]
        segments.push({ type: 'answer' as const, content, time: new Date().toISOString() })
        return { ...m, segments }
      })
      return
    }
    messages = [
      ...messages,
      {
        id: randomId(),
        role: 'user' as const,
        content,
        time: new Date().toISOString(),
      }
    ]
  }

  // 진행 표시 한 줄 — 텍스트만 시간 단위로 교체해 처리되는 느낌을 준다 (사용자 디자인 결정).
  // 마지막 라벨에 도달하면 유지. done/error/새 채팅에서 정지
  const WORKING_LABELS = [
    '요청을 이해하는 중',
    '사고하는 중',
    '자료를 확인하는 중',
    '처리하는 중',
    '정리하는 중'
  ]
  let workingLabel = $state('')
  let workingTimer: ReturnType<typeof setInterval> | null = null

  function beginTurn() {
    let i = 0
    workingLabel = WORKING_LABELS[0]
    if (workingTimer) clearInterval(workingTimer)
    workingTimer = setInterval(() => {
      i = Math.min(i + 1, WORKING_LABELS.length - 1)
      workingLabel = WORKING_LABELS[i]
    }, 2500)
  }

  function stopWorking() {
    if (workingTimer) {
      clearInterval(workingTimer)
      workingTimer = null
    }
    workingLabel = ''
  }

  function addAssistantMessage(content: string | undefined | null) {
    if (!content) return
    messages = [
      ...messages,
      {
        id: randomId(),
        role: 'assistant',
        content,
        time: new Date().toISOString()
      }
    ]
  }

  // ────────────────────────────────────────────
  // 타자기 리빌 — completion_delta 도착 속도와 별개로 REVEAL_MS 간격으로 흘려보낸다.
  // conversation_done 도착 시에도 멈추지 않고 남은 글자를 같은 속도로 마저 흘림.
  // ────────────────────────────────────────────

  function syncReveal() {
    const id = revealMsgId
    if (!id) return
    const shown = revealTarget.slice(0, revealShown)
    messages = messages.map((m) => (m.id === id ? { ...m, content: shown } : m))
  }

  function scheduleReveal() {
    if (revealTimer) return
    revealTimer = setTimeout(() => {
      revealTimer = null
      if (revealShown >= revealTarget.length) return
      revealShown += 1
      syncReveal()
      if (revealShown < revealTarget.length) scheduleReveal()
      else startPageToolTimer()          // 마지막 글자가 떨어졌다 — 여기서부터 센다
    }, revealDelay(revealShown))
  }

  function growReveal(id: string, fullText: string) {
    if (revealMsgId !== id) {
      revealMsgId = id
      revealShown = 0
    }
    revealTarget = fullText
    if (revealShown > revealTarget.length) revealShown = revealTarget.length
    syncReveal()
    if (revealShown < revealTarget.length) scheduleReveal()
  }

  function stopReveal() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null }
    revealMsgId = null
    revealTarget = ''
    revealShown = 0
  }

  // ────────────────────────────────────────────
  // v3 SSE 이벤트 처리
  // ────────────────────────────────────────────

  function handleSSEEvent(event: SSEEvent) {
    switch (event.type) {
      case 'progress':
        if (event.message) viewProgress = { message: event.message }
        break

      case 'completion_delta': {
        // 답 도착 자체는 즉시 반영하되, 화면엔 growReveal이 REVEAL_MS 간격으로 타자기처럼 흘려보낸다.
        const delta = event.text ?? ''
        if (!delta) break
        viewProgress = null
        stopWorking()
        if (!streamingMessageId) {
          const id = randomId()
          streamingMessageId = id
          messages = [
            ...messages,
            { id, role: 'assistant' as const, content: '', time: new Date().toISOString() }
          ]
          growReveal(id, delta)
          break
        }
        growReveal(streamingMessageId, revealTarget + delta)
        break
      }

      case 'step_tool_call':
        if (typeof event.tool === 'string' && event.tool.startsWith('page.')) {
          pendingPageTools.push({ tool: event.tool, args: event.args ?? {} })
        }
        break

      // 백엔드 영속용 초안 텍스트 — UI 작업 과정 SSOT는 중간 hop 표(markProcessLookups)
      case 'process_text':
        break

      case 'step_tool_result': {
        viewProgress = null
        // 렌더 조건: output이 있고 display가 none 아님
        const renderable = event.output != null && event.display !== 'none'
        if (!renderable) break
        // 빈 결과 테이블은 skip — 답은 completion 텍스트로
        if (Array.isArray(event.output) && event.output.length === 0 && !event.is_error) break
        // 응답 생성 과정: 모든 hop 표를 본문에 즉시 표시 (inProcess=false).
        // 전 hop 종료+응답 확정 시에만 markProcessLookups가 이전 hop을 과정으로 접는다.
        const toolMsgId = randomId()
        messages = [
          ...messages,
          {
            id: toolMsgId,
            role: 'assistant' as const,
            content: '',
            time: new Date().toISOString(),
            toolResult: {
              tool: event.tool ?? 'unknown',
              display: event.display ?? 'table',
              output: event.output,
              isError: event.is_error,
              hop: typeof event.hop === 'number' ? event.hop : null,
              inProcess: false,
              // 스트림 중 최초 1회 appear — done 시 false로 막아 결과 표 remount appear 방지
              playEnter: true,
              truncated: (event as { truncated?: boolean }).truncated === true,
              limit: (() => {
                const l = (event as { limit?: unknown }).limit
                return typeof l === 'number' ? l : null
              })(),
            },
          },
        ]
        break
      }

      case 'checkpoint_waiting':
        viewProgress = null
        waitingInput = extractCheckpointWaiting(event)

        // question을 에이전트 메시지에 세그먼트로 추가
        if (waitingInput.question) {
          if (!streamingMessageId) {
            const id = randomId()
            streamingMessageId = id
            messages = [
              ...messages,
              { id, role: 'assistant' as const, content: '', time: new Date().toISOString() }
            ]
          }
          messages = messages.map((m) => {
            if (m.id !== streamingMessageId) return m
            const segments = [...(m.segments ?? [])]
            segments.push({
              type: 'question' as const,
              content: waitingInput!.question,
              time: new Date().toISOString()
            })
            return { ...m, segments }
          })
        }
        break

      case 'conversation_done': {
        // 1) 최종 답 확정  2) 응답 이전 hop만 작업 과정으로  3) 레이아웃 정렬
        applyFinalAnswer(event.message)
        markProcessLookups()
        reorderTurnAfterDone()
        setDone()
        flushPageToolsSoon()
        break
      }

      case 'conversation_error': {
        // 백엔드가 category별 user-friendly 메시지 전달 시 그대로 사용, 없으면 기본 안내문.
        if (event.message) {
          console.warn('[agent] conversation_error:', event.message)
        }
        const _errorMsg = (typeof event.message === 'string' && event.message)
          ? event.message
          : '일시적으로 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
        addAssistantMessage(_errorMsg)
        setDone()
        pendingPageTools = []
        break
      }
    }
  }

  // ────────────────────────────────────────────
  // 스트리밍 종료
  // ────────────────────────────────────────────

  function setDone() {
    stopWorking()
    streamingMessageId = null
    viewProgress = null

    // 스트림 종료 — 마지막 메시지에만 시각 표시 (턴당 하나)
    if (messages.length > 0) {
      const lastIdx = messages.length - 1
      messages = messages.map((m, i) => (i === lastIdx ? { ...m, showTime: true } : m))
    }

    // 완료 후 30초 뒤 자동 숨김 (사용자가 결과 확인할 시간)
    if (dismissTimer) clearTimeout(dismissTimer)
    dismissTimer = setTimeout(() => {
      isAgentControlling = false
      dismissTimer = null
    }, 30_000)
  }

  // ────────────────────────────────────────────
  // 히스토리 로딩 — 새 스택 복원 — turns[].events를 라이브 SSE와 같은 핸들러로 재생 (agent-flow.md)
  function loadFromTurns(turns: AssistantTurnRecord[]) {
    suppressEnterMotion = true
    try {
      messages = []
      waitingInput = null
      viewProgress = null
      streamingMessageId = null

      for (const turn of turns) {
        streamingMessageId = null // 턴 경계 — 다음 completion이 이전 버블에 안 붙게
        addUserMessage(turn.user_message)
        for (const ev of turn.events ?? []) {
          // prefill(step_tool_call) 재생 = 현재 페이지 하이재킹 → 복원에선 skip
          if (ev?.type === 'step_tool_call') continue
          handleSSEEvent(ev)
        }
        // events엔 completion_delta(일시적)·conversation_done(=completion 컬럼)이 없다 → completion으로 최종답
        if (turn.completion) {
          handleSSEEvent({ type: 'conversation_done', message: turn.completion })
        }
      }

      // 마지막 턴이 paused면 재생된 checkpoint의 waitingInput 유지, 아니면 해제
      const last = turns[turns.length - 1]
      if (!last || last.status !== 'paused') waitingInput = null
      viewProgress = null
      streamingMessageId = null
    } finally {
      // 마운트 페인트 이후에만 enter 모션 재개 — 복원 일괄 등장 애니 스킵
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          suppressEnterMotion = false
        })
      })
    }
  }

  // ────────────────────────────────────────────
  // 세션 관리
  // ────────────────────────────────────────────

  function startNewChat() {
    messages = []
    viewProgress = null
    streamingMessageId = null
    isStreaming = false
    currentSessionId = null
    waitingInput = null
    isAgentControlling = false
    agentNavigateActive = false
    skipNavCount = 0
    suppressEnterMotion = false
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
    pendingPageTools = []
    if (pageToolTimer) { clearTimeout(pageToolTimer); pageToolTimer = null }
    flushPending = null
    stopWorking()
    stopReveal()
  }

  function clearProgress() {
    viewProgress = null
  }

  /** conversation_done — 스트림 초안을 최종 답으로 교체 (또는 답 메시지 추가) */
  function applyFinalAnswer(finalMessage: string | undefined) {
    const finalText = finalMessage?.trim() ? finalMessage : undefined
    if (!finalText) return

    const hasStream =
      streamingMessageId != null && messages.some((m) => m.id === streamingMessageId)
    if (hasStream) {
      const id = streamingMessageId as string
      messages = messages.map((m) =>
        m.id === id
          ? {
              ...m,
              processHeader: undefined,
              processText: undefined,
              processTools: undefined,
              processOpen: undefined,
              processClosing: undefined,
            }
          : m
      )
      // 새니타이즈된 최종 텍스트로 타깃 교체 — 이미 보여준 만큼은 유지하고 나머지만 계속 흘림
      growReveal(id, finalText)
      return
    }
    addAssistantMessage(finalText)
  }

  /**
   * 응답 확정 시 한 번에 정리 (타이머/다단계 모션 없음).
   *
   * 흐름:
   *  생성 중 — 모든 hop 표 본문 표시
   *  완료 — hop < max → 작업 과정(접힘) / max hop → 본문 결과 / playEnter 끄기
   */
  function markProcessLookups() {
    const lastUserIdx = messages.findLastIndex((m) => m.role === 'user')
    const hops = messages
      .filter((m, i) => i > lastUserIdx && m.toolResult && typeof m.toolResult.hop === 'number')
      .map((m) => m.toolResult!.hop as number)
    const maxHop = hops.length ? Math.max(...hops) : null

    messages = messages.map((m, i) => {
      if (i <= lastUserIdx || !m.toolResult) return m
      const hop = m.toolResult.hop
      const inProcess = typeof hop === 'number' && maxHop !== null && hop < maxHop
      const tr = m.toolResult
      if (tr.inProcess === inProcess && tr.playEnter === false) return m
      return { ...m, toolResult: { ...tr, inProcess, playEnter: false } }
    })

    const processTools = messages
      .filter((m, i) => i > lastUserIdx && m.toolResult?.inProcess)
      .map((m) => m.toolResult!)

    if (processTools.length === 0) {
      messages = messages.filter((m, i) => i <= lastUserIdx || !m.processHeader)
      return
    }

    const processIdx = messages.findIndex((m, i) => i > lastUserIdx && m.processHeader)
    if (processIdx < 0) {
      messages = [
        ...messages.slice(0, lastUserIdx + 1),
        {
          id: randomId(),
          role: 'assistant' as const,
          content: '',
          time: new Date().toISOString(),
          processHeader: true,
          // 항상 접힘 — 펼침/자동접기 시퀀스 없음 (표 이중 렌더 방지)
          processOpen: false,
          processTools,
        },
        ...messages.slice(lastUserIdx + 1),
      ]
      return
    }

    messages = messages.map((m, i) =>
      i === processIdx
        ? {
            ...m,
            processTools,
            processText: undefined,
            processOpen: false,
            processClosing: undefined,
          }
        : m
    )
  }

  /** 작업 과정 → 결과 표 → 최종 답. id 순서 동일하면 skip */
  function reorderTurnAfterDone() {
    const lastUserIdx = messages.findLastIndex((m) => m.role === 'user')
    if (lastUserIdx < 0) return
    const head = messages.slice(0, lastUserIdx + 1)
    const turn = messages.slice(lastUserIdx + 1)
    const next = [
      ...head,
      ...turn.filter((m) => m.processHeader),
      ...turn.filter((m) => m.toolResult),
      ...turn.filter((m) => !m.processHeader && !m.toolResult),
    ]
    if (
      next.length === messages.length &&
      next.every((m, i) => m.id === messages[i]?.id)
    ) {
      return
    }
    messages = next
  }

  return {
    get messages() { return messages },
    get isStreaming() { return isStreaming },
    get currentSessionId() { return currentSessionId },
    get waitingInput() { return waitingInput },
    get viewProgress() { return viewProgress },
    get isAgentControlling() { return isAgentControlling },
    get floatingPosition() { return floatingPosition },
    get agentNavigateActive() { return agentNavigateActive },
    get skipNavCount() { return skipNavCount },
    get workingLabel() { return workingLabel },
    /** 새 메시지/표 등장 모션 허용 (히스토리 일괄 복원 직후만 false) */
    get enterMotion() { return !suppressEnterMotion },
    /** 라이브 타이핑 중인 assistant 메시지 id — 커서 표시용 */
    get streamingMessageId() { return streamingMessageId },
    /** 타자기 리빌이 진행 중인 메시지 id — done 이후 잔여 리빌 동안에도 유지(커서·오토스크롤용) */
    get typingMessageId() { return revealMsgId },
    get streamingText() {
      // 라이브 답은 content 말풍선에 직접 표시 — 작업과정 접기용 텍스트는 processText만
      const m = messages.find((x) => x.id === streamingMessageId)
      return m?.processText ?? ''
    },

    set isStreaming(v: boolean) { isStreaming = v },
    set currentSessionId(v: string | null) { currentSessionId = v },
    set waitingInput(v: WaitingInput | null) { waitingInput = v },
    set isAgentControlling(v: boolean) { isAgentControlling = v },
    set floatingPosition(v: { x: number; y: number } | null) { floatingPosition = v },
    set agentNavigateActive(v: boolean) { agentNavigateActive = v },
    set skipNavCount(v: number) { skipNavCount = v },

    addUserMessage,
    addAssistantMessage,
    beginTurn,
    handleSSEEvent,
    setDone,
    loadFromTurns,
    startNewChat,
    clearProgress
  }
}

export const agentChatStore = createAgentChatStore()
