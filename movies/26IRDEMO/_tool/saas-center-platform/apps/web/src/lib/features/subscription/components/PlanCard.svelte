<script lang="ts">
  import type { PlanCardVM, PlanFitInsight } from '../view-model'
  import {
    PLAN_FIT_THRESHOLD_TIGHT,
    PLAN_FIT_THRESHOLD_MODERATE
  } from '../constants'

  interface Props {
    card: PlanCardVM
    fit: PlanFitInsight | null
    isReserved?: boolean
    isPending?: boolean
    onupgrade: (card: PlanCardVM) => void
    ondowngrade: (card: PlanCardVM) => void
  }

  let {
    card,
    fit,
    isReserved = false,
    isPending = false,
    onupgrade,
    ondowngrade
  }: Props = $props()

  const aiIncluded = $derived(card.aiFeatures.filter((f) => f.included))
  const aiIncludedCount = $derived(aiIncluded.length)
  const aiAllIncluded = $derived(
    card.aiFeatures.length > 0 && aiIncludedCount === card.aiFeatures.length
  )

  const fitIndicator = $derived.by(() => {
    if (!fit) return null
    if (fit.headroom < PLAN_FIT_THRESHOLD_TIGHT)
      return { dot: 'bg-red-500', text: 'text-red-600' }
    if (fit.headroom < PLAN_FIT_THRESHOLD_MODERATE)
      return { dot: 'bg-amber-500', text: 'text-amber-700' }
    return { dot: 'bg-green-500', text: 'text-green-700' }
  })
</script>

