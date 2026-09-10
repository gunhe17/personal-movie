<script lang="ts">
  import type { DonutChartItem } from '$lib/features/assessment/statistics/types'
  import { DONUT_CHART_COLORS } from '$lib/features/assessment/statistics/constants'

  interface Props {
    title: string
    data: DonutChartItem[]
    size?: number
    strokeWidth?: number
  }

  let { title, data, size = 200, strokeWidth = 40 }: Props = $props()

  const radius = $derived((size - strokeWidth) / 2)
  const circumference = $derived(2 * Math.PI * radius)
  const center = $derived(size / 2)

  // 총합 계산
  const total = $derived(data.reduce((sum, item) => sum + item.value, 0))

  // 가장 큰 값 항목 (중앙 표시용)
  const topItem = $derived(
    data.length > 0
      ? data.reduce(
          (max, item) => (item.value > max.value ? item : max),
          data[0]
        )
      : { label: '-', value: 0 }
  )
  const topPercentage = $derived(
    total > 0 ? Math.round((topItem.value / total) * 100) : 0
  )

  // 세그먼트 데이터 계산 (offset 포함)
  const segments = $derived.by(() => {
    let currentOffset = 0
    return data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0
      const dashLength = (percentage / 100) * circumference
      const segment = {
        ...item,
        percentage,
        dashLength,
        offset: currentOffset,
        color:
          item.color || DONUT_CHART_COLORS[index % DONUT_CHART_COLORS.length]
      }
      currentOffset += dashLength
      return segment
    })
  })
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6">
  <h3 class="text-body-01-normal-semibold mb-6 text-gray-900">{title}</h3>

  <div class="flex items-center justify-center gap-12">
    <!-- 도넛 차트 -->
    <div class="relative flex-shrink-0">
      <svg width={size} height={size} viewBox="0 0 {size} {size}">
        <!-- 배경 원 -->
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="#E5E7EB"
          stroke-width={strokeWidth}
        />

        <!-- 데이터 세그먼트 -->
        {#each segments as segment}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={segment.color}
            stroke-width={strokeWidth}
            stroke-dasharray="{segment.dashLength} {circumference}"
            stroke-dashoffset={-segment.offset}
            transform="rotate(-90 {center} {center})"
            class="transition-all duration-300"
          />
        {/each}
      </svg>

      <!-- 중앙 텍스트 -->
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-body-01-normal-medium text-gray-600"
          >{topItem.label}</span
        >
        <span class="text-headline-01-bold text-gray-900">{topPercentage}%</span
        >
      </div>
    </div>

    <!-- 범례 (오른쪽) -->
    <div class="flex flex-col gap-2.5">
      {#each segments as segment}
        <div class="flex items-center gap-2">
          <span
            class="h-2 w-2 rounded-full flex-shrink-0"
            style="background-color: {segment.color}"
          ></span>
          <span class="text-body-03-normal-regular text-gray-600">
            {segment.label}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>
