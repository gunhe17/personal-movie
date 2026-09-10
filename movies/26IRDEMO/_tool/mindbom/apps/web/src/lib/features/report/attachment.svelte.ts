/**
 * 본문에 이미 첨부된 자료 추적 + 말풍선 상태.
 *
 * 같은 자료를 두 번 넣는 실수를 막는 표시용이다. 본문이 바뀔 때마다
 * sync(doc)로 갱신한다.
 *
 * 대조 순서:
 *   1. sourceId — 삽입 시 심는 자료 id. 가장 확실하다.
 *   2. src      — 프리셋 본문처럼 sourceId 없이 들어간 이미지용.
 *                 차트는 매번 새로 생성되는 data URI라 여기 걸리지 않는다.
 *
 * (alt 문자열 대조는 하지 않는다. 삽입 경로마다 형식이 달라 취약하다 —
 *  프리셋 본문 alt는 'TCI 기질 4차원 프로파일'인데 자료명은 '기질 4차원'이었다.)
 *
 * 이미지·차트뿐 아니라 표(HTP/로르샤하/SCT의 해석 표)도 같은 방식으로 잡는다.
 */
import type { EditorDoc } from '$lib/components/document-editor/editor-core'

/** 첨부된 자료를 다시 눌렀을 때 뜨는 말풍선의 위치·대상 */
export interface AttachedPopover {
  assetId: string
  name: string
  /** 뷰포트 기준 좌표 — 자료 박스 오른쪽 가장자리 중앙 */
  x: number
  y: number
}

export function createAttachmentTracker() {
  let attachedIds = $state<Set<string>>(new Set())
  let attachedSrcs = $state<Set<string>>(new Set())
  let popover = $state<AttachedPopover | null>(null)

  /** 본문 변경 시 — 이미지/표 블록에서 sourceId와 src를 모은다 */
  function sync(doc: EditorDoc) {
    const ids = new Set<string>()
    const srcs = new Set<string>()
    for (const p of doc.paras) {
      if (p.kind !== 'image' && p.kind !== 'table') continue
      const meta = p.meta as { src?: string; sourceId?: string } | undefined
      if (meta?.sourceId) ids.add(meta.sourceId)
      if (meta?.src) srcs.add(meta.src)
    }
    attachedIds = ids
    attachedSrcs = srcs
  }

  function isAttached(id: string, src?: string): boolean {
    if (attachedIds.has(id)) return true
    return !!src && attachedSrcs.has(src)
  }

  /**
   * 두 번째 클릭의 의도는 대개 "한 번 더 넣기"가 아니라 "아까 넣은 게 어디 있지"다.
   * 자료 패널은 overflow-hidden/auto로 잘리므로 말풍선은 fixed로 띄운다 —
   * 클릭한 박스의 화면 좌표를 기준으로 삼는다.
   */
  function openPopover(a: { id: string; name: string }, e: MouseEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    popover = {
      assetId: a.id,
      name: a.name,
      x: box.right,
      y: box.top + box.height / 2
    }
  }

  function closePopover() {
    popover = null
  }

  return {
    get popover() {
      return popover
    },
    sync,
    isAttached,
    openPopover,
    closePopover
  }
}

export type AttachmentTracker = ReturnType<typeof createAttachmentTracker>
