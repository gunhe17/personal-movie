<script lang="ts">
  import { portal } from '$lib/utils/positionPortal'
  import { SCORE_RUBRIC } from '../constants'

  interface Props {
    /** 트리거 버튼 요소. portal anchor로 사용 */
    anchor: HTMLElement
    currentScore: number
    onSelect: (score: number) => void
    onClose: () => void
  }

  let { anchor, currentScore, onSelect, onClose }: Props = $props()

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
</script>

<div
  use:portal={{
    anchor,
    renderPosition: 'bottom',
    position: 'right',
    isFitWidth: false,
    offset: 4,
    zIndex: 60,
    callback: onClose,
  }}
  role="listbox"
  aria-label="점수 선택"
  class="w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
>
  {#each SCORE_RUBRIC as r (r.score)}
    {@const selected = r.score === currentScore}
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onclick={() => onSelect(r.score)}
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors
        {selected
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-700 hover:bg-gray-50'}"
    >
      <span
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border
          {selected ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}"
      >
        {#if selected}
          <span class="h-1.5 w-1.5 rounded-full bg-white"></span>
        {/if}
      </span>
      <span class="w-4 shrink-0 font-semibold">{r.score}</span>
      <span class="flex-1">{r.label}</span>
    </button>
  {/each}
</div>
