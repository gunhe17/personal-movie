<script lang="ts">
  import type { SubscriptionVM } from '../view-model'
  import type { CreditBalance } from '$lib/hooks/actions/credit.action'
  import {
    CREDIT_WARNING_THRESHOLD,
    CREDIT_DANGER_THRESHOLD
  } from '$lib/features/credit/constants'
  import {
    DEPLETION_CRITICAL_DAYS,
    DEPLETION_WARNING_DAYS,
    FEATURE_LABELS
  } from '../constants'

  // 무료 플랜 업셀: 유료에서 열리는 핵심 AI 기능 (라벨은 constants 단일 출처)
  const AI_UPSELL = ['ai_field_note', 'ai_agent', 'ai_case_analysis'].map(
    (k) => FEATURE_LABELS[k] ?? k
  )

  interface Props {
    vm: SubscriptionVM
    credit: CreditBalance | null
    creditUsagePercent: number
    periodStart: string
    periodEnd: string
    daysElapsed: number
    daysUntilReset: number
    /** 현재 플랜 월 요금 (원) — 0이면 무료 */
    priceMonthly?: number
  }

  let {
    vm,
    credit,
    creditUsagePercent,
    periodStart,
    periodEnd,
    daysElapsed,
    daysUntilReset,
    priceMonthly = 0
  }: Props = $props()

  // 현황 배지: 정상 이용 / 해지 예정 / 결제 실패 등 상태를 한눈에
  const statusBadge = $derived.by(() => {
    if (!vm.isPaid) return null
    if (vm.status === 'payment_failed')
      return { label: '결제 실패', cls: 'bg-status-danger-bg text-red-600' }
    if (vm.status === 'expired')
      return { label: '만료됨', cls: 'bg-gray-100 text-gray-500' }
    if (!vm.willRenew)
      return { label: '해지 예정', cls: 'bg-amber-50 text-amber-700' }
    return { label: '이용 중', cls: 'bg-green-50 text-green-700' }
  })

  const barColor = $derived(
    creditUsagePercent >= CREDIT_DANGER_THRESHOLD
      ? 'bg-red-500'
      : creditUsagePercent >= CREDIT_WARNING_THRESHOLD
        ? 'bg-amber-500'
        : 'bg-primary-500'
  )

  // 결제 주기 진행률 (시각적 컨텍스트)
  const periodProgress = $derived.by(() => {
    const start = new Date(periodStart).getTime()
    const end = new Date(periodEnd).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    const pct = Math.min(
      100,
      Math.max(0, Math.round(((now - start) / total) * 100))
    )
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000))
    return { pct, daysLeft }
  })

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
</script>

