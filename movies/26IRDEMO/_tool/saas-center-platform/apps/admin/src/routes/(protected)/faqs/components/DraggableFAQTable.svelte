<script lang="ts">
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import DragHandleIcon from '$lib/assets/DragHandleIcon.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import type { FAQSummary } from '$hooks/actions/faq.action'

  interface Props {
    items: FAQSummary[]
    onRowClick: (item: FAQSummary) => void
    onDelete: (faqId: string, e: MouseEvent) => void
    onReorder: (newItems: FAQSummary[]) => void
  }

  let { items, onRowClick, onDelete, onReorder }: Props = $props()

  const GRID_COLS = '56px 1fr 0.5fr 0.5fr 0.5fr 60px'

  // ─── 드래그 상태 ───
  let draggedIndex = $state<number | null>(null)
  let dragOverIndex = $state<number | null>(null)
  let isDragging = $state(false)

  // ghost: 드래그 시작 시 실제 행 rect 캡처
  let ghostRect = $state<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  // 각 컬럼 너비 캡처
  let ghostColWidths = $state<number[]>([])
  // 마우스가 행 내에서 눌린 오프셋
  let pointerOffsetY = $state(0)
  let pointerOffsetX = $state(0)
  // 현재 마우스 위치
  let pointerY = $state(0)
  let pointerX = $state(0)

  let rowRefs = $state<HTMLDivElement[]>([])
  let containerRef = $state<HTMLDivElement | null>(null)

  // ─── Pointer 드래그 ───
  function onPointerDown(e: PointerEvent, index: number) {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()

    const row = rowRefs[index]
    if (!row) return

    const rect = row.getBoundingClientRect()
    ghostRect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }

    // 각 컬럼 div 너비 캡처
    ghostColWidths = Array.from(row.children).map(
      (el) => el.getBoundingClientRect().width
    )

    pointerOffsetY = e.clientY - rect.top
    pointerOffsetX = e.clientX - rect.left
    pointerY = e.clientY
    pointerX = e.clientX

    draggedIndex = index
    isDragging = false

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(e: PointerEvent) {
    if (draggedIndex === null) return

    pointerY = e.clientY
    pointerX = e.clientX

    if (!isDragging) isDragging = true

    if (!containerRef) return
    const rows = containerRef.querySelectorAll('[data-row-index]')
    let found: number | null = null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      const idx = Number((row as HTMLElement).dataset.rowIndex)
      if (e.clientY < mid) {
        found = idx
        break
      }
    }
    if (found === null) found = items.length - 1
    dragOverIndex = found === draggedIndex ? null : found
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (
      draggedIndex !== null &&
      dragOverIndex !== null &&
      draggedIndex !== dragOverIndex
    ) {
      const newItems = [...items]
      const [moved] = newItems.splice(draggedIndex, 1)
      newItems.splice(dragOverIndex, 0, moved)
      onReorder(newItems)
    }

    draggedIndex = null
    dragOverIndex = null
    isDragging = false
    ghostRect = null
    ghostColWidths = []
  }

  // ─── 행의 transform 계산 ───
  function getRowTransform(index: number): string {
    if (draggedIndex === null || dragOverIndex === null || !ghostRect) return ''
    if (index === draggedIndex) return ''

    const from = draggedIndex
    const to = dragOverIndex

    if (from < to) {
      if (index > from && index <= to)
        return `translateY(-${ghostRect.height}px)`
    } else {
      if (index >= to && index < from)
        return `translateY(${ghostRect.height}px)`
    }
    return ''
  }

  let ghostTop = $derived(pointerY - pointerOffsetY)
  let ghostLeft = $derived(pointerX - pointerOffsetX)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative max-h-150 flex flex-col min-h-0"
  class:overflow-y-auto={!isDragging}
  class:overflow-hidden={isDragging}
  class:select-none={isDragging}
  bind:this={containerRef}
