<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type { FieldNoteListVM } from '../view-model'

  type LinkFilter = 'all' | 'linked' | 'unlinked'

  interface Props {
    items: FieldNoteListVM[]
    selectedId: string | null
    isLoading?: boolean
    getAuthorName: (authorId: string) => string
    onSelect: (id: string) => void
    searchQuery: string
    onSearchChange: (q: string) => void
  }

  let {
    items,
    selectedId,
    isLoading = false,
    getAuthorName,
    onSelect,
    searchQuery,
    onSearchChange
  }: Props = $props()

  let linkFilter = $state<LinkFilter>('all')
  let isFilterOpen = $state(false)
  let filterRef = $state<HTMLDivElement | null>(null)

  const FILTER_LABELS: Record<LinkFilter, string> = {
    all: '전체',
    linked: '연결',
    unlinked: '미연결'
  }

  const filteredItems = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = items

    if (linkFilter === 'linked') {
      list = list.filter((item) => item.isLinked)
    } else if (linkFilter === 'unlinked') {
      list = list.filter((item) => !item.isLinked)
    }

    if (q) {
      list = list.filter((item) => {
        const author = getAuthorName(item.authorId).toLowerCase()
        return (
          author.includes(q) ||
          item.createdDate.toLowerCase().includes(q) ||
          item.createdAt.toLowerCase().includes(q)
        )
      })
    }

    if (linkFilter === 'all') {
      // 미연결 먼저, 그 다음 연결
      list = [...list].sort((a, b) => {
        if (a.isLinked === b.isLinked) return 0
        return a.isLinked ? 1 : -1
      })
    }

    return list
  })

  function formatTitle(item: FieldNoteListVM): string {
    const author = getAuthorName(item.authorId)
    const datePart = item.createdDate
      .replaceAll('/', '')
      .replaceAll('.', '')
      .replaceAll('-', '')
    return `${author}_${datePart}_필드노트`
  }

  function toggleFilter(e: MouseEvent) {
    e.stopPropagation()
    isFilterOpen = !isFilterOpen
  }

  function selectFilter(value: LinkFilter) {
    linkFilter = value
    isFilterOpen = false
  }

  function handleDocClick(e: MouseEvent) {
    if (!isFilterOpen) return
    if (filterRef && !filterRef.contains(e.target as Node)) {
      isFilterOpen = false
    }
  }
</script>

<svelte:window onclick={handleDocClick} />

<aside class="flex h-full w-full flex-col bg-white">
  <!-- 검색 -->
  <div class="px-4 pt-5 pb-3">
    <Typography
      variant="body-02-normal-medium"
      className="mb-1.5 text-gray-700"
    >
      검색
    </Typography>
    <div class="relative">
      <input
        type="text"
        placeholder="검색어를 입력해주세요"
        value={searchQuery}
        oninput={(e) =>
          onSearchChange((e.currentTarget as HTMLInputElement).value)}
        class="h-9 w-full rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-[13px] text-gray-700 outline-none transition-colors placeholder:text-placeholder focus:border-gray-300"
      />
      <svg
        class="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  </div>

  <!-- 목록 라벨 + 필터 -->
  <div class="flex items-center justify-between px-4 pt-2 pb-2">
    <Typography variant="body-02-normal-medium" className="text-gray-700">
      목록
    </Typography>
    <div bind:this={filterRef} class="relative">
      <button
        type="button"
        onclick={toggleFilter}
        aria-label="필터"
        aria-expanded={isFilterOpen}
        class="flex h-6 items-center gap-1 rounded px-1.5 text-label-02-normal-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        {#if linkFilter !== 'all'}
          <span>{FILTER_LABELS[linkFilter]}</span>
        {/if}
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          class="text-gray-400"
        >
          <path
            d="M2 3h12l-4.5 5.5V13L6.5 11V8.5L2 3Z"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      {#if isFilterOpen}
        <div class="dropdown-panel absolute top-full right-0 z-20 mt-1">
          {#each ['all', 'linked', 'unlinked'] as LinkFilter[] as value}
            <button
              type="button"
              onclick={() => selectFilter(value)}
              class="dropdown-item {linkFilter === value ? 'is-selected' : ''}"
            >
              {FILTER_LABELS[value]}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- 리스트 -->
  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
    {#if isLoading && items.length === 0}
      <div class="flex items-center justify-center py-8">
        <span class="text-xs text-gray-400">불러오는 중...</span>
      </div>
    {:else if filteredItems.length === 0}
      <div class="flex items-center justify-center py-8">
        <span class="text-xs text-gray-400">
          {searchQuery ? '검색 결과가 없어요' : '필드노트가 없어요'}
        </span>
      </div>
    {:else}
      <ul class="flex flex-col gap-2">
        {#each filteredItems as item (item.id)}
          {@const isActive = item.id === selectedId}
          <li>
            <button
              type="button"
              onclick={() => onSelect(item.id)}
              class="group relative flex h-[84px] w-full items-center gap-3 rounded-lg px-4 text-left transition-colors {isActive
                ? 'bg-gray-50'
                : 'hover:bg-gray-50'}"
            >
              <div class="flex min-w-0 flex-1 flex-col">
                <Typography
                  variant="label-01-normal-regular"
                  color="text-gray-500"
                >
                  {item.createdDate}
                </Typography>
                <Typography
                  variant="body-01-normal-medium"
                  color="text-gray-900"
                  className="truncate-safe block mt-2"
                >
                  {formatTitle(item)}
                </Typography>
                <Typography
                  variant="label-01-normal-regular"
                  color="text-gray-400"
                  className="mt-1.5"
                >
                  {item.durationText}
                </Typography>
              </div>
              {#if item.isLinked}
                <span
                  class="shrink-0 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-[12px] font-medium text-green-700"
                >
                  연결됨
                </span>
              {:else}
                <span
                  class="shrink-0 inline-flex items-center rounded-md bg-gray-200 px-2 py-1 text-[12px] font-medium text-gray-600"
                >
                  미연결
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</aside>
