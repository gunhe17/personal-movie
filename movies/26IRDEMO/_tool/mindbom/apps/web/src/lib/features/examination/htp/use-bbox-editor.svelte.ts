/**
 * BBox 선택/드래그/리사이즈 상태 관리 composable
 * Sample의 useBBoxEditor.ts를 Svelte 5 Runes로 변환
 */
import type { BBox } from './types'

const MIN_SIZE_PERCENT = 2

export function useBBoxEditor(
  getBboxes: () => BBox[],
  onBBoxUpdate: (bboxes: BBox[]) => void,
  getContainerEl: () => HTMLElement | null,
) {
  let activeBBoxId = $state<string | null>(null)
  let isDragging = $state(false)
  let isResizing = $state(false)
  let dragStart = $state({ x: 0, y: 0 })
  let resizeHandle = $state<string | null>(null)

  function getContainerSize() {
    const el = getContainerEl()
    if (el) {
      const rect = el.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }
    return { width: 800, height: 600 }
  }

  function pxToPercent(pxX: number, pxY: number) {
    const { width, height } = getContainerSize()
    return { x: (pxX / width) * 100, y: (pxY / height) * 100 }
  }

  function selectBBox(bboxId: string) {
    activeBBoxId = bboxId
  }

  function deselectBBox() {
    activeBBoxId = null
  }

  function startDrag(bboxId: string, clientX: number, clientY: number) {
    activeBBoxId = bboxId
    isDragging = true
    dragStart = { x: clientX, y: clientY }
  }

  function startResize(bboxId: string, handle: string, clientX: number, clientY: number) {
    activeBBoxId = bboxId
    isResizing = true
    resizeHandle = handle
    dragStart = { x: clientX, y: clientY }
  }

  function drag(clientX: number, clientY: number) {
    if (!isDragging || !activeBBoxId) return
    const dx = clientX - dragStart.x
    const dy = clientY - dragStart.y
    const dp = pxToPercent(dx, dy)

    const updated = getBboxes().map((bbox) => {
      if (bbox.id === activeBBoxId) {
        return { ...bbox, xPercent: bbox.xPercent + dp.x, yPercent: bbox.yPercent + dp.y }
      }
      return bbox
    })
    onBBoxUpdate(updated)
    dragStart = { x: clientX, y: clientY }
  }

  function resize(clientX: number, clientY: number) {
    if (!isResizing || !activeBBoxId || !resizeHandle) return
    const dx = clientX - dragStart.x
    const dy = clientY - dragStart.y
    const dp = pxToPercent(dx, dy)
    const h = resizeHandle

    const updated = getBboxes().map((bbox) => {
      if (bbox.id !== activeBBoxId) return bbox
      const u = { ...bbox }
      if (h.includes('e')) u.widthPercent = Math.max(MIN_SIZE_PERCENT, bbox.widthPercent + dp.x)
      if (h.includes('w')) {
        const nw = bbox.widthPercent - dp.x
        if (nw > MIN_SIZE_PERCENT) { u.xPercent = bbox.xPercent + dp.x; u.widthPercent = nw }
      }
      if (h.includes('s')) u.heightPercent = Math.max(MIN_SIZE_PERCENT, bbox.heightPercent + dp.y)
      if (h.includes('n')) {
        const nh = bbox.heightPercent - dp.y
        if (nh > MIN_SIZE_PERCENT) { u.yPercent = bbox.yPercent + dp.y; u.heightPercent = nh }
      }
      return u
    })
    onBBoxUpdate(updated)
    dragStart = { x: clientX, y: clientY }
  }

  function stopDrag() {
    isDragging = false
  }

  function stopResize() {
    isResizing = false
    resizeHandle = null
  }

  /** document-level mouse listeners를 관리하는 effect용 setup/cleanup */
  function setupMouseListeners() {
    function handleMouseMove(e: MouseEvent) {
      if (isDragging) drag(e.clientX, e.clientY)
      else if (isResizing) resize(e.clientX, e.clientY)
    }
    function handleMouseUp() {
      if (isDragging) stopDrag()
      if (isResizing) stopResize()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  return {
    get activeBBoxId() { return activeBBoxId },
    get isDragging() { return isDragging },
    get isResizing() { return isResizing },
    selectBBox,
    deselectBBox,
    startDrag,
    startResize,
    drag,
    resize,
    stopDrag,
    stopResize,
    setupMouseListeners,
  }
}
