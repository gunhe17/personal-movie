import { tick } from 'svelte'

type PortalOptions = {
  anchor: HTMLElement
  anchorRect?: DOMRect | null
  renderPosition?: 'bottom' | 'right'
  position?: 'left' | 'right'
  offset?: number
  isFitWidth?: boolean
  exactWidth?: boolean
  /** 모달(10000) 위에 보이려면 10001 이상 권장 */
  zIndex?: number
  callback?: () => void
}

export const portal = (node: HTMLElement, options: PortalOptions) => {
  const {
    anchor, // 위치 기준 DOM
    anchorRect,
    renderPosition = 'bottom',
    position = 'left', // 드롭다운 렌더 position
    isFitWidth = true, // true -> anchor 폭을 최소폭으로(콘텐츠가 길면 늘어남)
    exactWidth = false, // true -> anchor 폭에 정확히 고정(늘어나지 않음)
    offset = 4, // anchor(트리거 버튼)와의 거리(px) — 전 드롭다운 공통 4
    zIndex,
    callback // 외부 클릭시의 콜백함수
  } = options

  const handleClick = (event: MouseEvent) => {
    if (
      !anchor.contains(event.target as Node) &&
      !node.contains(event.target as Node)
    ) {
      callback && callback()
    }
  }

  // 드롭다운 폭은 4px 배수로 스냅한다 — 항목이 두 줄로 접히면 안 되므로
  // 트리거 폭은 '최소 폭'으로만 쓰고(하한 160), 가장 긴 항목에 맞춰 4px 단위로 넓힌다.
  const snap4 = (n: number) => Math.ceil(n / 4) * 4

  const updatePosition = () => {
    const rect = anchorRect ?? anchor.getBoundingClientRect()

    node.style.position = 'fixed'
    if (zIndex != null) node.style.zIndex = String(zIndex)

    if (exactWidth) {
      // 앵커(트리거) 폭에 정확히 고정 — 콘텐츠가 길어도 커지지 않는다.
      // isFitWidth는 minWidth만 앵커에 맞추고 실제 폭은 콘텐츠를 따라가므로,
      // 옵션 라벨이 길면 뷰포트 폭까지 벌어진다(입력 폭과 어긋남).
      const w = snap4(rect.width)
      node.style.minWidth = `${w}px`
      node.style.width = `${w}px`
      node.style.maxWidth = `${w}px`
    } else if (isFitWidth) {
      node.style.width = ''
      node.style.minWidth = `${Math.max(160, snap4(rect.width))}px`
      node.style.maxWidth = `${window.innerWidth - 16}px`
      // minWidth 반영 후 실제 콘텐츠 폭을 재측정해 4px 그리드로 스냅
      node.style.width = `${snap4(node.getBoundingClientRect().width)}px`
    } else {
      node.style.minWidth = ''
    }

    const nodeRect = node.getBoundingClientRect()

    if (renderPosition === 'bottom') {
      // 상하 위치: 아래 공간 부족 시 위로
      const fitsBelow = rect.bottom + offset + nodeRect.height <= window.innerHeight
      node.style.top = fitsBelow
        ? `${rect.bottom + offset}px`
        : `${rect.top - nodeRect.height - offset}px`

      // 좌우 위치: 오른쪽 오버플로우 시 right 정렬
      const effectiveWidth = nodeRect.width
      const overflowsRight = rect.left + effectiveWidth > window.innerWidth
      if (position === 'right' || overflowsRight) {
        node.style.left = ''
        node.style.right = `${window.innerWidth - rect.right}px`
      } else {
        node.style.right = ''
        node.style.left = `${rect.left}px`
      }
    } else {
      // renderPosition === 'right'
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

  // body에 먼저 추가해야 nodeRect 계산이 정확함
  document.body.appendChild(node)

  // 초기 위치 설정 (tick 후 렌더링 완료 보장)
  tick().then(updatePosition)

  // anchor 위치 변화 감지 (모달 리사이즈, 스크롤 등)
  let prevRect = anchor.getBoundingClientRect()
  let rafId = 0

  if (!anchorRect) {
    // anchorRect가 직접 전달된 경우 정적 위치이므로 추적 불필요
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
