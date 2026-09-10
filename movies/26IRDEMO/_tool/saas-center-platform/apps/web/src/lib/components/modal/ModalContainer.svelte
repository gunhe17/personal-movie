<script lang="ts">
  import { onMount } from 'svelte'
  import { twMerge } from 'tailwind-merge'
  import { modalStore, type ModalConfig } from '../../stores/modal'
  import { fade, fly } from 'svelte/transition'
  import { cubicOut, cubicIn } from 'svelte/easing'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isNotDesktop = $derived(!responsive.isDesktop)

  const MOBILE_FULL_SIZES = new Set([
    'lg',
    'xl',
    'wide',
    'wideXl',
    'fit',
    'full',
    'custom500',
    'tall',
    'narrow'
  ])

  function shouldMobileFullWidth(modal: ModalConfig): boolean {
    if (!isNotDesktop) return false
    if (modal.options?.customWidth) return true
    return MOBILE_FULL_SIZES.has(modal.options?.size ?? '')
  }

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

  /** 이중 모달일 때 최상위 모달의 top을 뷰포트 중앙 기준으로 계산 */
  const getModalTop = (index: number) => {
    if (modalState.modals.length <= 1 || index < modalState.modals.length - 1) {
      return index * OFFSET
    }
    // 최상위 모달: 뷰포트 중앙에 배치
    const viewport = window.innerHeight
    const modal = modalState.modals[index]
    const h = modalHeights[modal.id] ?? 300
    return Math.max((viewport - h) / 2 - animatedOffset, 20)
  }

  const getDepth = (index: number, total: number) => {
    return total - index - 1
  }

  /* ---------------- 겹침 순서 (나중에 연 모달이 위) ----------------
     중앙 모달은 transform이 걸린 stack wrapper 안에 모여 있어(= 별도 쌓임 맥락) 자식
     z-index가 하단 시트와 겨루지 못한다. 그래서 wrapper 자체에 "가장 나중에 열린 중앙
     모달의 순번"을, 하단 시트에는 각자의 순번을 z-index로 준다.
     이게 없으면 하단 시트가 DOM상 뒤라는 이유만으로 그 위에서 연 중앙 모달을 가린다
     (상담일지 시트에서 연 전달문 모달이 시트 뒤로 숨던 문제). */
  const centerStackZ = $derived(
    modalState.modals.reduce(
      (z, modal, i) => (modal.options?.placement !== 'bottom' ? i + 1 : z),
      0
    )
  )

  /* ---------------- size class ---------------- */

  // 폭은 Web_Design.md §modal의 4단 규격을 따른다 — 540 / 640 / 740 / 1000.
  // Tailwind 기본 max-w-* 스케일(384/448/512/576/896)은 이 규격과 대응이 없어 폐기.
  // 740 = 좌우 2단 구성 모달(달력+선택 목록 등) 전용 구간.
  const getSizeClass = (size = 'md') => {
    const map: Record<string, string> = {
      sm: 'max-w-[540px]',
      md: 'max-w-[640px]',
      lg: 'max-w-[640px]',
      xl: 'max-w-[740px]',
      wide: 'max-w-[1000px]',
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
    class="fixed inset-0 flex justify-center pointer-events-auto"
    style="z-index:10000"
  >
    <!-- backdrop (fade in/out) -->
    <div
      class="absolute inset-0 bg-black/50"
      in:fade={{ duration: 220, easing: cubicOut }}
      out:fade={{ duration: 180, easing: cubicIn }}
      onclick={handleBackdropClick(topModal.id)}
    ></div>

    <!-- stack wrapper (center modals) -->
    <div
      class="relative w-full flex justify-center pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
      style="transform:translateY({animatedOffset}px); z-index:{centerStackZ}"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      {#each modalState.modals as modal, index (modal.id)}
        {#if modal.options?.placement !== 'bottom'}
          {@const depth = getDepth(index, modalState.modals.length)}
          {@const mobileFullWidth = shouldMobileFullWidth(modal)}
          <!-- positioning wrapper -->
          <div
            class={twMerge(
              'absolute left-1/2 -translate-x-1/2 w-full pointer-events-auto isolate',
              modal.options?.isReceipt ? 'rounded-none' : 'rounded-[20px]',
              mobileFullWidth
                ? ''
                : modal.options?.customWidth || modal.options?.customHeight
                  ? ''
                  : getSizeClass(modal.options?.size),
              !modal.options?.customHeight ? 'max-h-[90vh]' : ''
            )}
            style={`
              top:${getModalTop(index)}px;
              transition: width 0.25s ease-out, max-width 0.25s ease-out;
              ${
                mobileFullWidth
                  ? 'width: calc(100vw - 32px); max-width: calc(100vw - 32px);'
                  : modal.options?.customWidth
                    ? `width:${modal.options.customWidth}px; max-width:${modal.options.customWidth}px;`
                    : ''
              }
              ${
                modal.options?.customHeight
                  ? `height:min(${modal.options.customHeight}px,90vh);`
                  : ''
              }
            `}
          >
            <div
              use:modalAction={modal.id}
              class={twMerge(
                'relative h-full w-full rounded-[20px] bg-white shadow-xl overflow-hidden flex flex-col',
                !modal.options?.customHeight ? 'max-h-[90vh]' : '',
                modal.options?.isReceipt ? 'receipt-modal rounded-none!' : ''
              )}
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
                  class="absolute inset-0 pointer-events-auto rounded-[20px]"
                  style="background: rgba(0,0,0,{Math.min(0.4, depth * 0.12)});"
                />
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- bottom-sheet modals (화면 하단 고정, 아래에서 위로 슬라이드) -->
    {#each modalState.modals as modal, index (modal.id + '-bottom')}
      {#if modal.options?.placement === 'bottom'}
        {@const mobileFullWidth = shouldMobileFullWidth(modal)}
        {@const depth = getDepth(index, modalState.modals.length)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none"
          style="z-index:{index + 1}"
        >
          <div
            class={twMerge(
              'pointer-events-auto w-full',
              mobileFullWidth || modal.options?.customWidth
                ? ''
                : getSizeClass(modal.options?.size)
            )}
            style={`
              ${
                mobileFullWidth
                  ? 'width: calc(100vw - 32px); max-width: calc(100vw - 32px);'
                  : modal.options?.customWidth
                    ? `width:${modal.options.customWidth}px; max-width:${modal.options.customWidth}px;`
                    : ''
              }
              max-height: 90vh;
            `}
            onclick={(e) => e.stopPropagation()}
            in:fly={{ y: 500, duration: 380, easing: cubicOut, opacity: 1 }}
            out:fly={{ y: 500, duration: 250, easing: cubicIn, opacity: 1 }}
          >
            <div
              class={twMerge(
                'relative flex h-full max-h-[90vh] w-full flex-col bg-white shadow-xl',
                modal.options?.overflowVisible
                  ? 'overflow-visible rounded-t-[24px]'
                  : 'overflow-hidden rounded-t-[24px]'
              )}
            >
              <!-- svelte-ignore svelte_component_deprecated -->
              <svelte:component
                this={modal.component}
                {...modal.props}
                modalId={modal.id}
                closeModal={() => modalStore.close(modal.id)}
              />
            </div>
          </div>
          {#if depth > 0}
            <!-- 위에 다른 모달이 떠 있을 때의 딤.
                 하단 시트는 자기 면 바깥으로 나가는 요소(상단 참여자 탭)가 있고
                 overflowVisible이면 모서리도 면 밖으로 새므로, 면 안쪽(inset-0)이 아니라
                 화면 전체를 덮어야 시트 전체가 균일하게 어두워진다. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              in:fade={{ duration: 200 }}
              class="fixed inset-0 pointer-events-auto"
              style="background: rgba(0,0,0,{Math.min(0.4, depth * 0.12)});"
              onclick={handleBackdropClick(topModal.id)}
            ></div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}
