/**
 * 구간 AI 리뷰의 상태머신 — 드래그한 문장만 보는 쪽.
 *
 * 종합 리뷰(overall-review.svelte.ts)가 문서 전체를 훑는다면 이쪽은 임상가가
 * 방금 선택한 구간만 본다.
 *
 * phase: idle(선택 없음) → prompt(분석 버튼) → analyzing(로딩) → result(카드)
 *
 * 에디터도 DOM selection도 알지 못한다. "무엇이 선택됐는지"를 판정하는 일은
 * 화면(route)이 하고, 여기는 그 결과를 받아 단계와 타이머만 관리한다 —
 * selection 판정에는 화면 사정(표시 패널 바깥클릭 처리 등)이 섞이기 때문이다.
 *
 * ⚠️ 시연용: 분석이 900ms 타이머다. 실기능 전환 시 fetch 대기로 바꾼다.
 */
import type { ModelSelection } from '$lib/components/document-editor/editor-core'

export type SpanPhase = 'idle' | 'prompt' | 'analyzing' | 'result'

export function createSpanReview() {
  let phase = $state<SpanPhase>('idle')
  let text = $state('')
  /** 버튼·카드를 띄울 뷰포트 좌표 */
  let x = $state(0)
  let y = $state(0)

  /**
   * 선택 시점의 모델 범위.
   *
   * 분석 버튼을 누르면 DOM selection이 풀리므로, 치환에 쓸 범위를 미리
   * 보관해 둔다. 반응형일 필요가 없어 $state로 두지 않는다.
   */
  let range: ModelSelection | null = null

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** 본문에서 구간이 선택됐다 — 분석 버튼을 띄운다 */
  function prompt(
    selected: string,
    at: { x: number; y: number },
    sel: ModelSelection | null
  ) {
    clearTimer()
    text = selected
    x = at.x
    y = at.y
    range = sel
    phase = 'prompt'
  }

  /** 분석 버튼 클릭 */
  function run() {
    clearTimer()
    phase = 'analyzing'
    // 실제 분석처럼 보이도록 짧은 지연
    timer = setTimeout(() => {
      phase = 'result'
      timer = null
    }, 900)
  }

  function close() {
    clearTimer()
    phase = 'idle'
  }

  /** 치환에 쓸 범위. 적용에 성공하면 호출부가 clearRange()로 비운다. */
  function currentRange(): ModelSelection | null {
    return range
  }

  function clearRange() {
    range = null
  }

  function destroy() {
    clearTimer()
  }

  return {
    get phase() {
      return phase
    },
    get text() {
      return text
    },
    get x() {
      return x
    },
    get y() {
      return y
    },
    prompt,
    run,
    close,
    currentRange,
    clearRange,
    destroy
  }
}

export type SpanReviewState = ReturnType<typeof createSpanReview>
