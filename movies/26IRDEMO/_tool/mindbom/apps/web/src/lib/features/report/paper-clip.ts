/**
 * 수정안 미리보기에 쓰는 '지면 조각' 만들기.
 *
 * 실제 A4 페이지 DOM을 그대로 복제해 "보고서를 오려낸 것"처럼 보이게 한다.
 * 대상 문단만 선명하게 두고 나머지 문단은 블러 처리하며, 머리말·제목 같은
 * 지면 요소는 그대로 살린다. (텍스트만 재현하면 실제 문서처럼 안 보인다.)
 *
 * 렌더된 DOM을 읽는 일이라 route에서 떼어 둔다 — 에디터 API도 상태도 쓰지
 * 않고 document만 본다.
 */

export interface PaperClip {
  /** 복제된 페이지 HTML */
  html: string
  /** 조각 안에서 대상 문단의 세로 위치(px) */
  offsetY: number
}

/** 미리보기에 반영해 보여줄 변경 (실제 문서는 건드리지 않는다) */
export type ClipPreview = {
  insert?: string
  replace?: { before: string; after: string }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 문단 id로 렌더된 엘리먼트 찾기 — PaginatedEditor가 dataset.id에 Para.id를 심는다 */
export function findBlockEl(blockId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-id="${CSS.escape(blockId)}"]`
  )
}

export function buildPaperClip(
  blockId: string,
  preview?: ClipPreview
): PaperClip | null {
  const el = findBlockEl(blockId)
  const page = el?.closest<HTMLElement>('.page')
  if (!el || !page) return null

  const clone = page.cloneNode(true) as HTMLElement
  // 편집 관련 상태 제거 — 미리보기는 읽기 전용이다
  clone.querySelectorAll('[contenteditable]').forEach((n) => {
    ;(n as HTMLElement).removeAttribute('contenteditable')
  })
  clone
    .querySelectorAll('.hilite-layer, .rpt-block-del')
    .forEach((n) => n.remove())
  clone.classList.remove('screen-hidden')

  const target = clone.querySelector<HTMLElement>(
    `[data-id="${CSS.escape(blockId)}"]`
  )
  if (!target) return null
  // 대상 문단 표식 — 모달에서 이 클래스로 선명도를 되돌린다
  target.classList.add('clip-focus')

  // 수정안을 미리보기 안에 실제로 반영해 "적용하면 이렇게 된다"를 보여준다
  if (preview?.insert) {
    target.innerHTML = `<mark class="clip-ins">${escapeHtml(preview.insert)}</mark>`
  } else if (preview?.replace) {
    const { before, after } = preview.replace
    const i = target.textContent?.indexOf(before) ?? -1
    if (i !== -1) {
      const t = target.textContent ?? ''
      target.innerHTML =
        escapeHtml(t.slice(0, i)) +
        `<mark class="clip-del">${escapeHtml(before)}</mark>` +
        `<mark class="clip-ins">${escapeHtml(after)}</mark>` +
        escapeHtml(t.slice(i + before.length))
    }
  }

  // 문단의 페이지 내 세로 위치. offsetTop은 offsetParent가 무엇이냐에 따라
  // 기준이 달라지므로, 실제 렌더 좌표 차이로 구한다.
  const offsetY =
    el.getBoundingClientRect().top - page.getBoundingClientRect().top

  return { html: clone.innerHTML, offsetY }
}
