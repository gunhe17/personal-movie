<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import Pagination from '$components/Pagination.svelte'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getPaymentFailures,
    getPaymentStats,
    type FailedPaymentSummary,
    type FailedPaymentListResponse,
    type PaymentStatsResponse,
  } from '$hooks/actions/subscription.action'
  import {
    getPlanConfigs,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'
  import {
    PLAN_LABELS,
    PLAN_CHART_COLORS,
  } from '$lib/features/subscription/constants'
  import { formatDate } from '$lib/utils/format'
  import { fade, fly } from 'svelte/transition'

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

  // ─── 결제 실패 목록 ───
  let failurePage = $state(1)
  const PAGE_SIZE = 15

  const failuresQuery = $derived(
    queryBuilder<any, any>(getPaymentFailures, () => ({
      page: failurePage,
      size: PAGE_SIZE,
    }))
  )
  const failures = $derived<FailedPaymentListResponse | null>(failuresQuery.data ?? null)

  // ─── 결제 통계 ───
  const paymentStatsQuery = $derived(
    queryBuilder<any, any>(getPaymentStats, () => ({
      year: selectedYear,
      month: selectedMonth,
    }))
  )
  const stats = $derived<PaymentStatsResponse | null>(paymentStatsQuery.data ?? null)

  const isLoading = $derived(failuresQuery.isPending || paymentStatsQuery.isPending)

  // 플랜 설정 (API 기반 라벨)
  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))

  // ─── 플랜별 매출 ───
  const revenuePlanEntries = $derived.by(() => {
    if (!stats?.revenue_by_plan) return []
    return Object.entries(stats.revenue_by_plan)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
  })
  const maxRevenue = $derived(
    revenuePlanEntries.length > 0 ? Math.max(...revenuePlanEntries.map(([, v]) => v)) : 1
  )
  const totalRevenue = $derived(
    revenuePlanEntries.reduce((s, [, v]) => s + v, 0)
  )

  // ─── 실패율 계산 ───
  const failureRate = $derived.by(() => {
    if (!stats) return null
    const total = (stats.total_confirmed_this_month ?? 0) + (stats.failed_count ?? 0)
    if (total === 0) return null
    return Math.round(((stats.failed_count ?? 0) / total) * 100)
  })

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<FailedPaymentSummary>[] = [
    { key: 'created_at', label: '실패일시', width: '1fr', render: dateCell },
    { key: 'center_name', label: '센터명', width: '1.5fr', render: nameCell },
    { key: 'plan', label: '플랜', width: '0.7fr', align: 'center', render: planCell },
    { key: 'amount', label: '금액', width: '0.8fr', align: 'right', render: amountCell },
    { key: 'failed_reason', label: '실패 사유', width: '2fr', render: reasonCell },
    { key: 'id', label: '', width: '0.5fr', align: 'center', render: actionCell },
  ]
</script>

<!-- ── 셀 렌더러 ── -->

