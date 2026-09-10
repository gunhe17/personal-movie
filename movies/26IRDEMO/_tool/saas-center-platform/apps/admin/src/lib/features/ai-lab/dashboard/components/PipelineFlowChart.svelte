<script lang="ts">
  import type { PipelineConfigVM } from '../../production/view-model'
  import type { CostSummaryResponse } from '$hooks/actions/aiLab.action'

  let {
    configs = [],
    costData = null,
  }: {
    configs: PipelineConfigVM[]
    costData?: CostSummaryResponse | null
  } = $props()

  // 자동 파이프라인 vs 개별 기능 구분
  const AUTO_STEPS = ['chain_stt_refine', 'summary']
  const INDIVIDUAL_STEPS = ['stt_transcribe', 'recommendation', 'counseling_note']

  const autoConfigs = $derived(
    AUTO_STEPS.map((key) => configs.find((c) => c.step === key)).filter(Boolean) as PipelineConfigVM[],
  )
  const individualConfigs = $derived(
    INDIVIDUAL_STEPS.map((key) => configs.find((c) => c.step === key)).filter(Boolean) as PipelineConfigVM[],
  )

  const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    stt_transcribe: { label: 'STT', color: 'bg-amber-50 text-amber-600' },
    chain_stt_refine: { label: 'STT+LLM', color: 'bg-violet-50 text-violet-600' },
    refine: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
    summary: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
    counseling_note: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
    recommendation: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
  }

  const costMap = $derived(() => {
    if (!costData) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const bp of costData.production.by_purpose) {
      map.set(bp.purpose, bp.calls > 0 ? bp.estimated_cost_usd / bp.calls : 0)
    }
    return map
  })

  function getCostPerCall(step: string): string {
    const cost = costMap().get(step)
    if (cost == null || cost === 0) return '-'
    if (cost < 0.001) return `$${cost.toFixed(6)}`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }
</script>

<section class="section-border p-6">
  <div class="mb-5 flex items-center justify-between">
    <h2 class="text-body-03-normal-semibold text-gray-900">프로덕션 파이프라인</h2>
    <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-label-01-normal-medium text-emerald-600">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      Live
    </span>
  </div>

  {#if configs.length === 0}
    <div class="flex items-center justify-center py-12">
      <p class="text-body-03-normal-regular text-gray-400">파이프라인 설정을 불러오는 중...</p>
    </div>
  {:else}
    <!-- 자동 파이프라인 -->
    <div class="mb-2">
      <p class="mb-2.5 text-label-01-normal-medium text-gray-400">자동 파이프라인 (녹음 완료 시)</p>
      <div class="flex items-stretch gap-2 overflow-x-auto pb-1">
        {#each autoConfigs as config, i}
          {#if i > 0}
            <div class="flex shrink-0 items-center">
              <svg class="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          {/if}

          {@const badge = TYPE_BADGE[config.step]}
          <a
            href="/ai-lab/lab?step={config.step}"
            class="group flex min-w-[140px] flex-1 flex-col rounded-2xl border p-3.5 transition-all hover:border-primary-300 hover:shadow-sm
              {config.isConfigured ? 'border-gray-200 bg-[#FDFDFD]' : 'border-dashed border-gray-200 bg-white'}"
          >
            <div class="flex items-center justify-between">
              <p class="text-label-01-normal-bold text-gray-900">{config.label}</p>
              <span class="rounded-full px-1.5 py-0.5 text-label-01-normal-bold {badge?.color ?? 'bg-gray-100 text-gray-500'}">
                {badge?.label ?? 'AI'}
              </span>
            </div>

            <div class="mt-2">
              {#if config.isConfigured}
                <span class="inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-label-01-normal-medium text-blue-700">
                  {config.modelLabel}
                </span>
              {:else}
                <span class="inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-medium text-gray-400">
                  미설정
                </span>
              {/if}
            </div>

            <p class="mt-2.5 text-body-01-normal-bold tabular-nums text-gray-900">{getCostPerCall(config.step)}</p>
            <p class="text-label-01-normal-regular text-gray-400">건당 비용</p>

            <p class="mt-1.5 text-label-01-normal-medium text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
              실험실에서 개선 →
            </p>
          </a>
        {/each}
      </div>
    </div>

    <!-- 개별 기능 -->
    {#if individualConfigs.length > 0}
      <div class="mt-4">
        <p class="mb-2.5 text-label-01-normal-medium text-gray-400">실시간 상담 · 개별 기능</p>
        <div class="grid grid-cols-3 gap-2">
          {#each individualConfigs as config}
            {@const badge = TYPE_BADGE[config.step]}
            <a
              href="/ai-lab/lab?step={config.step}"
              class="group flex flex-col rounded-2xl border p-3.5 transition-all hover:border-primary-300 hover:shadow-sm
                {config.isConfigured ? 'border-gray-200 bg-[#FDFDFD]' : 'border-dashed border-gray-200 bg-white'}"
            >
              <div class="flex items-center justify-between">
                <p class="text-label-01-normal-bold text-gray-900">{config.label}</p>
                <span class="rounded-full px-1.5 py-0.5 text-label-01-normal-bold {badge?.color ?? 'bg-gray-100 text-gray-500'}">
                  {badge?.label ?? 'AI'}
                </span>
              </div>

              <div class="mt-2">
                {#if config.isConfigured}
                  <span class="inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-label-01-normal-medium text-blue-700">
                    {config.modelLabel}
                  </span>
                {:else}
                  <span class="inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-medium text-gray-400">
                    미설정
                  </span>
                {/if}
              </div>

              <p class="mt-1.5 text-label-01-normal-medium text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
                실험실에서 개선 →
              </p>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>