<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  <h2 class="text-title-01-normal-semibold text-gray-800 mb-4">구독 현황</h2>

  <!-- 플랜 + 기간 -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg {vm.isPaid
          ? 'bg-primary-500'
          : vm.badgeBg}"
      >
        <svg
          class="h-5.5 w-5.5 {vm.isPaid ? 'text-white' : vm.badgeText}"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <p class="text-body-01-normal-semibold text-gray-800">
            {vm.planLabel} 플랜
          </p>
          {#if statusBadge}
            <span
              class="rounded-full px-2 py-0.5 text-label-02-normal-medium {statusBadge.cls}"
              >{statusBadge.label}</span
            >
          {/if}
        </div>
        <p class="mt-1 text-body-02-normal-regular text-gray-500">
          {formatDate(periodStart)} ~ {formatDate(periodEnd)}
        </p>
      </div>
    </div>
    {#if priceMonthly > 0}
      <div class="text-right">
        <p class="text-body-01-normal-semibold tabular-nums text-gray-800">
          ₩{priceMonthly.toLocaleString()}<span
            class="text-body-03-normal-regular text-gray-400">/월</span
          >
        </p>
        {#if vm.willRenew}
          <p class="mt-1 text-body-03-normal-regular text-gray-500">
            다음 결제 {formatDate(periodEnd)}
          </p>
        {:else}
          <p class="mt-1 text-body-03-normal-regular text-gray-400">
            {formatDate(periodEnd)} 만료
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 결제 주기 진행 바 (유료 플랜 — 무료는 결제 주기가 없어 미표시) -->
  {#if vm.isPaid}
    <div class="mt-4">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-body-03-normal-regular text-gray-400">결제 주기</span>
        <span class="text-body-03-normal-regular text-gray-500"
          ><strong class="text-gray-700 tabular-nums"
            >{periodProgress.daysLeft}</strong
          >일 남음</span
        >
      </div>
      <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full bg-primary-300 transition-all duration-500"
          style="width: {periodProgress.pct}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- 크레딧 (유료 플랜) -->
  {#if vm.isPaid && credit}
    <div class="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
      <div class="flex items-center justify-between mb-3.5">
        <span class="text-body-02-normal-medium text-gray-600">AI 크레딧</span>
        <a
          href="/subscription/ai-usage"
          class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
          >상세 보기 &rarr;</a
        >
      </div>

      <!-- 남은 크레딧을 주인공으로 -->
      <div class="flex items-baseline gap-1.5 mb-2">
        <span class="text-headline-01-normal-bold tabular-nums text-gray-800"
          >{credit.credit_remaining.toLocaleString()}</span
        >
        <span class="text-body-02-normal-regular text-gray-500"
          >크레딧 남음</span
        >
        <span
          class="text-body-03-normal-regular text-gray-400 ml-auto tabular-nums"
          >{credit.credit_used.toLocaleString()} / {credit.credit_limit.toLocaleString()}
          사용</span
        >
      </div>

      <!-- 프로그레스 바 -->
      <div class="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500 {barColor}"
          style="width: {creditUsagePercent}%"
        ></div>
      </div>

      <!-- 하단 요약 -->
      <div
        class="mt-3.5 flex items-center justify-between text-body-03-normal-regular text-gray-400"
      >
        {#if credit.credit_used > 0}
          {@const elapsed = Math.max(1, daysElapsed)}
          {@const dailyAvg = Math.round(credit.credit_used / elapsed)}
          {@const depletionDays =
            dailyAvg > 0 ? Math.floor(credit.credit_remaining / dailyAvg) : 0}
          <span>
            일평균 <strong class="text-gray-600">{dailyAvg}</strong> 크레딧 사용
          </span>
          <span>
            {#if credit.credit_remaining <= 0}
              <span class="text-body-03-normal-medium text-status-danger"
                >소진됨</span
              >
            {:else if depletionDays <= daysUntilReset}
              <span
                class="text-body-03-normal-medium {depletionDays <=
                DEPLETION_CRITICAL_DAYS
                  ? 'text-status-danger'
                  : depletionDays <= DEPLETION_WARNING_DAYS
                    ? 'text-amber-500'
                    : 'text-gray-600'}">~{depletionDays}일 후 소진 예상</span
              >
            {:else}
              <span class="text-gray-500">리셋까지 여유</span>
            {/if}
          </span>
        {:else}
          <span>아직 사용 내역이 없어요</span>
          <span
            ><strong class="text-gray-600">{daysUntilReset}</strong>일 후 리셋</span
          >
        {/if}
      </div>
    </div>

    <!-- 무료 플랜: AI 기능 잠금 안내 + 업그레이드 유인 -->
  {:else if !vm.isPaid}
    <div
      class="mt-5 rounded-lg border border-primary-100 bg-primary-50/50 px-5 py-4"
    >
      <div class="flex items-center gap-2 mb-3">
        <svg
          class="h-4.5 w-4.5 shrink-0 text-primary-500"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
        <p class="text-body-02-normal-medium text-gray-800">
          유료 플랜에서 AI 기능이 열려요
        </p>
      </div>
      <div class="space-y-1.5">
        {#each AI_UPSELL as feat}
          <div class="flex items-center gap-2">
            <svg
              class="h-4 w-4 shrink-0 text-gray-400"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
            <span class="text-body-03-normal-regular text-gray-600">{feat}</span
            >
          </div>
        {/each}
      </div>
      <p class="mt-3 text-body-03-reading-regular text-gray-400">
        아래에서 플랜을 비교하고 업그레이드할 수 있어요.
      </p>
    </div>
  {/if}
</div>
