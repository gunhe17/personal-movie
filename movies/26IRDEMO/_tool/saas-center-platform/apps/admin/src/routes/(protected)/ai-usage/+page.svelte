<script lang="ts">
  import { fade } from 'svelte/transition'
  import { queryBuilder } from '$hooks/queries/builder'
  import PageHeader from '$lib/components/PageHeader.svelte'
  import Select from '$lib/components/Select.svelte'

  import { createAiUsageState } from '$lib/features/ai-usage/hooks.svelte'
  import { calcAlertLevel, calcAlertMessage } from '$lib/features/ai-usage/view-model'

  import StatusBanner from '$lib/features/ai-usage/components/StatusBanner.svelte'
  import KpiCards from '$lib/features/ai-usage/components/KpiCards.svelte'
  import CostTrendChart from '$lib/features/ai-usage/components/CostTrendChart.svelte'
  import FeatureCostTable from '$lib/features/ai-usage/components/FeatureCostTable.svelte'
  import CenterTopList from '$lib/features/ai-usage/components/CenterTopList.svelte'

  import {
    getAiUsageSummary,
    getAiUsageByFeature,
    getAiUsageMonthly,
    getAiUsageByCenter,
  } from '$hooks/actions/ai-usage.action'

  const state = createAiUsageState()

  // ─── 쿼리 ───
  const summaryQuery = queryBuilder(getAiUsageSummary, () => ({ month: state.selectedMonth }))
  const featureQuery = queryBuilder(getAiUsageByFeature, () => ({
    date_from: state.selectedDateFrom,
    date_to: state.selectedDateTo,
  }))
  const monthlyQuery = queryBuilder(getAiUsageMonthly)
  const centerQuery = queryBuilder(getAiUsageByCenter, () => ({
    size: 10,
    date_from: state.selectedDateFrom,
    date_to: state.selectedDateTo,
  }))

  // ─── 파생 데이터 ───
  const summary = $derived(summaryQuery.data)
  const features = $derived(featureQuery.data?.items ?? [])
  const monthlyItems = $derived(monthlyQuery.data?.items ?? [])
  const centers = $derived(centerQuery.data?.items ?? [])
  const isLoading = $derived(summaryQuery.isLoading || featureQuery.isLoading || monthlyQuery.isLoading)

  const alertLevel = $derived(calcAlertLevel(summary))
  const alertMessage = $derived(calcAlertMessage(summary, alertLevel))
</script>

<div in:fade class="p-6">
  <PageHeader title="AI 사용량 관리" description="플랫폼 전체 AI 비용 및 사용 현황">
    {#snippet actions()}
      <Select
        class="h-11 w-36 rounded-lg bg-white"
        selected={state.selectedPeriod}
        showActiveHighlight={true}
        defaultValue={state.currentMonth}
        on:change={(e) => { state.selectedPeriod = e.detail.value }}
        options={state.monthOptions}
      />
    {/snippet}
  </PageHeader>

  <!-- Zone A: 상태 배너 (경고/위험 시만 표시) -->
  <StatusBanner
    level={alertLevel}
    message={alertMessage}
    anchorId={alertLevel !== 'normal' ? 'zone-centers' : undefined}
  />

  <!-- Zone B: KPI 카드 2장 -->
  <KpiCards
    {summary}
    selectedPeriod={state.selectedPeriod}
    currentMonth={state.currentMonth}
    {isLoading}
  />

  <!-- Zone C: 비용 추이 차트 -->
  <CostTrendChart
    monthlyItems={monthlyItems}
    selectedMonth={state.selectedMonth}
    onMonthSelect={(month) => { state.selectedPeriod = month }}
  />

  <!-- Zone D + E: 기능별 / 센터별 — 2단 그리드 -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
    <FeatureCostTable {features} />
    <CenterTopList {centers} />
  </div>
</div>
