<script lang="ts">
  /**
   * Header — 참조 프로젝트(AppHeader)와 동일한 톤앤매너.
   *
   * 흰 면 + 하단 gray-200 보더. 좌측은 기관명, 우측은 알림·시크릿·유저 드롭다운.
   * 사이드바에 있던 유저 프로필/로그아웃을 여기로 올렸다 — 참조 프로젝트가
   * 그 구조이고, 흰 사이드바에서는 하단 다크 프로필 블록이 겉돈다.
   */
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { institutionStore, institutionId } from '$lib/stores/institution.store'
  import Icon from '$components/ui/Icon.svelte'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import BrandMark from '$components/ui/BrandMark.svelte'
  import PersonAvatar from '$components/ui/PersonAvatar.svelte'
  import HamburgerButton from '$lib/components/layout/HamburgerButton.svelte'
  import NotificationDropdown from '$lib/components/layout/NotificationDropdown.svelte'
  import SecretModeToggle from '$lib/components/layout/SecretModeToggle.svelte'

  interface Props {
    onMenuToggle?: () => void
  }

  let { onMenuToggle }: Props = $props()

  const ROLE_LABELS: Record<string, string> = {
    admin: '관리자',
    clinician: '임상심리사',
    researcher: '연구원'
  }

  let user = $derived($auth.user)
  let userName = $derived(user?.name ?? '사용자')
  let userEmail = $derived(user?.email ?? '')
  let userRole = $derived(user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '')

  // 기관명 — store에 목록이 없을 수 있어(새로고침 hydrate) 없으면 라벨을 비운다
  let institutionName = $derived.by(() => {
    const id = $institutionId
    if (!id) return ''
    const list = $institutionStore.institutions ?? []
    return list.find((i: { id: string; name?: string }) => i.id === id)?.name ?? ''
  })

  let showUserMenu = $state(false)
  let userMenuRef = $state<HTMLElement | null>(null)

  // 바깥 클릭으로 닫기. 여는 클릭이 그대로 닫기로 이어지지 않도록 다음 태스크에 등록한다.
  $effect(() => {
    if (!showUserMenu) return
    const close = (e: MouseEvent) => {
      if (userMenuRef && !userMenuRef.contains(e.target as Node)) showUserMenu = false
    }
    const t = setTimeout(() => window.addEventListener('click', close), 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('click', close)
    }
  })

  async function handleLogout() {
    showUserMenu = false
    await auth.logout()
    goto('/login')
  }
</script>

<header
  class="z-10 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6"
>
  <div class="flex min-w-0 items-center gap-3">
    {#if onMenuToggle}
      <HamburgerButton onClick={onMenuToggle} hideAt="lg" tone="light" />
    {/if}

    <!--
      로고 — 헤더가 전폭 최상단이라 사이드바가 아니라 여기가 로고 자리다.
      사이드바 폭(280)에 맞춰 좌측을 정렬하지 않는다. 헤더 자체 패딩을 따른다.
    -->
    <BrandMark href="/dashboard" class="shrink-0" />

    {#if institutionName}
      <span class="h-4 w-px shrink-0 bg-gray-200" aria-hidden="true"></span>
      <span class="truncate text-body-02-normal-semibold text-gray-700">{institutionName}</span>
    {/if}
  </div>

  <div class="flex items-center gap-1">
    <SecretModeToggle tone="light" />
    <NotificationDropdown />

    {#if user}
      <div class="relative ml-1" bind:this={userMenuRef}>
        <button
          type="button"
          onclick={() => (showUserMenu = !showUserMenu)}
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
        >
          <!--
            아바타 — 목록·상세 화면과 같은 PersonAvatar를 쓴다.
            여기만 이니셜 원이라 같은 사람이 화면마다 다르게 보였다.
            User에 성별 필드가 없어 일러스트는 이름 해시로 배정되는데,
            그건 PersonAvatar가 members 목록에서 이미 하는 동작이라
            같은 사람이면 어디서나 같은 그림이 나온다.
          -->
          <PersonAvatar name={userName} role="counselor" size={24} />
          <span class="hidden text-body-02-normal-semibold text-gray-700 sm:block">
            {userName}
          </span>
          <!-- 열림 표시는 ChevronToggle로 통일 (§4-3) -->
          <ChevronToggle
            open={showUserMenu}
            size={16}
            class="hidden shrink-0 text-gray-400 sm:block"
          />
        </button>

        {#if showUserMenu}
          <div
            class="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
            role="menu"
          >
            <div class="flex items-center gap-3 px-5 py-4">
              <PersonAvatar name={userName} role="counselor" size={36} />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-body-02-normal-semibold text-gray-900">
                    {userName}
                  </span>
                  {#if userRole}
                    <span class="shrink-0 text-label-01-normal-regular text-gray-500">
                      {userRole}
                    </span>
                  {/if}
                </div>
                {#if userEmail}
                  <p class="mt-1 truncate text-label-01-normal-regular text-gray-500">
                    {userEmail}
                  </p>
                {/if}
              </div>
            </div>

            <div class="border-t border-gray-100 px-3 py-2">
              <button
                type="button"
                role="menuitem"
                onclick={() => {
                  showUserMenu = false
                  goto('/settings/me')
                }}
                class="flex h-10 w-full items-center rounded-lg px-2 text-label-01-normal-regular text-gray-700 transition-colors hover:bg-gray-50"
              >
                내 설정
              </button>
              <button
                type="button"
                role="menuitem"
                onclick={handleLogout}
                class="flex h-10 w-full items-center rounded-lg px-2 text-label-01-normal-regular text-gray-700 transition-colors hover:bg-gray-50"
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
