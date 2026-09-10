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
  import { mapToSubscriptionVM } from '$lib/features/subscription/view-model'
  import {
    SUBSCRIPTION_STALE_TIME,
    SUBSCRIPTION_REFETCH_INTERVAL
  } from '$lib/features/subscription/constants'
  import UsageInsightCard from '$lib/features/credit/components/UsageInsightCard.svelte'
  import UsageSummaryCard from '$lib/features/credit/components/UsageSummaryCard.svelte'
  import TrendChart from '$lib/features/credit/components/TrendChart.svelte'
  import TrendKpiBar from '$lib/features/credit/components/TrendKpiBar.svelte'
  import UsageTimeline from '$lib/features/credit/components/UsageTimeline.svelte'
  import EmptyChartState from '$lib/features/credit/components/EmptyChartState.svelte'

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

  // ── 기능별 도넛 ──
  let donutHover = $state<number | null>(null)

  const DN_CX = 90,
    DN_CY = 90,
    DN_R = 66,
    DN_S = 22
  const DN_C = 2 * Math.PI * DN_R
  const DN_COLORS = ['#818cf8', '#a78bfa', '#ddd6fe']

  interface DonutSeg {
    offset: number
    dash: number
    color: string
    label: string
    percent: number
    credits: number
    calls: number
    hitPath: string
  }

  const donutTotal = $derived(
    vm?.byPurpose.reduce((s, p) => s + p.credits, 0) ?? 0
  )
  const donutSegs = $derived.by((): DonutSeg[] => {
    if (!vm || donutTotal === 0) return []
    let off = 0
    return vm.byPurpose.map((p, idx) => {
      const dash = (p.credits / donutTotal) * DN_C
      const color = DN_COLORS[idx % DN_COLORS.length]
      const percent = Math.round((p.credits / donutTotal) * 100)
      const sa = (off / DN_C) * 2 * Math.PI - Math.PI / 2
      const ea = ((off + dash) / DN_C) * 2 * Math.PI - Math.PI / 2
      const oR = DN_R + DN_S / 2 + 5,
        iR = DN_R - DN_S / 2 - 5
      const large = dash / DN_C > 0.5 ? 1 : 0
      const pt = (r: number, a: number) =>
        [DN_CX + r * Math.cos(a), DN_CY + r * Math.sin(a)] as const
      const [ox1, oy1] = pt(oR, sa),
        [ox2, oy2] = pt(oR, ea)
      const [ix1, iy1] = pt(iR, ea),
        [ix2, iy2] = pt(iR, sa)
      const hitPath = `M${ox1.toFixed(1)},${oy1.toFixed(1)} A${oR},${oR} 0 ${large} 1 ${ox2.toFixed(1)},${oy2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${iR},${iR} 0 ${large} 0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z`
      const seg: DonutSeg = {
        offset: off,
        dash,
        color,
        label: p.label,
        percent,
        credits: p.credits,
        calls: p.calls,
        hitPath
      }
      off += dash
      return seg
    })
  })
  const donutCenter = $derived(
    donutHover !== null ? donutSegs[donutHover] : donutSegs[0]
  )

  // ── 아바타 컬러 ──
  const avatarColors = [
    { bg: 'bg-indigo-100', text: 'text-indigo-600', bar: '#818cf8' },
    { bg: 'bg-violet-100', text: 'text-violet-600', bar: '#a78bfa' },
    { bg: 'bg-purple-100', text: 'text-purple-600', bar: '#c4b5fd' }
  ]
</script>

