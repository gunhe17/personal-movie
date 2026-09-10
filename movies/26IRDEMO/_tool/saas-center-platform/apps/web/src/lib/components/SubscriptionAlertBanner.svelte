<script lang="ts">
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getSubscription } from '$lib/hooks/actions/subscription.action'
  import { getCreditBalance } from '$lib/hooks/actions/credit.action'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import {
    CREDIT_STALE_TIME,
    CREDIT_REFETCH_INTERVAL,
    CREDIT_DANGER_THRESHOLD
  } from '$lib/features/credit/constants'
  import { slide } from 'svelte/transition'
  import { page } from '$app/state'
  import { showSubscription, showAiFeatures } from '$lib/config/environment'

  // 구독 경고(트라이얼)는 D5(리빙랩·운영 숨김), 크레딧 경고는 AI 노출(D1)을 따른다
  const subVisible = $derived(showSubscription(page.url.hostname))
  const aiVisible = $derived(showAiFeatures(page.url.hostname))

  // ─── 구독 상태 쿼리 ───
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
  const sub = $derived(
    (subQuery?.data as
      | import('$lib/hooks/actions/subscription.action').SubscriptionResponse
      | null
      | undefined) ?? null
  )

  const isTrial = $derived(sub?.status === 'trial')
  const isPaid = $derived(sub?.status === 'active' && sub?.plan !== 'free')

  // ─── 크레딧 잔량 쿼리 (유료만) ───
  const creditQuery = $derived(
    queryBuilder(
      getCreditBalance,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId && isPaid,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )
  const credit = $derived(
    (creditQuery?.data as
      | import('$lib/hooks/actions/credit.action').CreditBalance
      | null
      | undefined) ?? null
  )

  // ─── 크레딧 소진 경고 ───
  const creditUsagePercent = $derived(
    credit && credit.credit_limit > 0
      ? Math.round((credit.credit_used / credit.credit_limit) * 100)
      : 0
  )
  const showCreditWarning = $derived(
    aiVisible && isPaid && creditUsagePercent >= CREDIT_DANGER_THRESHOLD
  )
  const isCreditDepleted = $derived(creditUsagePercent >= 100)

  // ─── 체험 만료 경고 ───
  const trialDaysRemaining = $derived.by(() => {
    if (!isTrial || !sub?.trial_end) return null
    const now = new Date()
    const end = new Date(sub.trial_end)
    const diff = Math.ceil(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return Math.max(0, diff)
  })
  const showTrialWarning = $derived(
    subVisible && trialDaysRemaining !== null && trialDaysRemaining <= 7
  )

  // ─── 닫기 상태 ───
  let dismissedCredit = $state(false)
  let dismissedTrial = $state(false)
</script>

{#if showCreditWarning && !dismissedCredit}
  <div
    transition:slide={{ duration: 200 }}
    class="mx-4 mb-3 flex items-center justify-between rounded-lg px-4 py-3 text-sm {isCreditDepleted
      ? 'border border-red-200 bg-status-danger-bg text-red-800'
      : 'border border-amber-200 bg-amber-50 text-amber-800'}"
  >
    <div class="flex items-center gap-2">
      <svg
        class="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      {#if isCreditDepleted}
        <span
          >AI 크레딧이 <strong>모두 소진</strong>되었습니다. AI 기능이
          제한됩니다.</span
        >
      {:else}
        <span
          >AI 크레딧 사용량이 <strong>{creditUsagePercent}%</strong>에
          도달했습니다. 잔여 크레딧을 확인해주세요.</span
        >
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <a
        href="/subscription/ai-usage"
        class="shrink-0 rounded-md px-3 py-1 text-xs font-medium {isCreditDepleted
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} transition-colors"
      >
        사용량 확인
      </a>
      <button
        type="button"
        class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        onclick={() => (dismissedCredit = true)}
        aria-label="닫기"
      >
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}

{#if showTrialWarning && !dismissedTrial}
  <div
    transition:slide={{ duration: 200 }}
    class="mx-4 mb-3 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"
  >
    <div class="flex items-center gap-2">
      <svg
        class="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {#if trialDaysRemaining === 0}
        <span
          >체험 기간이 <strong>오늘 종료</strong>됩니다. 플랜을 선택하여 AI
          기능을 계속 이용하세요.</span
        >
      {:else}
        <span
          >체험 기간이 <strong>{trialDaysRemaining}일 후 종료</strong>됩니다.
          플랜을 선택하여 AI 기능을 계속 이용하세요.</span
        >
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <a
        href="/subscription"
        class="shrink-0 rounded-md bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-200"
      >
        플랜 선택
      </a>
      <button
        type="button"
        class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        onclick={() => (dismissedTrial = true)}
        aria-label="닫기"
      >
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}
