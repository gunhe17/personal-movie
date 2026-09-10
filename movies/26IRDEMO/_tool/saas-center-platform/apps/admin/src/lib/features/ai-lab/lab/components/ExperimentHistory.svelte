<script lang="ts">
  import type { ExperimentRunSummary } from '$hooks/actions/aiLab.action'
  import { formatDateShortKST, formatLatency, formatCostKRW } from '../../constants'

  let {
    experiments = [],
    isLoading = false,
    onLoad,
  }: {
    experiments: ExperimentRunSummary[]
    isLoading?: boolean
    onLoad?: (id: string) => void
  } = $props()

  let isOpen = $state(false)

  type SortKey = 'experiment_type' | 'model_name' | 'latency_ms' | 'estimated_cost_usd' | 'quality_score' | 'created_at'
  let sortKey = $state<SortKey>('created_at')
  let sortDir = $state<'asc' | 'desc'>('desc')

  const sortedExperiments = $derived.by(() => {
    const arr = [...experiments]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? 1 : -1
      if (bv == null) return sortDir === 'asc' ? -1 : 1
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return arr
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey = key
      sortDir = key === 'created_at' ? 'desc' : 'asc'
    }
  }

  const stepLabels: Record<string, string> = {
    llm_refine: '전사 보정',
    llm_summary: '요약',
    llm_counseling_note: '상담일지',
    llm_recommendation: '상담 추천',
    stt_transcribe: 'STT 전사',
    stt_diarize: 'STT 화자분리',
    chain_stt_refine: '화자분리 + 보정',
  }

  function stars(score: number | null): string {
    if (score == null) return '-'
    return '★'.repeat(score) + '☆'.repeat(5 - score)
  }

  function simplifyModel(name: string): string {
    return name.replace(/-\d{4}-\d{2}-\d{2}$/, '')
  }

  function scoreColor(score: number | null): string {
    if (score == null) return 'text-gray-300'
    if (score >= 4) return 'text-amber-500'
    if (score >= 3) return 'text-amber-400'
    return 'text-gray-400'
  }
</script>

<div class="section-border overflow-hidden">
  <!-- 토글 헤더 -->
  <button
    class="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
    onclick={() => isOpen = !isOpen}
  >
    <div class="flex items-center gap-2.5">
      <h3 class="text-body-03-normal-semibold text-gray-900">실험 이력</h3>
      <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-label-01-normal-medium text-gray-500">
        {experiments.length}건
      </span>
    </div>
    <svg
      class="h-4 w-4 text-gray-400 transition-transform {isOpen ? 'rotate-180' : ''}"
      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  </button>

  {#if isOpen}
    <div class="border-t border-gray-100">
      {#if isLoading}
        <div class="flex items-center justify-center gap-2 py-10">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
          <span class="text-body-03-normal-regular text-gray-400">불러오는 중...</span>
        </div>
      {:else if experiments.length === 0}
        <p class="py-10 text-center text-body-03-normal-regular text-gray-400">아직 실험 이력이 없습니다. 위에서 단계를 선택하여 첫 실험을 실행해보세요.</p>
      {:else}
        <div class="max-h-96 overflow-y-auto">
          <table class="w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-50 text-left text-label-01-normal-regular text-gray-500">
                {#snippet sortTh(label: string, key: SortKey, isFirst = false, isLast = false)}
                  <th class="px-4 py-2.5 {isFirst ? 'rounded-l-lg' : ''} {isLast ? 'rounded-r-lg' : ''}">
                    <button
                      class="flex items-center gap-1 hover:text-gray-700 transition-colors {sortKey === key ? 'text-gray-700 font-semibold' : ''}"
                      onclick={() => toggleSort(key)}
                    >
                      {label}
                      {#if sortKey === key}
                        <svg class="h-3 w-3 {sortDir === 'desc' ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      {:else}
                        <svg class="h-3 w-3 opacity-30" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                      {/if}
                    </button>
                  </th>
                {/snippet}
                {@render sortTh('단계', 'experiment_type', true)}
                {@render sortTh('모델', 'model_name')}
                {@render sortTh('지연', 'latency_ms')}
                {@render sortTh('비용', 'estimated_cost_usd')}
                {@render sortTh('평점', 'quality_score')}
                {@render sortTh('일시', 'created_at', false, true)}
              </tr>
            </thead>
            <tbody>
              {#each sortedExperiments as exp}
                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td class="px-4 py-3 text-body-03-normal-medium text-gray-700">
                    {stepLabels[exp.experiment_type] ?? exp.experiment_type}
                  </td>
                  <td class="px-4 py-3">
                    <span class="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-label-01-normal-regular text-gray-500">{simplifyModel(exp.model_name)}</span>
                  </td>
                  <td class="px-4 py-3 text-label-01-normal-regular tabular-nums text-gray-500">{formatLatency(exp.latency_ms)}</td>
                  <td class="px-4 py-3 text-label-01-normal-regular tabular-nums text-gray-500">{formatCostKRW(exp.estimated_cost_usd)}</td>
                  <td class="px-4 py-3">
                    <span class="text-body-03-normal-regular {scoreColor(exp.quality_score)}">{stars(exp.quality_score)}</span>
                  </td>
                  <td class="px-4 py-3 text-label-01-normal-regular text-gray-400">{formatDateShortKST(exp.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>
