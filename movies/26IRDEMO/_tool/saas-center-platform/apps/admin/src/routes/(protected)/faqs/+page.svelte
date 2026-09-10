<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Button from '$components/Button.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getFAQList,
    getFAQDetail,
    postCreateFAQ,
    patchFAQ,
    postFAQReorder,
    deleteFAQ,
    type FAQSummary,
    type FAQCategory,
    type FAQDetailResponse,
    type FAQCreateParams
  } from '$hooks/actions/faq.action'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { fade, slide } from 'svelte/transition'
  import FAQFormModal from './components/FAQFormModal.svelte'
  import DraggableFAQTable from './components/DraggableFAQTable.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'
  import Pagination from '$components/Pagination.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import TrashIcon from '$root/src/lib/assets/TrashIcon.svelte'

  const queryClient = useQueryClient()

  // ─── 카테고리 탭 ───
  const CATEGORIES: { value: FAQCategory | 'all'; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'getting_started', label: '시작하기' },
    { value: 'general', label: '일반' },
    { value: 'technical', label: '기술' },
    { value: 'feature', label: '기능' }
  ]

  const CATEGORY_LABELS: Record<FAQCategory, string> = {
    getting_started: '시작하기',
    general: '일반',
    technical: '기술',
    feature: '기능'
  }

  // ─── 상태 ───
  let activeCategory = $state<FAQCategory | 'all'>('all')
  let search = $state('')
  let debouncedSearch = $state('')
  let currentPage = $state(1)
  const pageSize = 20
  let searchTimeout: ReturnType<typeof setTimeout>

  $effect(() => {
    clearTimeout(searchTimeout)
    const q = search
    searchTimeout = setTimeout(() => {
      debouncedSearch = q
    }, 300)
  })

  function resetFilters() {
    search = ''
    debouncedSearch = ''
    currentPage = 1
  }

  // ─── 쿼리 ───
  // canReorder(특정 카테고리 탭) 시: 전체 로드 (size: 200, 스크롤 방식)
  // 전체 탭: 페이지네이션
  const faqsQuery = $derived(
    queryBuilder<any, any>(getFAQList, () => ({
      category: activeCategory !== 'all' ? activeCategory : undefined,
      search: debouncedSearch || undefined,
      page: canReorder ? 1 : currentPage,
      size: canReorder ? 100 : pageSize
    }))
  )

  const faqs = $derived<FAQSummary[]>(faqsQuery.data?.items ?? [])
  const total = $derived<number>(faqsQuery.data?.total ?? 0)
  const isLoading = $derived(faqsQuery.isPending)

  // ─── 드래그앤드롭 (특정 카테고리 탭에서만) ───
  const canReorder = $derived(activeCategory !== 'all')
  let localFaqs = $state<FAQSummary[]>([])
  let isOrderChanged = $state(false)

  // 쿼리 결과가 바뀌면 localFaqs 동기화 (드래그 중이 아닐 때만)
  $effect(() => {
    if (!isOrderChanged) {
      localFaqs = [...faqs]
    }
  })

  function handleReorder(newItems: FAQSummary[]) {
    localFaqs = newItems
    isOrderChanged = true
  }

  async function saveOrder() {
    if (!canReorder || activeCategory === 'all') return
    try {
      await postFAQReorder().request({
        category: activeCategory as FAQCategory,
        faq_ids: localFaqs.map((f) => f.id)
      })
      snackbarStore.success('순서가 저장되었습니다.')
      isOrderChanged = false
      invalidateList()
    } catch {
      snackbarStore.error('순서 저장에 실패했습니다.')
    }
  }

  function cancelOrder() {
    localFaqs = [...faqs]
    isOrderChanged = false
  }

  // ─── invalidate ───
  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: ['getFAQList'], exact: false })
    isOrderChanged = false
  }

  // ─── 등록 모달 ───
  function openCreateModal() {
    modalStore.open({
      component: FAQFormModal,
      props: {
        onSubmit: async (data: FAQCreateParams) => {
          await postCreateFAQ().request(data)
          snackbarStore.success('FAQ가 등록되었습니다.')
          invalidateList()
        }
      },
      options: { size: 'lg' }
    })
  }

  // ─── 행 클릭 → 수정 모달 ───
  async function handleRowClick(item: FAQSummary) {
    try {
      const faq = await getFAQDetail().request({ faqId: item.id })
      openEditModal(faq)
    } catch {
      snackbarStore.error('FAQ를 불러올 수 없습니다.')
    }
  }

  function openEditModal(faq: FAQDetailResponse) {
    modalStore.open({
      component: FAQFormModal,
      props: {
        faq,
        onSubmit: async (data: FAQCreateParams) => {
          await patchFAQ().request({ faqId: faq.id, ...data })
          snackbarStore.success('FAQ가 수정되었습니다.')
          invalidateList()
        }
      },
      options: { size: 'lg' }
    })
  }

  // ─── 삭제 확인 ───
  function openDeleteConfirm(faqId: string, e: MouseEvent) {
    e.stopPropagation()
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: 'FAQ 삭제',
        message: '이 FAQ를 삭제하시겠습니까?',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteFAQ().request({ faqId })
            snackbarStore.success('FAQ가 삭제되었습니다.')
            invalidateList()
          } catch {
            snackbarStore.error('삭제에 실패했습니다.')
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<FAQSummary>[] = $derived([
    {
      key: 'question',
      label: '질문',
      width: '1fr',
      cellClass: 'min-w-0 overflow-hidden',
      render: questionCell
    },
    ...(activeCategory === 'all'
      ? [
          {
            key: 'category' as keyof FAQSummary,
            label: '카테고리',
            width: '100px',
            align: 'center' as const,
            render: categoryCell
          }
        ]
      : []),
    {
      key: 'is_published' as keyof FAQSummary,
      label: '게시',
      width: '0.5fr',
      align: 'center' as const,
      render: publishCell
    },
    {
      key: 'sort_order' as keyof FAQSummary,
      label: '순서',
      width: '0.5fr',
      align: 'center' as const
    },
    {
      key: 'created_at' as keyof FAQSummary,
      label: '작성일',
      width: '0.5fr',
      align: 'center' as const,
      render: dateCell
    },
    {
      key: 'id' as keyof FAQSummary,
      label: '',
      width: '60px',
      align: 'center' as const,
      render: deleteBtn
    }
  ])

  // draggable 데이터 — isOrderChanged이면 localFaqs, 아니면 faqs 사용
  const displayFaqs = $derived(isOrderChanged ? localFaqs : faqs)
</script>

{#snippet questionCell({
  item
}: {
  item: FAQSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular block truncate text-gray-900">{item.question}</span>
{/snippet}

{#snippet categoryCell({
  item
}: {
  item: FAQSummary
  index: number
  isChecked: boolean
})}
  <span
    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
  >
    {CATEGORY_LABELS[item.category]}
  </span>
{/snippet}

