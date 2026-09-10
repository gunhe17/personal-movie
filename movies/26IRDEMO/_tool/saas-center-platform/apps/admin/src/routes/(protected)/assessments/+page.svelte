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
  import Button from '$components/Button.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getAssessmentList,
    type AssessmentSummary,
    type AssessmentStatus
  } from '$hooks/actions/assessment.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { fade } from 'svelte/transition'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'

  // ─── 필터 옵션 ───
  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'public', title: '공개' },
    { value: 'private', title: '비공개' },
    { value: 'draft', title: '초안' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({ search: '', status: 'all', page: 1 })

  let search = $state(url.initial.search as string)
  let statusFilter = $state<AssessmentStatus | 'all'>(
    url.initial.status as AssessmentStatus | 'all'
  )
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
    statusFilter = 'all'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const assessmentsQuery = $derived(
    queryBuilder<any, any>(getAssessmentList, () => ({
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const assessments = $derived<AssessmentSummary[]>(
    assessmentsQuery.data?.items ?? []
  )
  const total = $derived<number>(assessmentsQuery.data?.total ?? 0)
  const isLoading = $derived(assessmentsQuery.isPending)

  // ─── 핸들러 ───
  function handleRowClick(item: any) {
    goto(`/assessments/${item.id}`)
  }

  const statusConfig: Record<
    AssessmentStatus,
    { label: string; bg: string; text: string }
  > = {
    public: { label: '공개', bg: 'bg-green-50', text: 'text-green-700' },
    private: { label: '비공개', bg: 'bg-gray-100', text: 'text-gray-600' },
    draft: { label: '초안', bg: 'bg-yellow-50', text: 'text-yellow-700' }
  }

  const TYPE_LABELS: Record<string, string> = {
    objective: '객관 검사',
    projective: '투사 검사',
    intelligence: '지능 검사',
    developmental: '발달 검사'
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<AssessmentSummary>[] = [
    { key: 'kor_name', label: '검사명', width: '1fr', render: nameCell },
    { key: 'code', label: '코드', width: '1fr', render: codeCell },
    { key: 'type', label: '유형', width: '100px', render: typeCell },
    {
      key: 'duration',
      label: '소요시간',
      width: '90px',
      align: 'center',
      render: durationCell
    },
    { key: 'age', label: '대상연령', width: '100px' },
    {
      key: 'status',
      label: '상태',
      align: 'center',
      width: '100px',
      render: statusCell
    }
  ]
</script>

{#snippet nameCell({
  item
}: {
  item: AssessmentSummary
  index: number
  isChecked: boolean
})}
  <div>
    <span class="text-body-02-medium text-gray-800">{item.kor_name}</span>
    {#if item.eng_name}
      <p class="text-body-03-regular text-gray-400">{item.eng_name}</p>
    {/if}
  </div>
{/snippet}

{#snippet codeCell({
  item
}: {
  item: AssessmentSummary
  index: number
  isChecked: boolean
})}
  <span
    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
  >
    {item.code}
  </span>
{/snippet}

{#snippet typeCell({
  item
}: {
  item: AssessmentSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-600"
    >{TYPE_LABELS[item.type] ?? item.type}</span
  >
{/snippet}

{#snippet durationCell({
  item
}: {
  item: AssessmentSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-600"
    >{item.duration ? `${item.duration}분` : '-'}</span
  >
{/snippet}

{#snippet statusCell({
  item
}: {
  item: AssessmentSummary
  index: number
  isChecked: boolean
})}
  {@const status = statusConfig[item.status]}
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {status.bg} {status.text}"
  >
    {status.label}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="검사 관리"
    description="검사 도구를 등록하고 관리합니다 · 총 {total}개"
  >
    {#snippet actions()}
      {#if canOperate($auth.user?.role)}
        <Button
          size="md"
          color="primary"
          content="검사 등록"
          onclick={() => goto('/assessments/new')}
        />
      {/if}
    {/snippet}
  </PageHeader>

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="검사명 / 코드 검색"
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
  {:else if assessments.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 검사가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={assessments}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
