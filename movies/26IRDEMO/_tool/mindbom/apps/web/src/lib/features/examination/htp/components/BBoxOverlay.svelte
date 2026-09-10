<script lang="ts">
  import type { BBox } from '../types'
  import { bboxColorFor } from '../constants'

  interface Props {
    bboxes: BBox[]
    activeBBoxId: string | null
    onBBoxSelect: (bboxId: string) => void
    onDragStart: (bboxId: string, clientX: number, clientY: number) => void
    onResizeStart: (bboxId: string, handle: string, clientX: number, clientY: number) => void
  }

  let { bboxes, activeBBoxId, onBBoxSelect, onDragStart, onResizeStart }: Props = $props()

  function handleMouseDown(e: MouseEvent, bboxId: string) {
    e.stopPropagation()
    onBBoxSelect(bboxId)
    onDragStart(bboxId, e.clientX, e.clientY)
  }

  function handleResizeMouseDown(e: MouseEvent, bboxId: string, handle: string) {
    e.stopPropagation()
    onResizeStart(bboxId, handle, e.clientX, e.clientY)
  }

  const RESIZE_HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'] as const
  const HANDLE_CURSORS: Record<string, string> = {
    nw: 'cursor-nwse-resize', ne: 'cursor-nesw-resize',
    sw: 'cursor-nesw-resize', se: 'cursor-nwse-resize',
    n: 'cursor-ns-resize', s: 'cursor-ns-resize',
    w: 'cursor-ew-resize', e: 'cursor-ew-resize',
  }
  function handleStyle(handle: string) {
    const s: Record<string, string> = {}
    if (handle.includes('n')) s.top = '-5px'
    if (handle.includes('s')) s.bottom = '-5px'
    if (handle.includes('w')) s.left = '-5px'
    if (handle.includes('e')) s.right = '-5px'
    if (handle === 'n' || handle === 's') { s.left = '50%'; s.transform = 'translateX(-50%)' }
    if (handle === 'w' || handle === 'e') { s.top = '50%'; s.transform = 'translateY(-50%)' }
    return Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('; ')
  }
</script>

{#each bboxes as bbox, index (bbox.id)}
  {@const isActive = bbox.id === activeBBoxId}
  <!-- 색은 항목에 고정 — 렌더 순서(index)로 고르면 항목을 숨길 때마다
       남은 박스 색이 전부 바뀐다(constants.ts의 bboxColorFor 주석) -->
  {@const cs = bboxColorFor(bbox.colorIndex)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="absolute border-2 cursor-move transition-shadow {isActive ? 'z-10 shadow-lg' : ''}"
    style="
      left: {bbox.xPercent}%;
      top: {bbox.yPercent}%;
      width: {bbox.widthPercent}%;
      height: {bbox.heightPercent}%;
      border-color: {isActive ? cs.activeBorder : cs.border};
      background-color: {isActive ? cs.activeBg : cs.bg};
    "
    onmousedown={(e) => handleMouseDown(e, bbox.id)}
    onclick={(e) => { e.stopPropagation(); onBBoxSelect(bbox.id) }}
  >
    <!-- Label -->
    <div
      class="absolute left-0 text-white text-label-01-normal-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
      style="background-color: {isActive ? cs.activeBorder : cs.border}; top: -20px; z-index: {isActive ? 50 : 10 + index}"
    >
      {bbox.label}
    </div>

    <!-- Resize handles (active only) -->
    {#if isActive}
      {#each RESIZE_HANDLES as handle}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute w-2.5 h-2.5 bg-white border-2 rounded-sm {HANDLE_CURSORS[handle]}"
          style="{handleStyle(handle)}; border-color: {cs.activeBorder}"
          onmousedown={(e) => handleResizeMouseDown(e, bbox.id, handle)}
        ></div>
      {/each}
    {/if}
  </div>
{/each}
