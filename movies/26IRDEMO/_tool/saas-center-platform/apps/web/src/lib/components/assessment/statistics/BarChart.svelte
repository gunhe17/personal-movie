<script lang="ts">
  import type {
    BarChartItem,
    TooltipData
  } from '$lib/features/assessment/statistics/types'
  import { CHART_COLORS } from '$lib/features/assessment/statistics/constants'

  interface Props {
    title: string
    data: BarChartItem[]
    containerHeight?: number
  }

  let { title, data, containerHeight = 307 }: Props = $props()

  // 차트 SVG 높이 계산 (컨테이너 - 패딩 - 제목 영역)
  // pt-6 (24px) + 제목 + mb-4 ≈ 64px
  const height = $derived(containerHeight - 64)

  // 차트 설정
  const padding = { top: 20, right: 20, bottom: 60, left: 40 }
  const barGap = 8

  // 컨테이너 너비 추적
  let containerWidth = $state(800)
  let containerEl = $state<HTMLDivElement | null>(null)

  $effect(() => {
    if (!containerEl) return

    const observer = new ResizeObserver((entries) => {
      containerWidth = entries[0].contentRect.width
    })
    observer.observe(containerEl)

    return () => observer.disconnect()
  })

  // 차트 영역 계산
  const chartWidth = $derived(containerWidth - padding.left - padding.right)
  const chartHeight = $derived(height - padding.top - padding.bottom)

  // Y축 최대값 (10 단위로 올림)
  const maxValue = $derived(
    Math.ceil(Math.max(...data.map((d) => d.value), 1) / 10) * 10
  )

  // Y축 눈금
  const yTicks = $derived(() => {
    const ticks: number[] = []
    for (let i = 0; i <= maxValue; i += 10) {
      ticks.push(i)
    }
    return ticks
  })

  // 막대 너비 (고정 28px)
  const barWidth = 28

  // 막대 간격 계산 (컨테이너에 맞게 분배)
  const barSpacing = $derived(
    (chartWidth - barWidth * data.length) / (data.length + 1)
  )

  // 막대 위치 계산
  const getBarX = (index: number) => {
    return padding.left + barSpacing + index * (barWidth + barSpacing)
  }

  const getBarY = (value: number) => {
    return padding.top + chartHeight - (value / maxValue) * chartHeight
  }

  const getBarHeight = (value: number) => {
    return (value / maxValue) * chartHeight
  }

  // 툴팁 상태
  let tooltip = $state<TooltipData | null>(null)

  const handleMouseEnter = (item: BarChartItem, index: number) => {
    tooltip = {
      label: item.label,
      value: item.value,
      x: getBarX(index) + barWidth / 2,
      y: getBarY(item.value) - 10
    }
  }

  const handleMouseLeave = () => {
    tooltip = null
  }
</script>

<div
  class="rounded-lg border border-gray-200 bg-white px-6 pt-6"
  style="height: {containerHeight}px;"
>
  <!-- 제목 -->
  <h3 class="text-body-01-normal-semibold mb-4 text-gray-900">{title}</h3>

  <!-- 차트 컨테이너 -->
  <div bind:this={containerEl} class="relative w-full">
    <svg width={containerWidth} {height} class="overflow-visible">
      <!-- Y축 눈금선 및 라벨 -->
      {#each yTicks() as tick}
        {@const y = getBarY(tick)}
        <!-- 눈금선 -->
        <line
          x1={padding.left}
          y1={y}
          x2={containerWidth - padding.right}
          y2={y}
          stroke={CHART_COLORS.grid}
          stroke-dasharray="4,4"
        />
        <!-- Y축 라벨 -->
        <text
          x={padding.left - 8}
          {y}
          text-anchor="end"
          dominant-baseline="middle"
          fill={CHART_COLORS.text}
          font-size="12"
        >
          {tick}
        </text>
      {/each}

      <!-- 막대 -->
      {#each data as item, index}
        {@const x = getBarX(index)}
        {@const y = getBarY(item.value)}
        {@const barH = getBarHeight(item.value)}
        {@const r = 4}

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <path
          d="M {x} {y + r} Q {x} {y} {x + r} {y} L {x + barWidth - r} {y} Q {x +
            barWidth} {y} {x + barWidth} {y + r} L {x + barWidth} {y +
            barH} L {x} {y + barH} Z"
          fill="#4C87F6"
          class="cursor-pointer transition-all duration-150 hover:fill-[#3B6FD9]"
          onmouseenter={() => handleMouseEnter(item, index)}
          onmouseleave={handleMouseLeave}
        />

        <!-- X축 라벨 -->
        <text
          x={x + barWidth / 2}
          y={height - padding.bottom + 20}
          text-anchor="middle"
          fill={CHART_COLORS.text}
          font-size="12"
          class="select-none"
        >
          {item.label.length > 8 ? item.label.slice(0, 8) + '...' : item.label}
        </text>
      {/each}
    </svg>

    <!-- 툴팁 -->
    {#if tooltip}
      <div
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
        style="left: {tooltip.x}px; top: {tooltip.y}px;"
      >
        <p class="text-caption-medium whitespace-nowrap text-gray-600">
          {new Date().toISOString().split('T')[0]}
        </p>
        <p class="text-body-02-normal-medium whitespace-nowrap text-gray-900">
          진행건수 <span class="font-semibold">{tooltip.value}건</span>
        </p>
      </div>
    {/if}
  </div>
</div>
