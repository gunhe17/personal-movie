<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fly, fade } from 'svelte/transition'

  interface Props {
    open: boolean
    onClose: () => void
    side?: 'left' | 'right'
    hideAt?: 'lg' | 'xl'
    panelClass?: string
    children: Snippet
  }

  let {
    open,
    onClose,
    side = 'left',
    hideAt = 'lg',
    panelClass = '',
    children
  }: Props = $props()

  $effect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  })

  let hiddenClass = $derived(hideAt === 'lg' ? 'lg:hidden' : 'xl:hidden')
  let positionClass = $derived(side === 'left' ? 'left-0' : 'right-0')
  let flyX = $derived(side === 'left' ? -320 : 320)
</script>

{#if open}
  <div class="fixed inset-0 z-[60] {hiddenClass}">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/50"
      onclick={onClose}
      transition:fade={{ duration: 200 }}
    ></div>

    <div
      class="absolute inset-y-0 {positionClass} flex flex-col {panelClass}"
      transition:fly={{ x: flyX, duration: 250 }}
    >
      {@render children()}
    </div>
  </div>
{/if}
