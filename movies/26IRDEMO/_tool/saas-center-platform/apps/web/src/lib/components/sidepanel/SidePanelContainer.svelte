<script lang="ts">
  import { fly } from 'svelte/transition'
  import { browser } from '$app/environment'

  import { responsive } from '$stores/responsive.svelte'
  import { panelStore, type PanelState } from '$stores/sidePanel'

  import { clickOutside } from '$utils/clickOutside'

  let panelState: PanelState = $derived($panelStore)

  let isMobile = $derived(responsive.device === 'mobile')
  let shouldBeFullScreen = $derived(
    isMobile && panelState?.panel?.options?.fullScreenOnMobile
  )

  let zIndex = $state(50)

  $effect(() => {
    if (!browser) return

    if (panelState?.panel) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
  })

  $effect(() => {
    if (!browser || !panelState?.panel) return

    // Snackbar(z-[20000])가 항상 사이드 패널 위에 보이도록 상한선 유지
    const Z_SNACKBAR = 20000
    const allElements = Array.from(
      document.querySelectorAll<HTMLElement>('body *')
    )
    const maxZ = allElements.reduce((max, el) => {
      const z = parseInt(getComputedStyle(el).zIndex || '0', 10)
      if (isNaN(z) || z >= Z_SNACKBAR) return max
      return Math.max(max, z)
    }, 0)
    zIndex = Math.min(maxZ + 1, Z_SNACKBAR - 1)
  })

  // 배경 클릭·ESC 닫힘 비활성화 여부 (필드노트처럼 보며 작성하는 패널용)
  let disableBackdropClose = $derived(
    !!panelState?.panel?.options?.disableBackdropClose
  )

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && panelState.panel && !disableBackdropClose) {
      panelStore.close()
    }
  }

  const closePanel = () => {
    if (disableBackdropClose) return
    panelStore.close()
  }
</script>

{#if panelState && panelState.panel}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center"
    onkeydown={handleKeydown}
    transition:fly={{ duration: 300, opacity: 0 }}
    style="z-index: {zIndex};"
  >
    <div
      use:clickOutside={closePanel}
      class="fixed {shouldBeFullScreen
        ? 'inset-0 w-full'
        : `top-0 right-0 h-full ${panelState.panel?.options?.width}`} bg-white shadow-xl flex flex-col"
      transition:fly={shouldBeFullScreen
        ? { y: window.innerHeight, duration: 300, opacity: 1 }
        : { x: 400, duration: 300, opacity: 1 }}
    >
      <svelte:component
        this={panelState.panel.component}
        {...panelState.panel.props}
        panelId={panelState.panel.id}
        closePanel={() => panelStore.close()}
      />
    </div>
  </div>
{/if}