{#snippet publishCell({
  item
}: {
  item: FAQSummary
  index: number
  isChecked: boolean
})}
  {#if item.is_published}
    <span
      class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700"
      >게시</span
    >
  {:else}
    <span
      class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500"
      >숨김</span
    >
  {/if}
{/snippet}

{#snippet dateCell({
  item
}: {
  item: FAQSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD')}
  </span>
{/snippet}

{#snippet deleteBtn({
  item
}: {
  item: FAQSummary
  index: number
  isChecked: boolean
})}
  <button
    class="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
    onclick={(e) => openDeleteConfirm(item.id, e)}
  >
    <TrashIcon />
  </button>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="FAQ 관리"
    description="자주 묻는 질문을 관리합니다 · 총 {total}개"
  >
    {#snippet actions()}
      <Button
        size="md"
        color="primary"
        content="FAQ 등록"
        onclick={openCreateModal}
      />
    {/snippet}
  </PageHeader>

  <!-- 카테고리 탭 -->
  <div class="mb-4 flex items-center gap-1 border-b border-gray-200">
    {#each CATEGORIES as cat}
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeCategory === cat.value
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'}"
        onclick={() => {
          activeCategory = cat.value
          isOrderChanged = false
          currentPage = 1
        }}
      >
        {cat.label}
      </button>
    {/each}
  </div>

  <!-- 검색 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="질문, 답변 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>

    {#if canReorder}
      <span class="text-xs text-gray-400 ml-2"
        >드래그로 순서를 변경할 수 있습니다</span
      >
    {/if}
  </div>

  <!-- 테이블 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if displayFaqs.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 FAQ가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      {#if canReorder}
        <DraggableFAQTable
          items={localFaqs}
          onRowClick={handleRowClick}
          onDelete={openDeleteConfirm}
          onReorder={handleReorder}
        />
      {:else}
        <Table
          {columns}
          data={displayFaqs}
          onRowClick={handleRowClick}
          hoverEnabled
        />
      {/if}
    </div>

    {#if !canReorder}
      <div class="mt-4">
        <Pagination
          totalItems={total}
          itemsPerPage={pageSize}
          bind:currentPage
        />
      </div>
    {/if}
  {/if}
</div>

{#if isOrderChanged}
  <div
    class="fixed bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
    style="left: var(--sidebar-width, 240px); right: 0; width: calc(100% - var(--sidebar-width, 240px)); padding-left: 1rem; padding-right: 3.75rem;"
    transition:slide={{ duration: 200, axis: 'y' }}
  >
    <div class="flex items-center gap-3">
      <Typography variant="body-02-medium" color="text-gray-500">
        순서가 변경되었습니다. 저장하시겠습니까?
      </Typography>
      <Button size="md" color="light" content="취소" onclick={cancelOrder} />
      <Button
        size="md"
        color="primary"
        content="순서 저장"
        onclick={saveOrder}
      />
    </div>
  </div>
{/if}
