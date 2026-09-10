<script lang="ts">
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getMe,
    type MeResponse,
    type MeCenterSummary
  } from '$lib/hooks/actions/auth.action'
  import { centerId } from '$lib/stores/center.store'
  import NotificationBell from '$lib/features/notification/components/NotificationBell.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import Typography from '@common/components/Typography.svelte'
  import defaultLogo from '$lib/assets/DefaultLogoBlue.svg'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    centerName: string
    centerLogo: string
    isOverlayMode: boolean
    onMenuOpen: () => void
  }

  let { centerName, centerLogo, isOverlayMode, onMenuOpen }: Props = $props()

  const meQuery = queryBuilder(getMe)
  const meData = $derived(meQuery.data as MeResponse | undefined)

  const userName = $derived(
    meData?.person?.name ??
      meData?.account?.email ??
      $auth.user?.name ??
      '사용자'
  )
  const userEmail = $derived(meData?.account?.email ?? $auth.user?.email ?? '')
  const currentCenter = $derived.by(() => {
    const cid = $centerId
    if (!cid || !meData?.centers) return null
    return meData.centers.find((c: MeCenterSummary) => c.id === cid) ?? null
  })
  const userRole = $derived(currentCenter?.role_name ?? '')
  const avatarBg = $derived((currentCenter?.color as string) ?? '#22c55e')

  // 유저 드롭다운 메뉴
  let showUserMenu = $state(false)
  let userMenuRef: HTMLElement | null = $state(null)

  $effect(() => {
    if (!showUserMenu) return
    const close = (e: MouseEvent) => {
      if (userMenuRef && !userMenuRef.contains(e.target as Node)) {
        showUserMenu = false
      }
    }
    const t = setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('click', close)
    }
  })

  function handleLogout() {
    showUserMenu = false
    auth.logout()
    goto('/login')
  }
</script>

<header
  class="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6"
>
  <div class="flex items-center gap-3">
    {#if isOverlayMode}
      <Tooltip text="메뉴 열기">
        <button
          type="button"
          onclick={onMenuOpen}
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="메뉴 열기"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </Tooltip>
    {/if}
    <!-- 로고+센터명 = 홈(대시보드) 링크. 앵커로 둬야 키보드 포커스·새 탭 열기가 살고
         SvelteKit 클라이언트 내비게이션도 그대로 탄다 -->
    <a
      href="/dashboard"
      class="flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-70"
      aria-label="대시보드로 이동"
    >
      <img
        src={centerLogo || defaultLogo}
        alt="Logo"
        class="h-8 w-8 shrink-0 rounded object-cover"
      />
      <span class="text-sm font-semibold text-gray-900 truncate-safe"
        >{centerName || '센터'}</span
      >
    </a>
  </div>
  <div class="flex items-center gap-3">
    <NotificationBell />
    {#if meData}
      <div class="relative" bind:this={userMenuRef}>
        <button
          type="button"
          onclick={() => (showUserMenu = !showUserMenu)}
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption-01-normal-medium text-white"
            style="background-color: {avatarBg}"
          >
            {userName && userName !== '사용자' ? userName.slice(0, 1) : '?'}
          </span>
          <Typography
            variant="body-02-normal-semibold"
            color="text-gray-700"
            className="hidden sm:block"
          >
            {userName}
          </Typography>
          <span
            class="hidden sm:block shrink-0 text-gray-400 transition-transform duration-200"
            class:rotate-180={showUserMenu}
          >
            <ArrowDownIcon20 />
          </span>
        </button>

        {#if showUserMenu}
          <div
            class="dropdown-panel absolute top-full right-0 z-50 mt-1 w-66.75"
            role="menu"
          >
            <!-- 사용자 정보 -->
            <div class="flex shrink-0 items-center gap-3 px-2 py-2">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style="background-color: {avatarBg}"
              >
                {userName && userName !== '사용자' ? userName.slice(0, 1) : '?'}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <Typography
                    variant="body-02-normal-semibold"
                    color="text-gray-900"
                    className="truncate-safe"
                  >
                    {userName}
                  </Typography>
                  {#if userRole}
                    <Typography
                      variant="label-01-normal-medium"
                      color="text-gray-500"
                      className="shrink-0"
                    >
                      {userRole}
                    </Typography>
                  {/if}
                </div>
                {#if userEmail}
                  <!-- 이메일은 이름을 보조하는 식별값 — 무게를 medium으로 주면
                       이름(semibold)과 같은 줄기로 읽힌다. regular로 한 단계 내린다 -->
                  <Typography
                    variant="label-01-normal-regular"
                    color="text-gray-500"
                    className="truncate-safe mt-2"
                  >
                    {userEmail}
                  </Typography>
                {/if}
              </div>
            </div>

            <!-- 메뉴 항목 -->
            <div class="dropdown-list">
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  showUserMenu = false
                  goto('/settings/account-info')
                }}
                class="dropdown-item justify-start"
              >
                계정 정보
              </button>
              <button
                type="button"
                role="menuitem"
                onclick={handleLogout}
                class="dropdown-item justify-start"
              >
                로그아웃
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</header>