{#snippet dateCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  <span class="text-body-03-normal-regular tabular-nums text-gray-700">{formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}</span>
{/snippet}

{#snippet nameCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  <span class="text-body-03-normal-medium text-gray-800">{item.center_name}</span>
{/snippet}

{#snippet planCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  <PlanBadge plan={item.plan} planConfig={planLookup.get(item.plan)} />
{/snippet}

{#snippet amountCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  <span class="tabular-nums text-body-03-normal-medium text-gray-800">{item.amount.toLocaleString()}원</span>
{/snippet}

{#snippet reasonCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  {#if item.failed_reason}
    <span class="text-body-03-normal-regular text-red-600">{item.failed_reason}</span>
  {:else}
    <span class="text-gray-400">-</span>
  {/if}
{/snippet}

{#snippet actionCell({ item }: { item: FailedPaymentSummary; index: number; isChecked: boolean })}
  <button
    class="rounded-md border border-gray-200 px-2.5 py-1 text-label-02-normal-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
    onclick={(e) => { e.stopPropagation(); goto(`/subscription/manage/${item.center_id}`) }}
  >
    상세
  </button>
{/snippet}

<!-- ── 페이지 ── -->

<div in:fade class="p-6">
  <PageHeader
    title="결제 관리"
    description="결제 현황 및 실패 건 관리"
  >
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
      <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
    </div>
  {:else}

    <!-- ── KPI 카드 ── -->
    <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
      <!-- MRR -->
      <div in:fly={{ y: 16, duration: 350, delay: 0 }} class="section-border rounded-xl px-5 py-4">
        <p class="text-label-01-normal-regular text-gray-400">이번 달 매출 (MRR)</p>
        <p class="mt-1 text-headline-01-normal-bold tabular-nums text-gray-800">
          {(stats?.mrr ?? 0).toLocaleString()}<span class="text-body-03-normal-regular text-gray-400">원</span>
        </p>
        <p class="mt-1 text-label-01-normal-regular text-gray-400">{selectedYear}년 {selectedMonth}월</p>
      </div>

      <!-- 확정 결제 -->
      <div in:fly={{ y: 16, duration: 350, delay: 80 }} class="section-border rounded-xl px-5 py-4">
        <p class="text-label-01-normal-regular text-gray-400">확정 결제</p>
        <p class="mt-1 text-headline-01-normal-bold tabular-nums text-gray-800">
          {stats?.total_confirmed_this_month ?? 0}<span class="text-body-03-normal-regular text-gray-400">건</span>
        </p>
        {#if failureRate !== null && failureRate > 0}
          <p class="mt-1 text-label-01-normal-regular text-green-500">성공률 {100 - failureRate}%</p>
        {:else}
          <p class="mt-1 text-label-01-normal-regular text-gray-400">정상 결제 완료</p>
        {/if}
      </div>

      <!-- 결제 실패 -->
      <div in:fly={{ y: 16, duration: 350, delay: 160 }}
        class="section-border rounded-xl px-5 py-4 {(stats?.failed_count ?? 0) > 0 ? 'border-red-200 bg-red-50/30' : ''}"
      >
        <p class="text-label-01-normal-regular {(stats?.failed_count ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}">결제 실패</p>
        <p class="mt-1 text-headline-01-normal-bold tabular-nums {(stats?.failed_count ?? 0) > 0 ? 'text-red-600' : 'text-gray-800'}">
          {stats?.failed_count ?? 0}<span class="text-body-03-normal-regular {(stats?.failed_count ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}">건</span>
        </p>
        <p class="mt-1 text-label-01-normal-regular {(stats?.failed_count ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}">
          {#if (stats?.failed_count ?? 0) > 0 && failureRate !== null}
            실패율 {failureRate}%
          {:else if (stats?.failed_count ?? 0) > 0}
            확인 필요
          {:else}
            실패 없음
          {/if}
        </p>
      </div>

      <!-- 총 매출 -->
      <div in:fly={{ y: 16, duration: 350, delay: 240 }} class="section-border rounded-xl px-5 py-4">
        <p class="text-label-01-normal-regular text-gray-400">플랜별 매출 합계</p>
        <p class="mt-1 text-headline-01-normal-bold tabular-nums text-gray-800">
          {totalRevenue.toLocaleString()}<span class="text-body-03-normal-regular text-gray-400">원</span>
        </p>
        <p class="mt-1 text-label-01-normal-regular text-gray-400">{revenuePlanEntries.length}개 플랜</p>
      </div>
    </div>

    <!-- ── 플랜별 매출 분포 ── -->
    {#if revenuePlanEntries.length > 0}
      <div in:fly={{ y: 12, duration: 350, delay: 280 }} class="mb-4 section-border rounded-xl p-5">
        <Typography variant="title-01-semibold" color="text-gray-800" className="mb-4">플랜별 매출</Typography>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {#each revenuePlanEntries as [plan, amount]}
            {@const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0}
            <div class="rounded-lg bg-gray-50 px-4 py-3">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-sm" style="background: {PLAN_CHART_COLORS[plan] ?? '#6366f1'}"></span>
                  <span class="text-body-03-normal-medium text-gray-700">{planLookup.get(plan)?.label ?? PLAN_LABELS[plan] ?? plan}</span>
                </div>
                <span class="rounded-full bg-gray-200 px-2 py-0.5 text-label-02-normal-regular tabular-nums text-gray-500">{pct}%</span>
              </div>
              <p class="text-headline-02-normal-bold tabular-nums text-gray-800">{amount.toLocaleString()}<span class="text-label-02-normal-regular text-gray-400">원</span></p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── 결제 실패 목록 ── -->
    <div in:fly={{ y: 12, duration: 350, delay: 320 }} class="section-border overflow-hidden">
      <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div class="flex items-center gap-3">
          <Typography variant="title-01-semibold" color="text-gray-800">결제 실패 내역</Typography>
          {#if failures && failures.total > 0}
            <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-label-02-normal-medium text-red-600">
              <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
              {failures.total}건
            </span>
          {/if}
        </div>
        {#if failures && failures.total > 0}
          <span class="text-label-02-normal-regular tabular-nums text-gray-400">
            미처리 <strong class="text-red-600">{failures.total}건</strong>
          </span>
        {/if}
      </div>

      {#if !failures || failures.items.length === 0}
        <div class="flex flex-col items-center justify-center py-12">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-3">
            <svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p class="text-body-03-normal-medium text-gray-600">결제 실패 없음</p>
          <p class="mt-1 text-label-02-normal-regular text-gray-400">모든 결제가 정상 처리되고 있습니다</p>
        </div>
      {:else}
        <Table
          columns={columns}
          data={failures.items}
          keyField="id"
          onRowClick={(item) => goto(`/subscription/manage/${item.center_id}`)}
          hoverEnabled
        />

        {#if failures.total > PAGE_SIZE}
          <div class="border-t border-gray-100 px-4 py-3">
            <Pagination
              totalItems={failures.total}
              itemsPerPage={PAGE_SIZE}
              bind:currentPage={failurePage}
            />
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
