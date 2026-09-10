<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import { formatDate } from '$lib/utils/format'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getCenterList,
    type CenterSummary,
    type CenterStatusFilter,
    type CenterSortBy
  } from '$hooks/actions/center.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { fade } from 'svelte/transition'
  import PlanBadge from '$lib/features/subscription/components/PlanBadge.svelte'
  import {
    getPlanConfigs,
    type PlanConfigItem,
  } from '$hooks/actions/platform-settings.action'

  // ─── 필터 옵션 ───
  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'active', title: '활성' },
    { value: 'suspended', title: '정지' }
  ]

  const SORT_OPTIONS = [
    { value: 'created_at', title: '가입일순' },
    { value: 'name', title: '이름순' },
    { value: 'member_count', title: '멤버 수순' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    status: 'all',
    sort_by: 'created_at',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let statusFilter = $state<CenterStatusFilter>(
    url.initial.status as CenterStatusFilter
  )
  let sortBy = $state<CenterSortBy>(url.initial.sort_by as CenterSortBy)
  let currentPage = $state(url.initial.page as number)
  const pageSize = 10

  // ─── 검색 디바운스 ───
  let debouncedSearch = $state(url.initial.search as string)
  let searchTimeout: ReturnType<typeof setTimeout>

  $effect(() => {
    clearTimeout(searchTimeout)
    const q = search
    searchTimeout = setTimeout(() => {
      debouncedSearch = q
      currentPage = 1
    }, 300)
  })

  // 필터 변경 시 페이지 리셋
  $effect(() => {
    statusFilter
    sortBy
    currentPage = 1
  })

  // 모든 필터 변경 → URL 동기화 (단일 effect)
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      status: statusFilter,
      sort_by: sortBy,
      page: currentPage
    }
    if (!initialized) {
      initialized = true
      return
    }
    url.sync(snapshot)
  })

  function resetFilters() {
    search = ''
    debouncedSearch = ''
    statusFilter = 'all'
    sortBy = 'created_at'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const centersQuery = $derived(
    queryBuilder<any, any>(getCenterList, () => ({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: debouncedSearch || undefined,
      sort_by: sortBy,
      page: currentPage,
      size: pageSize
    }))
  )

  const centers = $derived<CenterSummary[]>(centersQuery.data?.items ?? [])
  const total = $derived<number>(centersQuery.data?.total ?? 0)
  const isLoading = $derived(centersQuery.isPending)

  function handleRowClick(item: any) {
    goto(`/center/manage/${item.id}`)
  }

  // 플랜 설정 (API 기반)
  const planConfigsQuery = $derived(
    queryBuilder<any, any>(getPlanConfigs, () => ({}), () => ({ staleTime: 60_000 }))
  )
  const planConfigs = $derived<PlanConfigItem[]>(planConfigsQuery.data?.items ?? [])
  const planLookup = $derived(new Map(planConfigs.map(p => [p.plan_type, p])))

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<CenterSummary>[] = [
    { key: 'name', label: '센터명', width: '1.5fr', render: nameCell },
    { key: 'representative_name', label: '대표자', width: '1fr' },
    { key: 'phone', label: '연락처', width: '1fr' },
    {
      key: 'plan',
      label: '플랜',
      width: '100px',
      align: 'center',
      render: planCell
    },
    {
      key: 'member_count',
      label: '멤버',
      width: '80px',
      align: 'center',
      render: memberCountCell
    },
    {
      key: 'is_active',
      label: '상태',
      width: '100px',
      align: 'center',
      render: statusCell
    },
    { key: 'created_at', label: '가입일', width: '120px', render: dateCell }
  ]
</script>

{#snippet nameCell({
  item
}: {
  item: CenterSummary
  index: number
  isChecked: boolean
})}
  <div>
    <span class="text-body-02-medium text-gray-800">{item.name}</span>
    <p class="text-body-03-regular text-gray-400">{item.code}</p>
  </div>
{/snippet}

{#snippet planCell({
  item
}: {
  item: CenterSummary
  index: number
  isChecked: boolean
})}
  <PlanBadge plan={item.plan} planConfig={planLookup.get(item.plan)} />
{/snippet}

{#snippet memberCountCell({
  item
}: {
  item: CenterSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-600">{item.member_count}명</span>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: CenterSummary
  index: number
  isChecked: boolean
})}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    class:bg-green-50={item.is_active}
    class:text-green-700={item.is_active}
    class:bg-red-50={!item.is_active}
    class:text-red-600={!item.is_active}
  >
    <span
      class="h-1.5 w-1.5 rounded-full"
      class:bg-green-500={item.is_active}
      class:bg-red-500={!item.is_active}
    ></span>
    {item.is_active ? '활성' : '정지'}
  </span>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: CenterSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.created_at)}</span
  >
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="센터 관리"
    description="등록된 상담센터를 관리합니다 · 총 {total}개"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="센터명 / 사업자번호 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
    />

    <Select
      class="h-11 w-32 bg-white rounded-lg"
      selected={sortBy}
      showActiveHighlight={true}
      defaultValue="created_at"
      on:change={(e) => (sortBy = e.detail.value)}
      options={SORT_OPTIONS}
    />

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  <!-- 테이블 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400"
        >불러오는 중...</Typography
      >
    </div>
  {:else if centers.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 센터가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={centers}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
