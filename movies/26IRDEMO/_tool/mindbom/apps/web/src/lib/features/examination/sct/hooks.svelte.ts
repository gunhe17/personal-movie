/**
 * SCT 검사 진행 상태 관리 (Svelte 5 runes).
 *
 * effect는 호출하는 컴포넌트 쪽에서 관리합니다 (소유권 문제 회피).
 * - load() / save() 를 명시적으로 노출
 * - 문항 진행, 응답 입력, 복합문항 reason 처리
 */
import type { SCTResponseItem, SCTStem } from './types'

const STORAGE_KEY_PREFIX = 'sctTestStateV1_'

interface PersistedState {
  responses: SCTResponseItem[]
  currentIndex: number
  startedAt: string
}

function getStorageKey(examId: string) {
  return `${STORAGE_KEY_PREFIX}${examId}`
}

export function createSCTTest(examId: string, stems: SCTStem[]) {
  const totalCount = stems.length

  let currentIndex = $state(0)
  let responses = $state<SCTResponseItem[]>([])
  let startedAt = $state('')

  function load() {
    try {
      const raw = localStorage.getItem(getStorageKey(examId))
      if (raw) {
        const persisted = JSON.parse(raw) as PersistedState
        responses = persisted.responses ?? []
        currentIndex = persisted.currentIndex ?? 0
        startedAt = persisted.startedAt || new Date().toISOString()
        return
      }
    } catch {
      // ignore corrupted storage
    }
    startedAt = new Date().toISOString()
  }

  /**
   * 서버에 저장된 응답으로 로컬 상태를 맞춘다.
   *
   * 응답은 localStorage에도 복원되지만, 응답 검토 화면에서 임상심리사가 고친
   * 내용은 서버에만 반영된다. 로컬만 믿고 복원하면 검토 화면의 수정이
   * 화면에 안 보일 뿐 아니라, 이후 자동저장 때 옛 값으로 서버를 덮어써 버린다.
   * 그래서 서버 값을 우선으로 삼는다.
   *
   * 진행 위치(currentIndex)는 서버에 없는 로컬 정보라 그대로 둔다.
   */
  function syncFromServer(serverResponses: SCTResponseItem[]) {
    if (serverResponses.length === 0) return

    const byId = new Map(responses.map((r) => [r.stemId, r]))
    for (const incoming of serverResponses) {
      // 서버가 내려준 필드를 그대로 채택한다. spread로 로컬을 덮으면 서버가
      // 비운 값(예: reason 삭제)이 로컬 값으로 되살아난다.
      byId.set(incoming.stemId, {
        stemId: incoming.stemId,
        answer: incoming.answer ?? '',
        reason: incoming.reason ?? null,
        answeredAt: incoming.answeredAt ?? null
      })
    }
    responses = [...byId.values()].sort((a, b) => a.stemId - b.stemId)
    save()
  }

  function save() {
    const state: PersistedState = { responses, currentIndex, startedAt }
    try {
      localStorage.setItem(getStorageKey(examId), JSON.stringify(state))
    } catch {
      // ignore quota errors
    }
  }

  function clearStorage() {
    try {
      localStorage.removeItem(getStorageKey(examId))
    } catch {
      // ignore
    }
  }

  function getCurrentStem(): SCTStem | null {
    return stems[currentIndex] ?? null
  }

  function getCurrentAnswer(): string {
    const stem = getCurrentStem()
    if (!stem) return ''
    return responses.find((r) => r.stemId === stem.id)?.answer ?? ''
  }

  function getCurrentReason(): string {
    const stem = getCurrentStem()
    if (!stem) return ''
    return responses.find((r) => r.stemId === stem.id)?.reason ?? ''
  }

  function upsertResponse(stemId: number, patch: Partial<SCTResponseItem>) {
    const idx = responses.findIndex((r) => r.stemId === stemId)
    const base: SCTResponseItem =
      idx >= 0 ? responses[idx] : { stemId, answer: '' }
    const merged: SCTResponseItem = {
      ...base,
      ...patch,
      answeredAt: new Date().toISOString()
    }
    if (idx >= 0) {
      const next = [...responses]
      next[idx] = merged
      responses = next
    } else {
      responses = [...responses, merged]
    }
  }

  function setAnswer(answer: string) {
    const stem = getCurrentStem()
    if (!stem) return
    upsertResponse(stem.id, { answer })
  }

  function setReason(reason: string) {
    const stem = getCurrentStem()
    if (!stem) return
    upsertResponse(stem.id, { reason })
  }

  function goNext() {
    if (currentIndex < totalCount - 1) currentIndex += 1
  }

  function goPrev() {
    if (currentIndex > 0) currentIndex -= 1
  }

  function goTo(index: number) {
    if (index >= 0 && index < totalCount) currentIndex = index
  }

  function fillMockResponses() {
    responses = stems.map((s) => ({
      stemId: s.id,
      answer: `${s.stem} (모의 응답)`,
      answeredAt: new Date().toISOString()
    }))
    currentIndex = totalCount - 1
  }

  return {
    get totalCount() {
      return totalCount
    },
    get currentIndex() {
      return currentIndex
    },
    get currentStem() {
      return getCurrentStem()
    },
    get responses() {
      return responses
    },
    get answeredCount() {
      return responses.filter((r) => r.answer.trim().length > 0).length
    },
    get isFirstItem() {
      return currentIndex === 0
    },
    get isLastItem() {
      return currentIndex === totalCount - 1
    },
    load,
    save,
    syncFromServer,
    clearStorage,
    getCurrentAnswer,
    getCurrentReason,
    setAnswer,
    setReason,
    goNext,
    goPrev,
    goTo,
    fillMockResponses
  }
}

export type SCTTest = ReturnType<typeof createSCTTest>
