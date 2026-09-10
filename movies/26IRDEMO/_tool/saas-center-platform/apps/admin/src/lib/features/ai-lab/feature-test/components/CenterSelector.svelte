<script lang="ts">
  import { getCenterList } from '$lib/hooks/actions/center.action'
  import type { CenterSummary } from '$lib/hooks/actions/center.action'

  let {
    selectedCenterId = '',
    onSelect,
  }: {
    selectedCenterId?: string
    onSelect: (centerId: string, centerName: string) => void
  } = $props()

  let search = $state('')
  let results = $state<CenterSummary[]>([])
  let loading = $state(false)
  let showDropdown = $state(false)
  let selectedName = $state('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value
    search = value
    selectedName = ''

    if (debounceTimer) clearTimeout(debounceTimer)
    if (value.length < 1) {
      results = []
      showDropdown = false
      return
    }
    debounceTimer = setTimeout(() => searchCenters(value), 300)
  }

  async function searchCenters(query: string) {
    loading = true
    try {
      const res = await getCenterList().request({ search: query, skip: 0, limit: 10 })
      results = res?.items ?? []
      showDropdown = true
    } catch {
      results = []
    } finally {
      loading = false
    }
  }

  function selectCenter(center: CenterSummary) {
    selectedName = center.name
    search = center.name
    showDropdown = false
    onSelect(center.id, center.name)
  }

  function handleBlur() {
    setTimeout(() => { showDropdown = false }, 200)
  }
</script>

<div class="relative">
  <div class="flex items-center gap-3">
    <div class="relative flex-1">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
        <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
      </div>
      <input
        type="text"
        class="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-body-03-normal-regular outline-none placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        placeholder="센터 이름 또는 코드로 검색..."
        value={search}
        oninput={handleInput}
        onfocus={() => { if (results.length > 0 && !selectedName) showDropdown = true }}
        onblur={handleBlur}
      />
      {#if loading}
        <div class="absolute inset-y-0 right-0 flex items-center pr-3">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500"></div>
        </div>
      {/if}
    </div>

    {#if selectedCenterId}
      <span class="shrink-0 rounded-full bg-primary-50 px-3 py-1 text-label-01-normal-medium text-primary-700">
        선택됨
      </span>
    {/if}
  </div>

  {#if showDropdown}
    <div class="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
      {#if results.length === 0}
        <div class="px-4 py-3 text-center text-body-03-normal-regular text-gray-400">
          검색 결과가 없습니다
        </div>
      {:else}
        {#each results as center}
          <button
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50
              {center.id === selectedCenterId ? 'bg-primary-50' : ''}"
            onmousedown={() => selectCenter(center)}
          >
            <div class="min-w-0 flex-1">
              <p class="text-body-03-normal-medium text-gray-900 truncate">{center.name}</p>
              <p class="text-label-01-normal-regular text-gray-400">{center.code}</p>
            </div>
            <span class="shrink-0 rounded px-2 py-0.5 text-label-01-normal-medium
              {center.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}">
              {center.is_active ? '활성' : '비활성'}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
