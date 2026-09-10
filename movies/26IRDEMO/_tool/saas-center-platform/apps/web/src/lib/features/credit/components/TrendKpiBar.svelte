<script lang="ts">
  interface KpiItem {
    label: string
    value: string
    unit?: string
    trend?: { direction: 'up' | 'down' | 'stable'; percent: number }
  }

  interface Props {
    items: KpiItem[]
  }

  let { items }: Props = $props()

  // 항목 수에 맞춰 lg 그리드 열 수 조정 (3개/4개 모두 균등 배치)
  const lgGrid = $derived(
    items.length >= 4
      ? 'lg:grid-cols-4'
      : items.length === 3
        ? 'lg:grid-cols-3'
        : 'lg:grid-cols-2'
  )

  function trendColor(_dir: 'up' | 'down' | 'stable'): string {
    // 사용량 추세는 중립 지표 — 방향은 화살표로 표시하고 색은 중립(gray)으로 통일
    return 'text-gray-500'
  }

  function trendArrow(dir: 'up' | 'down' | 'stable'): string {
    if (dir === 'up') return '↑'
    if (dir === 'down') return '↓'
    return '→'
  }
</script>

<div class="rounded-lg border border-gray-200 bg-white">
  <div class="grid grid-cols-2 {lgGrid} divide-x divide-gray-100">
    {#each items as item, i}
      <div
        class="px-6 py-5 {i === 0 ? 'lg:pl-6' : ''} {i === items.length - 1
          ? 'lg:pr-6'
          : ''}"
      >
        <p class="text-body-03-normal-regular text-gray-400 mb-1">
          {item.label}
        </p>
        <div class="flex items-baseline gap-1 flex-wrap">
          {#if item.value}
            <span
              class="text-title-01-normal-semibold tabular-nums text-gray-900"
              >{item.value}</span
            >
          {/if}
          {#if item.unit}
            <span class="text-body-03-normal-regular text-gray-400"
              >{item.unit}</span
            >
          {/if}
          {#if item.trend}
            <span
              class="text-body-02-normal-medium tabular-nums {trendColor(
                item.trend.direction
              )}"
            >
              {trendArrow(item.trend.direction)}
              {Math.abs(item.trend.percent)}%
            </span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
