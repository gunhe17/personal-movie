<script lang="ts">
  import type { StatsSummary } from '$lib/features/assessment/statistics/types'

  interface Props {
    data: StatsSummary
  }

  let { data }: Props = $props()

  // 증감 화살표
  const trendArrow = $derived(
    data.trendValue !== undefined ? (data.trendValue >= 0 ? '▲' : '▼') : ''
  )
</script>

<div
  class="flex h-[142px] flex-col justify-between rounded-lg border border-gray-200 bg-white p-5"
>
  <!-- 라벨 -->
  <p class="text-body-02-normal-regular text-gray-600">{data.label}</p>

  <!-- 값 + 부가 정보 -->
  <div class="flex items-baseline gap-3">
    <span class="text-[32px] font-bold leading-tight text-gray-900">
      {data.value.toLocaleString()}건
    </span>

    {#if data.trendValue !== undefined}
      <!-- 증감 표시 (파란색) -->
      <span class="text-body-02-normal-regular text-primary-500">
        {data.trendLabel ?? '어제보다'}
        {Math.abs(data.trendValue)}건 {trendArrow}
      </span>
    {:else if data.percentageValue !== undefined}
      <!-- 비율 표시 -->
      <span class="text-body-02-normal-regular text-gray-500">
        {data.percentageLabel ?? '전체 대비'}
        {data.percentageValue}%
      </span>
    {/if}
  </div>
</div>
