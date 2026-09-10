<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import ApplicationDetailModal from '$lib/components/modal/ApplicationDetailModal.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { formatDate } from '$lib/utils/format'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getApplicationList,
    type ApplicationSummary,
    type ApplicationStatus
  } from '$hooks/actions/application.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { fade } from 'svelte/transition'

  // ─── 필터 옵션 ───
  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'pending', title: '대기' },
    { value: 'approved', title: '승인' },
    { value: 'rejected', title: '거절' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  // 기본값: status='pending' (신청 관리 페이지는 대기 상태가 기본)
  const url = useUrlFilters({ search: '', status: 'pending', page: 1 })

  let search = $state(url.initial.search as string)
  let statusFilter = $state<ApplicationStatus | 'all'>(
    url.initial.status as ApplicationStatus | 'all'
  )
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
    currentPage = 1
  })

  // 모든 필터 변경 → URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      status: statusFilter,
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
    statusFilter = 'pending'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const applicationsQuery = $derived(
    queryBuilder<any, any>(getApplicationList, () => ({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: debouncedSearch || undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const applications = $derived<ApplicationSummary[]>(
    applicationsQuery.data?.items ?? []
  )
  const total = $derived<number>(applicationsQuery.data?.total ?? 0)
  const isLoading = $derived(applicationsQuery.isPending)

  // ─── 모달 ───
  function handleRowClick(item: ApplicationSummary) {
    modalStore.open({
      component: ApplicationDetailModal,
      props: { applicationId: item.id },
      options: { size: 'lg' }
    })
  }

  const statusConfig: Record<
    ApplicationStatus,
    { label: string; bg: string; text: string; dot: string }
  > = {
    pending: {
      label: '대기',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      dot: 'bg-yellow-500'
    },
    approved: {
      label: '승인',
      bg: 'bg-green-50',
      text: 'text-green-700',
      dot: 'bg-green-500'
    },
    rejected: {
      label: '거절',
      bg: 'bg-red-50',
      text: 'text-red-600',
      dot: 'bg-red-500'
    }
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<ApplicationSummary>[] = [
    { key: 'center_name', label: '센터명', width: '1fr' },
    {
      key: 'applicant_name',
      label: '신청자',
      width: '1fr',
      render: applicantCell
    },
    { key: 'business_registration_number', label: '사업자번호', width: '1fr' },
    { key: 'status', label: '상태', width: '100px', render: statusCell },
    { key: 'created_at', label: '신청일', width: '120px', render: dateCell }
  ]
</script>

{#snippet applicantCell({
  item
}: {
  item: ApplicationSummary
  index: number
  isChecked: boolean
})}
  <div>
    <span class="text-body-02-regular text-gray-800">{item.applicant_name}</span
    >
    <p class="text-body-03-regular text-gray-400">{item.applicant_email}</p>
  </div>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: ApplicationSummary
  index: number
  isChecked: boolean
})}
  {@const status = statusConfig[item.status]}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {status.bg} {status.text}"
  >
    <span class="h-1.5 w-1.5 rounded-full {status.dot}"></span>
    {status.label}
  </span>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: ApplicationSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.created_at)}</span
  >
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="센터 신청 관리"
    description="센터 등록 신청을 검토하고 승인/거절합니다 · 총 {total}건"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="신청자 / 센터명 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="pending"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
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
  {:else if applications.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '신청 내역이 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={applications}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
