<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { auth } from '$lib/stores/auth'
  import { sessionTimer } from '$lib/stores/session.svelte'
  import { modalStore } from '$lib/stores/modal'
  import SessionTimeoutModal from '$lib/components/modal/SessionTimeoutModal.svelte'
  import FloatingMemoButton from '$lib/components/FloatingMemoButton.svelte'
  import { page } from '$app/stores'
  import axios from 'axios'
  import type { LayoutData } from './$types'

  let { children, data }: { children: any; data: LayoutData } = $props()
  let ready = $state(false)

  // ─── 세션 타임아웃 (만료 2분 전 경고) ───
  const WARNING_AT = 2 * 60

  let warningShown = false
  let sessionModalId: string | null = null

  $effect(() => {
    if (sessionTimer.remaining <= WARNING_AT && sessionTimer.remaining > 0 && !warningShown) {
      warningShown = true
      showWarning()
    }
    if (sessionTimer.remaining <= 0 && warningShown) {
      forceLogout()
    }
  })

  function showWarning() {
    sessionModalId = modalStore.open({
      component: SessionTimeoutModal,
      props: {
        initialSeconds: WARNING_AT,
        onExtend: handleExtend,
        onLogout: forceLogout
      },
      options: { size: 'sm', persistent: true, closeOnBackdropClick: false, closeOnEscape: false }
    })
  }

  function handleExtend() {
    sessionModalId = null
    warningShown = false
    sessionTimer.reset()
  }

  async function forceLogout() {
    sessionTimer.stop()
    if (sessionModalId) {
      modalStore.close(sessionModalId)
      sessionModalId = null
    }
    try {
      await axios.post('/api/auth/logout')
    } catch { /* ignore */ }
    auth.logout()
    goto('/login')
  }

  onMount(() => {
    if (data.user) {
      auth.login(data.user)
    }
    ready = true

    if (browser) {
      sessionTimer.start()
    }
  })

  onDestroy(() => {
    sessionTimer.stop()
  })
</script>

{#if ready}
  {@render children?.()}
  {#if !$page.url.pathname.startsWith('/cs-memos')}
    <FloatingMemoButton />
  {/if}
{/if}
