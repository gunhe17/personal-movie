<script lang="ts">
  import { getContext } from 'svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getLabCostSummary,
    getLabExperimentList,
    type CostSummaryResponse,
    type ExperimentListResponse,
    type LabMetadataResponse,
  } from '$hooks/actions/aiLab.action'
  import {
    mapExperiment,
    buildKpiCards,
    buildProductionCostBreakdown,
    buildLabCostBreakdown,
    buildModelPerformanceByType,
  } from '$lib/features/ai-lab/dashboard/view-model'

  import PageHeader from '$components/PageHeader.svelte'
  import KpiCards from '$lib/features/ai-lab/dashboard/components/KpiCards.svelte'
  import CostBreakdown from '$lib/features/ai-lab/dashboard/components/CostBreakdown.svelte'
  import RecentExperiments from '$lib/features/ai-lab/dashboard/components/RecentExperiments.svelte'
  import ModelPerformance from '$lib/features/ai-lab/dashboard/components/ModelPerformance.svelte'

  const getMetadata = getContext<() => LabMetadataResponse | undefined>('labMetadata')
  const metadata = $derived(getMetadata())

  // ── Queries ──
  const costQ = $derived(
    queryBuilder(getLabCostSummary, () => ({}), () => ({ throwOnError: false, retry: 2 })),
  )
  const experimentsQ = $derived(
    queryBuilder(getLabExperimentList, () => ({ size: 100 }), () => ({ throwOnError: false, retry: 2 })),
  )

  // ── Derived Data ──
  const costData = $derived((costQ.data as CostSummaryResponse) ?? null)
  const allExperiments = $derived((experimentsQ.data as ExperimentListResponse)?.items ?? [])

  const kpiCards = $derived(buildKpiCards(costData))
  const productionCost = $derived(buildProductionCostBreakdown(costData, metadata))
  const labCost = $derived(buildLabCostBreakdown(costData, metadata))
  const recentExperiments = $derived(allExperiments.slice(0, 5).map((e) => mapExperiment(e, metadata)))
  const modelPerformance = $derived(buildModelPerformanceByType(allExperiments, metadata))

  const isLoading = $derived(costQ.isPending)
</script>

{#if isLoading}
  <div class="flex items-center justify-center py-32">
    <div class="flex flex-col items-center gap-3">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      <p class="text-body-03-normal-regular text-gray-400">불러오는 중...</p>
    </div>
  </div>
{:else}
  <PageHeader title="AI Lab 대시보드" description="AI 비용 · 사용 현황 · 실험 결과" />

  <div class="space-y-5">
    <!-- 퀵 가이드 + 기간 표시 -->
    <section class="section-border flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary-500 px-5 py-3.5">
      <div>
        <p class="text-body-03-normal-regular text-gray-600">
          AI 기능의 비용과 성능을 한눈에 확인하세요.
        </p>
        <p class="mt-0.5 text-label-01-normal-regular text-gray-400">전체 기간 누적 데이터 · 환율: 1 USD = 1,400 KRW (고정)</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <a
          href="/ai-lab/lab"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-body-03-normal-medium text-white transition-colors hover:bg-primary-600"
        >
          실험실
        </a>
        <a
          href="/ai-lab/feature-test"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-body-03-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          통합 테스트
        </a>
      </div>
    </section>

    <!-- KPI 카드 (3열) -->
    <KpiCards cards={kpiCards} />

    <!-- 비용 분석 (2열) -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <CostBreakdown data={productionCost} />
      <CostBreakdown data={labCost} />
    </div>

    <!-- 모델 성능 + 최근 실험 (2열) -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ModelPerformance groups={modelPerformance} />
      <RecentExperiments experiments={recentExperiments} />
    </div>
  </div>
{/if}
