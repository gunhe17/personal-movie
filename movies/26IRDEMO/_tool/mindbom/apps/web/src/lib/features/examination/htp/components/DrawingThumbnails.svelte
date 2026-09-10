<script lang="ts">
  import type { DrawingData } from '../types'

  interface Props {
    drawings: DrawingData[]
    activeIndex: number // -1 = 전체(선택 없음)
    onSelect: (index: number) => void
  }

  let { drawings, activeIndex, onSelect }: Props = $props()

  let isAllSelected = $derived(activeIndex === -1)
</script>

<div class="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
  {#each drawings as drawing, index (drawing.id)}
    {@const isActive = index === activeIndex}
    <button
      onclick={() => onSelect(index)}
      class="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all
        {isActive ? 'ring-2 ring-blue-500 ring-offset-2 border-gray-200' : isAllSelected ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white opacity-50'}"
    >
      <!-- Thumbnail -->
      <div class="w-14 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-300">
        {#if drawing.imageUrl}
          <img src={drawing.imageUrl} alt={drawing.label} class="w-full h-full object-cover" />
        {:else}
          <span class="material-icons-round text-2xl {drawing.textClass}">{drawing.icon}</span>
        {/if}
      </div>
      <!-- Label -->
      <div class="flex items-center gap-1">
        <span class="material-icons-round text-sm {drawing.textClass}">{drawing.icon}</span>
        <span class="font-medium text-gray-800">{drawing.label}</span>
      </div>
    </button>
  {/each}
</div>
