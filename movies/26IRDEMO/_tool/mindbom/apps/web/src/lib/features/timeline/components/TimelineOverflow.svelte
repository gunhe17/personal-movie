<script lang="ts">
  import type { TimelineItem } from '../types'
  import { EXAM_STATUS_VISUAL } from '$features/examination/common/exam-visual'

  interface Props {
    items: TimelineItem[]
    left: number
    top: number
    width: number
    height: number
    onClick?: (id: string) => void
  }

  let { items, left, top, width, height, onClick }: Props = $props()

  let open = $state(false)

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

  // 접힌 항목은 시각순으로 보여준다 — 목록에서는 시간이 유일한 단서다
  let sorted = $derived(
    [...items].sort(
      (a, b) => a.when.anchorAt.getTime() - b.when.anchorAt.getTime()
    )
  )
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') open = false
  }}
/>

<div class="absolute" style="left: {left}px; top: {top}px; width: {width}px; height: {height}px">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex h-full w-full items-center justify-center gap-1 rounded-md border border-gray-200 bg-white text-label-02-normal-medium text-gray-600 shadow-sm transition-shadow hover:shadow-md"
  >
    외 {items.length}건
    <span class="material-icons-round text-[14px]! leading-none text-gray-400">
      {open ? 'expand_less' : 'expand_more'}
    </span>
  </button>

  {#if open}
    <!-- 목록은 카드 위로 띄운다 — 위젯 높이가 고정이라 아래로 밀 공간이 없다 -->
    <div
      class="absolute bottom-full z-20 mb-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
    >
      {#each sorted as item (item.id)}
        {@const visual = EXAM_STATUS_VISUAL[item.state.status]}
        <button
          type="button"
          onclick={() => {
            open = false
            onClick?.(item.id)
          }}
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-50"
        >
          <span class="h-1.5 w-1.5 flex-shrink-0 rounded-full {visual.dotClass}"></span>
          <span class="flex-shrink-0 text-label-02-normal-regular tabular-nums text-gray-500">
            {fmtTime(item.when.anchorAt)}
          </span>
          <span class="truncate text-[13px] font-semibold text-gray-900">
            {item.who.name}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
