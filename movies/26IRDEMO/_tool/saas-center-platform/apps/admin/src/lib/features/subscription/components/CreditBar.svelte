<script lang="ts">
  import { CREDIT_USAGE_THRESHOLDS } from '../constants'

  interface Props {
    used: number
    limit: number
    showLabel?: boolean
  }

  let { used, limit, showLabel = true }: Props = $props()

  const pct = $derived(limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0)

  const barColor = $derived(
    pct >= CREDIT_USAGE_THRESHOLDS.DANGER
      ? 'bg-red-500'
      : pct >= CREDIT_USAGE_THRESHOLDS.WARNING
        ? 'bg-amber-400'
        : 'bg-blue-500'
  )
</script>

<div>
  {#if showLabel}
    <div class="mb-1 flex items-center justify-between text-xs">
      <span class="text-gray-500">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      <span class="tabular-nums font-medium {pct >= CREDIT_USAGE_THRESHOLDS.DANGER ? 'text-red-600' : pct >= CREDIT_USAGE_THRESHOLDS.WARNING ? 'text-amber-600' : 'text-gray-600'}">{pct}%</span>
    </div>
  {/if}
  <div class="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
    <div class="h-full rounded-full transition-all duration-500 {barColor}" style="width: {pct}%"></div>
  </div>
</div>
