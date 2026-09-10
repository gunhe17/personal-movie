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

  // ── 기능 그룹 정의 ──

  interface FeatureGroup {
    id: string
    icon: string
    title: string
    description: string
    steps: string[]                  // 매핑되는 pipeline steps
    badge: { label: string; color: string }
    billing: string                  // 과금 요약
    status: 'active' | 'coming_soon' | 'info_only'
    hardcodedInfo?: {                // API 메타데이터 밖 기능용
      models: string[]
      note: string
    }
  }

  const FEATURE_GROUPS: FeatureGroup[] = [
    {
      id: 'realtime',
      icon: '🎙️',
      title: '실시간 상담',
      description: '5분 단위 전사 + 보정 + AI 상담 추천',
      steps: ['stt_transcribe', 'refine', 'recommendation'],
      badge: { label: 'STT + LLM', color: 'bg-amber-50 text-amber-600' },
      billing: '전사 무료 · 추천 무료',
      status: 'active',
    },
    {
      id: 'post_recording',
      icon: '🎤',
      title: '녹음 완료 후 처리',
      description: '화자분리 + 보정 + AI 요약',
      steps: ['chain_stt_refine', 'summary'],
      badge: { label: 'STT + LLM', color: 'bg-violet-50 text-violet-600' },
      billing: '전사 무료 · 요약 2크레딧',
      status: 'active',
    },
    {
      id: 'counseling_note',
      icon: '📋',
      title: 'AI 상담일지',
      description: '구조화된 상담일지 자동 생성',
      steps: ['counseling_note'],
      badge: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
      billing: '3크레딧 / 건',
      status: 'active',
    },
    {
      id: 'case_analysis',
      icon: '🔍',
      title: '사례 분석',
      description: '상담 사례 종합 분석 리포트',
      steps: [],
      badge: { label: 'LLM', color: 'bg-violet-50 text-violet-600' },
      billing: '4크레딧 / 건',
      status: 'info_only',
      hardcodedInfo: {
        models: ['gpt-4o-mini'],
        note: '상담 모듈에서 실행',
      },
    },
    {
      id: 'agent',
      icon: '🤖',
      title: 'AI 에이전트',
      description: '대화형 AI 어시스턴트',
      steps: [],
      badge: { label: 'Agent', color: 'bg-emerald-50 text-emerald-600' },
      billing: '스킬 선택 3크레딧',
      status: 'info_only',
      hardcodedInfo: {
        models: ['Gemini 2.5 Flash', 'gpt-4.1-mini'],
        note: '스킬 선택 + 체크포인트 3레이어',
      },
    },
    {
      id: 'projective_test',
      icon: '🧪',
      title: '투사 검사 AI',
      description: '투사 검사 자동 해석',
      steps: [],
      badge: { label: '준비 중', color: 'bg-gray-100 text-gray-400' },
      billing: '-',
      status: 'coming_soon',
    },
  ]

  // ── 파이프라인 config 매핑 ──

  const configMap = $derived(() => {
    const map = new Map<string, PipelineConfigVM>()
    for (const c of configs) map.set(c.step, c)
    return map
  })

  // ── 비용 데이터 매핑 ──

  const costMap = $derived(() => {
    if (!costData) return new Map<string, { costPerCall: number; calls: number }>()
    const map = new Map<string, { costPerCall: number; calls: number }>()
    for (const bp of costData.production.by_purpose) {
      map.set(bp.purpose, {
        costPerCall: bp.calls > 0 ? bp.estimated_cost_usd / bp.calls : 0,
        calls: bp.calls,
      })
    }
    return map
  })

  function getGroupStepConfigs(group: FeatureGroup): PipelineConfigVM[] {
    return group.steps
      .map((s) => configMap().get(s))
      .filter((c): c is PipelineConfigVM => c != null)
  }

  function getGroupTotalCalls(group: FeatureGroup): number {
    return group.steps.reduce((sum, s) => sum + (costMap().get(s)?.calls ?? 0), 0)
  }

  function formatCost(cost: number): string {
    if (cost === 0) return '-'
    if (cost < 0.001) return `$${cost.toFixed(6)}`
    if (cost < 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(2)}`
  }

  function getGroupAvgCost(group: FeatureGroup): string {
    let totalCost = 0
    let totalCalls = 0
    for (const s of group.steps) {
      const d = costMap().get(s)
      if (d) {
        totalCost += d.costPerCall * d.calls
        totalCalls += d.calls
      }
    }
    return totalCalls > 0 ? formatCost(totalCost / totalCalls) : '-'
  }

  function isGroupConfigured(group: FeatureGroup): boolean {
    if (group.status !== 'active') return false
    return getGroupStepConfigs(group).some((c) => c.isConfigured)
  }

  function getFirstLabStep(group: FeatureGroup): string | null {
    return group.steps[0] ?? null
  }

  function getGroupDiarizationStrategy(group: FeatureGroup): string | null {
    if (group.id !== 'post_recording') return null
    const sttConfig = configMap().get('chain_stt_refine')
    return sttConfig?.diarizationStrategy ?? null
  }

  const STRATEGY_LABELS: Record<string, { label: string; color: string }> = {
    integrated: { label: '통합 (OpenAI)', color: 'bg-amber-50 text-amber-700' },
    specialized: { label: '분리 (STT + pyannote)', color: 'bg-violet-50 text-violet-700' },
  }

  let isOpen = $state(false)

  const activeCount = $derived(FEATURE_GROUPS.filter((g) => g.status === 'active' && isGroupConfigured(g)).length)
  const totalCount = $derived(FEATURE_GROUPS.filter((g) => g.status !== 'coming_soon').length)
</script>

<section class="section-border overflow-hidden">
  <!-- 토글 헤더 -->
  <button
    class="flex w-full items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
    onclick={() => isOpen = !isOpen}
  >
    <div class="flex items-center gap-3">
      <h2 class="text-body-03-normal-semibold text-gray-900">AI 기능 현황</h2>
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-label-01-normal-medium text-gray-500">
        {activeCount}/{totalCount} 활성
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-label-01-normal-medium text-emerald-600">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Live
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
  <div class="border-t border-gray-100 px-6 py-5">
  {#if configs.length === 0}
    <div class="flex items-center justify-center py-12">
      <p class="text-body-03-normal-regular text-gray-400">설정을 불러오는 중...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {#each FEATURE_GROUPS as group (group.id)}
        {@const stepConfigs = getGroupStepConfigs(group)}
        {@const configured = isGroupConfigured(group)}
        {@const totalCalls = getGroupTotalCalls(group)}
        {@const labStep = getFirstLabStep(group)}
        {@const strategy = getGroupDiarizationStrategy(group)}

        <div
          class="group relative flex flex-col rounded-xl border p-4 transition-all
            {group.status === 'coming_soon'
              ? 'border-dashed border-gray-200 bg-gray-50/30'
              : configured
                ? 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
                : 'border-dashed border-gray-300 bg-white hover:border-primary-300 hover:shadow-sm'}"
        >
          <!-- 헤더 -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-lg">
                {group.icon}
              </span>
              <div>
                <p class="text-body-03-normal-semibold text-gray-900">{group.title}</p>
                <p class="text-label-01-normal-regular text-gray-400">{group.description}</p>
              </div>
            </div>
            <span class="shrink-0 rounded-full px-1.5 py-0.5 text-label-01-normal-bold {group.badge.color}">
              {group.badge.label}
            </span>
          </div>

          <!-- 화자분리 전략 (음성전사 전용) -->
          {#if strategy}
            {@const strategyDisplay = STRATEGY_LABELS[strategy] ?? { label: strategy, color: 'bg-gray-100 text-gray-600' }}
            <div class="mt-2.5 flex items-center gap-1.5">
              <span class="text-label-01-normal-regular text-gray-400">화자분리 전략</span>
              <span class="rounded-full px-2 py-0.5 text-label-01-normal-medium {strategyDisplay.color}">
                {strategyDisplay.label}
              </span>
            </div>
          {/if}

          <!-- 모델 목록 -->
          <div class="mt-3 space-y-1.5">
            {#if group.status === 'active' && stepConfigs.length > 0}
              {#each stepConfigs as config}
                <div class="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                  <span class="text-label-01-normal-regular text-gray-500">{config.label}</span>
                  {#if config.isConfigured}
                    <span class="rounded-md bg-blue-50 px-1.5 py-0.5 text-label-01-normal-medium text-blue-700">
                      {config.modelLabel}
                    </span>
                  {:else}
                    <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-medium text-gray-400">
                      미설정
                    </span>
                  {/if}
                </div>
              {/each}
            {:else if group.hardcodedInfo}
              {#each group.hardcodedInfo.models as model}
                <div class="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                  <span class="text-label-01-normal-regular text-gray-500">{group.hardcodedInfo?.note ?? ''}</span>
                  <span class="rounded-md bg-violet-50 px-1.5 py-0.5 text-label-01-normal-medium text-violet-600">
                    {model}
                  </span>
                </div>
              {/each}
            {:else if group.status === 'coming_soon'}
              <div class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-3">
                <span class="text-label-01-normal-regular text-gray-400">개발 예정</span>
              </div>
            {/if}
          </div>

          <!-- 하단: 과금 + 통계 -->
          <div class="mt-auto pt-3">
            <div class="flex items-center justify-between border-t border-gray-100 pt-2.5">
              <div>
                <p class="text-label-01-normal-regular text-gray-400">과금</p>
                <p class="text-label-01-normal-medium text-gray-600">{group.billing}</p>
              </div>
              {#if group.status === 'active' && totalCalls > 0}
                <div class="text-right">
                  <p class="text-label-01-normal-regular text-gray-400">건당 비용</p>
                  <p class="text-body-03-normal-bold tabular-nums text-gray-900">{getGroupAvgCost(group)}</p>
                </div>
              {/if}
            </div>

            {#if group.status === 'active' && labStep}
              <a
                href="/ai-lab/lab?step={labStep}"
                class="mt-2 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white py-1.5 text-label-01-normal-medium text-primary-600 opacity-0 transition-all hover:bg-primary-50 group-hover:opacity-100"
              >
                실험실에서 개선
                <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </a>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  </div>
  {/if}
</section>
