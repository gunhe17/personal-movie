/**
 * "본문에서 무엇이 선택됐는가" 판정.
 *
 * 구간 리뷰 상태머신(span-review.svelte.ts)은 DOM selection을 알지 못한다 —
 * 단계와 타이머만 관리한다. 그 사이를 잇는 판정이 여기 있다.
 *
 * mouseup 시점에만 부른다 — selectionchange는 드래그 중 계속 발화해 과도하다.
 */

export type SpanSelection =
  /** 리뷰 UI 내부 클릭 — 스스로 닫히지 않게 아무것도 하지 않는다 */
  | { kind: 'ignore' }
  /** 선택이 풀렸다 (또는 너무 짧다) — 열려 있던 리뷰를 닫는다 */
  | { kind: 'clear' }
  /** 본문에서 구간이 선택됐다 — 분석 버튼을 띄운다 */
  | { kind: 'select'; text: string; at: { x: number; y: number } }

/** 분석 버튼을 띄울 최소 글자 수 — 오타성 클릭·한두 글자 선택은 무시 */
const MIN_SELECTION_LENGTH = 2

export function judgeSelection(target: HTMLElement | null): SpanSelection {
  // 분석 버튼/리뷰 카드 내부 클릭은 무시
  if (
    target?.closest('[data-ai-review]') ||
    target?.closest('[role="dialog"][aria-label="AI 리뷰"]')
  ) {
    return { kind: 'ignore' }
  }

  const sel = window.getSelection()
  const text = sel?.toString() ?? ''
  if (!sel || sel.isCollapsed || text.trim().length < MIN_SELECTION_LENGTH) {
    return { kind: 'clear' }
  }

  // 에디터 본문 안에서 일어난 선택만 대상
  const anchor = sel.anchorNode
  const inEditor =
    anchor instanceof Node &&
    (anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as HTMLElement)
      : anchor.parentElement
    )?.closest('[contenteditable]')
  if (!inEditor) return { kind: 'ignore' }

  const rect = sel.getRangeAt(0).getBoundingClientRect()
  return {
    kind: 'select',
    text,
    at: { x: rect.right + 12, y: rect.bottom + 8 }
  }
}
