<script lang="ts">
  import { onMount } from 'svelte'
  import { twMerge } from 'tailwind-merge'
  import { modalStore, type ModalConfig } from '../../stores/modal'
  import { fade } from 'svelte/transition'

  interface ModalState {
    modals: ModalConfig[]
    isOpen: boolean
  }

  let modalState = $state<ModalState>({ modals: [], isOpen: false })
  let modalHeights = $state<Record<string, number>>({})

  let originalBodyOverflow = ''
  let originalBodyPaddingRight = ''
  let scrollbarWidth = 0

  const unsubscribe = modalStore.subscribe((state: ModalState) => {
    const wasOpen = modalState.isOpen
    modalState = state
    if (modalState.isOpen && !wasOpen) lockBodyScroll()
    else if (!modalState.isOpen && wasOpen) unlockBodyScroll()
  })

  /* ---------------- body scroll lock ---------------- */

  const calculateScrollbarWidth = () => {
    if (scrollbarWidth) return scrollbarWidth

    const outer = document.createElement('div')
    outer.style.cssText =
      'visibility:hidden;overflow:scroll;width:100px;height:100px;position:absolute;top:-9999px;'
    document.body.appendChild(outer)

    const inner = document.createElement('div')
    inner.style.width = '100%'
    outer.appendChild(inner)

    scrollbarWidth = outer.offsetWidth - inner.offsetWidth
    document.body.removeChild(outer)
    return scrollbarWidth
  }

  function hasScrollbar() {
    return (
      document.documentElement.scrollHeight >
      document.documentElement.clientHeight
    )
  }

  function lockBodyScroll() {
    const body = document.body
    const html = document.documentElement

    originalBodyOverflow = body.style.overflow
    originalBodyPaddingRight = body.style.paddingRight

    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'

    if (hasScrollbar()) {
      body.style.paddingRight = calculateScrollbarWidth() + 'px'
    }
  }

  function unlockBodyScroll() {
    const body = document.body
    const html = document.documentElement

    body.style.overflow = originalBodyOverflow
    body.style.paddingRight = originalBodyPaddingRight
    html.style.overflow = ''
  }

  /* ---------------- ESC close ---------------- */

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && modalState.modals.length) {
      const top = modalState.modals.at(-1)
      if (top?.options?.closeOnEscape !== false) {
        modalStore.close()
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      unsubscribe()
      unlockBodyScroll()
    }
  })

  /* ---------------- backdrop click ---------------- */

  const handleBackdropClick = (id: string) => (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return
    const modal = modalState.modals.find((m) => m.id === id)
    if (modal?.options?.closeOnBackdropClick !== false) modalStore.close(id)
  }

  /* ---------------- modal height tracking ---------------- */

  const modalAction = (node: HTMLDivElement, id: string) => {
    let rafId = 0
    const update = () => {
      modalHeights[id] = node.offsetHeight
    }
    const scheduleUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(update)
    }
    update()

    const ro = new ResizeObserver(scheduleUpdate)
    ro.observe(node)
    window.addEventListener('resize', scheduleUpdate)

    return {
      destroy() {
        if (rafId) cancelAnimationFrame(rafId)
        ro.disconnect()
        window.removeEventListener('resize', scheduleUpdate)
        delete modalHeights[id]
      }
    }
  }

  /* ---------------- stack position ---------------- */

  const OFFSET = 20

  const getStackHeight = () => {
    let maxBottom = 0
    modalState.modals.forEach((modal, i) => {
      const h = modalHeights[modal.id] ?? 300
      const bottom = i * OFFSET + h
      if (bottom > maxBottom) maxBottom = bottom
    })
    return maxBottom
  }

  const getStackOffset = () => {
    const viewport = window.innerHeight
    return Math.max((viewport - getStackHeight()) / 2, 20)
  }

  const getDepth = (index: number, total: number) => {
    return total - index - 1
  }

  /* ---------------- size class ---------------- */

  const getSizeClass = (size = 'md') => {
    const map: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      wide: 'max-w-4xl',
      full: 'max-w-full mx-4',
      fit: 'max-w-fit mx-4'
    }
    return map[size] || map.md
  }

  let animatedOffset = $state(0)
  let prevOffset = 0

  $effect(() => {
    const next = getStackOffset()
    const diff = next - prevOffset

    const MAX_MOVE = 10

    if (Math.abs(diff) > MAX_MOVE) {
      animatedOffset = prevOffset + Math.sign(diff) * MAX_MOVE
    } else {
      animatedOffset = next
    }

    prevOffset = animatedOffset
  })
</script>

{#if modalState.modals.length > 0}
  {@const topModal = modalState.modals[modalState.modals.length - 1]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 bg-black/50 flex justify-center pointer-events-auto"
    style="z-index:10000"
    onclick={handleBackdropClick(topModal.id)}
  >
    <!-- stack wrapper -->
    <div
      class="relative w-full flex justify-center pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      style="transform:translateY({animatedOffset}px)"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      {#each modalState.modals as modal, index (modal.id)}
        {@const depth = getDepth(index, modalState.modals.length)}
        <div
          use:modalAction={modal.id}
          class={twMerge(
            'absolute left-1/2 -translate-x-1/2 w-full rounded-2xl bg-white shadow-xl overflow-hidden pointer-events-auto flex flex-col',
            modal.options?.customWidth || modal.options?.customHeight
              ? ''
              : getSizeClass(modal.options?.size),
            !modal.options?.customHeight ? 'max-h-[90vh]' : ''
          )}
          style={`
            top:${index * OFFSET}px;
            ${
              modal.options?.customWidth
                ? `width:${modal.options.customWidth}px; max-width:${modal.options.customWidth}px;`
                : ''
            }
            ${
              modal.options?.customHeight
                ? `height:min(${modal.options.customHeight}px,90vh);`
                : ''
            }
          `}
          onclick={(e) => e.stopPropagation()}
        >
          <!-- svelte-ignore svelte_component_deprecated -->
          <svelte:component
            this={modal.component}
            {...modal.props}
            modalId={modal.id}
            closeModal={() => modalStore.close(modal.id)}
          />
          {#if depth > 0}
            <!-- svelte-ignore element_invalid_self_closing_tag -->
            <div
              in:fade={{ duration: 200 }}
              class="absolute inset-0 pointer-events-auto rounded-2xl"
              style="background: rgba(0,0,0,{Math.min(0.4, depth * 0.12)});"
            />
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
