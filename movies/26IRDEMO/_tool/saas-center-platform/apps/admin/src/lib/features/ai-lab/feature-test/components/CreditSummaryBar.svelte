<script lang="ts">
  import { getCreditPercent, getCreditStatus, CREDIT_STATUS_STYLES } from '../view-model'
  import type { CreditBalance } from '$lib/hooks/actions/featureTest.action'

  let {
    credit,
    onRefresh,
  }: {
    credit: CreditBalance | null | undefined
    onRefresh: () => void
  } = $props()

  const creditPercent = $derived(
    credit ? getCreditPercent(credit.credit_used, credit.credit_limit) : 0,
  )
  const barStyles = $derived(CREDIT_STATUS_STYLES[getCreditStatus(creditPercent)])
</script>

<section class="section-border px-6 py-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h2 class="text-body-03-normal-medium text-gray-900">크레딧</h2>
      {#if credit}
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-label-01-normal-regular text-gray-500">
          {credit.plan_type ?? 'free'}
        </span>
      {/if}
    </div>
    <button
      class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
      onclick={onRefresh}
      aria-label="새로고침"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"/></svg>
    </button>
  </div>

  {#if credit}
    <div class="mt-3 flex items-end justify-between">
      <div class="flex items-baseline gap-1.5">
        <span class="text-headline-01-normal-bold tabular-nums text-gray-900">
          {credit.credit_used.toLocaleString()}
        </span>
        <span class="text-body-03-normal-regular text-gray-400">
          / {credit.credit_limit.toLocaleString()} 사용
        </span>
      </div>
      <span class="text-body-03-normal-medium tabular-nums {barStyles.text}">
        {creditPercent}%
      </span>
    </div>
    <div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full transition-all duration-500 {barStyles.bar}"
        style="width: {creditPercent}%"
      ></div>
    </div>
  {:else}
    <p class="mt-3 text-body-03-normal-regular text-gray-400">불러오는 중...</p>
  {/if}
</section>
