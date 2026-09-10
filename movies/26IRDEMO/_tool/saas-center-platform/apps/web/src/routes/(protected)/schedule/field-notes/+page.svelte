<script lang="ts">
  import { fade } from 'svelte/transition'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { goto } from '$app/navigation'

  import Typography from '@common/components/Typography.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Select from '$root/src/lib/components/Select.svelte'
  import ListGridToggleButton from '$root/src/lib/components/ListGridToggleButton.svelte'
  import NoDataSection from '$root/src/lib/components/NoDataSection.svelte'

  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$lib/hooks/queries/builder'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'

  import { getFieldNoteList } from '$lib/hooks/actions/field-note.action'
  import { getMemberList } from '$lib/hooks/actions/member.action'

  import { mapToFieldNoteListVM } from '$lib/features/schedule/field-notes/view-model'
  import {
    LINKED_FILTER_OPTIONS,
    PROCESSING_FILTER_OPTIONS,
    FIELD_NOTE_GRID_PAGE_SIZE,
    FIELD_NOTE_LIST_PAGE_SIZE
  } from '$lib/features/schedule/field-notes/constants'
  import { buildFieldNoteListInput } from '$lib/features/schedule/field-notes/query-builders'
  import { useFieldNoteFilters } from '$lib/features/schedule/field-notes/hooks.svelte'
  import { createFieldNotesService } from '$lib/features/schedule/field-notes/field-notes-service'
  import FieldNoteCard from '$lib/features/schedule/field-notes/components/FieldNoteCard.svelte'

  const pathname = page.url.pathname
  const filters = useFieldNoteFilters(page.url, pathname)
  const isOverlayMode = $derived(!responsive.isDesktop)

  const queryClient = useQueryClient()
  const fieldNotesService = createFieldNotesService({ queryClient })

  // 멤버 목록 (작성자 이름 표시용)
  const memberQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }))
  )
  const memberMap = $derived.by(() => {
    const map = new Map<string, string>()
    for (const m of memberQuery.data?.items ?? []) {
      map.set(m.id, m.person.name)
    }
    return map
  })

  function getAuthorName(authorId: string): string {
    return memberMap.get(authorId) ?? '알 수 없음'
  }

  function handleOpen(id: string) {
    goto(`/schedule/field-notes/${id}`)
  }

  let viewType = $state(filters.viewType)

  $effect(() => {
    viewType = filters.viewType
  })
  $effect(() => {
    filters.viewType = viewType
  })
  $effect(() => {
    if (viewType) {
      filters.pageSize =
        viewType === 'grid'
          ? FIELD_NOTE_GRID_PAGE_SIZE
          : FIELD_NOTE_LIST_PAGE_SIZE
    }
  })

  // 반응형 viewType 전환: 줄일 때 grid 강제, 넓힐 때 원래 값 복원
  let viewTypeBeforeOverlay: 'list' | 'grid' | null = $state(null)

  $effect(() => {
    if (isOverlayMode && viewType === 'list') {
      viewTypeBeforeOverlay = 'list'
      viewType = 'grid'
    } else if (!isOverlayMode && viewTypeBeforeOverlay) {
      viewType = viewTypeBeforeOverlay
      viewTypeBeforeOverlay = null
    }
  })

  const onViewChange = (view: 'list' | 'grid') => {
    filters.viewType = view
    filters.pageSize =
      view === 'list' ? FIELD_NOTE_LIST_PAGE_SIZE : FIELD_NOTE_GRID_PAGE_SIZE
  }

  const isGrid = $derived(viewType === 'grid')

  // 테이블(list) 뷰 — 기존 오프셋 페이지네이션 그대로 (grid 일 땐 비활성)
  const listQuery = $derived(
    queryBuilder(
      getFieldNoteList,
      () => buildFieldNoteListInput($centerId!, filters.buildFilters()),
      () => ({ enabled: !isGrid })
    )
  )
  const listData = $derived(listQuery.data)

  // 카드(grid) 뷰 — 무한 스크롤 (list 일 땐 비활성)
  const notesInfinite = infiniteQueryBuilder(getFieldNoteList, {
    key: () => {
      const f = filters.buildFilters()
      return {
        center: $centerId,
        processingStatus: f.processingStatus,
        linked: f.linked
      }
    },
    buildInput: (skip, limit) => ({
      ...buildFieldNoteListInput($centerId!, filters.buildFilters()),
      skip,
      limit
    }),
    pageSize: FIELD_NOTE_GRID_PAGE_SIZE,
    enabled: () => isGrid
  })

  // 활성 소스에서 items/total 파생
  const rawItems = $derived.by<any[]>(() => {
    if (isGrid) {
      const pages = notesInfinite.data?.pages ?? []
      return pages.flatMap((p: any) => (Array.isArray(p?.items) ? p.items : []))
    }
    return listData?.items ?? []
  })
  const items = $derived(rawItems.map(mapToFieldNoteListVM))
  const total = $derived(
    isGrid
      ? (notesInfinite.data?.pages?.[0]?.total ?? 0)
      : (listData?.total ?? 0)
  )

  // 무한 스크롤 제어
  const gridInitialLoading = $derived(isGrid && notesInfinite.isLoading)
  const loadingMore = $derived(isGrid && notesInfinite.isFetchingNextPage)
  const hasMore = $derived(isGrid && (notesInfinite.hasNextPage ?? false))
  const loadMore = () => notesInfinite.fetchNextPage()

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return f.processingStatus === 'all' && f.linked === 'all'
  })
