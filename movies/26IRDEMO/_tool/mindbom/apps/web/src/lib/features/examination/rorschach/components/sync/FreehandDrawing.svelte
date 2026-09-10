<script lang="ts">
  import type { Point } from '../../types'
  import { OVERLAY_VIEWBOX } from '../../constants'

  interface Props {
    strokeColor: string
    /** 그려진 path 콜백 — 좌표는 0..1 normalized */
    onDrawEnd: (path: Point[]) => void
  }

  let { strokeColor, onDrawEnd }: Props = $props()

  /** viewBox는 0..VB로 두고 콜백 직전에 /VB로 normalize하여 전달. */
  const VB = OVERLAY_VIEWBOX

  let isDrawing = $state(false)
  let path = $state<Point[]>([])
  let svgEl: SVGSVGElement | null = $state(null)

  let pathD = $derived.by(() => {
    if (path.length === 0) return ''
    let d = `M ${path[0].x} ${path[0].y}`
    for (let i = 1; i < path.length; i++) d += ` L ${path[i].x} ${path[i].y}`
    return d
  })

  /**
   * pointer 픽셀 좌표 → SVG viewBox(0..1) 좌표.
   * getScreenCTM 역행렬로 letterbox/스케일까지 보정.
   */
  function getVbPoint(e: PointerEvent): Point {
    if (!svgEl) return { x: 0, y: 0 }
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const inv = ctm.inverse()
    const screenPt = svgEl.createSVGPoint()
    screenPt.x = e.clientX
    screenPt.y = e.clientY
    const vbPt = screenPt.matrixTransform(inv)
    return { x: vbPt.x, y: vbPt.y }
  }

  function handlePointerDown(e: PointerEvent) {
    e.preventDefault()
    svgEl?.setPointerCapture(e.pointerId)
    isDrawing = true
    path = [getVbPoint(e)]
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing) return
    path = [...path, getVbPoint(e)]
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDrawing) return
    svgEl?.releasePointerCapture(e.pointerId)
    isDrawing = false
    if (path.length >= 2) {
      // viewBox 0..VB 좌표를 0..1 normalized로 변환해 콜백
      onDrawEnd(path.map(p => ({ x: p.x / VB, y: p.y / VB })))
    }
    path = []
  }
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {VB} {VB}"
  preserveAspectRatio="none"
  class="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  role="application"
  aria-label="영역 그리기"
>
  {#if pathD}
    <path
      d={pathD}
      stroke={strokeColor}
      fill="rgba(255,255,255,0.1)"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      stroke-width="3"
    />
  {/if}
</svg>
