<script lang="ts">
  interface PlanItem {
    key: string
    count: number
    pct: number
    color: string
    label: string
  }

  interface Props {
    plans: PlanItem[]
    hoveredPlan?: string | null
    onHover?: (key: string | null) => void
    onClick?: (key: string) => void
  }

  let { plans, hoveredPlan = null, onHover, onClick }: Props = $props()
</script>

<div class="space-y-2">
  {#each plans as plan}
    {@const isHovered = hoveredPlan === plan.key}
    <button
      class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors
        {isHovered ? 'bg-gray-100' : 'hover:bg-gray-50'}
        {plan.count === 0 ? 'opacity-40' : ''}"
      onmouseenter={() => onHover?.(plan.key)}
      onmouseleave={() => onHover?.(null)}
      onclick={() => plan.count > 0 && onClick?.(plan.key)}
    >
      <span
        class="h-2.5 w-2.5 shrink-0 rounded-sm transition-transform {isHovered ? 'scale-125' : ''}"
        style="background: {plan.color}"
      ></span>
      <span class="flex-1 text-sm {plan.count > 0 ? 'font-medium text-gray-800' : 'text-gray-400'}">{plan.label}</span>
      <span class="text-sm tabular-nums">
        <span class="font-bold {plan.count > 0 ? 'text-gray-800' : 'text-gray-300'}">{plan.count}</span>
        <span class="ml-0.5 text-xs text-gray-400">{plan.pct}%</span>
      </span>
    </button>
  {/each}
</div>