>
  <!-- 헤더 -->
  <div
    class="sticky top-0 z-10 grid h-14 shrink-0 items-center gap-4 bg-gray-50 border-b border-gray-100 px-6"
    style="grid-template-columns: {GRID_COLS}"
  >
    <div></div>
    <div class="text-body-01-regular text-gray-600">질문</div>
    <div class="text-body-01-regular text-gray-600 text-center">게시</div>
    <div class="text-body-01-regular text-gray-600 text-center">순서</div>
    <div class="text-body-01-regular text-gray-600 text-center">작성일</div>
    <div></div>
  </div>

  <!-- 바디 -->
  {#each items as item, idx (item.id)}
    {@const isBeingDragged = draggedIndex === idx}
    {@const transform = getRowTransform(idx)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      data-row-index={idx}
      bind:this={rowRefs[idx]}
      class="grid min-h-18.5 items-center gap-4 border-b bg-white px-6 py-3 cursor-pointer transition-colors
        {idx === items.length - 1 ? 'border-b-0' : 'border-gray-100'}
        {isBeingDragged ? 'opacity-0' : 'hover:bg-gray-50'}"
      style="grid-template-columns: {GRID_COLS}; transition: transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94), background-color 150ms; transform: {transform};"
      onpointerdown={(e) => onPointerDown(e, idx)}
    >
      <!-- 드래그 핸들 -->
      <div
        class="flex cursor-grab items-center justify-center text-gray-400 hover:text-gray-600 active:cursor-grabbing"
      >
        <DragHandleIcon />
      </div>

      <!-- 질문 -->
      <div class="min-w-0 overflow-hidden" onclick={() => onRowClick(item)}>
        <span class="text-body-02-regular block truncate text-gray-900"
          >{item.question}</span
        >
      </div>

      <!-- 게시 -->
      <div class="text-center" onclick={() => onRowClick(item)}>
        {#if item.is_published}
          <span
            class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700"
            >게시</span
          >
        {:else}
          <span
            class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500"
            >숨김</span
          >
        {/if}
      </div>

      <!-- 순서 -->
      <div class="text-center" onclick={() => onRowClick(item)}>
        <span class="text-body-02-regular text-gray-600">{item.sort_order}</span
        >
      </div>

      <!-- 작성일 -->
      <div class="text-center" onclick={() => onRowClick(item)}>
        <span class="text-body-02-regular text-gray-500"
          >{formatDate(item.created_at, 'YYYY-MM-DD')}</span
        >
      </div>

      <!-- 삭제 -->
      <div class="flex items-center justify-center">
        <button
          class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          onclick={(e) => onDelete(item.id, e)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  {/each}

  <!-- drop 위치 인디케이터 -->
  {#if isDragging && dragOverIndex !== null && dragOverIndex !== draggedIndex}
    {@const targetRow = rowRefs[dragOverIndex]}
    {#if targetRow}
      {@const rect = targetRow.getBoundingClientRect()}
      {@const containerRect = containerRef?.getBoundingClientRect()}
      {#if containerRect}
        {@const scrollTop = containerRef?.scrollTop ?? 0}
        {@const isAbove = (draggedIndex ?? 0) > dragOverIndex}
        <div
          class="pointer-events-none absolute left-0 right-0 z-40 h-0.5 bg-primary-500 rounded-full"
          style="top: {(isAbove ? rect.top : rect.bottom) -
            containerRect.top +
            scrollTop}px;"
        ></div>
      {/if}
    {/if}
  {/if}
</div>

<!-- ghost: 실제 행 크기/위치 그대로 fixed 복제 -->
{#if isDragging && draggedIndex !== null && ghostRect && ghostColWidths.length > 0}
  {@const item = items[draggedIndex]}
  <div
    class="pointer-events-none fixed z-50 grid items-center gap-4 rounded-lg border border-primary-300 bg-primary-50/80 shadow-2xl px-6"
    style="top: {ghostTop}px; left: {ghostLeft}px; width: {ghostRect.width}px; height: {ghostRect.height}px; grid-template-columns: {ghostColWidths
      .map((w) => `${w}px`)
      .join(' ')};"
  >
    <div class="flex items-center justify-center text-primary-400">
      <DragHandleIcon />
    </div>
    <div class="min-w-0 overflow-hidden">
      <span
        class="text-body-02-regular block truncate text-gray-900 font-medium"
        >{item.question}</span
      >
    </div>
    <div class="text-center">
      {#if item.is_published}
        <span
          class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700"
          >게시</span
        >
      {:else}
        <span
          class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500"
          >숨김</span
        >
      {/if}
    </div>
    <div class="text-center">
      <span class="text-body-02-regular text-gray-600">{item.sort_order}</span>
    </div>
    <div class="text-center">
      <span class="text-body-02-regular text-gray-500"
        >{formatDate(item.created_at, 'YYYY-MM-DD')}</span
      >
    </div>
    <div></div>
  </div>
{/if}