<div in:fade class="mx-auto flex max-w-[1200px] flex-col">
  <PageTitleSection title="AI 사용량" className="mb-4" />

  {#if isLoading}
    <div
      class="rounded-2xl border border-gray-200 bg-white p-8 flex items-center justify-center"
    >
      <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
    </div>
  {:else if subVM?.isFree}
    <!-- Free 플랜 -->
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
            href="/settings/subscription"
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
            href="/settings/subscription"
            class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
            >구독 관리 &rarr;</a
          >
        </div>

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
          <span class="text-body-03-normal-regular text-gray-400"
            >{vm.creditRemaining.toLocaleString()} 남음</span
          >
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
          <span
            ><strong class="text-gray-700">{vm.daysUntilReset}일</strong> 후 리셋</span
          >
        </div>
      </div>

      <!-- 2. 경고/소진 예측 -->
      {#if vm.status === 'danger'}
        <div
          class="rounded-lg bg-status-danger-bg border border-red-100 px-4 py-3 flex items-center gap-2.5"
        >
          <svg
            class="h-4 w-4 text-status-danger shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <div>
            <p class="text-body-02-normal-medium text-red-600">
              크레딧이 거의 소진되었어요.
              <span class="tabular-nums"
                >남은 {vm.creditRemaining.toLocaleString()} 크레딧 ({100 -
                  vm.usagePercent}%)</span
              >
              {#if vm.insight.estimatedDepletionDays > 0}
                <span
                  class="text-body-03-normal-regular text-status-danger ml-1"
                  >· 약 {vm.insight.estimatedDepletionDays}일 후 소진 예상</span
                >
              {/if}
            </p>
            <a
              href="/settings/subscription"
              class="text-body-03-normal-regular text-status-danger hover:text-red-600 underline"
              >플랜 업그레이드로 크레딧 늘리기</a
            >
          </div>
        </div>
      {:else if vm.status === 'warning'}
        <div
          class="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-center gap-2.5"
        >
          <svg
            class="h-4 w-4 text-amber-500 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p class="text-body-02-normal-medium text-amber-700">
            크레딧이 얼마 남지 않았어요.
            <span class="tabular-nums"
              >남은 {vm.creditRemaining.toLocaleString()} 크레딧 ({100 -
                vm.usagePercent}%)</span
            >
            {#if vm.insight.estimatedDepletionDays > 0 && vm.insight.estimatedDepletionDays <= vm.daysUntilReset}
              <span class="text-body-03-normal-regular text-amber-600 ml-1"
                >· 약 {vm.insight.estimatedDepletionDays}일 후 소진 예상</span
              >
            {/if}
          </p>
        </div>
      {/if}

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
          },
          {
            label: '주간 추세',
            value: `${Math.abs(vm.insight.weeklyTrendPercent)}%`,
            trend: {
              direction: vm.insight.weeklyTrend,
              percent: vm.insight.weeklyTrendPercent
            }
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
        <!-- 추이 차트 (탭: 크레딧 / 호출 횟수) -->
        {#snippet chartTabSwitcher()}
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 shrink-0">
            {#each [['credits', '크레딧'], ['calls', '호출 횟수']] as const as [key, label]}
              <button
                class="rounded-lg px-3 py-1.5 text-body-03-normal-medium transition-colors
                  {chartTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (chartTab = key)}>{label}</button
              >
            {/each}
          </div>
        {/snippet}

        {#if chartTab === 'credits'}
          {#if creditTrend.length > 0}
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
                <h3 class="text-title-01-normal-semibold text-gray-800">
                  크레딧 누적 사용량
                </h3>
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
                  AI 기능을 사용하면 일별·누적 크레딧 소비량을 확인할 수
                  있습니다
                </p>
              </div>
            </div>
          {/if}
        {:else if callsTrend.length > 0}
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
              <h3 class="text-title-01-normal-semibold text-gray-800">
                AI 사용 횟수 추이
              </h3>
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
                AI 기능을 사용하면 일별·누적 사용 횟수를 확인할 수 있습니다
              </p>
            </div>
          </div>
        {/if}

        <!-- 기능별 사용 (도넛 + 테이블) -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col"
        >
          <h3 class="text-title-01-normal-semibold text-gray-800 mb-4 shrink-0">
            기능별 사용
          </h3>

          {#if vm.byPurpose.length > 0}
            <div class="flex items-stretch gap-0 flex-1">
              <!-- 도넛 -->
              <div
                class="relative shrink-0 flex flex-col items-center justify-center pr-5"
                style="width:160px"
                onmouseleave={() => (donutHover = null)}
              >
                <div class="relative" style="width:140px;height:140px">
                  <svg viewBox="0 0 180 180" class="h-full w-full">
                    <circle
                      cx={DN_CX}
                      cy={DN_CY}
                      r={DN_R}
                      fill="none"
                      stroke="#f3f4f6"
                      stroke-width={DN_S}
                    />
                    {#each donutSegs as seg, i}
                      <circle
                        cx={DN_CX}
                        cy={DN_CY}
                        r={DN_R}
                        fill="none"
                        stroke={seg.color}
                        stroke-width={donutHover === i ? DN_S + 5 : DN_S}
                        stroke-dasharray="{seg.dash} {DN_C}"
                        stroke-dashoffset={-seg.offset}
                        transform="rotate(-90 {DN_CX} {DN_CY})"
                        style="opacity:{donutHover !== null && donutHover !== i
                          ? 0.3
                          : 1};transition:stroke-width 0.15s ease,opacity 0.15s ease"
                      />
                    {/each}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    {#each donutSegs as seg, i}
                      <path
                        d={seg.hitPath}
                        fill="transparent"
                        style="cursor:pointer"
                        onmouseenter={() => (donutHover = i)}
                      />
                    {/each}
                  </svg>
                  <div
                    class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                  >
                    <span
                      class="text-label-01-normal-medium text-gray-700 max-w-[72px] truncate-safe text-center leading-none"
                    >
                      {donutCenter?.label ?? ''}
                    </span>
                    <span
                      class="text-title-01-normal-semibold tabular-nums text-gray-900 leading-none mt-0.5"
                    >
                      {donutCenter?.percent ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              <!-- 구분선 -->
              <div class="w-px bg-gray-100 shrink-0 self-stretch"></div>

              <!-- 테이블 -->
              <div class="flex-1 pl-5">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-gray-100">
                      <th
                        class="text-left text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                        >기능</th
                      >
                      <th
                        class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                        >크레딧</th
                      >
                      <th
                        class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                        >횟수</th
                      >
                      <th
                        class="text-right text-body-03-normal-medium text-gray-400 pb-2 font-normal"
                        >비율</th
                      >
                    </tr>
                  </thead>
                  <tbody>
                    {#each vm.byPurpose as p, i}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <tr
                        class="border-b border-gray-50 last:border-0 transition-opacity"
                        style="opacity:{donutHover !== null && donutHover !== i
                          ? 0.35
                          : 1}"
                        onmouseenter={() => (donutHover = i)}
                        onmouseleave={() => (donutHover = null)}
                      >
                        <td class="py-3">
                          <div class="flex items-center gap-2">
                            <span
                              class="inline-block h-2 w-2 rounded-full shrink-0"
                              style="background:{donutSegs[i]?.color}"
                            ></span>
                            <span
                              class="text-body-02-normal-medium text-gray-700"
                              >{p.label}</span
                            >
                          </div>
                        </td>
                        <td
                          class="py-3 text-right text-body-02-normal-medium tabular-nums text-gray-900"
                          >{p.credits.toLocaleString()}</td
                        >
                        <td
                          class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                          >{p.calls}회</td
                        >
                        <td
                          class="py-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                          >{donutSegs[i]?.percent ?? 0}%</td
                        >
                      </tr>
                    {/each}
                  </tbody>
                  <tfoot>
                    <tr class="border-t border-gray-100">
                      <td class="pt-3 text-body-02-normal-medium text-gray-500"
                        >합계</td
                      >
                      <td
                        class="pt-3 text-right text-body-02-normal-semibold tabular-nums text-gray-900"
                        >{donutTotal.toLocaleString()}</td
                      >
                      <td
                        class="pt-3 text-right text-body-02-normal-medium tabular-nums text-gray-500"
                        >{vm.byPurpose.reduce((s, p) => s + p.calls, 0)}회</td
                      >
                      <td
                        class="pt-3 text-right text-body-02-normal-regular tabular-nums text-gray-500"
                        >100%</td
                      >
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
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
        <!-- 상담사별 사용 현황 -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-title-01-normal-semibold text-gray-800">
              상담사별 사용 현황
            </h3>
            <span class="text-body-03-normal-regular text-gray-400"
              >이번 달 기준</span
            >
          </div>

          {#if memberUsage.length > 0}
            <div class="space-y-3">
              {#each memberUsage as m, i}
                {@const ac = avatarColors[i % avatarColors.length]}
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {ac.bg}"
                  >
                    <span class="text-body-02-normal-semibold {ac.text}"
                      >{m.memberName.charAt(0)}</span
                    >
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline justify-between mb-1.5">
                      <span class="text-body-02-normal-medium text-gray-800"
                        >{m.memberName}</span
                      >
                      <span
                        class="text-body-02-normal-medium tabular-nums text-gray-900 shrink-0 ml-2"
                        >{m.totalCredits.toLocaleString()} 크레딧</span
                      >
                    </div>
                    <div
                      class="relative h-1.5 rounded-full bg-gray-100 overflow-hidden"
                    >
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        style="width:{m.percentage}%;background:{ac.bar}"
                      ></div>
                    </div>
                  </div>
                  <span
                    class="shrink-0 w-10 text-right text-body-03-normal-regular tabular-nums text-gray-400"
                    >{m.percentage}%</span
                  >
                </div>
              {/each}
            </div>
          {:else}
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
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
              <p class="text-body-02-normal-medium text-gray-500 mb-1">
                상담사별 사용 기록이 없어요
              </p>
              <p class="text-body-03-normal-regular text-gray-400">
                AI 기능을 사용하면 상담사별 사용 현황을 확인할 수 있습니다
              </p>
            </div>
          {/if}
        </div>

        <!-- 사용 기록 -->
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
    <div
      class="rounded-2xl border border-gray-200 bg-white p-8 flex flex-col items-center justify-center gap-3"
    >
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
    <div
      class="rounded-2xl border border-gray-200 bg-white p-8 flex items-center justify-center"
    >
      <p class="text-body-01-reading-regular text-gray-400">
        AI 사용량 정보를 불러올 수 없어요.
      </p>
    </div>
  {/if}
</div>
