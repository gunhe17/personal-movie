<script lang="ts">
  import { portal } from '$lib/utils/positionPortal'
  import { fly } from 'svelte/transition'

  export interface KebabMenuItem {
    label: string
    onClick: () => void
    variant?: 'default' | 'danger'
  }

  interface Props {
    items?: KebabMenuItem[]
  }

  let { items = [] }: Props = $props()

  let isOpen = $state(false)
  let buttonEl: HTMLButtonElement | null = $state(null)

  const hasItems = $derived(items.length > 0)

  function toggleMenu(event: MouseEvent) {
    event.stopPropagation()
    if (!hasItems) return
    isOpen = !isOpen
  }

  function handleItemClick(item: KebabMenuItem, event: MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    item.onClick()
    isOpen = false
  }

  function handleScroll() {
    if (isOpen) isOpen = false
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

<div class="relative flex items-center justify-center">
  <button
    bind:this={buttonEl}
    type="button"
    aria-label="더보기"
    class="flex items-center justify-center rounded p-1 text-gray-400 transition-colors
      {hasItems
      ? 'hover:bg-gray-100 hover:text-gray-600 cursor-pointer'
      : 'cursor-default'}"
    onclick={toggleMenu}
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="4" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="16" r="1.5" fill="currentColor" />
    </svg>
  </button>

  {#if isOpen && buttonEl}
    <div
      use:portal={{
        anchor: buttonEl,
        position: 'right',
        isFitWidth: true,
        zIndex: 9999,
        callback: () => {
          isOpen = false
        }
      }}
      class="min-w-30 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      transition:fly={{ y: -8, duration: 150 }}
    >
      {#each items as item}
        <button
          type="button"
          class="w-full whitespace-nowrap px-4 py-2 text-left text-sm transition-colors
            {item.variant === 'danger'
            ? 'text-red-500 hover:bg-red-50'
            : 'text-gray-700 hover:bg-gray-50'}"
          onclick={(e) => handleItemClick(item, e)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
