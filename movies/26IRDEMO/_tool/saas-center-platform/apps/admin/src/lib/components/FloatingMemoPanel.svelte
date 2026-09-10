<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fly } from 'svelte/transition'
  import { snackbarStore } from '$stores/snackbar'
  import { auth } from '$stores/auth'
  import { get } from 'svelte/store'
  import { canAdminister } from '$lib/utils/permissions'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getCSMemoList,
    getCSMemoDetail,
    postCreateCSMemo,
    patchCSMemo,
    deleteCSMemo,
    type CSMemoSummary,
    type CSMemoDetailResponse,
    type MemoType
  } from '$hooks/actions/cs-memo.action'
  import {
    getCenterList,
    type CenterSummary
  } from '$hooks/actions/center.action'
  import Select from '$components/Select.svelte'
  import { formatDate } from '$lib/utils/format'

  interface Props {
    open: boolean
    onClose: () => void
  }

  let { open, onClose }: Props = $props()
  const queryClient = useQueryClient()

  /** 패널 내부 목록 + TanStack Query 캐시 동시 갱신 */
  function refreshAll() {
    fetchMemos()
    queryClient.invalidateQueries({ queryKey: ['getCSMemoList'], exact: false })
  }

  // ─── 뷰 상태 ───
  type ViewMode = 'list' | 'detail' | 'create' | 'edit'
  let viewMode = $state<ViewMode>('list')
  let selectedMemo = $state<CSMemoDetailResponse | null>(null)
  let isLoadingDetail = $state(false)
  let isHovered = $state(true)
  let isFocusedInside = $state(false)
  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let isActive = $derived(isHovered || isFocusedInside)

  function handleMouseEnter() {
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
    isHovered = true
  }

  function handleMouseLeave() {
    hoverTimer = setTimeout(() => {
      isHovered = false
    }, 200)
  }

  // ─── 검색/필터/페이지 ───
  let searchInput = $state('')
  let debouncedSearch = $state('')
  let filterType = $state<string>('')
  let currentPage = $state(1)
  const PAGE_SIZE = 8
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // 검색 디바운스
  $effect(() => {
    const value = searchInput
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedSearch = value
      currentPage = 1
    }, 300)
  })

  // ─── 폼 상태 ───
  let formTitle = $state('')
  let formContent = $state('')
  let formMemoType = $state<MemoType>('inquiry')
  let formCenterId = $state<string>('')

  // ─── 메모 목록 (수동 fetch) ───
  let memoItems = $state<CSMemoSummary[]>([])
  let totalPages = $state(1)
  let totalCount = $state(0)
  let isListLoading = $state(false)

  async function fetchMemos() {
    isListLoading = true
    try {
      const params: Record<string, any> = {
        size: PAGE_SIZE,
        page: currentPage,
        sort_order: 'desc'
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (filterType) params.memo_type = filterType

      const result = await getCSMemoList().request(params)
      memoItems = result?.items ?? []
      totalPages = result?.pages ?? 1
      totalCount = result?.total ?? 0
    } catch {
      memoItems = []
    } finally {
      isListLoading = false
    }
  }

  // 필터/페이지 변경 시 자동 fetch
  $effect(() => {
    // 의존성 추적을 위해 값 읽기
    debouncedSearch
    filterType
    currentPage
    if (open) {
      fetchMemos()
    }
  })

  function resetFilters() {
    searchInput = ''
    debouncedSearch = ''
    filterType = ''
    currentPage = 1
  }

  // ─── 센터 목록 (수동 fetch) ───
  let centerOptions = $state([{ value: '', title: '센터 선택 (선택사항)' }])

  async function fetchCenters() {
    try {
      const result = await getCenterList().request({ size: 100 })
      centerOptions = [
        { value: '', title: '센터 선택 (선택사항)' },
        ...(result?.items ?? []).map((c: CenterSummary) => ({
          value: c.id,
          title: c.name
        }))
      ]
    } catch {
      // ignore
    }
  }

  // 패널 열릴 때 센터 목록 1회 fetch
  $effect(() => {
    if (open) {
      fetchCenters()
    }
  })

  const MEMO_TYPE_OPTIONS = [
    { value: 'inquiry', title: '문의' },
    { value: 'complaint', title: '불만' },
    { value: 'request', title: '요청' },
    { value: 'other', title: '기타' }
  ]

  const FILTER_TYPE_OPTIONS = [
    { value: '', title: '전체 유형' },
    ...MEMO_TYPE_OPTIONS
  ]

  const MEMO_TYPE_CONFIG: Record<
    MemoType,
    { label: string; bg: string; text: string }
  > = {
    inquiry: { label: '문의', bg: 'bg-blue-50', text: 'text-blue-700' },
    complaint: { label: '불만', bg: 'bg-red-50', text: 'text-red-700' },
    request: { label: '요청', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    other: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  // ─── 권한 체크 ───
  function canModify(memo: CSMemoDetailResponse | CSMemoSummary): boolean {
    const authState = get(auth)
    if (!authState.user) return false
    if (canAdminister(authState.user.role)) return true
    return memo.created_by === authState.user.id
  }

  // ─── 목록 새로고침 ───
  function refreshList() {
    refreshAll()
  }

  let isSubmitting = $state(false)

  // ─── 상세 보기 ───
  async function openDetail(memo: CSMemoSummary) {
    isLoadingDetail = true
    try {
      const detail = await getCSMemoDetail().request({ memoId: memo.id })
      selectedMemo = detail
      viewMode = 'detail'
    } catch {
      snackbarStore.error('메모 상세 조회에 실패했습니다.')
    } finally {
      isLoadingDetail = false
    }
  }

  // ─── 새 메모 작성 ───
  function openCreateForm() {
    formTitle = ''
    formContent = ''
    formMemoType = 'inquiry'
    formCenterId = ''
    viewMode = 'create'
  }

  // ─── 수정 모드 ───
  function openEditForm() {
    if (!selectedMemo) return
    formTitle = selectedMemo.title
    formContent = selectedMemo.content
    formMemoType = selectedMemo.memo_type
    formCenterId = selectedMemo.center_id ?? ''
    viewMode = 'edit'
  }

  // ─── 목록으로 돌아가기 ───
  function goBack() {
    if (viewMode === 'edit') {
      viewMode = 'detail'
    } else {
      viewMode = 'list'
      selectedMemo = null
    }
  }

  // ─── 제출 ───
  async function handleSubmit() {
    if (!formTitle.trim() || !formContent.trim()) return
    isSubmitting = true
    try {
      if (viewMode === 'create') {
        await postCreateCSMemo().request({
          title: formTitle.trim(),
          content: formContent.trim(),
          memo_type: formMemoType,
          center_id: formCenterId || null
        })
        snackbarStore.success('메모가 저장되었습니다.')
        refreshList()
        viewMode = 'list'
      } else if (viewMode === 'edit' && selectedMemo) {
        await patchCSMemo().request({
          memoId: selectedMemo.id,
          title: formTitle.trim(),
          content: formContent.trim(),
          memo_type: formMemoType,
          center_id: formCenterId || null
        })
        snackbarStore.success('메모가 수정되었습니다.')
        refreshList()
        const detail = await getCSMemoDetail().request({
          memoId: selectedMemo.id
        })
        selectedMemo = detail
        viewMode = 'detail'
      }
    } catch {
      snackbarStore.error('저장에 실패했습니다.')
    } finally {
      isSubmitting = false
    }
  }

  // ─── 삭제 ───
  let showDeleteConfirm = $state(false)

  async function handleDelete() {
    if (!selectedMemo) return
    isSubmitting = true
    try {
      await deleteCSMemo().request({ memoId: selectedMemo.id })
      snackbarStore.success('메모가 삭제되었습니다.')
      refreshList()
      selectedMemo = null
      viewMode = 'list'
      showDeleteConfirm = false
    } catch {
      snackbarStore.error('삭제에 실패했습니다.')
    } finally {
      isSubmitting = false
    }
  }
</script>

{#if open}
  <!-- 패널 -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class={twMerge(
      'fixed bottom-20 right-6 z-10001 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-opacity duration-200',
      isActive ? 'opacity-100' : 'opacity-30'
    )}
    style="width: 400px; height: 560px;"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onfocusin={() => (isFocusedInside = true)}
    onfocusout={() => (isFocusedInside = false)}
    transition:fly={{ y: 20, duration: 250 }}
  >
    <!-- ═══ 헤더 ═══ -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-gray-100 bg-primary-500 px-4 py-3"
    >
      <div class="flex items-center gap-2">
        {#if viewMode !== 'list'}
          <button
            onclick={goBack}
            class="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="뒤로 가기"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        {/if}
        <span class="text-sm font-semibold text-white">
          {#if viewMode === 'list'}CS 메모
          {:else if viewMode === 'create'}새 메모 작성
          {:else if viewMode === 'edit'}메모 수정
          {:else}메모 상세
          {/if}
        </span>
      </div>
      <div class="flex items-center gap-1">
        {#if viewMode === 'list'}
          <button
            onclick={openCreateForm}
            class="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            title="새 메모 작성"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        {/if}
        <button
          onclick={onClose}
          class="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="패널 닫기"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- ═══ 바디 ═══ -->
    <div class="flex-1 overflow-y-auto">
      {#if viewMode === 'list'}
        <!-- ─── 검색/필터 ─── -->
        <div class="sticky top-0 z-10 border-b border-gray-100 bg-white p-3">
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={searchInput}
              placeholder="메모 검색"
              class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 h-8 text-sm outline-none focus:border-primary-500 focus:bg-white focus:ring-1 focus:ring-primary-500"
            />
            <Select
              class="h-8 w-24 shrink-0 bg-gray-50 rounded-lg text-xs"
              selected={filterType}
              on:change={(e) => {
                filterType = e.detail.value
                currentPage = 1
              }}
              placeholder="유형"
              options={FILTER_TYPE_OPTIONS}
            />
            <button
              onclick={resetFilters}
              class="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              title="필터 초기화"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          {#if totalCount > 0}
            <p class="mt-1.5 text-xs text-gray-400">총 {totalCount}건</p>
          {/if}
        </div>

        <!-- ─── 메모 목록 ─── -->
        {#if isListLoading && memoItems.length === 0}
          <div class="flex items-center justify-center py-12">
            <span class="text-sm text-gray-400">불러오는 중...</span>
          </div>
        {:else if !memoItems.length}
          <div class="flex flex-col items-center justify-center py-12">
            <svg
              class="mb-2 h-10 w-10 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span class="text-sm text-gray-400">메모가 없습니다</span>
          </div>
        {:else}
          <div class="divide-y divide-gray-50">
            {#each memoItems as memo (memo.id)}
              {@const typeConfig = MEMO_TYPE_CONFIG[memo.memo_type as MemoType]}
              <button
                onclick={() => openDetail(memo)}
                class="w-full px-3 py-2.5 text-left transition hover:bg-gray-50"
              >
                <!-- 1행: 카테고리 | 제목 | 날짜 -->
                <div class="flex items-center gap-1.5">
                  <span
                    class={twMerge(
                      'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[12px] font-medium leading-none',
                      typeConfig.bg,
                      typeConfig.text
                    )}
                  >
                    {typeConfig.label}
                  </span>
                  <span
                    class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800"
                  >
                    {memo.title}
                  </span>
                  <span class="shrink-0 text-[12px] text-gray-400">
                    {formatDate(memo.created_at, 'MM.DD HH:mm')}
                  </span>
                </div>
                <!-- 2행: 센터명 -->
                {#if memo.center_name}
                  <p class="ml-1 mt-1 truncate text-xs text-gray-400">
                    {memo.center_name}
                  </p>
                {/if}
                <!-- 3행: 작성자 -->
                <p class="ml-1 mt-1 text-xs text-gray-400">
                  {memo.created_by_name || '-'}
                </p>
              </button>
            {/each}
          </div>
          <!-- 페이지네이션 -->
          {#if totalPages > 1}
            <div
              class="flex items-center justify-center gap-1 border-t border-gray-100 py-2.5"
            >
              <button
                onclick={() => (currentPage = Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                이전
              </button>
              <span class="px-2 text-xs text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onclick={() =>
                  (currentPage = Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                다음
              </button>
            </div>
          {/if}
        {/if}
      {:else if viewMode === 'detail' && selectedMemo}
        <!-- ─── 상세 보기 ─── -->
        {@const typeConfig = MEMO_TYPE_CONFIG[selectedMemo.memo_type]}
        <div class="p-4">
          <div class="mb-3 flex items-center gap-2">
            <span
              class={twMerge(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                typeConfig.bg,
                typeConfig.text
              )}
            >
              {typeConfig.label}
            </span>
            {#if selectedMemo.center_name}
              <span class="text-xs text-gray-400"
                >{selectedMemo.center_name}</span
              >
            {/if}
          </div>

          <h3 class="mb-3 text-base font-semibold text-gray-900">
            {selectedMemo.title}
          </h3>

          <div
            class="mb-4 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700"
          >
            {selectedMemo.content}
          </div>

          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>{selectedMemo.created_by_name || '-'}</span>
            <span>·</span>
            <span
              >{formatDate(selectedMemo.created_at, 'YYYY-MM-DD HH:mm')}</span
            >
          </div>
        </div>

        <!-- 삭제 확인 -->
        {#if showDeleteConfirm}
          <div class="border-t border-gray-100 bg-red-50 p-4">
            <p class="mb-3 text-sm text-red-700">이 메모를 삭제하시겠습니까?</p>
            <div class="flex gap-2">
              <button
                onclick={() => (showDeleteConfirm = false)}
                class="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onclick={handleDelete}
                disabled={isSubmitting}
                class="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        {/if}
      {:else if viewMode === 'create' || viewMode === 'edit'}
        <!-- ─── 작성/수정 폼 ─── -->
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <div class="space-y-3 p-4">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              제목 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              bind:value={formTitle}
              placeholder="메모 제목"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600"
                >유형</label
              >
              <Select
                class="h-9 w-full bg-white rounded-lg text-sm"
                selected={formMemoType}
                on:change={(e) => (formMemoType = e.detail.value as MemoType)}
                options={MEMO_TYPE_OPTIONS}
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-600"
                >센터</label
              >
              <Select
                class="h-9 w-full bg-white rounded-lg text-sm"
                selected={formCenterId}
                on:change={(e) => (formCenterId = e.detail.value)}
                options={centerOptions}
              />
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600">
              내용 <span class="text-red-500">*</span>
            </label>
            <textarea
              bind:value={formContent}
              placeholder="통화 내용을 기록하세요"
              rows="8"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
            ></textarea>
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ 푸터 ═══ -->
    {#if viewMode === 'detail' && selectedMemo && canModify(selectedMemo) && !showDeleteConfirm}
      <div class="flex shrink-0 gap-2 border-t border-gray-100 px-4 py-3">
        <button
          onclick={() => (showDeleteConfirm = true)}
          class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
        >
          삭제
        </button>
        <button
          onclick={openEditForm}
          class="flex-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          수정
        </button>
      </div>
    {/if}

    {#if viewMode === 'create' || viewMode === 'edit'}
      <div class="flex shrink-0 gap-2 border-t border-gray-100 px-4 py-3">
        <button
          onclick={goBack}
          class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onclick={handleSubmit}
          disabled={isSubmitting || !formTitle.trim() || !formContent.trim()}
          class="flex-1 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : viewMode === 'edit' ? '수정' : '저장'}
        </button>
      </div>
    {/if}
  </div>
{/if}
