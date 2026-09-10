<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import DatePickerInput from '$components/DatePickerInput.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import { getAuditLogList, type AuditLogSummary } from '$hooks/actions/audit-log.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import { fade } from 'svelte/transition'
  import { getActionLabel, getActionColor } from '$lib/features/audit-logs/constants'

  // ─── 필터 옵션 ───
  const TARGET_TYPE_OPTIONS = [
    { value: 'all', title: '전체 대상' },
    { value: 'center_application', title: '센터 신청' },
    { value: 'center', title: '센터' },
    { value: 'admin_account', title: '어드민 계정' },
    { value: 'admin_account_invitation', title: '어드민 초대' },
    { value: 'notice', title: '공지사항' },
    { value: 'inquiry', title: '문의' },
    { value: 'faq', title: 'FAQ' },
    { value: 'cs_memo', title: 'CS 메모' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    target_type: 'all',
    date_from: '',
    date_to: '',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let targetTypeFilter = $state(url.initial.target_type as string)
  let dateFrom = $state(url.initial.date_from as string)
  let dateTo = $state(url.initial.date_to as string)
  let currentPage = $state(url.initial.page as number)
  const pageSize = 20

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
    targetTypeFilter
    dateFrom
    dateTo
    currentPage = 1
  })

  // URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      target_type: targetTypeFilter,
      date_from: dateFrom,
      date_to: dateTo,
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
    targetTypeFilter = 'all'
    dateFrom = ''
    dateTo = ''
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const logsQuery = $derived(
    queryBuilder<any, any>(getAuditLogList, () => ({
      search: debouncedSearch || undefined,
      target_type: targetTypeFilter !== 'all' ? targetTypeFilter : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const logs = $derived<AuditLogSummary[]>(logsQuery.data?.items ?? [])
  const total = $derived<number>(logsQuery.data?.total ?? 0)
  const isLoading = $derived(logsQuery.isPending)

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<AuditLogSummary>[] = [
    {
      key: 'created_at',
      label: '일시',
      width: '160px',
      align: 'center' as const,
      render: dateCell
    },
    {
      key: 'admin_email',
      label: '어드민',
      width: '1fr',
      cellClass: 'min-w-0 truncate'
    },
    {
      key: 'action',
      label: '액션',
      width: '220px',
      render: actionCell
    },
    {
      key: 'summary',
      label: '내용',
      width: '2fr',
      cellClass: 'min-w-0 truncate'
    },
    {
      key: 'ip_address',
      label: 'IP',
      width: '140px',
      align: 'center' as const,
      render: ipCell
    }
  ]
</script>

{#snippet dateCell({
  item
}: {
  item: AuditLogSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}
  </span>
{/snippet}

{#snippet actionCell({
  item
}: {
  item: AuditLogSummary
  index: number
  isChecked: boolean
})}
  {@const color = getActionColor(item.action)}
  <span
    class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {color.bg} {color.text}"
    title={item.action}
  >
    {getActionLabel(item.action)}
  </span>
{/snippet}

{#snippet ipCell({
  item
}: {
  item: AuditLogSummary
  index: number
  isChecked: boolean
})}
  <span class="text-xs font-mono text-gray-400">
    {item.ip_address || '-'}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="감사 로그"
    description="어드민 계정의 변경 행위 기록을 조회합니다 · 총 {total}개"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="내용 또는 어드민 이메일 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-40 bg-white rounded-lg"
      selected={targetTypeFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (targetTypeFilter = e.detail.value)}
      options={TARGET_TYPE_OPTIONS}
    />

    <div class="flex items-center gap-1.5">
      <DatePickerInput bind:value={dateFrom} placeholder="시작일" showActiveHighlight class="w-36" />
      <span class="text-xs text-gray-400">~</span>
      <DatePickerInput bind:value={dateTo} placeholder="종료일" showActiveHighlight class="w-36" />
    </div>

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
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if logs.length === 0}
    <div class="section-border py-16">
      <NoDataSection description="감사 로그가 없습니다" />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={logs} />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
