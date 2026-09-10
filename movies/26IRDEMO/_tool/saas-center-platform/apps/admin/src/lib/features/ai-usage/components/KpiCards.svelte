<script lang="ts">
  import type { AiUsageSummary } from '$hooks/actions/ai-usage.action'
  import { fmtKRW, fmtNum, fmtTokens, fmtAudioMin, changePctDisplay } from '../view-model'

  interface Props {
    summary: AiUsageSummary | null | undefined
    selectedPeriod: string
    currentMonth: string
    isLoading: boolean
  }

  let { summary, selectedPeriod, currentMonth, isLoading }: Props = $props()

  const monthLabel = $derived(
    selectedPeriod === currentMonth
      ? '이번 달'
      : `${Number(selectedPeriod.split('-')[1])}월`,
  )

  const costChg = $derived(changePctDisplay(summary?.cost_change_pct ?? null))
  const callChg = $derived(changePctDisplay(summary?.call_change_pct ?? null))

  const costPerCall = $derived.by(() => {
    const cost = summary?.total_cost ?? 0
    const calls = summary?.total_calls ?? 0
    return calls > 0 ? cost / calls : 0
  })
</script>

{#if isLoading}
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
    {#each Array(2) as _}
      <div class="section-border animate-pulse bg-white">
        <div class="px-6 pb-4 pt-5">
          <div class="h-3 w-20 rounded bg-gray-200"></div>
          <div class="mt-3 h-8 w-32 rounded bg-gray-200"></div>
        </div>
        <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
          <div class="px-5 py-3.5">
            <div class="h-2.5 w-12 rounded bg-gray-100"></div>
            <div class="mt-1.5 h-4 w-20 rounded bg-gray-100"></div>
          </div>
          <div class="px-5 py-3.5">
            <div class="h-2.5 w-12 rounded bg-gray-100"></div>
            <div class="mt-1.5 h-4 w-20 rounded bg-gray-100"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

    <!-- 카드 1: 비용 복합 카드 -->
    <div class="section-border bg-white">
      <div class="px-6 pb-4 pt-5">
        <p class="text-label-01-normal-regular text-gray-500">{monthLabel} AI 비용 (외부 API)</p>
        <div class="mt-2 flex flex-wrap items-baseline gap-3">
          <p class="tabular-nums text-headline-01-normal-bold text-gray-900">
            {fmtKRW(summary?.total_cost ?? 0)}
          </p>
          {#if costChg}
            <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 {costChg.bgColor} {costChg.color} text-label-01-normal-medium tabular-nums">
              {costChg.arrow}{costChg.label} 전월
            </span>
          {:else}
            <span class="text-label-02-normal-regular text-gray-400">전월 데이터 없음</span>
          {/if}
        </div>
      </div>
      <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">누계 토큰</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{fmtTokens(summary?.total_tokens ?? 0)}</p>
        </div>
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">{(summary?.total_audio_minutes ?? 0) > 0 ? 'STT 분' : '활성 모델'}</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">
            {#if (summary?.total_audio_minutes ?? 0) > 0}
              {fmtAudioMin(summary?.total_audio_minutes ?? 0)}
            {:else}
              {summary?.active_models ?? 0}개
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- 카드 2: 호출 복합 카드 -->
    <div class="section-border bg-white">
      <div class="px-6 pb-4 pt-5">
        <p class="text-label-01-normal-regular text-gray-500">{monthLabel} 총 호출</p>
        <div class="mt-2 flex flex-wrap items-baseline gap-3">
          <p class="tabular-nums text-headline-01-normal-bold text-gray-900">
            {fmtNum(summary?.total_calls ?? 0)}<span class="ml-1 text-body-01-normal-regular text-gray-400">회</span>
          </p>
          {#if callChg}
            <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 {callChg.bgColor} {callChg.color} text-label-01-normal-medium tabular-nums">
              {callChg.arrow}{callChg.label} 전월
            </span>
          {/if}
        </div>
      </div>
      <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">건당 평균 비용</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{fmtKRW(costPerCall)}</p>
        </div>
        <div class="px-5 py-3.5">
          <p class="text-label-02-normal-regular text-gray-400">활성 모델</p>
          <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{summary?.active_models ?? 0}개</p>
        </div>
      </div>
    </div>

  </div>
{/if}
