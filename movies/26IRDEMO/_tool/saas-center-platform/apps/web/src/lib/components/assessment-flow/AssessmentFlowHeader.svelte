<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getMeAssessment } from '$lib/hooks/actions/auth.action'
  import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'
  import { assessmentCenterStore } from '$lib/stores/assessment-center.store'
  import { centerStore } from '$lib/stores/center.store'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'

  // AppTopBar와 동일: GET auth/me로 표시 이름·센터 목록 파생
  const meQuery = queryBuilder(getMeAssessment)
  $effect(() => {
    const centers = meQuery.data?.centers
    if (centers?.length) {
      assessmentCenterStore.setCenters(centers)
      centerStore.setCenters(centers)
    }
  })
  const displayName = $derived(
    meQuery.data?.person?.name ??
      meQuery.data?.account?.email ??
      $assessmentAuthStore.user?.name ??
      ''
  )
  const userInitial = $derived(displayName ? displayName.slice(0, 1) : '')
  const loggedInUserRole = $derived($assessmentAuthStore.user?.role ?? '')

  let dropdownOpen = $state(false)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let menuRef = $state<HTMLDivElement | null>(null)

  const centerId = $derived(page.params?.centerId ?? null)
  const centerName = $derived.by(() => {
    if (!centerId) return ''
    const state = $assessmentCenterStore
    const center = state.centers.find((c) => c.id === centerId)
    return center?.name ?? ''
  })

  const roleLabel = $derived.by(() => {
    const r = loggedInUserRole.toLowerCase()
    if (
      r === 'admin' ||
      r === 'manage' ||
      r.includes('admin') ||
      r.includes('manage')
    )
      return '관리자'
    if (r === 'counselor' || r.includes('counselor')) return '상담사'
    return loggedInUserRole || '관리자'
  })

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen
  }

  function handleLogout() {
    dropdownOpen = false
    void assessmentAuthStore.logout().then(() => {
      goto('/assessment-flow/login')
    })
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as Node
    if (
      dropdownOpen &&
      triggerRef &&
      !triggerRef.contains(target) &&
      menuRef &&
      !menuRef.contains(target)
    ) {
      dropdownOpen = false
    }
  }

  onMount(() => {
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  })
</script>

<header
  class="relative min-h-[44px] h-11 border-b border-gray-200 bg-white px-3 sm:px-6 flex items-center justify-between shrink-0"
>
  <div class="flex items-center min-w-0">
    <MindScopeLogo />
  </div>
  <div class="relative flex items-center min-w-0">
    <button
      type="button"
      bind:this={triggerRef}
      onclick={toggleDropdown}
      class="flex items-center gap-2 text-gray-600 hover:text-gray-800 active:opacity-80 transition-opacity cursor-pointer min-h-[44px] touch-manipulation min-w-0"
      aria-expanded={dropdownOpen}
      aria-haspopup="true"
    >
      <span class="text-sm truncate-safe max-w-[120px] sm:max-w-none"
        >{displayName}</span
      >
      {#if userInitial}
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-medium text-white"
        >
          {userInitial}
        </span>
      {/if}
      <svg
        class="h-4 w-4 text-gray-500 transition-transform {dropdownOpen
          ? 'rotate-180'
          : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>

    {#if dropdownOpen}
      <div
        bind:this={menuRef}
        class="absolute right-0 top-full z-50 mt-1 w-[min(calc(100vw-2rem),16rem)] sm:w-64 overflow-hidden rounded-lg border border-gray-200 bg-white py-4 shadow-lg"
      >
        <div class="flex flex-col items-center px-4 pb-4">
          {#if userInitial}
            <span
              class="mb-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-xl font-medium text-white"
            >
              {userInitial}
            </span>
          {/if}
          <div class="flex items-center gap-2">
            <span class="text-base font-semibold text-gray-900">
              {displayName}
            </span>
            <span
              class="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"
            >
              {roleLabel}
            </span>
          </div>
          {#if centerName}
            <p class="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
              <svg
                class="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {centerName}
            </p>
          {/if}
        </div>
        <div class="border-t border-gray-100"></div>
        <div class="px-4 pt-3">
          <button
            type="button"
            onclick={handleLogout}
            class="w-full rounded-lg py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>
