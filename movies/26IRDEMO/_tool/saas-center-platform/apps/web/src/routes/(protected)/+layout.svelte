<style>
  .layout-content {
    height: 100%;
    transition:
      transform 0.7s cubic-bezier(0.4, 0, 0.2, 1),
      filter 0.7s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center center;
  }

  .layout-content--locked {
    transform: scale(0.96);
    filter: blur(12px) brightness(0.7);
    opacity: 0.5;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { beforeNavigate } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { centerStore } from '$lib/stores/center.store'
  import { permissionStore } from '$lib/stores/permission.store'
  import {
    secretModeStore,
    secretModeType
  } from '$lib/stores/secret-mode.store'
  import RedirectOverlay from '$lib/components/RedirectOverlay.svelte'
  import SecretModeLockScreen from '$lib/components/SecretModeLockScreen.svelte'
  import SubscriptionAlertBanner from '$lib/components/SubscriptionAlertBanner.svelte'
  import type { LayoutData } from './$types'

  let { children, data }: { children: any; data: LayoutData } = $props()
  let ready = $state(false)
  let needsRedirect = $state(false)

  // 뒤로가기로 CSR 전용 agent 대화 페이지에 재진입 시 SvelteKit popstate 내비가 조용히 실패
  // (도착지 컴포넌트의 리로드 핵은 내비 실패 시 실행 기회가 없음) → 출발지에서 풀 로드로 우회
  beforeNavigate((nav) => {
    if (
      nav.type === 'popstate' &&
      nav.to?.url.pathname.includes('/agent/session/')
    ) {
      nav.cancel()
      window.location.href = nav.to.url.href
    }
  })

  const isLocked = $derived($secretModeType === 'lockscreen')

  // 잠금화면 DOM 유지용: isLocked가 false가 되어도 퇴장 애니메이션 동안 유지
  let showLockScreen = $state(false)

  $effect(() => {
    if (isLocked) {
      showLockScreen = true
    }
  })

  function handleLockScreenExited() {
    showLockScreen = false
  }

  onMount(() => {
    if (data.user) {
      auth.login(data.user)
      centerStore.initialize()
      permissionStore.load()

      const currentCenterId = centerStore.getCurrentCenterId()
      if (!currentCenterId) {
        needsRedirect = true
        return
      }
      secretModeStore.initialize(
        data.user?.email || data.user?.id,
        currentCenterId
      )
    }
    ready = true
  })
</script>

{#if needsRedirect}
  <RedirectOverlay to="/welcome" message="센터를 선택해주세요" />
{:else if ready}
  <div class="layout-content" class:layout-content--locked={isLocked}>
    <SubscriptionAlertBanner />
    {@render children?.()}
  </div>

  {#if showLockScreen}
    <SecretModeLockScreen onexited={handleLockScreenExited} />
  {/if}
{/if}
