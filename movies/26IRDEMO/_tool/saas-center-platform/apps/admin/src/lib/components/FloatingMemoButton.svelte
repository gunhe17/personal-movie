<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { browser } from '$app/environment'
  import { onDestroy } from 'svelte'
  import FloatingMemoPanel from './FloatingMemoPanel.svelte'
  import Phone40 from '../assets/Phone40.svelte'

  let isPanelOpen = $state(false)

  function togglePanel() {
    isPanelOpen = !isPanelOpen
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') isPanelOpen = false
  }

  if (browser) {
    window.addEventListener('keydown', handleKeydown)
    onDestroy(() => window.removeEventListener('keydown', handleKeydown))
  }
</script>

<FloatingMemoPanel open={isPanelOpen} onClose={() => (isPanelOpen = false)} />

<button
  onclick={togglePanel}
  class={twMerge(
    'fixed bottom-6 right-6 z-10001 flex h-12 w-12 items-center justify-center rounded-full',
    'shadow-lg transition-all active:scale-95',
    isPanelOpen
      ? 'bg-gray-600 text-white hover:bg-gray-700'
      : 'bg-primary-500 text-white opacity-40 hover:opacity-100 hover:bg-primary-600 hover:shadow-xl'
  )}
  aria-label={isPanelOpen ? '메모 패널 닫기' : '빠른 메모 작성'}
  title={isPanelOpen ? '메모 패널 닫기' : '빠른 메모 작성'}
>
  {#if isPanelOpen}
    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  {:else}
    <Phone40 />
  {/if}
</button>
