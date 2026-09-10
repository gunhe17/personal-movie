<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '@common/components/Typography.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import {
    getSubscription,
    getPlans,
    type SubscriptionResponse,
    type PlanInfo
  } from '$lib/hooks/actions/subscription.action'
  import {
    getCreditBalance,
    type CreditBalance
  } from '$lib/hooks/actions/credit.action'
  import { mapToSubscriptionVM } from '$lib/features/subscription/view-model'
  import { SUBSCRIPTION_STALE_TIME } from '$lib/features/subscription/constants'
  import { CREDIT_STALE_TIME } from '$lib/features/credit/constants'

  interface Props {
    /** 탭/패널 내부에서 쓸 때 카드 외곽·타이틀 제거 */
    bare?: boolean
  }
  let { bare = false }: Props = $props()

  // ── 쿼리 ──
  const subQuery = $derived(
    queryBuilder(
      getSubscription,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME
      })
    )
  )
  const subData = $derived(
    subQuery.data as SubscriptionResponse | null | undefined
  )

  const plansQuery = $derived(
    queryBuilder(
      getPlans,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: SUBSCRIPTION_STALE_TIME
      })
    )
  )
  const plans = $derived(plansQuery.data as PlanInfo[] | null | undefined)

  const vm = $derived(subData ? mapToSubscriptionVM(subData, plans) : null)

  const creditQuery = $derived(
    queryBuilder(
      getCreditBalance,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId && !!vm?.isPaid,
        staleTime: CREDIT_STALE_TIME
      })
    )
  )
  const credit = $derived(creditQuery.data as CreditBalance | null | undefined)

  // ── 파생 값 ──
  const currentPlanInfo = $derived(
    plans && vm ? (plans.find((p) => p.plan === vm.plan) ?? null) : null
  )

  const creditLimit = $derived(credit?.credit_limit ?? vm?.creditLimit ?? 0)
  const creditUsed = $derived(credit?.credit_used ?? 0)
  const creditRemaining = $derived(
    credit?.credit_remaining ?? Math.max(0, creditLimit - creditUsed)
  )
  const usagePercent = $derived(
    creditLimit > 0
      ? Math.min(100, Math.round((creditUsed / creditLimit) * 100))
      : 0
  )
  const usageColor = $derived(
    usagePercent >= 90
      ? 'bg-red-500'
      : usagePercent >= 70
        ? 'bg-amber-500'
        : 'bg-primary-500'
  )

  const nextAmountLabel = $derived(
    currentPlanInfo
      ? currentPlanInfo.price_monthly === 0
        ? '무료'
        : `₩${currentPlanInfo.price_monthly.toLocaleString()}`
      : '—'
  )

  // 외곽/구분 스타일 — bare면 좌우 패딩 제거(부모 패널이 담당)
  const rootCls = $derived(
    bare ? '' : 'bg-white rounded-lg border border-gray-200'
  )
  const sectionCls = $derived(
    bare
      ? 'border-t border-gray-100 py-5 first:border-t-0 first:pt-0'
      : 'border-t border-gray-100 p-6'
  )

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
</script>

