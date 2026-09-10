<script lang="ts">
  import type { CreditPace } from '../view-model'

  interface KpiItem {
    label: string
    value: string
    unit?: string
    trend?: { direction: 'up' | 'down' | 'stable'; percent: number }
  }

  interface Props {
    pace: CreditPace
    creditRemaining: number
    estimatedDepletionDays: number
    daysUntilReset: number
    kpiItems?: KpiItem[]
  }

  let {
    pace,
    creditRemaining,
    estimatedDepletionDays,
    daysUntilReset,
    kpiItems
  }: Props = $props()

  const paceColor = $derived(
    pace.status === 'surplus'
      ? 'text-green-600'
      : pace.status === 'on-track'
        ? 'text-blue-600'
        : pace.status === 'over-pace'
          ? 'text-amber-600'
          : 'text-red-600'
  )

  const statusLabel = $derived(
    pace.status === 'surplus'
      ? '여유'
      : pace.status === 'on-track'
        ? '적정'
        : pace.status === 'over-pace'
          ? '빠름'
          : '초과'
  )

  function trendColor(dir: 'up' | 'down' | 'stable'): string {
    if (dir === 'up') return 'text-status-danger'
    if (dir === 'down') return 'text-green-500'
    return 'text-gray-400'
  }

  function trendArrow(dir: 'up' | 'down' | 'stable'): string {
    if (dir === 'up') return '↑'
    if (dir === 'down') return '↓'
    return '→'
  }
</script>

<div class="rounded-lg border border-gray-200 bg-white px-6 py-6">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-title-01-normal-semibold text-gray-900">사용 분석</h2>
    <span class="text-body-03-normal-medium {paceColor}">{statusLabel}</span>
  </div>

  {#if kpiItems && kpiItems.length > 0}
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-03-normal-regular text-gray-500 mb-2"
    >
      {#each kpiItems as kpi, i}
        {#if i > 0}<span class="text-gray-300">·</span>{/if}
        <span>
          {kpi.label}
          <strong
            class="text-body-03-normal-medium tabular-nums text-gray-800 ml-0.5"
            >{kpi.value}</strong
          >
          {#if kpi.unit}<span class="text-gray-400">{kpi.unit}</span>{/if}
          {#if kpi.trend}
            <span class="tabular-nums {trendColor(kpi.trend.direction)} ml-0.5">
              {trendArrow(kpi.trend.direction)}{Math.abs(kpi.trend.percent)}%
            </span>
          {/if}
        </span>
      {/each}
    </div>
    <div class="border-t border-gray-100 mb-2"></div>
  {/if}

  <div class="space-y-1">
    <div class="flex items-center justify-between py-0.5">
      <div class="flex items-baseline gap-1.5">
        <span class="text-body-02-normal-medium text-gray-700">하루 권장량</span
        >
        <span class="text-body-03-normal-regular text-gray-400"
          >{creditRemaining.toLocaleString()} ÷ {pace.daysUntilReset}일</span
        >
      </div>
      <span class="tabular-nums text-body-02-normal-medium text-gray-900"
        >{pace.dailyBudget.toLocaleString()}
        <span class="text-body-03-normal-regular text-gray-400">크레딧/일</span
        ></span
      >
    </div>

    <div class="flex items-center justify-between py-0.5">
      <div class="flex items-baseline gap-1.5">
        <span class="text-body-02-normal-medium text-gray-700"
          >실제 사용 속도</span
        >
        <span class="text-body-03-normal-regular text-gray-400"
          >최근 {pace.daysElapsed}일</span
        >
      </div>
      <span class="tabular-nums text-body-02-normal-medium {paceColor}"
        >{pace.dailyActual.toLocaleString()}
        <span class="text-body-03-normal-regular text-gray-400">크레딧/일</span
        ></span
      >
    </div>

    <div class="flex items-center justify-between py-0.5">
      <span class="text-body-02-normal-medium text-gray-700">권장 대비</span>
      <span class="tabular-nums text-body-02-normal-medium {paceColor}"
        >{pace.pacePercent}%</span
      >
    </div>

    <div class="flex items-center justify-between py-0.5">
      <span class="text-body-02-normal-medium text-gray-700"
        >리셋 시점 예상</span
      >
      <span
        class="tabular-nums text-body-02-normal-medium {pace.projectedRemaining >
        0
          ? 'text-green-600'
          : 'text-red-600'}"
      >
        {#if pace.projectedRemaining > 0}
          {pace.projectedRemaining.toLocaleString()} 남음
        {:else if estimatedDepletionDays > 0}
          약 {estimatedDepletionDays}일 후 소진
        {:else}
          소진됨
        {/if}
      </span>
    </div>
  </div>
</div>
