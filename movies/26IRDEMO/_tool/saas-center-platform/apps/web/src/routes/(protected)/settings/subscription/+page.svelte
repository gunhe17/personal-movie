<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getSubscription,
    getPlans
  } from '$lib/hooks/actions/subscription.action'
  import type {
    SubscriptionResponse,
    PlanInfo
  } from '$lib/hooks/actions/subscription.action'
  import { getCreditBalance } from '$lib/hooks/actions/credit.action'
  import type { CreditBalance } from '$lib/hooks/actions/credit.action'
  import { centerId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import {
    CREDIT_STALE_TIME,
    CREDIT_REFETCH_INTERVAL
  } from '$lib/features/credit/constants'
  import {
    mapToSubscriptionVM,
    mapToPlanCards,
    calcPlanFitInsight
  } from '$lib/features/subscription/view-model'
  import type { PlanCardVM } from '$lib/features/subscription/view-model'
  import { createSubscriptionService } from '$lib/features/subscription/subscription-service'
  import SubscriptionStatus from '$lib/features/subscription/components/SubscriptionStatus.svelte'
  import PlanCard from '$lib/features/subscription/components/PlanCard.svelte'

  // ── 서비스 ──

  const queryClient = useQueryClient()
  const subscriptionService = createSubscriptionService({ queryClient })

  // ── 쿼리 ──

  const subQuery = $derived(
    queryBuilder(
      getSubscription,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME,
        refetchInterval: SUBSCRIPTION_REFETCH_INTERVAL
      })
    )
  )
  const subData = $derived(
    subQuery.data as SubscriptionResponse | null | undefined
  )

  const creditQuery = $derived(
    queryBuilder(
      getCreditBalance,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId && !!vm?.isPaid,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )
  const credit = $derived(creditQuery.data as CreditBalance | null | undefined)
  const creditUsedPercent = $derived(
    credit && credit.credit_limit > 0
      ? Math.min(
          Math.round((credit.credit_used / credit.credit_limit) * 100),
          100
        )
      : 0
  )
  const creditUsagePercent = $derived(creditUsedPercent)

  const plansQuery = $derived(
    queryBuilder(
      getPlans,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME,
        refetchInterval: SUBSCRIPTION_REFETCH_INTERVAL
      })
    )
  )
  const plans = $derived(plansQuery.data as PlanInfo[] | null | undefined)
  const vm = $derived(subData ? mapToSubscriptionVM(subData, plans) : null)

  const planCards = $derived(plans && vm ? mapToPlanCards(plans, vm.plan) : [])
  const mainCards = $derived(planCards.filter((c) => c.plan !== 'enterprise'))
  const currentPlanPrice = $derived(
    plans?.find((p) => p.plan === vm?.plan)?.price_monthly ?? 0
  )

  // ── 사용량 기반 적합도 ──

  const daysElapsed = $derived(() => {
    if (!credit?.period_start) return 0
    const start = new Date(credit.period_start)
    const now = new Date()
    return Math.max(
      1,
      Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    )
  })
  const daysTotal = $derived(() => {
    if (!credit?.period_start || !credit?.period_end) return 30
    const start = new Date(credit.period_start)
    const end = new Date(credit.period_end)
    return Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    )
  })
  const daysUntilReset = $derived(() => {
    if (!credit?.period_end) return 0
    return Math.max(
      0,
      Math.ceil((new Date(credit.period_end).getTime() - Date.now()) / 86400000)
    )
  })

  function getFitInsight(card: PlanCardVM) {
    if (!credit || credit.credit_used === 0) return null
    return calcPlanFitInsight(
      card.creditLimit,
      credit.credit_used,
      credit.credit_limit,
      daysElapsed(),
      daysTotal()
    )
  }

  // ── 핸들러 ──

  function handleUpgradeRequest(card: PlanCardVM) {
    subscriptionService.handleRequestPlanChange(card)
  }

  function handleDowngradeRequest(card: PlanCardVM) {
    subscriptionService.handleRequestPlanChange(card)
  }

  function handleCancelDowngradeRequest() {
    subscriptionService.handleCancelDowngrade()
  }

  function handleCancelSubscription() {
    if (subData?.current_period_end) {
      subscriptionService.handleCancelSubscription(subData.current_period_end)
    }
  }

  // ── 예약 변경일 포맷 ──

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
</script>

