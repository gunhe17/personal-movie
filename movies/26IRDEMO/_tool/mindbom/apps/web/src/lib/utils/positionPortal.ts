import { tick } from 'svelte'

/**
 * Z-index 레이어 (design-system-guide.md §2-6) — app.css의 `--z-index-*`와
 * 같은 사다리다. portal은 인라인 style로 z를 박으므로 CSS 변수를 쓸 수 없어
 * 여기에 숫자로 둔다. 한쪽만 고치지 말 것.
 */
export const Z_LAYER = {
  lock: 9999,
  modal: 10000,
  /**
   * portal로 띄운 드롭다운 — 모달 위.
   *
   * 표(§2-6)상 값은 10001이지만 그건 모달이 하나일 때 얘기다. 모달을 겹치면
   * ModalContainer가 10000+i로 올리므로 두 번째 모달부터 드롭다운을 덮는다.
   * 모달 스택이 이 여유(100)를 넘을 일은 없다고 보고 위로 띄워 둔다.
   */
  portalDropdown: 10100,
  snackbar: 20000
} as const

type PortalOptions = {
  anchor: HTMLElement
  anchorRect?: DOMRect | null
  renderPosition?: 'bottom' | 'right'
  position?: 'left' | 'right'
  offset?: number
  isFitWidth?: boolean
  /** 미지정 시 z를 건드리지 않는다. 모달 위로 띄우려면 Z_LAYER.portalDropdown */
  zIndex?: number
  callback?: () => void
}

export const portal = (node: HTMLElement, options: PortalOptions) => {
  const {
    anchor,
    anchorRect,
    renderPosition = 'bottom',
    position = 'left',
    isFitWidth = true,
    offset = 8,
    zIndex,
    callback
  } = options

  const handleClick = (event: MouseEvent) => {
    if (
      !anchor.contains(event.target as Node) &&
      !node.contains(event.target as Node)
    ) {
      callback && callback()
    }
  }

  const updatePosition = () => {
    const rect = anchorRect ?? anchor.getBoundingClientRect()
    const nodeRect = node.getBoundingClientRect()

    node.style.position = 'fixed'
    if (zIndex != null) node.style.zIndex = String(zIndex)
    node.style.width = isFitWidth ? `${rect.width}px` : ''

    if (renderPosition === 'bottom') {
      const fitsBelow = rect.bottom + offset + nodeRect.height <= window.innerHeight
      node.style.top = fitsBelow
        ? `${rect.bottom + offset}px`
        : `${rect.top - nodeRect.height - offset}px`

      const effectiveWidth = isFitWidth ? rect.width : nodeRect.width
      const overflowsRight = rect.left + effectiveWidth > window.innerWidth
      if (position === 'right' || overflowsRight) {
        node.style.left = ''
        node.style.right = `${window.innerWidth - rect.right}px`
      } else {
        node.style.right = ''
        node.style.left = `${rect.left}px`
      }
    } else {
      const fitsBelow = rect.top + nodeRect.height <= window.innerHeight
      node.style.top = fitsBelow
        ? `${rect.top}px`
        : `${rect.top - nodeRect.height + rect.height}px`

      const fitsRight = rect.right + offset + nodeRect.width <= window.innerWidth
      node.style.right = ''
      node.style.left = fitsRight
        ? `${rect.right + offset}px`
        : `${rect.left - nodeRect.width - offset}px`
    }
  }

  document.body.appendChild(node)

  tick().then(updatePosition)

  let prevRect = anchor.getBoundingClientRect()
  let rafId = 0

  if (!anchorRect) {
    const trackAnchor = () => {
      const curr = anchor.getBoundingClientRect()
      if (
        curr.top !== prevRect.top ||
        curr.left !== prevRect.left ||
        curr.width !== prevRect.width ||
        curr.height !== prevRect.height
      ) {
        prevRect = curr
        updatePosition()
      }
      rafId = requestAnimationFrame(trackAnchor)
    }
    rafId = requestAnimationFrame(trackAnchor)
  }

  document.addEventListener('click', handleClick, true)

  return {
    update(newOptions: PortalOptions) {
      options = newOptions
      updatePosition()
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('click', handleClick, true)
      node.remove()
    }
  }
}