<div class={rootCls}>
  <!-- 헤더: 현재 플랜 + 변경 버튼 -->
  <div class="flex items-center justify-between gap-3 {bare ? 'pb-5' : 'p-6'}">
    <div class="flex items-center gap-2.5">
      {#if !bare}
        <Typography variant="title-01-semibold" color="text-gray-900"
          >구독</Typography
        >
      {/if}
      {#if vm}
        <span
          class="rounded-full px-2.5 py-0.5 text-label-02-normal-bold {vm.badgeBg} {vm.badgeText}"
        >
          {vm.planLabel}
        </span>
        {#if vm.status !== 'active'}
          <Typography variant="body-03-normal-regular" color="text-gray-400">
            {vm.statusLabel}
          </Typography>
        {/if}
      {/if}
    </div>
    <button
      onclick={() => goto('/subscription')}
      class="h-10 shrink-0 px-4 flex-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <Typography variant="body-01-normal-medium" color="text-gray-600"
        >플랜 변경</Typography
      >
    </button>
  </div>

  {#if subQuery.isLoading}
    <div class={sectionCls}>
      <Typography variant="body-02-normal-regular" color="text-gray-400"
        >로딩 중...</Typography
      >
    </div>
  {:else if vm}
    <!-- 사용량 -->
    <div class={sectionCls}>
      <div class="mb-3 flex h-6 items-center justify-between">
        <Typography variant="body-01-semibold" color="text-gray-800">
          사용량
        </Typography>
        <button
          onclick={() => goto('/subscription/ai-usage')}
          class="flex items-center gap-2 text-body-02-normal-regular text-gray-500 hover:text-gray-700 transition-colors"
        >
          자세히
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {#if vm.isFree}
        <div class="flex-center flex-col gap-2 rounded-lg bg-gray-50 py-8">
          <Typography variant="body-01-medium" color="text-gray-500">
            무료 플랜은 AI 크레딧이 포함되어 있지 않아요
          </Typography>
          <Typography variant="body-02-normal-regular" color="text-gray-400">
            플랜을 변경하면 AI 기능을 사용할 수 있어요
          </Typography>
        </div>
      {:else}
        <div class="space-y-3 rounded-lg bg-gray-50 px-5 py-4">
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <Typography variant="body-02-normal-regular" color="text-gray-500"
                >AI 크레딧</Typography
              >
              <Typography variant="body-02-normal-medium" color="text-gray-800">
                {creditUsed.toLocaleString()} / {creditLimit.toLocaleString()}
              </Typography>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                class="h-full rounded-full transition-all {usageColor}"
                style="width: {usagePercent}%"
              ></div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-500"
              className="w-18 shrink-0">잔여 크레딧</Typography
            >
            <Typography
              variant="body-02-normal-medium"
              color="text-primary-500"
            >
              {creditRemaining.toLocaleString()}
            </Typography>
          </div>
        </div>
      {/if}
    </div>

    <!-- 결제 정보 -->
    <div class={sectionCls}>
      <div class="mb-3 flex h-6 items-center">
        <Typography variant="body-01-semibold" color="text-gray-800">
          결제 정보
        </Typography>
      </div>
      <dl class="space-y-3">
        <div class="flex gap-7">
          <Typography
            variant="body-01-normal-regular"
            color="text-gray-600"
            className="w-22.5 min-w-22.5">이용 기간</Typography
          >
          <Typography variant="body-01-normal-regular" color="text-gray-800"
            >{vm.periodLabel}</Typography
          >
        </div>
        <div class="flex gap-7">
          <Typography
            variant="body-01-normal-regular"
            color="text-gray-600"
            className="w-22.5 min-w-22.5">다음 결제일</Typography
          >
          <Typography variant="body-01-normal-regular" color="text-gray-800">
            {#if vm.isFree}—{:else if vm.willRenew && subData}{formatDate(
                subData.current_period_end
              )}{:else}갱신 예정 없음{/if}
          </Typography>
        </div>
        <div class="flex gap-7">
          <Typography
            variant="body-01-normal-regular"
            color="text-gray-600"
            className="w-22.5 min-w-22.5">결제 예정 금액</Typography
          >
          <Typography variant="body-01-normal-regular" color="text-gray-800">
            {vm.isFree || !vm.willRenew ? '—' : nextAmountLabel}
          </Typography>
        </div>
      </dl>
    </div>

    <!-- 플랜 혜택 -->
    {#if vm.featureLabels.length > 0 || creditLimit > 0}
      <div class={sectionCls}>
        <div class="mb-3 flex h-6 items-center">
          <Typography variant="body-01-semibold" color="text-gray-800">
            플랜 혜택
          </Typography>
        </div>
        <div class="flex flex-wrap gap-2">
          {#if creditLimit > 0}
            <span
              class="rounded-full bg-primary-50 px-3 py-1 text-body-02-normal-medium text-primary-600"
            >
              AI 크레딧 {creditLimit.toLocaleString()}
            </span>
          {/if}
          {#each vm.featureLabels as label}
            <span
              class="rounded-full bg-gray-100 px-3 py-1 text-body-02-normal-regular text-gray-600"
              >{label}</span
            >
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <div class={sectionCls}>
      <Typography variant="body-02-normal-regular" color="text-gray-500"
        >구독 정보를 불러올 수 없습니다.</Typography
      >
    </div>
  {/if}
</div>
