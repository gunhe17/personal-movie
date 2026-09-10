<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import Button from '$components/Button.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getVoucherList,
    type AdminVoucherSummary
  } from '$hooks/actions/voucher.action'
  import { buildYearOptions } from '$lib/features/voucher/constants'
  import { useUrlFilters } from '$utils/url-filters.svelte'
  import { formatDate } from '$utils/format'
  import { fade } from 'svelte/transition'

  const YEAR_OPTIONS = buildYearOptions()

  const url = useUrlFilters({ search: '', year: 'all', page: 1 })

  let search = $state(url.initial.search as string)
  let yearFilter = $state(url.initial.year as string)
  let currentPage = $state(url.initial.page as number)
  const pageSize = 20

  let debouncedSearch = $state(url.initial.search as string)
  let timer: ReturnType<typeof setTimeout>
  $effect(() => {
    clearTimeout(timer)
    const q = search
    timer = setTimeout(() => {
      debouncedSearch = q
      currentPage = 1
    }, 300)
  })

  $effect(() => {
    yearFilter
    currentPage = 1
  })

  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      year: yearFilter,
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
    yearFilter = 'all'
    currentPage = 1
    url.reset()
  }

  const listQuery = $derived(
    queryBuilder<any, any>(getVoucherList, () => ({
      q: debouncedSearch || undefined,
      year: yearFilter !== 'all' ? Number(yearFilter) : undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const items = $derived<AdminVoucherSummary[]>(listQuery.data?.items ?? [])
  const total = $derived<number>(listQuery.data?.total ?? 0)
  const isLoading = $derived(listQuery.isPending)

  function handleRowClick(item: AdminVoucherSummary) {
    goto(`/vouchers/${item.id}`)
  }

  const columns: TableColumn<AdminVoucherSummary>[] = [
    { key: 'name', label: '사업명', width: '1.4fr', cellClass: 'min-w-0 truncate' },
    {
      key: 'program_organization',
      label: '기관',
      width: '0.9fr',
      cellClass: 'min-w-0 truncate'
    },
    { key: 'program_year', label: '연도', width: '80px', align: 'center' },
    { key: 'usage_period', label: '이용 기간', width: '180px', align: 'center', render: usageCell },
    { key: 'status', label: '상태', width: '90px', align: 'center', render: statusCell },
    { key: 'created_at', label: '작성일', width: '140px', align: 'center', render: createdCell }
  ]
</script>

{#snippet usageCell({ item }: { item: AdminVoucherSummary; index: number; isChecked: boolean })}
  <span class="text-body-02-regular text-gray-500">
    {item.usage_start_date ?? '-'} ~ {item.usage_end_date ?? '-'}
  </span>
{/snippet}

{#snippet statusCell({ item }: { item: AdminVoucherSummary; index: number; isChecked: boolean })}
  {#if item.deleted_at}
    <span
      class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"
    >
      삭제됨
    </span>
  {:else}
    <span
      class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
      활성
    </span>
  {/if}
{/snippet}

{#snippet createdCell({ item }: { item: AdminVoucherSummary; index: number; isChecked: boolean })}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD')}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="바우처 사업 카탈로그"
    description="플랫폼 공용 바우처 사업을 관리합니다 · 총 {total}개"
  >
    {#snippet actions()}
      <Button
        size="md"
        color="primary"
        content="새 바우처 등록"
        onclick={() => goto('/vouchers/new')}
      />
    {/snippet}
  </PageHeader>

  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="사업명·이름·대상 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-32 rounded-lg bg-white"
      selected={yearFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (yearFilter = e.detail.value)}
      options={YEAR_OPTIONS}
    />

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if items.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch ? '검색 결과가 없습니다' : '등록된 바우처가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={items} onRowClick={handleRowClick} hoverEnabled />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
