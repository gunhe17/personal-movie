<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCreditUsage,
    getCreditHistory
  } from '$lib/hooks/actions/credit.action'
  import type {
    CreditUsageResponse,
    CreditHistoryResponse
  } from '$lib/hooks/actions/credit.action'
  import { centerId } from '$lib/stores/center.store'
  import {
    STATUS_STYLES,
    CREDIT_STALE_TIME,
    CREDIT_REFETCH_INTERVAL
  } from '$lib/features/credit/constants'
  import { PLAN_LABELS } from '$lib/features/subscription/constants'
  import {
    mapToUsagePageVM,
    mapCreditToTrendItems,
    mapCallsToTrendItems,
    mapToMemberUsage
  } from '$lib/features/credit/view-model'
  import {
    getSubscription,
    getPlans
  } from '$lib/hooks/actions/subscription.action'
  import type {
    SubscriptionResponse,
    PlanInfo
  } from '$lib/hooks/actions/subscription.action'
  import {
    mapToSubscriptionVM,
    hasFeature
  } from '$lib/features/subscription/view-model'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import UsageInsightCard from '$lib/features/credit/components/UsageInsightCard.svelte'
  import UsageSummaryCard from '$lib/features/credit/components/UsageSummaryCard.svelte'
  import TrendChart from '$lib/features/credit/components/TrendChart.svelte'
  import TrendKpiBar from '$lib/features/credit/components/TrendKpiBar.svelte'
  import UsageTimeline from '$lib/features/credit/components/UsageTimeline.svelte'
  import PurposeSummaryPanel from '$lib/features/credit/components/PurposeSummaryPanel.svelte'
  import MemberUsageList from '$lib/features/credit/components/MemberUsageList.svelte'
  import CreditStatusAlert from '$lib/features/credit/components/CreditStatusAlert.svelte'

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
  const subVM = $derived(subData ? mapToSubscriptionVM(subData, plans) : null)
  // 현재 플랜에 AI가 포함되는지 — Free(미포함)면 크레딧 대신 "미포함" 표시(지난 유료 데이터 오표시 방지)
  const hasAi = $derived(hasFeature(subVM, 'ai_agent'))

  const usageQuery = $derived(
    queryBuilder(
      getCreditUsage,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )
  const historyQuery = $derived(
    queryBuilder(
      getCreditHistory,
      () => ({ centerId: $centerId }),
      () => ({
        enabled: !!$centerId,
        staleTime: CREDIT_STALE_TIME,
        refetchInterval: CREDIT_REFETCH_INTERVAL
      })
    )
  )

  const usageData = $derived(
    usageQuery.data as CreditUsageResponse | null | undefined
  )
  const vm = $derived(usageData ? mapToUsagePageVM(usageData) : null)
  const historyData = $derived(
    historyQuery.data as CreditHistoryResponse | null | undefined
  )
  const memberUsage = $derived(mapToMemberUsage(historyData?.items ?? []))
  const styles = $derived(vm ? STATUS_STYLES[vm.status] : STATUS_STYLES.normal)
  const isLoading = $derived(subQuery.isLoading || usageQuery.isLoading)

  // ── 차트 탭 ──
  let chartTab = $state<'credits' | 'calls'>('credits')

  const creditTrend = $derived(
    vm ? mapCreditToTrendItems(vm.dailyCreditChart) : []
  )
  const callsTrend = $derived(vm ? mapCallsToTrendItems(vm.dailyChart) : [])
</script>

<div in:fade class="flex flex-col bg-gray-50 pb-8">
  <PageTitleSection title="AI 사용량" className="mb-4" />

  {#if isLoading}
    <div class="flex items-center justify-center py-16">
      <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
    </div>
  {:else if subVM?.isFree}
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <div class="flex items-center gap-2">
        <h2 class="text-title-01-normal-semibold text-gray-800">
          {subVM.planLabel} 플랜
        </h2>
        <span
          class="rounded-full {subVM.badgeBg} px-2 py-0.5 text-body-03-normal-medium {subVM.badgeText}"
          >{subVM.statusLabel}</span
        >
      </div>
      <p class="mt-1 text-body-02-normal-regular text-gray-500">
        AI 크레딧이 포함되지 않은 플랜입니다.
      </p>

      <div class="mt-4">
        <div
          class="rounded-lg border border-dashed border-primary-200 bg-primary-50/50 px-4 py-3.5"
        >
          <p class="text-body-02-normal-medium text-gray-800">
            AI 기능을 사용하려면 플랜을 업그레이드하세요
          </p>
          <p class="text-body-03-normal-regular text-gray-500 mt-0.5">
            {PLAN_LABELS['starter'] ?? 'Starter'} 플랜부터 AI 상담일지, 통합 청구
            등을 사용할 수 있습니다.
          </p>
          <a
            href="/subscription"
            class="mt-2 inline-flex items-center gap-1 text-body-02-normal-medium text-primary-500 hover:text-primary-600"
          >
            플랜 보기
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  {:else if subVM && vm}
    <div class="space-y-4">
      <!-- 1. AI 크레딧 카드 -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h2 class="text-title-01-normal-semibold text-gray-800">
              AI 크레딧
            </h2>
            <span
              class="rounded-full {subVM.badgeBg} px-2 py-0.5 text-body-03-normal-medium {subVM.badgeText}"
              >{subVM.planLabel}</span
            >
          </div>
          <a
            href="/subscription"
            class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
            >구독 관리 &rarr;</a
          >
        </div>

        {#if !hasAi}
          <!-- Free 등 AI 미포함 플랜 — 지난 유료 사용 데이터 대신 미포함 안내 -->
          <div class="py-2">
            <p class="text-body-01-normal-medium text-gray-700">
              AI 크레딧 미포함
            </p>
            <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
              유료 플랜부터 AI 기능이 제공됩니다.
            </p>
          </div>
        {:else}
          <div class="flex items-end justify-between mb-1">
            <div>
              <span
                class="text-headline-00-normal-bold tabular-nums text-gray-900"
                >{vm.creditUsed.toLocaleString()}</span
              >
              <span class="text-body-02-normal-regular text-gray-400 ml-1"
                >/ {vm.creditLimit.toLocaleString()} 사용</span
              >
            </div>
            {#if vm.isActive}
              <span class="text-body-03-normal-regular text-gray-400"
                >{vm.creditRemaining.toLocaleString()} 남음</span
              >
            {:else}
              <span class="text-body-03-normal-regular text-orange-600"
                >사용 불가 (만료)</span
              >
            {/if}
          </div>

          <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500 {styles.bar}"
              style="width: {vm.usagePercent}%"
            ></div>
          </div>

          <div
            class="mt-4 flex items-center justify-between text-body-03-normal-regular text-gray-500"
          >
            <span>{subVM.periodLabel}</span>
            {#if vm.isActive}
              <span
                ><strong class="text-gray-700">{vm.daysUntilReset}일</strong> 후
                리셋</span
              >
            {:else}
              <span class="text-orange-600">구독 만료 · 마지막 사용 기간</span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- 2. 경고/위험 배너 -->
      <CreditStatusAlert
        status={vm.status}
        creditRemaining={vm.creditRemaining}
        usagePercent={vm.usagePercent}
        estimatedDepletionDays={vm.insight.estimatedDepletionDays}
        daysUntilReset={vm.daysUntilReset}
      />

      <!-- 3. KPI 바 -->
      <TrendKpiBar
        items={[
          {
            label: '총 사용',
            value: vm.creditUsed.toLocaleString(),
            unit: '크레딧'
          },
          {
            label: '남은 크레딧',
            value: vm.creditRemaining.toLocaleString(),
            unit: '크레딧'
          },
          {
            label: '일평균',
            value: String(vm.insight.dailyAvgCredits),
            unit: '크레딧'
          }
        ]}
      />

      <!-- 4. 사용 인사이트 + 잔여 가능 작업 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UsageInsightCard {vm} />
        <UsageSummaryCard {vm} />
      </div>

      <!-- 5. 추이 차트 + 기능별 사용 -->
      <div class="grid grid-cols-2 gap-4">
        {#snippet chartTabSwitcher()}
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 shrink-0">
            {#each [['credits', '크레딧'], ['calls', '호출 횟수']] as [string, string][] as [key, label]}
              <button
                class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
                  {chartTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (chartTab = key as 'credits' | 'calls')}
                >{label}</button
              >
            {/each}
          </div>
        {/snippet}

        <!-- 추이 차트 -->
        {#if chartTab === 'credits'}
          {#if creditTrend.length > 1}
            <TrendChart
              title="크레딧 누적 사용량"
              subtitle="일별 크레딧 소비 + 누적 사용량"
              items={creditTrend}
              dailyUnit="크레딧"
              cumulativeUnit="크레딧"
              theme="indigo"
              headerRight={chartTabSwitcher}
            />
          {:else}
            <div class="rounded-2xl border border-gray-200 bg-white p-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-title-01-normal-semibold text-gray-800">
                    크레딧 누적 사용량
                  </h3>
                  <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                    일별 크레딧 소비 + 누적 사용량
                  </p>
                </div>
                {@render chartTabSwitcher()}
              </div>
              <div class="flex flex-col items-center py-8 text-center">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 mb-3"
                >
                  <svg
                    class="h-6 w-6 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                    />
                  </svg>
                </div>
                <p class="text-body-02-normal-medium text-gray-500 mb-1">
                  크레딧 사용 추이가 여기에 표시됩니다
                </p>
                <p class="text-body-03-normal-regular text-gray-400">
                  2일 이상 데이터가 쌓이면 추이를 확인할 수 있습니다
                </p>
              </div>
            </div>
          {/if}
        {:else if callsTrend.length > 1}
          <TrendChart
            title="AI 사용 횟수 추이"
            subtitle="일별 사용 횟수 + 누적 횟수"
            items={callsTrend}
            dailyUnit="회"
            cumulativeUnit="회"
            theme="violet"
            headerRight={chartTabSwitcher}
          />
        {:else}
          <div class="rounded-2xl border border-gray-200 bg-white p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-title-01-normal-semibold text-gray-800">
                  AI 사용 횟수 추이
                </h3>
                <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
                  일별 사용 횟수 + 누적 횟수
                </p>
              </div>
              {@render chartTabSwitcher()}
            </div>
            <div class="flex flex-col items-center py-8 text-center">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 mb-3"
              >
                <svg
                  class="h-6 w-6 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                </svg>
              </div>
              <p class="text-body-02-normal-medium text-gray-500 mb-1">
                사용 횟수 추이가 여기에 표시됩니다
              </p>
              <p class="text-body-03-normal-regular text-gray-400">
                2일 이상 데이터가 쌓이면 추이를 확인할 수 있습니다
              </p>
            </div>
          </div>
        {/if}

        <!-- 기능별 사용 -->
        <div
          class="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col"
        >
          <h3 class="text-title-01-normal-semibold text-gray-800 mb-4 shrink-0">
            기능별 사용
          </h3>

          {#if vm.byPurpose.length > 0}
            <PurposeSummaryPanel items={vm.byPurpose} />
          {:else}
            <div
              class="flex flex-1 flex-col items-center justify-center py-8 text-center"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 mb-3"
              >
                <svg
                  class="h-6 w-6 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
                  />
                </svg>
              </div>
              <p class="text-body-02-normal-medium text-gray-500 mb-1">
                기능별 사용 비율이 여기에 표시됩니다
              </p>
              <p class="text-body-03-normal-regular text-gray-400">
                AI 상담일지, 업무 도우미 등을 사용해 보세요
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- 6. 상담사별 사용 현황 + 사용 기록 -->
      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-2xl border border-gray-200 bg-white p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-title-01-normal-semibold text-gray-800">
              상담사별 사용 현황
            </h3>
            <span class="text-body-03-normal-regular text-gray-400"
              >이번 달 기준</span
            >
          </div>
          <MemberUsageList items={memberUsage} />
        </div>

        <UsageTimeline items={historyData?.items ?? []} />
      </div>

      <!-- 7. 안내 -->
      <div class="rounded-lg bg-gray-50 px-5 py-4">
        <p class="text-body-02-normal-medium text-gray-500 mb-2">안내</p>
        <ul class="space-y-1.5">
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-02-normal-regular text-gray-500">
              크레딧은 AI 기능 사용 시 자동으로 누적됩니다.
            </p>
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-02-normal-regular text-gray-500">
              크레딧은 기간 종료 시 초기화되며, 이월되지 않습니다.
            </p>
          </li>
          <li class="flex items-start gap-1.5">
            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"></span>
            <p class="text-body-02-normal-regular text-gray-500">
              크레딧이 부족하면 AI 기능 사용이 제한됩니다.
            </p>
          </li>
        </ul>
      </div>
    </div>
  {:else if usageQuery.isError}
    <div class="flex flex-col items-center justify-center py-16 gap-3">
      <p class="text-body-01-reading-regular text-gray-500">
        데이터를 불러오지 못했어요.
      </p>
      <button
        onclick={() => usageQuery.refetch()}
        class="rounded-lg border border-gray-200 px-4 py-2 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
      >
        다시 시도
      </button>
    </div>
  {:else}
    <div class="flex items-center justify-center py-16">
      <p class="text-body-01-reading-regular text-gray-400">
        AI 사용량 정보를 불러올 수 없어요.
      </p>
    </div>
  {/if}
</div>
