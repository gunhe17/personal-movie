<script lang="ts">
  import type { Snippet } from 'svelte'

  // 확정 화면의 좌우 분할 — 왼쪽 문서, 오른쪽 항목. 가운데 바를 끌어 비율을 바꾼다.
  // 문서를 크게 볼 때와 항목을 훑을 때 원하는 비율이 다르다.

  let {
    left,
    right,
    initial = 0.5
  }: { left: Snippet; right: Snippet; initial?: number } = $props()

  const MIN = 0.2
  const MAX = 0.8

  let host: HTMLDivElement | null = $state(null)
  let ratio = $state(0)
  $effect(() => {
    if (!ratio) ratio = initial
  })
  let dragging = $state(false)

  function onDown(e: PointerEvent) {
    if (!host) return
    dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onMove(e: PointerEvent) {
    if (!dragging || !host) return
    const box = host.getBoundingClientRect()
    ratio = Math.min(MAX, Math.max(MIN, (e.clientX - box.left) / box.width))
  }

  const onUp = () => (dragging = false)

  function onKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.05 : 0.01
    if (e.key === 'ArrowLeft') ratio = Math.max(MIN, ratio - step)
    else if (e.key === 'ArrowRight') ratio = Math.min(MAX, ratio + step)
    else return
    e.preventDefault()
  }
</script>

<div bind:this={host} class="flex min-h-0 flex-1 flex-col lg:flex-row">
  <div class="flex min-h-0 min-w-0 flex-col lg:w-[var(--split)]" style="--split:{ratio * 100}%">
    {@render left()}
  </div>

  <div
    class="group flex shrink-0 cursor-col-resize items-center justify-center px-1.5 py-2 lg:py-0"
    role="slider"
    aria-label="좌우 너비 조절"
    aria-orientation="vertical"
    aria-valuemin={Math.round(MIN * 100)}
    aria-valuemax={Math.round(MAX * 100)}
    aria-valuenow={Math.round(ratio * 100)}
    tabindex="0"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
    onkeydown={onKey}
  >
    <div
      class="h-10 w-1 rounded-full transition-colors {dragging
        ? 'bg-primary-500'
        : 'bg-gray-200 group-hover:bg-primary-300'}"
    ></div>
  </div>

  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    {@render right()}
  </div>
</div>