<div in:fade class="mx-auto flex flex-col pb-8">
  <PageTitleSection title="구독 관리" className="mb-4" />

  {#if subQuery.isLoading}
    <div class="flex items-center justify-center py-16">
      <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
    </div>
  {:else if vm && subData}
    <div class="space-y-4">
      <!-- 승인 대기 배너 -->
      {#if vm.isPending && vm.pendingPlanLabel}
        <div
          class="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3"
        >
          <div class="flex items-center gap-2">
            <svg
              class="h-5 w-5 text-amber-500 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p class="text-body-02-normal-medium text-amber-800">
              <strong>{vm.pendingPlanLabel}</strong> 플랜으로의 변경 요청이 관리자
              승인 대기 중이에요.
            </p>
          </div>
        </div>
      {/if}

      <!-- 다운그레이드 예약 배너 -->
      {#if vm.hasReservedDowngrade && vm.reservedPlanLabel}
        <div
          class="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3"
        >
          <div class="flex items-center gap-2">
            <svg
              class="h-5 w-5 text-amber-500 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z"
              />
            </svg>
            <p class="text-body-02-normal-medium text-amber-800">
              구독 기간 만료 후 <strong>{vm.reservedPlanLabel}</strong> 플랜으로
              변경 예정
              {#if subData.current_period_end}
                <span class="text-body-03-normal-regular text-amber-600 ml-1"
                  >({formatDate(subData.current_period_end)})</span
                >
              {/if}
            </p>
          </div>
          <button
            class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-body-03-normal-medium text-amber-700 hover:bg-amber-50 transition"
            onclick={handleCancelDowngradeRequest}
          >
            예약 취소
          </button>
        </div>
      {/if}

      <!-- 구독 현황 -->
      <SubscriptionStatus
        {vm}
        credit={credit ?? null}
        {creditUsagePercent}
        periodStart={subData.current_period_start}
        periodEnd={subData.current_period_end}
        daysElapsed={daysElapsed()}
        daysUntilReset={daysUntilReset()}
        priceMonthly={currentPlanPrice}
      />

      <!-- 플랜 비교 -->
      {#if mainCards.length > 0}
        <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-title-01-normal-semibold text-gray-800">
              플랜 비교
            </h2>
            <span class="text-label-02-normal-regular text-gray-400"
              >VAT 별도</span
            >
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {#each mainCards as card}
              <PlanCard
                {card}
                fit={getFitInsight(card)}
                isReserved={vm.hasReservedDowngrade &&
                  vm.reservedPlanLabel === card.label}
                isPending={vm.isPending}
                onupgrade={handleUpgradeRequest}
                ondowngrade={handleDowngradeRequest}
              />
            {/each}
          </div>

          <!-- 안내 -->
          <div
            class="mt-4 pt-3 border-t border-gray-100 flex items-start justify-between"
          >
            <p class="text-body-03-reading-regular text-gray-400">
              업그레이드 즉시 적용 · 다운그레이드 기간 만료 후 적용 · 크레딧은
              새 플랜 기준 초기화
            </p>
            {#if vm.isPaid && !vm.hasReservedDowngrade && !vm.isPending}
              <button
                class="text-body-03-normal-medium text-gray-400 underline underline-offset-2 transition hover:text-status-danger shrink-0 ml-4"
                onclick={handleCancelSubscription}
              >
                구독 해지
              </button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {:else if subQuery.isError}
    <div class="flex items-center justify-center py-16 flex-col gap-3">
      <p class="text-body-01-reading-regular text-gray-500">
        데이터를 불러오지 못했어요.
      </p>
      <button
        onclick={() => subQuery.refetch()}
        class="rounded-lg border border-gray-200 px-4 py-2 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
      >
        다시 시도
      </button>
    </div>
  {:else}
    <div class="flex items-center justify-center py-16">
      <p class="text-body-01-reading-regular text-gray-400">
        구독 정보를 불러올 수 없어요.
      </p>
    </div>
  {/if}
</div>