<!-- 심플 체크 (클로드 스타일 — 원형 배지 없이 얇은 체크만) -->
{#snippet check()}
  <svg
    class="h-4 w-4 shrink-0 text-primary-500 mt-0.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    viewBox="0 0 24 24"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m4.5 12.75 6 6 9-13.5"
    />
  </svg>
{/snippet}

<!-- 기능 항목 (체크 + 라벨) -->
{#snippet featureItem(label: string)}
  <div class="flex items-start gap-2.5">
    {@render check()}
    <span class="text-body-02-normal-regular leading-snug text-gray-600"
      >{label}</span
    >
  </div>
{/snippet}

<div
  class="rounded-lg flex flex-col transition-colors duration-200 relative bg-white
    {card.isCurrent
    ? 'border border-primary-500 bg-primary-50/40'
    : card.isRecommended
      ? 'border border-primary-200 hover:border-primary-400 hover:shadow-md'
      : 'border border-gray-200 hover:border-gray-300 hover:shadow-md'}"
>
  <!-- 추천 뱃지 -->
  {#if card.isRecommended && !card.isCurrent}
    <div class="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
      <span
        class="rounded-full bg-primary-500 px-3 py-0.5 text-label-02-normal-bold text-white"
        >추천</span
      >
    </div>
  {/if}

  <!-- ── 구매 존: 플랜 정체성 + 가격 + CTA (카드 간 정렬) ── -->
  <div class="p-6">
    <div class="flex items-center gap-2 mb-1.5">
      <h3 class="text-title-01-normal-semibold text-gray-800 truncate-safe">
        {card.label}
      </h3>
      {#if card.isCurrent}
        <span
          class="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-label-02-normal-medium text-primary-600"
          >사용 중</span
        >
      {/if}
    </div>
    <p class="text-body-03-reading-regular text-gray-500 line-clamp-1 mb-5">
      {card.tagline}
    </p>

    <!-- 가격 (앵커) -->
    <div class="mb-1.5 flex items-baseline gap-1">
      <span class="text-headline-00-normal-bold tabular-nums text-gray-900"
        >{card.priceLabel}</span
      >
      {#if card.priceSuffix}
        <span class="text-body-02-normal-regular text-gray-400"
          >{card.priceSuffix}</span
        >
      {/if}
    </div>
    <p class="text-body-03-reading-regular text-gray-500 line-clamp-1 mb-5">
      {card.audience}
    </p>

    <!-- CTA -->
    {#if card.isCurrent}
      <div
        class="w-full rounded-lg bg-primary-50 h-11 flex items-center justify-center text-body-02-normal-medium text-primary-400"
      >
        현재 사용 중인 플랜
      </div>
    {:else if isReserved}
      <div
        class="w-full rounded-lg bg-amber-50 border border-amber-200 h-11 flex items-center justify-center text-body-02-normal-medium text-amber-600"
      >
        변경 예약됨
      </div>
    {:else if isPending}
      <div
        class="w-full rounded-lg bg-gray-100 h-11 flex items-center justify-center text-body-02-normal-medium text-gray-400 cursor-not-allowed"
      >
        승인 대기 중
      </div>
    {:else if card.isUpgrade}
      <button
        class="w-full rounded-lg h-11 text-body-02-normal-medium text-white transition-colors duration-200
          {card.isRecommended
          ? 'bg-primary-500 hover:bg-primary-400'
          : 'bg-gray-500 hover:bg-gray-700'}"
        onclick={() => onupgrade(card)}
      >
        {card.label}로 변경 요청
      </button>
    {:else if card.isDowngrade}
      <button
        class="w-full rounded-lg h-11 border border-gray-200 bg-white text-body-02-normal-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50"
        onclick={() => ondowngrade(card)}
      >
        {card.label}로 변경 요청
      </button>
    {/if}
  </div>

  <!-- 풀블리드 구분선 -->
  <div class="border-t border-gray-100"></div>

  <!-- ── 혜택 존: 크레딧 + 기능 (그룹 간 gap-6, 그룹 내 항목 space-y-2, 레이블→항목 mb-2.5) ── -->
  <div class="p-6 flex flex-col flex-1 gap-6">
    <!-- 크레딧 그룹 -->
    <div>
      {#if card.hasCredit}
        <p class="text-body-01-normal-semibold text-gray-800">
          <span class="tabular-nums">{card.creditLabel}</span> 크레딧<span
            class="text-body-03-normal-regular text-gray-400"
          >
            / 월</span
          >
        </p>
        <p class="mt-1 text-body-03-reading-regular text-gray-500">
          {card.creditHint}
        </p>
      {:else}
        <p class="text-body-01-normal-semibold text-gray-500">
          AI 크레딧 미포함
        </p>
        <p class="mt-1 text-body-03-reading-regular text-gray-500">
          유료 플랜부터 제공
        </p>
      {/if}
    </div>

    <!-- 포함 기능 그룹 -->
    <div class="flex-1">
      {#if card.additions.length > 0 && card.basePlanLabel}
        <p class="text-body-03-normal-medium text-gray-500 mb-2.5">
          <strong class="text-gray-700">{card.basePlanLabel}</strong>의 모든
          기능 및:
        </p>
      {/if}
      <div class="space-y-2">
        {#if card.additions.length > 0}
          {#each card.additions as addition}
            {@render featureItem(addition)}
          {/each}
        {:else}
          {#each card.baseFeatures as base}
            {@render featureItem(base)}
          {/each}
        {/if}
        {#each card.extraFeatures as feat}
          {@render featureItem(feat.label)}
        {/each}
      </div>
    </div>

    <!-- AI 기능 그룹 (포함된 것만 노출 — 미포함은 상위 플랜 카드에 표시됨) -->
    {#if aiIncludedCount > 0}
      <div>
        <div class="flex items-center gap-1 mb-2.5">
          <svg
            class="h-3.5 w-3.5 shrink-0 text-primary-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
            />
          </svg>
          <span class="text-body-03-normal-semibold text-primary-500"
            >AI 기능</span
          >
          {#if aiAllIncluded}<span
              class="text-body-03-normal-regular text-primary-400"
              >· 모두 포함</span
            >{/if}
        </div>
        <div class="space-y-2">
          {#each aiIncluded as feat}
            {@render featureItem(feat.label)}
          {/each}
        </div>
      </div>
    {/if}

    <!-- 사용량 기반 적합도 인사이트 -->
    {#if fitIndicator && fit && card.hasCredit && !card.isCurrent && card.isUpgrade}
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <div class="flex items-center gap-1.5 mb-1">
          <div class="h-1.5 w-1.5 rounded-full {fitIndicator.dot}"></div>
          <span class="text-label-02-normal-medium {fitIndicator.text}"
            >{fit.fitMessage}</span
          >
        </div>
        <p class="text-label-02-normal-regular text-gray-500">
          일평균 <strong class="text-gray-600">{fit.dailyAvgUsage}</strong>
          크레딧
          {#if fit.creditDiffFromCurrent > 0}
            · 현재 대비 <strong class="text-gray-600"
              >+{fit.creditDiffFromCurrent.toLocaleString()}</strong
            >
          {/if}
        </p>
      </div>
    {/if}
  </div>
</div>
