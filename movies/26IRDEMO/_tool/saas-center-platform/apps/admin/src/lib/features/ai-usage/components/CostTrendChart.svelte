<script lang="ts">
  import type { MonthlyUsageItem } from '$hooks/actions/ai-usage.action'
  import MonthlyBarChart from './MonthlyBarChart.svelte'

  interface Props {
    monthlyItems: MonthlyUsageItem[]
    selectedMonth: string
    onMonthSelect?: (month: string) => void
  }

  let { monthlyItems, selectedMonth, onMonthSelect }: Props = $props()
</script>

<div class="mb-6 section-border bg-white">
  <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
    <h2 class="text-title-01-normal-semibold text-gray-900">비용 추이</h2>
    <span class="text-label-01-normal-regular text-gray-400">바를 클릭해 월별 상세 조회</span>
  </div>
  <MonthlyBarChart items={monthlyItems} {selectedMonth} mode="cost" {onMonthSelect} />
</div>
