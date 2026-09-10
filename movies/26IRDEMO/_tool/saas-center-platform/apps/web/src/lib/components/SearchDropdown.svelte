<style>
  /* 스크롤바 스타일링 */
  :global(.search-dropdown-scroll)::-webkit-scrollbar {
    width: 6px;
  }

  :global(.search-dropdown-scroll)::-webkit-scrollbar-track {
    background: transparent;
  }

  :global(.search-dropdown-scroll)::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  :global(.search-dropdown-scroll)::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts" generics="T">
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import type { Snippet } from 'svelte'

  interface Props {
    /**
     * 드롭다운에 표시할 아이템 배열
     */
    items: T[]
    /**
     * 검색어 (필터링에 사용)
     */
    searchQuery?: string
    /**
     * 드롭다운 열림/닫힘 상태
     */
    isOpen: boolean
    /**
     * 아이템 선택 시 호출되는 콜백
     */
    onSelect: (item: T) => void
    /**
     * 커스텀 필터 함수 (제공하지 않으면 기본 필터링 없음)
     */
    filterFn?: (item: T, query: string) => boolean
    /**
     * 드롭다운의 최대 높이 (기본값: 280px)
     */
    maxHeight?: string
    /**
     * 빈 결과일 때 표시할 메시지
     */
    emptyMessage?: string
    /**
     * 아이템 렌더링을 위한 snippet
     */
    itemSnippet: Snippet<[T]>
    /**
     * 하단 액션 버튼을 위한 선택적 snippet
     */
    actionSnippet?: Snippet
  }

  let {
    items,
    searchQuery = '',
    isOpen,
    onSelect,
    filterFn,
    maxHeight = '280px',
    emptyMessage = '검색 결과가 없습니다',
    itemSnippet,
    actionSnippet
  }: Props = $props()

  // 필터링된 아이템 목록
  let filteredItems = $derived(
    filterFn && searchQuery.length > 0
      ? items.filter((item) => filterFn(item, searchQuery))
      : items
  )
</script>

{#if isOpen}
  <div
    transition:slide={{ duration: 300, easing: quintOut }}
    class="dropdown-panel max-h-none overflow-hidden absolute top-full right-0 left-0 z-50 mt-1"
  >
    <!-- 아이템 리스트 -->
    {#if filteredItems.length > 0}
      <div
        class="dropdown-list overflow-y-auto"
        style="max-height: {maxHeight}"
      >
        {#each filteredItems as item}
          <button onclick={() => onSelect(item)} class="dropdown-item h-auto">
            {@render itemSnippet(item)}
          </button>
        {/each}
      </div>
    {:else}
      <!-- 빈 결과 메시지 -->
      <div
        class="px-2 py-8 text-center text-body-02-normal-regular text-gray-400"
      >
        {emptyMessage}
      </div>
    {/if}

    <!-- 액션 버튼 영역 -->
    {#if actionSnippet}
      <div class="mt-1 border-t border-gray-100 pt-1">
        {@render actionSnippet()}
      </div>
    {/if}
  </div>
{/if}
