<script lang="ts">
  import type { FeatureCard, FeatureTestId } from '../constants'

  interface Props {
    features: FeatureCard[]
    activeFeatureId: FeatureTestId
    onSelect: (id: FeatureTestId) => void
  }

  let { features, activeFeatureId, onSelect }: Props = $props()
</script>

<div class="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
  {#each features as f}
    {@const isActive = activeFeatureId === f.id}
    <button
      class="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-body-03-normal-medium transition-colors
        {isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
      onclick={() => onSelect(f.id as FeatureTestId)}
    >
      <span class="h-2 w-2 rounded-full {f.icon.bg}"></span>
      {f.name}
    </button>
  {/each}
</div>
