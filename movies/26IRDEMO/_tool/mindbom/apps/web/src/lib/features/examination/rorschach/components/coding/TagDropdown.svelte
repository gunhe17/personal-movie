<script lang="ts">
  import { portal } from '$lib/utils/positionPortal'

  interface Props {
    /** 트리거 버튼 요소. portal anchor로 사용 */
    anchor: HTMLElement
    options: readonly string[]
    selected: string | string[] | null
    isMulti: boolean
    onSelect: (value: string) => void
    onClose: () => void
  }

  let { anchor, options, selected, isMulti, onSelect, onClose }: Props = $props()

  let filter = $state('')
  let inputEl: HTMLInputElement | null = $state(null)

  $effect(() => {
    // 마운트 직후 input 포커스
    inputEl?.focus()
  })

  let filtered = $derived(
    options.filter(opt => opt.toLowerCase().includes(filter.toLowerCase()))
  )

  function isSelectedVal(value: string): boolean {
    if (isMulti) return Array.isArray(selected) && selected.includes(value)
    return selected === value
  }
</script>

<div
  use:portal={{
    anchor,
    renderPosition: 'bottom',
    isFitWidth: false,
    offset: 4,
    zIndex: 60,
    callback: onClose,
  }}
  class="bg-white border border-gray-200 rounded-lg shadow-lg min-w-45 max-h-60 overflow-hidden"
>
  <div class="p-1.5 border-b border-gray-100">
    <input
      bind:this={inputEl}
      bind:value={filter}
      type="text"
      placeholder="검색..."
      class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
    />
  </div>
  <div class="overflow-y-auto max-h-45">
    {#each filtered as opt (opt)}
      {@const sel = isSelectedVal(opt)}
      <button
        onclick={() => onSelect(opt)}
        class="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 {sel ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}"
      >
        {#if isMulti}
          <span class="w-3.5 h-3.5 rounded border flex items-center justify-center {sel ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300'}">
            {#if sel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {/if}
          </span>
        {/if}
        <span>{opt}</span>
      </button>
    {/each}
    {#if filtered.length === 0}
      <div class="px-3 py-2 text-xs text-gray-400">일치하는 항목 없음</div>
    {/if}
  </div>
</div>
