/**
 * 영상 촬영용 목(mock) 에이전트 스토어 — 페이지 이동에도 살아남는 싱글턴.
 *
 * 화면에 아무것도 그리지 않는다. 정해진 순서대로 실제 page tool을 쏘기만 한다 —
 * 경로는 제품과 동일한 handlePageToolCall(page.navigate → registry → form-tools)이라
 * 촬영본에 찍히는 화면 동작은 진짜다. 대사·채팅 UI는 여기 없다(촬영 프레임에서 제외).
 *
 * 상태는 sessionStorage에 실어 navigate로 컴포넌트가 갈려도 이어진다.
 */

import { browser } from '$app/environment'
import { handlePageToolCall } from '$lib/features/agent/page-tools'
import type { SSEEvent } from '$lib/features/agent/chat/types'

const KEY = 'agent-mock:v2'

export interface MockToolCall {
  /** page.navigate · page.set_fields · page.submit 등 — 실제 page tool 이름 */
  name: string
  /** 그 도구에 그대로 넘길 인자. prefill 값도 여기서 우리가 정한다 */
  args: Record<string, unknown>
  /** 이 도구를 쏘기 전 대기(ms) — 화면 전환과 입력 사이의 호흡 */
  delayMs?: number
}

export interface MockTurn {
  /** 이 턴이 무엇인지 — 편집기·조작용 라벨. 화면에는 그리지 않는다 */
  label: string
  /** 턴을 시작하기 전 대기(ms) — 조작 순간과 화면 반응 사이의 간격 */
  leadMs?: number
  /** 이 턴에서 실행할 page tool 목록 (순서대로) */
  tools?: MockToolCall[]

  // ── 아래는 실제 에이전트 채팅 화면(/agent)에서 재생할 때만 쓴다 ──
  /** 진행 문구 — 답을 만드는 동안 화면에 뜬다 */
  progress?: string
  /** 되물음 — 사용자 입력을 기다리는 말풍선 */
  question?: string
  /** 최종 답변. 한 글자씩 흘러나온다 */
  reply?: string
  /** 답변 타이핑 간격(ms/글자). 기본 18 */
  typeMs?: number
}

export interface MockScript {
  title: string
  turns: MockTurn[]
}

interface Persisted {
  active: boolean
  script: MockScript
  cursor: number
}

export const EMPTY_SCRIPT: MockScript = { title: '새 스크립트', turns: [] }

/** 어느 화면에서든 다음 턴을 넘기는 키 — 촬영 중 화면에 아무것도 남기지 않는다 */
export const ADVANCE_KEY = 'F9'

function load(): Persisted | null {
  if (!browser) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

function createMockAgentStore() {
  const saved = load()

  let active = $state(saved?.active ?? false)
  let script = $state<MockScript>(saved?.script ?? EMPTY_SCRIPT)
  let cursor = $state(saved?.cursor ?? 0)
  let busy = $state(false)
  /** 마지막 실행 결과 — 편집기에서만 읽는다(촬영 화면에는 표시하지 않는다) */
  let lastError = $state('')

  function persist() {
    if (!browser) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ active, script, cursor } satisfies Persisted))
    } catch {
      // sessionStorage 불가(프라이빗 모드 등) — 촬영은 계속된다, 이동 시 커서만 잃는다
    }
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  return {
    get active() {
      return active
    },
    get script() {
      return script
    },
    get cursor() {
      return cursor
    },
    get busy() {
      return busy
    },
    get lastError() {
      return lastError
    },
    get finished() {
      return cursor >= script.turns.length
    },
    /** 다음에 실행될 턴 — 편집기에서 "다음: …"으로 보여준다 */
    get nextTurn(): MockTurn | null {
      return script.turns[cursor] ?? null
    },

    start(next: MockScript) {
      script = next
      cursor = 0
      active = true
      busy = false
      lastError = ''
      persist()
    },

    reset() {
      cursor = 0
      busy = false
      lastError = ''
      persist()
    },

    stop() {
      active = false
      busy = false
      persist()
    },

    /** 다음 턴의 도구들을 순서대로 실제 실행한다 */
    async advance() {
      if (!active || busy || cursor >= script.turns.length) return
      busy = true
      lastError = ''

      const turn = script.turns[cursor]
      cursor = cursor + 1
      persist()

      await wait(turn.leadMs ?? 300)
      for (const tool of turn.tools ?? []) {
        await wait(tool.delayMs ?? 400)
        try {
          await handlePageToolCall('mock', 'mock', tool.name, tool.args)
        } catch (e) {
          lastError = `${tool.name} — ${(e as Error).message}`
        }
      }

      busy = false
      persist()
    },

    /**
     * 실제 에이전트 채팅(/agent)에서 서버 대신 재생한다.
     * 서버가 보내는 것과 같은 SSE 이벤트를 같은 순서로 흘려 실제 채팅 UI가 그대로 그려진다.
     * page tool은 이벤트로만 내보내고, 실행은 채팅 화면의 기존 배선이 맡는다.
     */
    async stream(onEvent: (e: SSEEvent) => void, onDone: () => void) {
      if (!active || cursor >= script.turns.length) {
        onDone()
        return
      }
      busy = true
      const turn = script.turns[cursor]
      cursor = cursor + 1
      persist()

      await wait(turn.leadMs ?? 300)
      if (turn.progress) onEvent({ type: 'progress', message: turn.progress })

      // 되물음 턴은 여기서 끝난다 — 사용자의 다음 입력이 다음 턴을 연다
      if (turn.question) {
        await wait(500)
        onEvent({ type: 'checkpoint_waiting', question: turn.question })
        busy = false
        onDone()
        return
      }

      for (const tool of turn.tools ?? []) {
        await wait(tool.delayMs ?? 400)
        onEvent({ type: 'step_tool_call', tool: tool.name, args: tool.args })
      }

      const reply = turn.reply ?? ''
      if (reply) {
        await wait(300)
        const per = turn.typeMs ?? 18
        for (const ch of reply) {
          onEvent({ type: 'completion_delta', text: ch })
          await wait(per)
        }
      }

      await wait(200)
      onEvent({ type: 'conversation_done', message: reply })
      busy = false
      onDone()
    }
  }
}

export const mockAgent = createMockAgentStore()
