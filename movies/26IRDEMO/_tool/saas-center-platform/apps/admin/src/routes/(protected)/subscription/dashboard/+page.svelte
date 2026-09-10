<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import DonutChart from '$lib/features/subscription/components/DonutChart.svelte'
  import PlanLegend from '$lib/features/subscription/components/PlanLegend.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getSubscriptionUsageOverview,
    getSubscriptionStats,
    getSubscriptionList,
    getPaymentStats,
    type CenterUsageRank,
    type SubscriptionUsageOverviewResponse,
    type SubscriptionStatsResponse,
    type AdminSubscriptionListResponse,
    type PaymentStatsResponse,
  } from '$hooks/actions/subscription.action'
  import {
    getPlanConfigs,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'
  import {
    planChartColor,
    FEATURE_BAR_COLORS,
    CREDIT_USAGE_THRESHOLDS,
  } from '$lib/features/subscription/constants'
  import { fade } from 'svelte/transition'

  // ─── 기간 필터 ───
  const now = new Date()
  let selectedPeriod = $state(`${now.getFullYear()}-${now.getMonth() + 1}`)
  const selectedYear = $derived(Number(selectedPeriod.split('-')[0]))
  const selectedMonth = $derived(Number(selectedPeriod.split('-')[1]))

  const monthOptions = $derived.by(() => {
    const opts: { value: string; title: string }[] = []
    const d = new Date(now.getFullYear(), now.getMonth())
    for (let i = 0; i < 12; i++) {
      opts.push({
        value: `${d.getFullYear()}-${d.getMonth() + 1}`,
        title: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      })
      d.setMonth(d.getMonth() - 1)
    }
    return opts
  })

  // ─── 쿼리 ───
  const overviewQuery = $derived(
    queryBuilder<any, any>(getSubscriptionUsageOverview, () => ({
      year: selectedYear,
      month: selectedMonth,
      top_limit: 5,
    }))
  )
  const data = $derived<SubscriptionUsageOverviewResponse | null>(overviewQuery.data ?? null)

  const statsQuery = $derived(queryBuilder<any, any>(getSubscriptionStats, () => ({})))
  const stats = $derived<SubscriptionStatsResponse | null>(statsQuery.data ?? null)

  const pendingQuery = $derived(
    queryBuilder<any, any>(getSubscriptionList, () => ({ status: 'pending', page: 1, size: 1 }))
  )
  const pendingCount = $derived<number>((pendingQuery.data as AdminSubscriptionListResponse | null)?.total ?? 0)

  const paymentStatsQuery = $derived(
    queryBuilder<any, any>(getPaymentStats, () => ({ year: selectedYear, month: selectedMonth }))
  )
  const paymentStats = $derived<PaymentStatsResponse | null>(paymentStatsQuery.data ?? null)
  const failedPaymentCount = $derived(paymentStats?.failed_count ?? 0)

  const isLoading = $derived(overviewQuery.isPending || statsQuery.isPending)

  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))
  /** plan_order 정렬된 플랜 목록 — 도넛·범례의 정본(하드코딩 대체) */
  const orderedPlans = $derived([...planConfigs].sort((a, b) => a.plan_order - b.plan_order))

  // ─── 파생 데이터 ───
  const freeCount = $derived(stats?.by_plan?.free ?? 0)
  const paidCount = $derived(stats ? (stats.total - freeCount) : 0)
  const paidRate = $derived(stats && stats.total > 0 ? Math.round((paidCount / stats.total) * 100) : 0)

  const totalCreditsUsed = $derived(data?.feature_usage?.reduce((sum, f) => sum + f.total_credits, 0) ?? 0)
  const totalCalls = $derived(data?.feature_usage?.reduce((sum, f) => sum + f.total_calls, 0) ?? 0)
  const activeFeatures = $derived(data?.feature_usage?.filter(f => f.total_calls > 0 || f.total_credits > 0) ?? [])

  const avgUsagePct = $derived.by(() => {
    if (!data?.top_credit_users?.length) return 0
    const sum = data.top_credit_users.reduce((s, u) => s + (u.credit_limit > 0 ? (u.credit_used / u.credit_limit) * 100 : 0), 0)
    return Math.round(sum / data.top_credit_users.length)
  })

  function getPlanPct(plan: string): number {
    if (!data || data.total_centers === 0) return 0
    return Math.round(((data.by_plan?.[plan] ?? 0) / data.total_centers) * 100)
  }

  const donutSegments = $derived(
    orderedPlans.map((p, i) => ({
      key: p.plan_type,
      value: data?.by_plan?.[p.plan_type] ?? 0,
      color: planChartColor(p.plan_type, i),
      label: p.label,
    }))
  )

  const planLegendItems = $derived(
    orderedPlans.map((p, i) => ({
      key: p.plan_type,
      count: data?.by_plan?.[p.plan_type] ?? 0,
      pct: getPlanPct(p.plan_type),
      color: planChartColor(p.plan_type, i),
      label: p.label,
    }))
  )

  const topCount = $derived(data?.top_credit_users?.length ?? 0)
  const topLabel = $derived(topCount > 0 ? `크레딧 사용량 TOP ${topCount}` : '크레딧 사용량')

  // ─── 카운트업 애니메이션 ───
  let animatedTotal = $state(0)
  let animatedPaidRate = $state(0)
  let animatedQuota = $state(0)
  let animatedPending = $state(0)
  let mounted = $state(false)

  function animateValue(from: number, to: number, duration: number, cb: (v: number) => void) {
    if (!browser) { cb(to); return }
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      cb(Math.round(from + (to - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  $effect(() => {
    if (data && stats && !isLoading) {
      mounted = true
      animateValue(0, data.total_centers, 800, v => animatedTotal = v)
      animateValue(0, paidRate, 1000, v => animatedPaidRate = v)
      animateValue(0, data.quota_exceeded_count, 600, v => animatedQuota = v)
      animateValue(0, pendingCount, 600, v => animatedPending = v)
    }
  })

  const actionItems = $derived.by(() => {
    if (!data || !stats) return []
    const items: { label: string; count: number; dot: string; href: string }[] = []
    if (pendingCount > 0)
      items.push({ label: '승인 대기', count: pendingCount, dot: 'bg-primary-500', href: '/subscription/list?filter=pending' })
    if (data.quota_exceeded_count > 0)
      items.push({ label: '쿼터 초과', count: data.quota_exceeded_count, dot: 'bg-red-500', href: '/subscription/list?filter=quota_exceeded' })
    if (failedPaymentCount > 0)
      items.push({ label: '결제 실패', count: failedPaymentCount, dot: 'bg-rose-500', href: '/subscription/manage' })
    return items
  })

  let hoveredPlan = $state<string | null>(null)

  // ─── TOP N 헬퍼 ───
  function topPct(item: CenterUsageRank): number {
    return item.credit_limit > 0 ? Math.min(100, Math.round((item.credit_used / item.credit_limit) * 100)) : 0
  }
  function topPctColor(pct: number): string {
    if (pct >= CREDIT_USAGE_THRESHOLDS.DANGER) return 'text-red-600'
    if (pct >= CREDIT_USAGE_THRESHOLDS.WARNING) return 'text-amber-600'
    return 'text-gray-700'
  }
  function topBarColor(pct: number): string {
    if (pct >= CREDIT_USAGE_THRESHOLDS.DANGER) return 'bg-red-500'
    if (pct >= CREDIT_USAGE_THRESHOLDS.WARNING) return 'bg-amber-400'
    return 'bg-primary-500'
  }

  const topColumns: TableColumn<CenterUsageRank>[] = [
    { key: 'center_id',    label: '#',    width: '48px',  align: 'center', render: topRankCell },
    { key: 'center_name',  label: '센터', width: '1fr',   render: topNameCell },
    { key: 'credit_used',  label: '사용량', width: '120px', render: topBarCell },
    { key: 'credit_limit', label: '크레딧', width: '150px', align: 'right', render: topCreditCell },
    { key: 'plan',         label: '비율',  width: '70px',  align: 'right', render: topPctCell },
  ]
</script>

<!-- ── TOP N 셀 렌더러 ── -->

{#snippet topRankCell({ index }: { item: CenterUsageRank; index: number; isChecked: boolean })}
  <span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-label-02-normal-bold
    {index === 0 ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-500'}">
    {index + 1}
  </span>
{/snippet}

{#snippet topNameCell({ item }: { item: CenterUsageRank; index: number; isChecked: boolean })}
  <div class="flex items-center gap-2">
    <span class="text-body-03-normal-medium text-gray-800">{item.center_name}</span>
    <PlanBadge plan={item.plan} size="sm" planConfig={planLookup.get(item.plan)} />
  </div>
{/snippet}

{#snippet topBarCell({ item }: { item: CenterUsageRank; index: number; isChecked: boolean })}
  {@const pct = topPct(item)}
  <div class="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
    <div
      class="h-full rounded-full transition-all duration-700 {topBarColor(pct)}"
      style="width:{mounted ? pct : 0}%"
    ></div>
  </div>
{/snippet}

{#snippet topCreditCell({ item }: { item: CenterUsageRank; index: number; isChecked: boolean })}
  {@const pct = topPct(item)}
  <span class="tabular-nums text-body-03-normal-medium {topPctColor(pct)}">{item.credit_used.toLocaleString()}</span>
  <span class="text-label-01-normal-regular text-gray-400"> / {item.credit_limit.toLocaleString()}</span>
{/snippet}

{#snippet topPctCell({ item }: { item: CenterUsageRank; index: number; isChecked: boolean })}
  {@const pct = topPct(item)}
  <span class="tabular-nums text-body-03-normal-bold {topPctColor(pct)}">{pct}%</span>
{/snippet}

<!-- ══════════════════════════════ 페이지 ══════════════════════════════ -->

<div in:fade class="p-6">
  <PageHeader title="구독 대시보드" description="플랫폼 전체 구독 및 AI 사용 현황">
    {#snippet actions()}
      <Select
        class="h-11 w-36 rounded-lg bg-white"
        selected={selectedPeriod}
        showActiveHighlight={true}
        defaultValue={`${now.getFullYear()}-${now.getMonth() + 1}`}
        on:change={(e) => { selectedPeriod = e.detail.value }}
        options={monthOptions}
      />
    {/snippet}
  </PageHeader>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <p class="text-body-03-normal-regular text-gray-400">불러오는 중...</p>
    </div>
  {:else if data}

    <!-- ── KPI 카드 4열 (Section 9-2 단순 카드) ── -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      <!-- 전체 센터 -->
      <button
        class="section-border flex flex-col gap-1.5 px-5 py-4 text-left transition-shadow hover:shadow-md"
        onclick={() => goto('/subscription/list')}
      >
        <p class="text-label-01-normal-regular text-gray-500">전체 센터</p>
        <div class="flex items-end justify-between gap-2">
          <p class="tabular-nums text-headline-01-normal-bold text-gray-900">{animatedTotal}</p>
          {#if stats && stats.total > 0}
            <svg viewBox="0 0 36 36" class="h-9 w-9 shrink-0">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" stroke-width="4" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-primary-500)" stroke-width="4"
                stroke-dasharray="{87.96 * paidRate / 100} {87.96 * (1 - paidRate / 100)}"
                stroke-dashoffset="22"
                stroke-linecap="round"
              />
            </svg>
          {/if}
        </div>
        <p class="text-label-01-normal-regular text-gray-400">유료 {paidCount} · 무료 {freeCount}</p>
      </button>

      <!-- 유료 전환율 -->
      <button
        class="section-border flex flex-col gap-1.5 px-5 py-4 text-left transition-shadow hover:shadow-md"
        onclick={() => goto('/subscription/list')}
      >
        <p class="text-label-01-normal-regular text-gray-500">유료 전환율</p>
        <p class="tabular-nums text-headline-01-normal-bold text-gray-900">
          {animatedPaidRate}<span class="text-body-01-normal-regular text-gray-400">%</span>
        </p>
        <p class="text-label-01-normal-regular text-gray-400">{paidCount}개 센터 유료 구독 중</p>
      </button>

      <!-- 쿼터 초과 -->
      <button
        class="section-border flex flex-col gap-1.5 px-5 py-4 text-left transition-shadow hover:shadow-md
          {data.quota_exceeded_count > 0 ? 'border-red-200 bg-red-50/30' : ''}"
        onclick={() => data.quota_exceeded_count > 0 ? goto('/subscription/list?filter=quota_exceeded') : null}
      >
        <p class="text-label-01-normal-regular {data.quota_exceeded_count > 0 ? 'text-red-500' : 'text-gray-500'}">쿼터 초과</p>
        <div class="flex items-end gap-2">
          <p class="tabular-nums text-headline-01-normal-bold {data.quota_exceeded_count > 0 ? 'text-red-600' : 'text-gray-900'}">
            {animatedQuota}
          </p>
          {#if data.quota_exceeded_count > 0}
            <span class="mb-1.5 h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
          {:else}
            <svg class="mb-1 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </div>
        <p class="text-label-01-normal-regular {data.quota_exceeded_count > 0 ? 'text-red-400' : 'text-gray-400'}">
          {data.quota_exceeded_count > 0 ? '즉시 확인 필요' : `${data.total_centers}개 센터 정상`}
        </p>
      </button>

      <!-- 승인 대기 -->
      <button
        class="section-border flex flex-col gap-1.5 px-5 py-4 text-left transition-shadow hover:shadow-md
          {pendingCount > 0 ? 'border-primary-200 bg-primary-50/30' : ''}"
        onclick={() => pendingCount > 0 ? goto('/subscription/list?filter=pending') : null}
      >
        <p class="text-label-01-normal-regular {pendingCount > 0 ? 'text-primary-500' : 'text-gray-500'}">승인 대기</p>
        <div class="flex items-end gap-2">
          <p class="tabular-nums text-headline-01-normal-bold {pendingCount > 0 ? 'text-primary-600' : 'text-gray-900'}">
            {animatedPending}
          </p>
          {#if pendingCount > 0}
            <span class="mb-1.5 h-2 w-2 animate-pulse rounded-full bg-primary-500"></span>
          {:else}
            <svg class="mb-1 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </div>
        <p class="text-label-01-normal-regular {pendingCount > 0 ? 'text-primary-400' : 'text-gray-400'}">
          {pendingCount > 0 ? '플랜 변경 요청 확인 필요' : '대기 중인 요청 없음'}
        </p>
      </button>
    </div>

    <!-- ── 경고 배너 (Section 9-5) ── -->
    {#if actionItems.length > 0}
      <div class="mb-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
        <svg class="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div class="min-w-0 flex-1">
          <p class="text-body-03-normal-semibold text-yellow-800">조치 필요 항목이 있습니다</p>
          <div class="mt-2 flex flex-wrap gap-2">
            {#each actionItems as item}
              <button
                class="inline-flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-white px-3 py-1.5 text-label-01-normal-medium text-gray-700 transition-colors hover:bg-yellow-50"
                onclick={() => goto(item.href)}
              >
                <span class="h-1.5 w-1.5 rounded-full {item.dot}"></span>
                {item.label} {item.count}건 →
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Quick Stats 스트립 ── -->
    <div class="mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-gray-50 px-5 py-3">
      <span class="text-body-03-normal-regular text-gray-500">
        이번 달 크레딧 총 사용
        <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{totalCreditsUsed.toLocaleString()}</span>
      </span>
      <span class="text-gray-300">·</span>
      <span class="text-body-03-normal-regular text-gray-500">
        총 호출 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{totalCalls.toLocaleString()}회</span>
      </span>
      <span class="text-gray-300">·</span>
      <span class="text-body-03-normal-regular text-gray-500">
        활성 기능 <span class="text-body-03-normal-semibold text-gray-800">{activeFeatures.length}개</span>
      </span>
      {#if avgUsagePct > 0}
        <span class="text-gray-300">·</span>
        <span class="text-body-03-normal-regular text-gray-500">
          TOP {topCount} 평균 사용률 <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{avgUsagePct}%</span>
        </span>
      {/if}
      {#if paymentStats && paymentStats.mrr > 0}
        <span class="text-gray-300">·</span>
        <span class="text-body-03-normal-regular text-gray-500">
          MRR <span class="tabular-nums text-body-03-normal-semibold text-gray-800">₩{paymentStats.mrr.toLocaleString()}</span>
        </span>
      {/if}
    </div>

    <!-- ── 플랜 분포 + AI 기능별 사용량 (Section 9-6 차트+기능목록) ── -->
    <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">

      <!-- 플랜 분포 -->
      <div class="section-border p-5">
        <h2 class="mb-4 text-title-01-normal-semibold text-gray-900">플랜 분포</h2>
        <div class="flex items-start gap-4">
          <div class="shrink-0">
            <DonutChart
              segments={donutSegments}
              size={110}
              strokeWidth={14}
              centerText={String(data.total_centers)}
              centerSubText="센터"
              hoveredKey={hoveredPlan}
              onHover={(k) => hoveredPlan = k}
              onClick={(k) => goto(`/subscription/list?plan=${k}`)}
            />
          </div>
          <div class="min-w-0 flex-1">
            <PlanLegend
              plans={planLegendItems}
              hoveredPlan={hoveredPlan}
              onHover={(k) => hoveredPlan = k}
              onClick={(k) => goto(`/subscription/list?plan=${k}`)}
            />
          </div>
        </div>
      </div>

      <!-- AI 기능별 사용량 -->
      <div class="section-border p-5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-title-01-normal-semibold text-gray-900">AI 기능별 사용량</h2>
            <p class="mt-0.5 text-label-01-normal-regular text-gray-400">
              총 {totalCalls.toLocaleString()}회 · {totalCreditsUsed.toLocaleString()} 크레딧
            </p>
          </div>
          <span class="rounded-full bg-gray-100 px-2.5 py-1 text-label-01-normal-medium text-gray-500">
            {selectedYear}년 {selectedMonth}월
          </span>
        </div>

        {#if activeFeatures.length > 0}
          <div class="space-y-2">
            {#each activeFeatures as item, i}
              {@const idx = data.feature_usage.indexOf(item)}
              {@const pct = totalCreditsUsed > 0 ? Math.round((item.total_credits / totalCreditsUsed) * 100) : 0}
              <div class="flex items-center gap-3 rounded-lg bg-gray-50 px-3.5 py-3">
                <span class="h-2 w-2 shrink-0 rounded-full" style="background: {FEATURE_BAR_COLORS[idx % FEATURE_BAR_COLORS.length]}"></span>
                <span class="flex-1 text-body-03-normal-medium text-gray-700">{item.label}</span>
                <span class="tabular-nums text-body-03-normal-semibold text-gray-800">{item.total_calls.toLocaleString()}회</span>
                <span class="tabular-nums text-body-03-normal-regular text-gray-500">{item.total_credits.toLocaleString()} 크레딧</span>
                {#if pct > 0}
                  <span class="rounded-full bg-gray-200 px-2 py-0.5 text-label-02-normal-medium tabular-nums text-gray-500">{pct}%</span>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex flex-col items-center justify-center py-8">
            <svg class="mb-2 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <p class="text-body-03-normal-regular text-gray-400">이번 달 사용 기록이 없습니다</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── 크레딧 사용량 TOP N ── -->
    <div class="section-border overflow-hidden">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 class="text-title-01-normal-semibold text-gray-900">{topLabel}</h2>
        <a
          href="/subscription/list"
          class="text-label-01-normal-medium text-primary-600 hover:underline"
        >전체 보기 →</a>
      </div>

      {#if topCount === 0}
        <div class="py-10">
          <NoDataSection description="크레딧 사용 기록이 없습니다" />
        </div>
      {:else}
        <Table
          columns={topColumns}
          data={data.top_credit_users}
          keyField="center_id"
          onRowClick={(item) => goto(`/subscription/manage/${item.center_id}`)}
          hoverEnabled
        />
      {/if}
    </div>

  {/if}
</div>
