<script lang="ts">
  import { canAdminister } from '$lib/utils/permissions'
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
    getCSMemoList,
    getCSMemoDetail,
    postCreateCSMemo,
    patchCSMemo,
    deleteCSMemo,
    bulkDeleteCSMemos,
    type CSMemoSummary,
    type MemoType,
    type CSMemoDetailResponse
  } from '$hooks/actions/cs-memo.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { auth } from '$lib/stores/auth'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { fade, slide } from 'svelte/transition'
  import MemoFormModal from './components/MemoFormModal.svelte'
  import MemoDetailModal from './components/MemoDetailModal.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'

  const queryClient = useQueryClient()

  // ─── 권한 ───
  const isSuperAdmin = $derived(canAdminister($auth.user?.role))

  // ─── 필터 옵션 ───
  const MEMO_TYPE_OPTIONS = [
    { value: 'all', title: '전체 유형' },
    { value: 'inquiry', title: '문의' },
    { value: 'complaint', title: '불만' },
    { value: 'request', title: '요청' },
    { value: 'other', title: '기타' }
  ]

  const SORT_OPTIONS = [
    { value: 'desc', title: '최신순' },
    { value: 'asc', title: '오래된순' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    type: 'all',
    sort: 'desc',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let typeFilter = $state(url.initial.type as string)
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
    typeFilter
    sortOrder
    currentPage = 1
  })

  // URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      type: typeFilter,
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
    typeFilter = 'all'
    sortOrder = 'desc'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const memosQuery = $derived(
    queryBuilder<any, any>(getCSMemoList, () => ({
      search: debouncedSearch || undefined,
      memo_type: typeFilter !== 'all' ? typeFilter : undefined,
      sort_order: sortOrder as 'asc' | 'desc',
      page: currentPage,
      size: pageSize
    }))
  )

  const memos = $derived<CSMemoSummary[]>(memosQuery.data?.items ?? [])
  const total = $derived<number>(memosQuery.data?.total ?? 0)
  const isLoading = $derived(memosQuery.isPending)

  // ─── invalidate ───
  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: ['getCSMemoList'], exact: false })
  }

  // ─── 새 메모 작성 ───
  function openCreateModal() {
    modalStore.open({
      component: MemoFormModal,
      props: {
        onSubmit: async (data: any) => {
          await postCreateCSMemo().request(data)
          snackbarStore.success('메모가 저장되었습니다.')
          invalidateList()
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 행 클릭 → 상세 모달 ───
  async function handleRowClick(item: CSMemoSummary) {
    try {
      const memo = await getCSMemoDetail().request({ memoId: item.id })
      openDetailModal(memo)
    } catch {
      snackbarStore.error('메모를 불러올 수 없습니다.')
    }
  }

  function openDetailModal(memo: CSMemoDetailResponse) {
    const canModify = isSuperAdmin || memo.created_by === $auth.user?.id
    modalStore.open({
      component: MemoDetailModal,
      props: {
        memo,
        canModify,
        onEdit: () => {
          modalStore.close()
          openEditModal(memo)
        },
        onDelete: () => {
          modalStore.close()
          openDeleteConfirm(memo.id)
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 수정 모달 ───
  function openEditModal(memo: CSMemoDetailResponse) {
    modalStore.open({
      component: MemoFormModal,
      props: {
        memo,
        onSubmit: async (data: any) => {
          await patchCSMemo().request({ memoId: memo.id, ...data })
          snackbarStore.success('메모가 수정되었습니다.')
          invalidateList()
        }
      },
      options: { size: 'md' }
    })
  }

  // ─── 삭제 확인 ───
  function openDeleteConfirm(memoId: string) {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '메모 삭제',
        message: '이 메모를 삭제하시겠습니까?',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteCSMemo().request({ memoId })
            snackbarStore.success('메모가 삭제되었습니다.')
            invalidateList()
          } catch {
            snackbarStore.error('삭제에 실패했습니다.')
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  // ─── 다중 선택 ───
  let selectedIds = $state<string[]>([])

  function handleCheckChange(ids: string[]) {
    selectedIds = ids
  }

  function openBulkDeleteConfirm() {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '메모 일괄 삭제',
        message: `선택한 ${selectedIds.length}개의 메모를 삭제하시겠습니까?`,
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await bulkDeleteCSMemos().request({ memo_ids: selectedIds })
            snackbarStore.success(
              `${selectedIds.length}개의 메모가 삭제되었습니다.`
            )
            selectedIds = []
            invalidateList()
          } catch {
            snackbarStore.error('메모 삭제에 실패했습니다.')
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  // ─── 유틸 ───
  const MEMO_TYPE_CONFIG: Record<
    MemoType,
    { label: string; bg: string; text: string }
  > = {
    inquiry: { label: '문의', bg: 'bg-blue-50', text: 'text-blue-700' },
    complaint: { label: '불만', bg: 'bg-red-50', text: 'text-red-700' },
    request: { label: '요청', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    other: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<CSMemoSummary>[] = $derived([
    {
      key: 'title',
      label: '제목',
      width: '1fr',
      cellClass: 'min-w-0 truncate'
    },
    {
      key: 'memo_type',
      label: '유형',
      width: '100px',
      align: 'center' as const,
      render: typeCell
    },
    { key: 'center_name', label: '센터', width: '0.7fr', render: centerCell },
    ...(isSuperAdmin
      ? [
          {
            key: 'created_by_name' as keyof CSMemoSummary,
            label: '작성자',
            width: '0.7fr',
            align: 'center' as const,
            render: writerCell
          }
        ]
      : []),
    {
      key: 'created_at',
      label: '작성일',
      width: '150px',
      align: 'center' as const,
      render: dateCell
    }
  ])
</script>

{#snippet typeCell({
  item
}: {
  item: CSMemoSummary
  index: number
  isChecked: boolean
})}
  {@const config = MEMO_TYPE_CONFIG[item.memo_type]}
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {config.bg} {config.text}"
  >
    {config.label}
  </span>
{/snippet}

{#snippet centerCell({
  item
}: {
  item: CSMemoSummary
  index: number
  isChecked: boolean
})}
  {#if item.center_name}
    <span class="text-body-02-regular text-gray-600 truncate">{item.center_name}</span>
  {:else}
    <span class="text-body-02-regular text-gray-400 truncate">설정된 센터가 없습니다</span>
  {/if}
{/snippet}

{#snippet writerCell({ item }: { item: CSMemoSummary; index: number; isChecked: boolean })}
  <span class="block truncate text-sm text-gray-600" title={item.created_by_name}>{item.created_by_name ?? '-'}</span>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: CSMemoSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="CS 전화 메모"
    description="전화 상담 내용을 기록하고 관리합니다 · 총 {total}개"
  >
    {#snippet actions()}
      <Button
        size="md"
        color="primary"
        content="새 메모 작성"
        onclick={openCreateModal}
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
        placeholder="제목, 내용 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={typeFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (typeFilter = e.detail.value)}
      options={MEMO_TYPE_OPTIONS}
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
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if memos.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 메모가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={memos}
        onRowClick={handleRowClick}
        hoverEnabled
        showCheckbox
        bind:selectedIds
        onCheckChange={handleCheckChange}
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>

{#if selectedIds.length > 0}
  <div
    class="fixed bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
    style="left: var(--sidebar-width, 240px); right: 0; width: calc(100% - var(--sidebar-width, 240px)); padding-left: 1rem; padding-right: 3.75rem;"
    transition:slide={{ duration: 200, axis: 'y' }}
  >
    <div class="flex items-center gap-3">
      <Typography variant="body-02-medium" color="text-gray-500">
        {selectedIds.length}개 선택됨
      </Typography>
      <Button
        size="md"
        color="light"
        content="선택 해제"
        onclick={() => (selectedIds = [])}
      />
      <button
        class="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
        onclick={openBulkDeleteConfirm}
      >
        선택 삭제
      </button>
    </div>
  </div>
{/if}
