<script lang="ts">
  import type { FlowStep } from '../view-model'

  let { steps }: { steps: FlowStep[] } = $props()

  const statusStyles: Record<string, { border: string; bg: string; text: string; dot: string }> = {
    idle: { border: 'border-gray-100', bg: 'bg-gray-50', text: 'text-gray-400', dot: 'bg-gray-300' },
    active: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
    completed: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    error: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
  }
</script>

<div class="flex items-stretch gap-0">
  {#each steps as step, i}
    {@const style = statusStyles[step.status] ?? statusStyles.idle}

    {#if i > 0}
      <div class="flex items-center px-1">
        <svg class="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    {/if}

    <div class="flex min-w-0 flex-1 flex-col items-center rounded-xl border px-3 py-3 text-center transition-colors {style.border} {style.bg}">
      <div class="mb-1.5 flex items-center gap-1.5">
        {#if step.status === 'active'}
          <span class="h-1.5 w-1.5 animate-pulse rounded-full {style.dot}"></span>
        {:else if step.status === 'completed'}
          <svg class="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        {:else if step.status === 'error'}
          <svg class="h-3.5 w-3.5 text-red-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        {/if}
        <span class="text-label-01-normal-medium text-gray-900">{step.label}</span>
      </div>
      <span class="text-label-01-normal-regular {style.text}">{step.description}</span>
    </div>
  {/each}
</div>
