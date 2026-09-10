<script lang="ts">
  import { fade } from 'svelte/transition'
  import * as XLSX from 'xlsx'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import DownloadIcon20 from '$lib/assets/DownloadIcon20.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Select from '$lib/components/Select.svelte'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getActivityLogs } from '$lib/hooks/actions/activity-log.action'
  import type { ActivityLogListResponse } from '$lib/hooks/actions/activity-log.action'
  import { centerId } from '$lib/stores/center.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import ActivityLogDetailModal from '$lib/components/modal/ActivityLogDetailModal.svelte'
  import {
    ACTIVITY_LOG_PAGE_SIZE,
    CATEGORY_OPTIONS,
    ACTION_OPTIONS,
    DATE_RANGE_OPTIONS
  } from '$lib/features/activity-log/constants'
  import {
    mapToActivityLogVMs,
    type ActivityLogVM
  } from '$lib/features/activity-log/view-model'

  let currentPage = $state(1)
  let selectedCategory = $state('')
  let selectedAction = $state('')
  let selectedDateRange = $state('')
  let searchQuery = $state('')

  // 검색 디바운스
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let debouncedSearch = $state('')

  $effect(() => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      debouncedSearch = searchQuery
      currentPage = 1
    }, 300)
    return () => clearTimeout(searchTimer)
  })

  // 날짜 범위 계산
  const dateFrom = $derived.by(() => {
    if (!selectedDateRange) return undefined
    const days = parseInt(selectedDateRange)
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString()
  })

  const query = $derived(
    queryBuilder(
      getActivityLogs,
      () => ({
        centerId: $centerId,
        category: selectedCategory || undefined,
        action: selectedAction || undefined,
        date_from: dateFrom,
        page: currentPage,
        size: ACTIVITY_LOG_PAGE_SIZE
      }),
      () => ({
        enabled: !!$centerId
      })
    )
  )

  const data = $derived(
    query.data as ActivityLogListResponse | null | undefined
  )

  // 클라이언트 검색 필터
  const allItems = $derived<ActivityLogVM[]>(
    data?.items ? mapToActivityLogVMs(data.items) : []
  )
  const items = $derived.by(() => {
    if (!debouncedSearch) return allItems
    const q = debouncedSearch.toLowerCase()
    return allItems.filter(
      (item) =>
        item.summary.toLowerCase().includes(q) ||
        item.actorName.toLowerCase().includes(q) ||
        item.categoryLabel.includes(q) ||
        item.actionLabel.includes(q)
    )
  })
  const serverTotal = $derived(data?.total ?? 0)
  const totalItems = $derived(debouncedSearch ? items.length : serverTotal)
  const isLoading = $derived(query.isLoading)
  const isFetching = $derived(query.isFetching)

  const hasActiveFilter = $derived(
    !!selectedCategory ||
      !!selectedAction ||
      !!selectedDateRange ||
      !!searchQuery
  )
  const isResetDisabled = $derived(!hasActiveFilter)

  function resetFilters() {
    selectedCategory = ''
    selectedAction = ''
    selectedDateRange = ''
    searchQuery = ''
    debouncedSearch = ''
    currentPage = 1
  }

  function exportToExcel() {
    if (items.length === 0) {
      snackbarStore.error('내보낼 데이터가 없어요.')
      return
    }

    const rows = items.map((item) => ({
      일시: `${item.date} ${item.time}`,
      행위자: item.actorName,
      카테고리: item.categoryLabel,
      액션: item.actionLabel,
      내용: item.summary
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 40 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '활동 로그')

    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    XLSX.writeFile(wb, `활동로그_${dateStr}.xlsx`)
  }

  function openDetailModal(item: ActivityLogVM) {
    modalStore.open({
      component: ActivityLogDetailModal,
      props: { item },
      options: { customWidth: 540 }
    })
  }

  const columns: TableColumn<ActivityLogVM>[] = [
    { key: 'time', label: '일시', width: '0.8fr', render: timeCell },
    { key: 'actorName', label: '행위자', width: '0.7fr' },
    { key: 'categoryLabel', label: '카테고리', width: '0.6fr' },
    { key: 'actionLabel', label: '액션', width: '0.5fr', render: actionCell },
    { key: 'summary', label: '내용', width: '2fr' }
  ]
</script>

{#snippet timeCell({ item }: { item: ActivityLogVM })}
  <div class="tabular-nums">
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-800"
      tag="span"
    >
      {item.date}
    </Typography>
    <Typography variant="body-03-regular" color="text-gray-400" tag="p">
      {item.time}
    </Typography>
  </div>
{/snippet}

{#snippet actionCell({ item }: { item: ActivityLogVM })}
  <span
    class="inline-flex rounded-full px-2 py-0.5 text-body-03-normal-medium {item
      .actionColor.bg} {item.actionColor.text}"
  >
    {item.actionLabel}
  </span>
{/snippet}

<div in:fade class="bg-gray-50 flex h-full flex-col xl:overflow-hidden">
  <!-- 타이틀 아래가 필터 바(여백 가진 행) → 간격 8 -->
  <PageTitleSection title="활동 로그" className="mb-2" />

  <div class="flex-1 min-h-0 flex flex-col gap-2">
    <!-- 필터 바 -->
    <div class="filter-bar flex flex-wrap items-center gap-3">
      <div
        class="flex h-11 w-90 bg-white items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-border-active duration-200"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="검색어를 입력해주세요"
          class="w-60 bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
        />
      </div>
      <Select
        class="rounded-lg bg-white"
        options={CATEGORY_OPTIONS}
        selected={CATEGORY_OPTIONS.find((o) => o.value === selectedCategory) ??
          CATEGORY_OPTIONS[0]}
        showActiveHighlight={true}
        defaultValue=""
        on:change={(e) => {
          selectedCategory = typeof e.detail === 'object' ? e.detail.value : ''
          currentPage = 1
        }}
      />
      <Select
        class="rounded-lg bg-white"
        options={ACTION_OPTIONS}
        selected={ACTION_OPTIONS.find((o) => o.value === selectedAction) ??
          ACTION_OPTIONS[0]}
        showActiveHighlight={true}
        defaultValue=""
        on:change={(e) => {
          selectedAction = typeof e.detail === 'object' ? e.detail.value : ''
          currentPage = 1
        }}
      />
      <Select
        class="rounded-lg bg-white"
        options={DATE_RANGE_OPTIONS}
        selected={DATE_RANGE_OPTIONS.find(
          (o) => o.value === selectedDateRange
        ) ?? DATE_RANGE_OPTIONS[0]}
        showActiveHighlight={true}
        defaultValue=""
        on:change={(e) => {
          selectedDateRange = typeof e.detail === 'object' ? e.detail.value : ''
          currentPage = 1
        }}
      />
      <FilterResetButton onclick={resetFilters} disabled={isResetDisabled} />
    </div>

    <!-- 총 건수 + 내보내기 -->
    <div class="flex h-11 items-center justify-between">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {totalItems.toLocaleString()}건
      </Typography>
      <Tooltip text="Excel 내보내기">
        <button
          class="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-medium text-gray-600 hover:bg-gray-50 disabled:text-gray-300 disabled:border-gray-100"
          onclick={exportToExcel}
          disabled={items.length === 0}
          aria-label="Excel 내보내기"
        >
          <DownloadIcon20 />
          내보내기
        </button>
      </Tooltip>
    </div>

    <!-- 테이블 -->
    {#if (isLoading || isFetching) && items.length === 0}
      <div
        class="flex-1 flex items-center justify-center rounded-2xl border border-gray-200 bg-white"
      >
        <Typography variant="body-01-normal-regular" color="text-gray-500"
          >로딩 중...</Typography
        >
      </div>
    {:else if items.length === 0}
      <NoDataSection
        description={hasActiveFilter
          ? '검색 조건에 맞는 활동 로그가 없어요'
          : '등록된 활동 로그가 없어요'}
      />
    {:else}
      <div
        class="rounded-2xl border border-gray-200 bg-white flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <Table
          {columns}
          data={items}
          keyField="id"
          headerClass="bg-white border-b border-gray-200"
          bodyClass="flex-1 min-h-0 overflow-auto"
          hoverEnabled={true}
          onRowClick={openDetailModal}
        />
      </div>

      {#if !debouncedSearch}
        <Pagination
          totalItems={serverTotal}
          itemsPerPage={ACTIVITY_LOG_PAGE_SIZE}
          bind:currentPage
        />
      {/if}
    {/if}
  </div>
</div>