</script>

<!-- 카드=페이지 전체 스크롤(무한) / 테이블=기존 높이 고정. 헤더는 xl에서 sticky 고정 -->
<div
  in:fade
  class="flex flex-col bg-gray-50 {isGrid
    ? ''
    : 'xl:h-full xl:overflow-hidden'}"
>
  <!-- 타이틀↔필터 간격은 FloatingFilterBar의 py-4가 일부 담당(mb-6 → mb-2) -->
  <!-- 타이틀 아래가 필터 바(여백 가진 행) → 간격 8 -->
  <PageTitleSection title="필드노트" className="mb-2" />

  <!-- 필터 — 상단에 닿으면 플로팅으로 고정 -->
  <FloatingFilterBar reserveScroll={isGrid}>
    {#snippet children()}
      <Select
        class="bg-white rounded-lg"
        selected={filters.processingStatus}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) => (filters.processingStatus = e.detail.value)}
        options={PROCESSING_FILTER_OPTIONS}
      />
      <Select
        class="bg-white rounded-lg"
        selected={filters.linked}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) => (filters.linked = e.detail.value)}
        options={LINKED_FILTER_OPTIONS}
      />
      <FilterResetButton
        onclick={() => filters.reset()}
        disabled={isResetDisabled}
      />
    {/snippet}
  </FloatingFilterBar>

  <!-- 통계 + 뷰 토글 -->
  <div class="flex h-12 shrink-0 items-center justify-between">
    <Typography variant="body-01-medium" color="text-gray-600">
      총 {total}건
    </Typography>
    <div class="flex items-center gap-3">
      {#if !isOverlayMode}
        <ListGridToggleButton bind:viewType {onViewChange} />
      {/if}
    </div>
  </div>

  {#if isGrid}
    <!-- 카드(grid): 페이지 흐름대로 늘어남(내부 스크롤 없음) → 본문 전체 스크롤 -->
    {#if items.length === 0 && !gridInitialLoading}
      <div class="flex flex-1 items-center justify-center py-12">
        <NoDataSection description="필드노트가 없어요" />
      </div>
    {:else}
      <div in:fade>
        <div
          class="grid gap-4 pb-4"
          style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));"
        >
          {#each items as item (item.id)}
            <FieldNoteCard
              {item}
              authorName={getAuthorName(item.authorId)}
              onDelete={fieldNotesService.remove}
              onOpen={handleOpen}
            />
          {/each}
        </div>
        <InfiniteScrollSentinel
          onLoadMore={loadMore}
          {hasMore}
          loading={loadingMore || gridInitialLoading}
        />
      </div>
    {/if}
  {:else}
    <!-- 테이블(list): 기존 높이 고정 + 오프셋 페이지네이션 그대로 -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      {#if items.length === 0}
        <div class="flex flex-1 items-center justify-center py-12">
          <NoDataSection
            description={listQuery.isLoading
              ? '불러오는 중...'
              : '필드노트가 없어요'}
          />
        </div>
      {:else}
        <div in:fade class="min-h-0 flex-1 xl:overflow-y-auto">
          <div
            class="bg-white rounded-2xl border border-gray-200 overflow-hidden"
          >
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100 bg-gray-50">
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >날짜</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >작성자</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >녹음시간</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >상태</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >처리</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >연결</th
                  >
                  <th class="text-left px-4 py-3 font-medium text-gray-600"
                    >요약</th
                  >
                  <th
                    class="text-center px-4 py-3 font-medium text-gray-600 w-20"
                  ></th>
                </tr>
              </thead>
              <tbody>
                {#each items as item (item.id)}
                  <tr
                    role="button"
                    tabindex="0"
                    onclick={() => handleOpen(item.id)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ')
                        handleOpen(item.id)
                    }}
                    class="border-b border-gray-50 hover:bg-gray-25 transition-colors cursor-pointer"
                  >
                    <td class="px-4 py-3 text-gray-700">{item.createdAt}</td>
                    <td class="px-4 py-3 text-gray-700"
                      >{getAuthorName(item.authorId)}</td
                    >
                    <td class="px-4 py-3 text-gray-600">{item.durationText}</td>
                    <td class="px-4 py-3">
                      <span class="text-gray-600">{item.statusLabel}</span>
                    </td>
                    <td class="px-4 py-3">
                      <span class={item.processingColor}
                        >{item.processingLabel}</span
                      >
                    </td>
                    <td class="px-4 py-3">
                      {#if item.isLinked}
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700"
                          >연결됨</span
                        >
                      {:else}
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500"
                          >미연결</span
                        >
                      {/if}
                    </td>
                    <td class="px-4 py-3">
                      {#if item.hasSummary}
                        <span class="text-green-600">완료</span>
                      {:else}
                        <span class="text-gray-400">-</span>
                      {/if}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <button
                        class="text-xs text-red-400 hover:text-red-600 transition-colors"
                        onclick={(e) => {
                          e.stopPropagation()
                          fieldNotesService.remove(item.id)
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <div class="mt-auto flex shrink-0 justify-center">
        <Pagination
          totalItems={total}
          itemsPerPage={filters.pageSize}
          bind:currentPage={filters.currentPage}
        />
      </div>
    </div>
  {/if}
</div>
