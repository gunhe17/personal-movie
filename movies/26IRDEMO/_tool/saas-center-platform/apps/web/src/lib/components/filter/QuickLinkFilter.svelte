<script lang="ts">
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import Select from '$lib/components/Select.svelte'
  import type { SelectOptionType } from '$lib/types/common'
  import Typography from '@common/components/Typography.svelte'

  interface FilterTab {
    name: string
    count: number
    active?: boolean
  }

  interface Props {
    tabs: FilterTab[]
    searchPlaceholder?: string
    onTabChange?: (tabName: string) => void
    onSearch?: (query: string) => void
    onSortChange?: (sortOrder: 'newest' | 'oldest') => void
    sortOrder?: 'newest' | 'oldest'
  }

  let {
    tabs = $bindable(),
    searchPlaceholder = '이름, 코드로 검색',
    onTabChange,
    onSearch,
    onSortChange,
    sortOrder = $bindable('oldest')
  }: Props = $props()

  let searchQuery = $state('')

  const sortOptions: SelectOptionType[] = [
    { title: '오래된 순', value: 'oldest' },
    { title: '최신 순', value: 'newest' }
  ]

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

  function handleSelectChange(e: CustomEvent) {
    const option = e.detail as SelectOptionType
    sortOrder = option.value as 'newest' | 'oldest'
    onSortChange?.(sortOrder)
  }
</script>

<div class="mb-4 flex flex-col bg-white">
  <!-- 검색 -->
  <div
    class="flex h-11 w-90 items-center gap-2 rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2.5"
  >
    <button>
      <SearchIcon />
    </button>
    <input
      type="text"
      placeholder={searchPlaceholder}
      class="text-title-02-normal-regular grow bg-transparent outline-none placeholder:text-placeholder"
      oninput={handleSearchInput}
    />
  </div>

  <!-- 경계선 -->
  <div class="my-4 border-t border-gray-200"></div>

  <!-- 필터 탭 및 정렬 -->
  <div class="flex items-center justify-between">
    <!-- 필터 탭들 -->
    <!-- <div class="flex items-center gap-2">
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
		</div> -->
    <Typography variant="title-01-medium" color="text-gray-700">
      전체 {0}
    </Typography>

    <!-- 정렬 셀렉트 -->
    <Select
      options={sortOptions}
      selected={sortOrder}
      on:change={handleSelectChange}
      class="min-"
    />
  </div>
</div>
