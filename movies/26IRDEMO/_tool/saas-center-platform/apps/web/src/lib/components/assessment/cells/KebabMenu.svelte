<script lang="ts">
  import { portal } from '$root/src/lib/utils/positionPortal'
  import { fly } from 'svelte/transition'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import KebabIcon24 from '$lib/assets/KebabIcon24.svelte'
  import KebabIcon20 from '$lib/assets/KebabIcon20.svelte'

  interface MenuItem {
    label: string
    onClick: () => void
    variant?: 'default' | 'danger'
    /** 이 항목 위에 구분선을 그린다 (다른 성격의 액션 분리용) */
    divider?: boolean
  }

  interface Props {
    items?: MenuItem[]
    onMenuClick?: () => void
    horizontal?: boolean
    /** '더보기' 툴팁 표시 여부 (카드 등 좁은 곳에선 끔) */
    showTooltip?: boolean
    /** 아이콘 크기 — 카드/테이블 목록 24, 상세 패널 헤더 20 */
    size?: 20 | 24
  }

  let {
    items = [],
    onMenuClick,
    horizontal = false,
    showTooltip = true,
    size = 24
  }: Props = $props()

  let isOpen = $state(false)
  let buttonEl: HTMLButtonElement | null = $state(null)

  const hasItems = $derived(items.length > 0)

  function toggleMenu(event: MouseEvent) {
    event.stopPropagation()
    if (!hasItems) return
    isOpen = !isOpen
    onMenuClick?.()
  }

  function handleItemClick(item: MenuItem, event: MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    item.onClick()
    isOpen = false
  }

  function handleScroll() {
    if (isOpen) {
      isOpen = false
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('scroll', handleScroll, true)
      return () => {
        document.removeEventListener('scroll', handleScroll, true)
      }
    }
  })
</script>

<div
  class="kebab-menu-container relative flex h-full w-full items-center justify-center"
>
  {#snippet triggerButton()}
    <!-- 단독 아이콘 버튼 = 아이콘 + 패딩 8. hover 배경이 그 영역(24→40 / 20→36)에 들어온다. -->
    <button
      bind:this={buttonEl}
      type="button"
      aria-label="더보기"
      class="flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors {hasItems
        ? 'cursor-pointer hover:bg-gray-100 hover:text-gray-600'
        : 'cursor-default'}"
      onclick={toggleMenu}
    >
      {#if horizontal}
        <!-- 3-dot 아이콘 (가로) -->
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="4" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          <circle cx="16" cy="10" r="1.5" fill="currentColor" />
        </svg>
      {:else}
        <!-- 3-dot 아이콘 (세로, 우측 정렬 자산) — 전 화면 케밥 공통 -->
        {#if size === 20}
          <KebabIcon20 color="currentColor" />
        {:else}
          <KebabIcon24 color="currentColor" />
        {/if}
      {/if}
    </button>
  {/snippet}

  {#if showTooltip}
    <Tooltip text="더보기">
      {@render triggerButton()}
    </Tooltip>
  {:else}
    {@render triggerButton()}
  {/if}
  {#if isOpen}
    <div
      use:portal={{
        anchor: buttonEl!,
        position: 'right',
        callback: () => {
          isOpen = false
        }
      }}
      class="dropdown-panel fixed z-9999"
      transition:fly={{ y: -8, duration: 150 }}
    >
      {#each items as item}
        {#if item.divider}
          <div class="dropdown-divider"></div>
        {/if}
        <button
          type="button"
          class="dropdown-item {item.variant === 'danger' ? 'is-danger' : ''}"
          onclick={(e) => handleItemClick(item, e)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
