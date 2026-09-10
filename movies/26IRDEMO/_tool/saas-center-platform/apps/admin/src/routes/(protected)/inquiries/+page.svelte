<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getInquiryList,
    getInquiryDetail,
    patchInquiryAnswer,
    patchInquiryStatus,
    deleteInquiry,
    type InquirySummary,
    type InquiryType,
    type InquiryStatus,
    type InquiryDetailResponse
  } from '$hooks/actions/inquiry.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { formatDate } from '$root/src/lib/utils/format'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { fade } from 'svelte/transition'
  import InquiryDetailModal from './components/InquiryDetailModal.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'

  const queryClient = useQueryClient()

  // ─── 필터 옵션 ───
  const INQUIRY_TYPE_OPTIONS = [
    { value: 'all', title: '전체 유형' },
    { value: 'general', title: '일반 문의' },
    { value: 'technical', title: '기술 문의' },
    { value: 'feature_request', title: '기능 요청' },
    { value: 'other', title: '기타' }
  ]

  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'pending', title: '대기' },
    { value: 'in_progress', title: '처리 중' },
    { value: 'resolved', title: '답변 완료' }
  ]

  const INQUIRY_TYPE_CONFIG: Record<
    InquiryType,
    { label: string; bg: string; text: string }
  > = {
    general: { label: '일반 문의', bg: 'bg-blue-50', text: 'text-blue-700' },
    technical: {
      label: '기술 문의',
      bg: 'bg-purple-50',
      text: 'text-purple-700'
    },
    feature_request: {
      label: '기능 요청',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700'
    },
    other: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  const STATUS_CONFIG: Record<
    InquiryStatus,
    { label: string; bg: string; text: string }
  > = {
    pending: { label: '대기', bg: 'bg-gray-100', text: 'text-gray-600' },
    in_progress: { label: '처리 중', bg: 'bg-blue-50', text: 'text-blue-700' },
    resolved: { label: '답변 완료', bg: 'bg-green-50', text: 'text-green-700' }
  }

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    type: 'all',
    status: 'all',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let typeFilter = $state(url.initial.type as string)
  let statusFilter = $state(url.initial.status as string)
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
    statusFilter
    currentPage = 1
  })

  // URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      type: typeFilter,
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
    typeFilter = 'all'
    statusFilter = 'all'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const inquiriesQuery = $derived(
    queryBuilder<any, any>(getInquiryList, () => ({
      search: debouncedSearch || undefined,
      inquiry_type: typeFilter !== 'all' ? typeFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const inquiries = $derived<InquirySummary[]>(inquiriesQuery.data?.items ?? [])
  const total = $derived<number>(inquiriesQuery.data?.total ?? 0)
  const isLoading = $derived(inquiriesQuery.isPending)

  // ─── invalidate ───
  function invalidateList() {
    queryClient.invalidateQueries({
      queryKey: ['getInquiryList'],
      exact: false
    })
  }

  // ─── 행 클릭 → 상세 모달 ───
  async function handleRowClick(item: InquirySummary) {
    try {
      const inquiry = await getInquiryDetail().request({ inquiryId: item.id })
      openDetailModal(inquiry)
    } catch {
      snackbarStore.error('문의를 불러올 수 없습니다.')
    }
  }

  function openDetailModal(inquiry: InquiryDetailResponse) {
    modalStore.open({
      component: InquiryDetailModal,
      props: {
        inquiry,
        onSave: async (answer: string) => {
          await patchInquiryAnswer().request({ inquiryId: inquiry.id, answer })
          await patchInquiryStatus().request({
            inquiryId: inquiry.id,
            status: 'resolved'
          })
          snackbarStore.success('답변이 등록되었습니다.')
          invalidateList()
        },
        onDelete: () => {
          modalStore.close()
          openDeleteConfirm(inquiry.id)
        }
      },
      options: { size: 'lg' }
    })
  }

  // ─── 삭제 확인 ───
  function openDeleteConfirm(inquiryId: string) {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '문의 삭제',
        message: '이 문의를 삭제하시겠습니까? 답변 내용도 함께 삭제됩니다.',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteInquiry().request({ inquiryId })
            snackbarStore.success('문의가 삭제되었습니다.')
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
  const columns: TableColumn<InquirySummary>[] = [
    {
      key: 'subject',
      label: '제목',
      width: '1fr',
      cellClass: 'min-w-0 truncate'
    },
    {
      key: 'inquiry_type',
      label: '유형',
      width: '110px',
      align: 'center' as const,
      render: typeCell
    },
    {
      key: 'status',
      label: '상태',
      width: '100px',
      align: 'center' as const,
      render: statusCell
    },
    {
      key: 'sender_name',
      label: '문의자',
      width: '0.8fr',
      cellClass: 'min-w-0 overflow-hidden truncate',
      render: senderCell
    },
    {
      key: 'center_name',
      label: '센터',
      width: '0.7fr',
      cellClass: 'min-w-0 overflow-hidden truncate',
      render: centerCell
    },
    {
      key: 'answered_by_name',
      label: '답변자',
      width: '0.6fr',
      cellClass: 'min-w-0 overflow-hidden truncate',
      render: answeredByCell
    },
    {
      key: 'created_at',
      label: '접수일',
      width: '150px',
      align: 'center' as const,
      render: dateCell
    }
  ]
</script>

{#snippet typeCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  {@const config = INQUIRY_TYPE_CONFIG[item.inquiry_type]}
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {config.bg} {config.text}"
  >
    {config.label}
  </span>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  {@const config = STATUS_CONFIG[item.status]}
  <span
    class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {config.bg} {config.text}"
  >
    {config.label}
  </span>
{/snippet}

{#snippet senderCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  <div class="flex flex-col gap-0.5 min-w-0">
    <span class="text-body-02-regular text-gray-800 truncate">
      {item.sender_name}
    </span>
    <span class="text-xs text-gray-400 truncate">{item.sender_email}</span>
  </div>
{/snippet}

{#snippet centerCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-600 truncate">
    {item.center_name || '-'}
  </span>
{/snippet}

{#snippet answeredByCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  <span
    class="text-body-02-regular {item.answered_by_name
      ? 'text-gray-700'
      : 'text-gray-400'}"
  >
    {item.answered_by_name || '-'}
  </span>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: InquirySummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500">
    {formatDate(item.created_at, 'YYYY-MM-DD HH:mm')}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="문의 관리"
    description="센터 및 사용자의 1:1 문의를 관리합니다 · 총 {total}개"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="제목, 내용, 문의자 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-32 bg-white rounded-lg"
      selected={typeFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (typeFilter = e.detail.value)}
      options={INQUIRY_TYPE_OPTIONS}
    />

    <Select
      class="h-11 w-32 bg-white rounded-lg"
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
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if inquiries.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '접수된 문의가 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={inquiries}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
