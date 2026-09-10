<script lang="ts">
  import KebabMenu, { type KebabMenuItem } from '$components/KebabMenu.svelte'
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
  import { useQueryClient } from '@tanstack/svelte-query'
  import { modalStore } from '$lib/stores/modal'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import {
    getTerminatedCenterList,
    type TerminatedCenterSummary,
    type TerminatedStatusFilter
  } from '$hooks/actions/center.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { fade } from 'svelte/transition'
  import {
    STATUS_OPTIONS,
    DEFAULT_FILTERS,
    PAGE_SIZE,
    getRemainingDaysBadge
  } from '$lib/features/center-terminations/constants'
  import { createTerminationService } from '$lib/features/center-terminations/termination-service'
  import TerminationDetailModal from './components/TerminationDetailModal.svelte'
  import Checkbox from '$root/src/lib/components/Checkbox.svelte'

  // ─── 서비스 ───
  const queryClient = useQueryClient()
  const service = createTerminationService({ queryClient })
  const canManage = $derived(canOperate($auth.user?.role))

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters(DEFAULT_FILTERS)

  let search = $state(url.initial.search as string)
  let statusFilter = $state<TerminatedStatusFilter | 'all'>(
    url.initial.status as TerminatedStatusFilter | 'all'
  )
  let expiringSoon = $state(url.initial.expiring_soon as boolean)
  let currentPage = $state(url.initial.page as number)

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

  $effect(() => {
    statusFilter
    expiringSoon
    currentPage = 1
  })

  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      status: statusFilter,
      expiring_soon: expiringSoon,
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
    expiringSoon = false
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const terminatedQuery = $derived(
    queryBuilder<any, any>(getTerminatedCenterList, () => ({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: debouncedSearch || undefined,
      expiring_soon: expiringSoon || undefined,
      page: currentPage,
      size: PAGE_SIZE
    }))
  )

  const centers = $derived<TerminatedCenterSummary[]>(
    terminatedQuery.data?.items ?? []
  )
  const total = $derived<number>(terminatedQuery.data?.total ?? 0)
  const isLoading = $derived(terminatedQuery.isPending)

  const expiringSoonCount = $derived(
    centers.filter((c) => !c.is_expired && c.retention_remaining_days <= 7)
      .length
  )

  function handleRowClick(item: TerminatedCenterSummary) {
    modalStore.open({
      component: TerminationDetailModal,
      props: { center: item },
      options: { size: 'lg' }
    })
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<TerminatedCenterSummary>[] = [
    { key: 'name', label: '센터명', width: '1.5fr', render: nameCell },
    { key: 'business_registration_number', label: '사업자번호', width: '1fr' },
    {
      key: 'deleted_at',
      label: '해지일',
      width: '110px',
      render: deletedAtCell
    },
    {
      key: 'retention_expires_at',
      label: '만료일',
      width: '110px',
      render: expiresAtCell
    },
    {
      key: 'retention_remaining_days',
      label: '잔여일',
      width: '90px',
      align: 'center',
      render: remainingDaysCell
    },
    {
      key: 'export_count',
      label: '내보내기',
      width: '90px',
      align: 'center',
      render: exportCell
    },
    {
      key: 'actions',
      label: '',
      width: '50px',
      align: 'center',
      render: actionCell
    }
  ]
</script>

{#snippet nameCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  <div>
    <span class="text-body-02-medium text-gray-800">{item.name}</span>
    <p class="text-body-03-regular text-gray-400">{item.code}</p>
  </div>
{/snippet}

{#snippet deletedAtCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.deleted_at)}</span
  >
{/snippet}

{#snippet expiresAtCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.retention_expires_at)}</span
  >
{/snippet}

{#snippet remainingDaysCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  {@const badge = getRemainingDaysBadge(
    item.retention_remaining_days,
    item.is_expired
  )}
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium {badge.bg} {badge.text}"
  >
    {badge.label}
  </span>
{/snippet}

{#snippet exportCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  {#if item.has_pending_export}
    <span
      class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
    >
      {item.export_count}건 대기
    </span>
  {:else if item.export_count > 0}
    <span class="text-body-02-regular text-gray-400">완료</span>
  {:else}
    <span class="text-body-02-regular text-gray-300">-</span>
  {/if}
{/snippet}

{#snippet actionCell({
  item
}: {
  item: TerminatedCenterSummary
  index: number
  isChecked: boolean
})}
  {@const menuItems: KebabMenuItem[] = [
    ...(!item.is_expired
      ? [{ label: '데이터 내보내기', onClick: () => service.requestExport() }]
      : []),
    ...(!item.is_expired && canManage
      ? [{ label: '해지 철회', onClick: () => service.restore(item.id, item.name) }]
      : []),
    ...(item.is_expired && canManage
      ? [{ label: '데이터 삭제', onClick: () => service.purge(), variant: 'danger' as const }]
      : [])
  ]}
  <KebabMenu items={menuItems} />
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="해지 센터 관리"
    description="해지된 센터의 데이터 보관 및 삭제를 관리합니다 · 총 {total}개"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="센터명 / 사업자번호 검색"
        bind:value={search}
        class="w-full text-sm outline-none placeholder:text-gray-400"
      />
    </div>

    <Select
      class="h-11 w-36 rounded-lg bg-white"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
    />

    <label
      class="flex h-11 cursor-pointer select-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600"
    >
      <Checkbox id="expiry" bind:checked={expiringSoon} />
      만료 임박
    </label>

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  <!-- 만료 임박 알림 배너 -->
  {#if expiringSoonCount > 0 && !expiringSoon}
    <div
      class="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <span class="text-sm font-medium text-amber-800">
        보관 만료 임박 센터 {expiringSoonCount}건이 있습니다 (7일 이내)
      </span>
      <button
        class="ml-auto text-xs font-medium text-amber-700 underline hover:text-amber-900"
        onclick={() => (expiringSoon = true)}
      >
        임박 건만 보기
      </button>
    </div>
  {/if}

  <!-- 테이블 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if centers.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '해지된 센터가 없습니다'}
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
      <Pagination
        totalItems={total}
        itemsPerPage={PAGE_SIZE}
        bind:currentPage
      />
    </div>
  {/if}
</div>
