import { tick } from 'svelte'

type PortalOptions = {
  anchor: HTMLElement
  anchorRect?: DOMRect | null
  renderPosition?: 'bottom' | 'right'
  position?: 'left' | 'right'
  offset?: number
  isFitWidth?: boolean
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
