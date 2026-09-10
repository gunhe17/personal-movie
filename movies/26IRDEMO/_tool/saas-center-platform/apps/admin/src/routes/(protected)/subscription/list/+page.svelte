<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Select from '$components/Select.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Pagination from '$components/Pagination.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import StatusBadge from '$lib/features/subscription/components/StatusBadge.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getSubscriptionList,
    getSubscriptionStats,
    type AdminSubscriptionSummary,
    type AdminSubscriptionListResponse,
    type SubscriptionStatsResponse,
  } from '$hooks/actions/subscription.action'
  import {
    getPlanConfigs,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'
  import {
    STATUS_OPTIONS,
    PAGE_SIZE,
    CREDIT_USAGE_THRESHOLDS,
    planChartColor,
    PLAN_LABELS,
  } from '$lib/features/subscription/constants'
  import { fade } from 'svelte/transition'

  // ─── URL 파라미터에서 초기 필터 읽기 ───
  const urlFilter = $derived(new URL(page.url).searchParams.get('filter'))
  const urlPlan = $derived(new URL(page.url).searchParams.get('plan'))

  // ─── 필터 상태 ───
  let search = $state('')
  let debouncedSearch = $state('')
  let planFilter = $state(urlPlan ?? 'all')
  let statusFilter = $state(urlFilter ?? 'all')
  let quotaOnly = $state(urlFilter === 'quota_exceeded')
  let currentPage = $state(1)
  let debounceTimer: ReturnType<typeof setTimeout>

  function onSearchInput(e: Event) {
    search = (e.target as HTMLInputElement).value
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedSearch = search
      currentPage = 1
    }, 300)
  }

  function resetFilters() {
    search = ''
    debouncedSearch = ''
    planFilter = 'all'
    statusFilter = 'all'
    quotaOnly = false
    currentPage = 1
  }

  // ─── 쿼리 ───
  const listQuery = $derived(
    queryBuilder<any, any>(getSubscriptionList, () => ({
      search: debouncedSearch || undefined,
      plan: planFilter !== 'all' ? planFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      is_quota_exceeded: quotaOnly ? true : undefined,
      page: currentPage,
      size: PAGE_SIZE,
    }))
  )
  const data = $derived<AdminSubscriptionListResponse | null>(listQuery.data ?? null)
  const isLoading = $derived(listQuery.isPending)

  // 통계 쿼리
  const statsQuery = $derived(
    queryBuilder<any, any>(getSubscriptionStats, () => ({}))
  )
  const stats = $derived<SubscriptionStatsResponse | null>(statsQuery.data ?? null)

  // 플랜 설정 (API 기반 라벨/뱃지)
  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  /** plan_type → PlanConfigItem 룩업 */
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))
  /** plan_order 정렬된 플랜 목록 — 요약 스트립·필터 옵션의 정본(하드코딩 대체) */
  const orderedPlans = $derived([...planConfigs].sort((a, b) => a.plan_order - b.plan_order))
  const planFilterOptions = $derived([
    { value: 'all', title: '전체 플랜' },
    ...orderedPlans.map(p => ({ value: p.plan_type, title: p.label })),
  ])

  // ─── 사용률 헬퍼 ───
  function getUsagePct(used: number, limit: number): number {
    if (limit <= 0) return 0
    return Math.min(100, Math.round((used / limit) * 100))
  }

  function getUsagePctColor(pct: number): string {
    if (pct >= CREDIT_USAGE_THRESHOLDS.DANGER) return 'text-red-600'
    if (pct >= CREDIT_USAGE_THRESHOLDS.WARNING) return 'text-amber-600'
    return 'text-gray-700'
  }

  function getCreditBg(pct: number): string {
    if (pct >= CREDIT_USAGE_THRESHOLDS.DANGER) return 'bg-red-50/50'
    if (pct >= CREDIT_USAGE_THRESHOLDS.WARNING) return 'bg-amber-50/50'
    return ''
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<AdminSubscriptionSummary>[] = [
    { key: 'center_name', label: '센터명', width: '1.5fr', render: nameCell },
    { key: 'plan', label: '플랜', width: '0.8fr', align: 'center', render: planCell },
    { key: 'status', label: '상태', width: '0.8fr', align: 'center', render: statusCell },
    { key: 'credit', label: '크레딧', width: '1.2fr', render: creditCell },
    { key: 'usage', label: '사용률', width: '1fr', align: 'center', render: usageCell },
  ]
</script>

<!-- ── 셀 렌더러 ── -->

{#snippet nameCell({ item }: { item: AdminSubscriptionSummary; index: number; isChecked: boolean })}
  <div class="flex items-center gap-2">
    {#if item.status === 'trial'}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" title="무료 이용 중"></span>
    {:else if item.status === 'pending'}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500 animate-pulse" title="승인 대기"></span>
    {:else if item.status === 'payment_failed'}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-pulse" title="결제 실패"></span>
    {:else if item.is_quota_exceeded}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="쿼터 초과"></span>
    {/if}
    <span class="text-body-03-normal-medium text-gray-800">{item.center_name}</span>
    {#if item.status === 'pending' && item.reserved_plan}
      <span class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-label-01-normal-medium text-primary-700">
        <span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
        {planLookup.get(item.reserved_plan)?.label ?? PLAN_LABELS[item.reserved_plan] ?? item.reserved_plan} 변경 요청
      </span>
    {/if}
  </div>
{/snippet}

{#snippet planCell({ item }: { item: AdminSubscriptionSummary; index: number; isChecked: boolean })}
  <PlanBadge plan={item.plan} planConfig={planLookup.get(item.plan)} />
{/snippet}

{#snippet statusCell({ item }: { item: AdminSubscriptionSummary; index: number; isChecked: boolean })}
  <StatusBadge status={item.status} quotaExceeded={item.is_quota_exceeded} />
{/snippet}

{#snippet creditCell({ item }: { item: AdminSubscriptionSummary; index: number; isChecked: boolean })}
  {@const pct = getUsagePct(item.credit_used, item.credit_limit)}
  {#if item.credit_limit > 0}
    <span class="inline-flex items-center rounded px-1.5 py-0.5 tabular-nums {getCreditBg(pct)}">
      <span class="text-body-03-normal-medium {getUsagePctColor(pct)}">{item.credit_used.toLocaleString()}</span>
      <span class="text-body-03-normal-regular text-gray-400"> / {item.credit_limit.toLocaleString()}</span>
    </span>
  {:else}
    <span class="text-gray-400">-</span>
  {/if}
{/snippet}

{#snippet usageCell({ item }: { item: AdminSubscriptionSummary; index: number; isChecked: boolean })}
  {@const pct = getUsagePct(item.credit_used, item.credit_limit)}
  {#if item.credit_limit > 0}
    <div class="flex items-center justify-center gap-2">
      <div class="relative h-1.5 w-20 rounded-full bg-gray-100">
        <!-- 70%/90% 마커 -->
        <div class="absolute top-0 bottom-0 left-[70%] w-px bg-gray-200"></div>
        <div class="absolute top-0 bottom-0 left-[90%] w-px bg-gray-200"></div>
        <div
          class="h-1.5 rounded-full transition-all {pct >= CREDIT_USAGE_THRESHOLDS.DANGER ? 'bg-red-500' : pct >= CREDIT_USAGE_THRESHOLDS.WARNING ? 'bg-amber-400' : 'bg-blue-500'}"
          style="width: {pct}%"
        ></div>
      </div>
      <span class="tabular-nums text-body-03-normal-semibold {getUsagePctColor(pct)}">{pct}%</span>
    </div>
  {:else}
    <span class="text-gray-400">-</span>
  {/if}
{/snippet}

<!-- ── 페이지 ── -->

<div in:fade class="p-6">
  <PageHeader
    title="구독 목록"
    description="전체 센터의 구독 및 크레딧 현황 · 총 {data?.total ?? 0}개"
  />

  <!-- 요약 스트립 -->
  {#if stats}
    <div class="mb-4 flex flex-wrap items-center gap-x-1 rounded-xl border border-gray-100 bg-white px-5 py-3">
      <button
        class="rounded-md px-2 py-1 transition-colors hover:bg-gray-50 {planFilter === 'all' ? 'text-body-03-normal-semibold text-gray-800' : 'text-body-03-normal-regular text-gray-500'}"
        onclick={() => { planFilter = 'all'; currentPage = 1 }}
      >
        전체 <span class="tabular-nums text-body-03-normal-bold text-gray-800">{stats.total}</span>
      </button>
      {#each orderedPlans as p, i}
        {@const count = stats.by_plan?.[p.plan_type] ?? 0}
        {#if count > 0}
          <span class="text-gray-300">·</span>
          <button
            class="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-gray-50 {planFilter === p.plan_type ? 'text-body-03-normal-semibold text-gray-800' : 'text-body-03-normal-regular text-gray-500'}"
            onclick={() => { planFilter = p.plan_type; currentPage = 1 }}
          >
            <span class="h-2 w-2 rounded-sm" style="background: {planChartColor(p.plan_type, i)}"></span>
            {p.label} <span class="tabular-nums text-body-03-normal-bold">{count}</span>
          </button>
        {/if}
      {/each}
      {#if stats.quota_exceeded_count > 0}
        <span class="ml-auto">
          <button
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-01-normal-medium transition-colors
              {quotaOnly ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}"
            onclick={() => { quotaOnly = !quotaOnly; currentPage = 1 }}
          >
            <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            쿼터 초과 {stats.quota_exceeded_count}
          </button>
        </span>
      {/if}
    </div>
  {/if}

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <!-- 검색 -->
    <div class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4">
      <SearchIcon className="h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder="센터명 검색"
        class="w-full text-body-03-normal-regular outline-none placeholder:text-gray-400"
        value={search}
        oninput={onSearchInput}
      />
    </div>
    <!-- 플랜 필터 -->
    <Select
      class="h-11 w-28 rounded-lg bg-white"
      selected={planFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => { planFilter = e.detail.value; currentPage = 1 }}
      options={planFilterOptions}
    />
    <!-- 상태 필터 -->
    <Select
      class="h-11 w-28 rounded-lg bg-white"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => { statusFilter = e.detail.value; currentPage = 1 }}
      options={STATUS_OPTIONS}
    />
    <!-- 쿼터 초과만 토글 -->
    <button
      class="flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-label-01-normal-medium transition-colors
        {quotaOnly ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}"
      onclick={() => { quotaOnly = !quotaOnly; currentPage = 1 }}
    >
      <span class="h-1.5 w-1.5 rounded-full {quotaOnly ? 'bg-red-500' : 'bg-gray-400'}"></span>
      쿼터 초과만
    </button>
    <!-- 다운그레이드 예약 토글 — 결제 연동 전까지 숨김 -->
    <!-- 초기화 -->
    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
    >
      <RefreshIcon className="h-4 w-4 text-gray-500" />
    </button>
  </div>

  <!-- 테이블 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
    </div>
  {:else if !data || data.items.length === 0}
    <div class="section-border py-16">
      <NoDataSection description="조건에 맞는 구독이 없습니다" />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        columns={columns}
        data={data.items}
        keyField="id"
        onRowClick={(item) => goto(`/subscription/manage/${item.center_id}`)}
        hoverEnabled
      />
    </div>

    {#if data.total > PAGE_SIZE}
      <div class="mt-4">
        <Pagination
          totalItems={data.total}
          itemsPerPage={PAGE_SIZE}
          bind:currentPage={currentPage}
        />
      </div>
    {/if}
  {/if}
</div>
