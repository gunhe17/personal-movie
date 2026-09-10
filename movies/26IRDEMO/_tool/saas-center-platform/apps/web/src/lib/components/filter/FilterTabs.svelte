<script lang="ts">
  import SearchIcon from '$lib/assets/SearchIcon.svelte'

  interface FilterTab {
    name: string
    count: number
    active?: boolean
  }

  interface Props {
    tabs: FilterTab[]
    searchPlaceholder?: string
    searchValue?: string
    onTabChange?: (tabName: string) => void
    onSearch?: (query: string) => void
    onChipFilterChange?: (chipFilter: 'online' | 'offline') => void
    showChipFilters?: boolean
    chipFilter?: 'online' | 'offline'
  }

  let {
    tabs = $bindable(),
    searchPlaceholder = '검색',
    searchValue = '',
    onTabChange,
    onSearch,
    onChipFilterChange,
    showChipFilters = false,
    chipFilter = $bindable('offline')
  }: Props = $props()

  let searchQuery = $state(searchValue)

  // searchValue prop이 변경되면 searchQuery도 업데이트
  $effect(() => {
    searchQuery = searchValue
  })

  function handleTabClick(tabName: string) {
    tabs = tabs.map((tab) => ({
      ...tab,
      active: tab.name === tabName
    }))
    onTabChange?.(tabName)
  }

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement
    searchQuery = target.value
    onSearch?.(searchQuery)
  }

  function handleChipClick(filter: 'online' | 'offline') {
    chipFilter = filter
    onChipFilterChange?.(filter)
  }
</script>

<div class="flex flex-col gap-4 bg-white">
  <!-- 탭 필터 및 검색 -->
  <div class="flex items-center justify-between">
    <!-- 필터 탭들 -->
    <div class="flex items-center gap-2">
      {#each tabs as tab}
        <button
          onclick={() => handleTabClick(tab.name)}
          class="flex h-[44px] w-[160px] items-center justify-between gap-2 rounded-[10px] border px-4 transition-colors {tab.active
            ? 'border-[#4C87F6] bg-[#f4f8ff] text-gray-900'
            : 'border-gray-100 bg-white text-gray-400 hover:text-gray-600'}"
        >
          <span class="text-title-02-normal-semibold">{tab.name}</span>
          <span class="text-title-02-normal-semibold text-[#256EF4]">
            {tab.count}
          </span>
        </button>
      {/each}
    </div>

    <!-- 검색 -->
    <div
      class="flex h-[44px] w-90 items-center gap-2 rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2.5"
    >
      <button>
        <SearchIcon />
      </button>
      <input
        type="text"
        value={searchQuery}
        placeholder={searchPlaceholder}
        class="text-title-02-normal-regular grow bg-transparent outline-none placeholder:text-placeholder"
        oninput={handleSearchInput}
      />
    </div>
  </div>

  <!-- 칩 필터 -->
  {#if showChipFilters}
    <div class="flex items-center gap-2">
      <button
        onclick={() => handleChipClick('offline')}
        class="flex h-[32px] items-center rounded-full px-4 transition-colors {chipFilter ===
        'offline'
          ? 'bg-gray-900 text-white'
          : 'border border-gray-200 bg-white text-gray-300 '}"
      >
        <span class="text-label-01-normal-medium">오프라인 전용</span>
      </button>
      <button
        onclick={() => handleChipClick('online')}
        class="flex h-[32px] items-center rounded-full px-4 transition-colors {chipFilter ===
        'online'
          ? 'bg-gray-900 text-white'
          : 'border border-gray-200 bg-white text-gray-300 '}"
      >
        <span class="text-label-01-normal-medium">온라인 전용</span>
      </button>
    </div>
  {/if}
</div>
