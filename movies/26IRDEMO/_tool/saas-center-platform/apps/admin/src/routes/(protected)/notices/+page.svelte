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
  import Checkbox from '$components/Checkbox.svelte'
  import Button from '$components/Button.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getNoticeList,
    type NoticeSummary,
    type NoticeCategory
  } from '$hooks/actions/notice.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import { fade } from 'svelte/transition'

  // ─── 필터 옵션 ───
  const CATEGORY_OPTIONS = [
    { value: 'all', title: '전체 유형' },
    { value: 'maintenance', title: '점검 안내' },
    { value: 'update', title: '업데이트' },
    { value: 'announcement', title: '일반 공지' }
  ]

  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'published', title: '게시됨' },
    { value: 'draft', title: '초안' }
  ]

  const SORT_OPTIONS = [
    { value: 'desc', title: '최신순' },
    { value: 'asc', title: '오래된순' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    category: 'all',
    status: 'all',
    sort: 'desc',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let categoryFilter = $state(url.initial.category as string)
  let statusFilter = $state(url.initial.status as string)
  let sortOrder = $state(url.initial.sort as string)
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
    categoryFilter
    statusFilter
    sortOrder
    currentPage = 1
  })

  // URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      category: categoryFilter,
      status: statusFilter,
      sort: sortOrder,
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
    categoryFilter = 'all'
    statusFilter = 'all'
    sortOrder = 'desc'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const noticesQuery = $derived(
    queryBuilder<any, any>(getNoticeList, () => ({
      search: debouncedSearch || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      is_published:
        statusFilter === 'published'
          ? true
          : statusFilter === 'draft'
            ? false
            : undefined,
      sort_order: sortOrder as 'asc' | 'desc',
      page: currentPage,
      size: pageSize
    }))
  )

  const notices = $derived(noticesQuery.data?.items ?? [])
  const total = $derived<number>(noticesQuery.data?.total ?? 0)
  const isLoading = $derived(noticesQuery.isPending)

  // ─── 핸들러 ───
  function handleRowClick(item: any) {
    goto(`/notices/${item.id}`)
  }

  // ─── 유틸 ───
  const CATEGORY_CONFIG: Record<
    NoticeCategory,
    { label: string; bg: string; text: string }
  > = {
    maintenance: { label: '점검', bg: 'bg-orange-50', text: 'text-orange-700' },
    update: { label: '업데이트', bg: 'bg-blue-50', text: 'text-blue-700' },
    announcement: { label: '일반', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<NoticeSummary>[] = [
    {
      key: 'is_pinned',
      label: '고정',
      width: '56px',
      align: 'center',
      render: pinnedCell
    },
    {
      key: 'title',
      label: '제목',
      width: '1fr',
      cellClass: 'min-w-0 truncate'
    },
    {
      key: 'category',
      label: '유형',
      width: '0.5fr',
      align: 'center',
      render: categoryCell
    },
    {
      key: 'is_published',
      label: '상태',
      width: '0.5fr',
      align: 'center',
      render: statusCell
    },
    {
      key: 'read_count',
      label: '조회',
      width: '80px',
      align: 'center',
      render: readCountCell
    },
    {
      key: 'created_at',
      label: '작성일',
      width: '0.5fr',
      align: 'center',
      render: dateCell
    }
  ]
</script>

{#snippet pinnedCell({
  item
}: {
  item: NoticeSummary
  index: number
  isChecked: boolean
})}
  <div class="flex justify-center">
    <Checkbox id="pinned-{item.id}" checked={item.is_pinned} disabled />
  </div>
{/snippet}

{#snippet categoryCell({
  item
}: {
  item: NoticeSummary
  index: number
  isChecked: boolean
})}
  {@const config = CATEGORY_CONFIG[item.category]}
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {config.bg} {config.text}"
  >
    {config.label}
  </span>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: NoticeSummary
  index: number
  isChecked: boolean
})}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    class:bg-green-50={item.is_published}
    class:text-green-700={item.is_published}
    class:bg-gray-100={!item.is_published}
    class:text-gray-500={!item.is_published}
  >
    <span
      class="h-1.5 w-1.5 rounded-full"
      class:bg-green-500={item.is_published}
      class:bg-gray-400={!item.is_published}
    ></span>
    {item.is_published ? '게시됨' : '초안'}
  </span>
{/snippet}

{#snippet readCountCell({
  item
}: {
  item: NoticeSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500">
    {item.read_count} / {item.target_read_count}
  </span>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: NoticeSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}</span
  >
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="공지사항 관리"
    description="시스템 공지사항을 작성하고 관리합니다 · 총 {total}개"
  >
    {#snippet actions()}
      <Button
        size="md"
        color="primary"
        content="새 공지 작성"
        onclick={() => goto('/notices/new')}
      />
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
        placeholder="제목 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={categoryFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (categoryFilter = e.detail.value)}
      options={CATEGORY_OPTIONS}
    />

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
    />

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={sortOrder}
      showActiveHighlight={true}
      defaultValue="desc"
      on:change={(e) => (sortOrder = e.detail.value)}
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
  {:else if notices.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 공지사항이 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={notices}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
