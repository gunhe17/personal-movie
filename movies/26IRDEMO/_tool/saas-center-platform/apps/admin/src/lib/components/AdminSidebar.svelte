<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { sidebar } from '$lib/stores/sidebar.svelte'
  import { auth } from '$lib/stores/auth'
  import axios from 'axios'
  import GridIcon from '$lib/assets/GridIcon.svelte'
  import BuildingIcon from '$lib/assets/BuildingIcon.svelte'
  import UsersIcon from '$lib/assets/UsersIcon.svelte'
  import DocumentIcon from '$lib/assets/DocumentIcon.svelte'
  import ClipboardIcon from '$lib/assets/ClipboardIcon.svelte'
  import AiIcon from '$lib/assets/AiIcon.svelte'
  import CreditCardIcon from '$lib/assets/CreditCardIcon.svelte'
  import ChartIcon from '$lib/assets/ChartIcon.svelte'
  import LabIcon from '$lib/assets/LabIcon.svelte'
  import SettingsIcon from '$lib/assets/SettingsIcon.svelte'
  import CardIcon from '$lib/assets/CardIcon.svelte'
  import type { Component } from 'svelte'
  import { ROLE_GROUPS, ROLE_META, type AdminRole } from '$lib/utils/permissions'
  import { fade, slide } from 'svelte/transition'
  import { sessionTimer } from '$lib/stores/session.svelte'

  const { ALL_ROLES, ADMIN_PLUS, SUPER_PLUS } = ROLE_GROUPS

  interface SubMenuItem {
    id: string
    label: string
    href: string
    roles: AdminRole[]
  }

  interface MenuGroup {
    id: string
    label: string
    icon: Component
    roles: AdminRole[]
    children: SubMenuItem[]
  }

  interface MenuItem {
    id: string
    label: string
    href: string
    icon: Component
    roles: AdminRole[]
    target?: string
  }

  type NavItem =
    | ({ type: 'single' } & MenuItem)
    | ({ type: 'group' } & MenuGroup)

  const navItems: NavItem[] = [
    {
      type: 'single',
      id: 'dashboard',
      label: '대시보드',
      href: '/dashboard',
      icon: GridIcon,
      roles: ALL_ROLES
    },
    {
      type: 'group',
      id: 'center-group',
      label: '센터',
      icon: BuildingIcon,
      roles: ALL_ROLES,
      children: [
        {
          id: 'applications',
          label: '신청 관리',
          href: '/center/applications',
          roles: ALL_ROLES
        },
        {
          id: 'centers',
          label: '등록 센터 관리',
          href: '/center/manage',
          roles: ALL_ROLES
        },
        {
          id: 'terminations',
          label: '해지 센터 관리',
          href: '/center/terminations',
          roles: ADMIN_PLUS
        }
      ]
    },
    {
      type: 'group',
      id: 'account-group',
      label: '계정',
      icon: UsersIcon,
      roles: ALL_ROLES,
      children: [
        {
          id: 'accounts',
          label: '계정 관리',
          href: '/account/clients',
          roles: ALL_ROLES
        },
        {
          id: 'admin-accounts',
          label: '어드민 계정 관리',
          href: '/account/admins',
          roles: SUPER_PLUS
        }
      ]
    },
    {
      type: 'single',
      id: 'assessments',
      label: '검사 관리',
      href: '/assessments',
      icon: DocumentIcon,
      roles: ALL_ROLES
    },
    {
      type: 'group',
      id: 'voucher-group',
      label: '바우처',
      icon: CardIcon,
      roles: ADMIN_PLUS,
      children: [
        {
          id: 'vouchers',
          label: '바우처 관리',
          href: '/vouchers',
          roles: ADMIN_PLUS
        },
        {
          id: 'voucher-extraction',
          label: '바우처 정보 AI 추출',
          href: '/voucher-extraction',
          roles: ADMIN_PLUS
        }
      ]
    },
    {
      type: 'group',
      id: 'subscription-group',
      label: '구독 관리',
      icon: CreditCardIcon,
      roles: SUPER_PLUS,
      children: [
        {
          id: 'subscription-dashboard',
          label: '대시보드',
          href: '/subscription/dashboard',
          roles: SUPER_PLUS
        },
        {
          id: 'subscription-list',
          label: '구독 목록',
          href: '/subscription/list',
          roles: SUPER_PLUS
        },
      ]
    },
    {
      type: 'single',
      id: 'ai-usage',
      label: 'AI 사용량 관리',
      href: '/ai-usage',
      icon: AiIcon,
      roles: ADMIN_PLUS
    },
    {
      type: 'single',
      id: 'monitoring',
      label: '성능 모니터링',
      href: '/monitoring',
      icon: ChartIcon,
      roles: SUPER_PLUS
    },
    {
      type: 'group',
      id: 'ai-lab-group',
      label: 'AI Lab',
      icon: LabIcon,
      roles: ALL_ROLES,
      children: [
        {
          id: 'ai-lab-dashboard',
          label: '대시보드',
          href: '/ai-lab/dashboard',
          roles: ALL_ROLES
        },
        {
          id: 'ai-lab-lab',
          label: '실험실',
          href: '/ai-lab/lab',
          roles: ALL_ROLES
        },
        {
          id: 'ai-lab-diarize-compare',
          label: '화자분리 비교',
          href: '/ai-lab/diarize-compare',
          roles: ALL_ROLES
        },
        {
          id: 'ai-lab-diarize-prompt',
          label: '화자분리 프롬프트 튜닝',
          href: '/ai-lab/diarize-prompt',
          roles: ALL_ROLES
        },
        {
          id: 'ai-lab-feature-test',
          label: '통합 테스트',
          href: '/ai-lab/feature-test',
          roles: ALL_ROLES
        }
      ]
    },
    {
      type: 'group',
      id: 'cs-group',
      label: '고객센터',
      icon: ClipboardIcon,
      roles: ALL_ROLES,
      children: [
        {
          id: 'notices',
          label: '공지사항 관리',
          href: '/notices',
          roles: ALL_ROLES
        },
        {
          id: 'cs-memos',
          label: 'CS 전화 메모',
          href: '/cs-memos',
          roles: ALL_ROLES
        },
        {
          id: 'inquiries',
          label: '문의 관리',
          href: '/inquiries',
          roles: ALL_ROLES
        },
        {
          id: 'faqs',
          label: 'FAQ 관리',
          href: '/faqs',
          roles: ALL_ROLES
        }
      ]
    },
    {
      type: 'group',
      id: 'admin-group',
      label: '설정',
      icon: SettingsIcon,
      roles: SUPER_PLUS,
      children: [
        {
          id: 'audit-logs',
          label: '감사 로그',
          href: '/audit-logs',
          roles: SUPER_PLUS
        },
        {
          id: 'settings',
          label: '시스템 설정',
          href: '/settings',
          roles: SUPER_PLUS
        },
        {
          id: 'message-templates',
          label: '문자 양식',
          href: '/settings/message-templates',
          roles: SUPER_PLUS
        }
      ]
    }
  ]

  const userRole = $derived($auth.user?.role ?? 'customer_service')

  const visibleNavItems = $derived(
    navItems
      .filter((item) => item.roles.includes(userRole as AdminRole))
      .map((item) => {
        if (item.type === 'group') {
          return {
            ...item,
            children: item.children.filter((c) =>
              c.roles.includes(userRole as AdminRole)
            )
          }
        }
        return item
      })
      .filter(
        (item) =>
          item.type !== 'group' || (item as MenuGroup).children.length > 0
      )
  )

  // 그룹 펼침 상태
  let openGroups = $state<Record<string, boolean>>({
    'center-group': false,
    'account-group': false,
    'ai-lab-group': false,
    'cs-group': false,
    'admin-group': false
  })

  // 현재 경로에 맞는 그룹 자동 펼침
  $effect(() => {
    for (const item of visibleNavItems) {
      if (item.type === 'group') {
        const group = item as MenuGroup
        if (group.children.some((c) => page.url.pathname.startsWith(c.href))) {
          openGroups[group.id] = true
        }
      }
    }
  })

  function toggleGroup(id: string) {
    openGroups[id] = !openGroups[id]
  }

  const isActive = (href: string) => page.url.pathname.startsWith(href)
  const isGroupActive = (group: MenuGroup) =>
    group.children.some((c) => isActive(c.href))

  // ── flyout (collapsed 상태) ──
  // <li> 위치를 캡처해서 fixed 좌표로 렌더, 80ms delay로 gap 처리
  interface FlyoutState {
    id: string
    type: 'single' | 'group'
    top: number // getBoundingClientRect().top
    height: number // getBoundingClientRect().height
  }

  let flyout = $state<FlyoutState | null>(null)
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function onMenuEnter(e: MouseEvent, id: string, type: 'single' | 'group') {
    if (!sidebar.collapsed) return
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    flyout = { id, type, top: rect.top, height: rect.height }
  }

  function onMenuLeave() {
    hideTimer = setTimeout(() => {
      flyout = null
    }, 150)
  }

  function onFlyoutEnter() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function onFlyoutLeave() {
    hideTimer = setTimeout(() => {
      flyout = null
    }, 150)
  }

  // flyout이 표시할 아이템 찾기
  const flyoutItem = $derived(
    flyout ? (visibleNavItems.find((i) => i.id === flyout!.id) ?? null) : null
  )

  let loggingOut = $state(false)

  async function handleLogout() {
    loggingOut = true
    try {
      await axios.post('/api/auth/logout')
      auth.logout()
      goto('/login')
    } catch {
      auth.logout()
      goto('/login')
    }
  }
</script>

<aside
  class="fixed left-0 top-0 z-30 flex h-screen flex-col overflow-hidden border-r border-gray-200 bg-white transition-all duration-200"
  style="width: var(--sidebar-width, 240px)"
>
  <!-- Logo -->
  <div
    class="flex h-16 items-center gap-3 border-b border-gray-100 px-4 {sidebar.collapsed
      ? 'justify-center'
      : ''}"
  >
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm
        {ROLE_META[$auth.user?.role as AdminRole]?.logoBg ?? 'bg-blue-500'}"
    >
      {($auth.user?.role ?? 'A').charAt(0).toUpperCase()}
    </div>
    <span
      class="sidebar-label text-base font-semibold text-gray-900 whitespace-nowrap overflow-hidden transition-all duration-200
        {sidebar.collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'}"
    >
      {$auth.user?.name.toUpperCase() ?? 'ADMIN'}
    </span>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-3 py-4">
    <ul class="flex flex-col gap-1">
      {#each visibleNavItems as item}
        {#if item.type === 'single'}
          <li
            onmouseenter={(e) => onMenuEnter(e, item.id, 'single')}
            onmouseleave={onMenuLeave}
          >
            <a
              href={item.href}
              target={item.target ?? undefined}
              rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium duration-300
                {sidebar.collapsed ? 'justify-center' : ''}
                {isActive(item.href)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
            >
              <span class="flex h-5 w-5 shrink-0 items-center justify-center">
                <item.icon class="h-5 w-5" />
              </span>
              <span
                class="sidebar-label whitespace-nowrap overflow-hidden transition-all duration-200
                  {sidebar.collapsed
                  ? 'max-w-0 opacity-0'
                  : 'max-w-40 opacity-100'}"
              >
                {item.label}
              </span>
              {#if item.target === '_blank' && !sidebar.collapsed}
                <svg class="h-3 w-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              {/if}
            </a>
          </li>
        {:else}
          {@const group = item}
          <li
            onmouseenter={(e) => onMenuEnter(e, group.id, 'group')}
            onmouseleave={onMenuLeave}
          >
            {#if sidebar.collapsed}
              <a
                href={group.children[0]?.href}
                class="flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium duration-300
                  {isGroupActive(group)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
              >
                <span class="flex h-5 w-5 shrink-0 items-center justify-center">
                  <group.icon class="h-5 w-5" />
                </span>
              </a>
            {:else}
              <button
                onclick={() => toggleGroup(group.id)}
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium duration-300
                  {isGroupActive(group)
                  ? 'text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
              >
                <span class="flex h-5 w-5 shrink-0 items-center justify-center">
                  <group.icon class="h-5 w-5" />
                </span>
                <span
                  class="flex-1 text-left whitespace-nowrap overflow-hidden"
                >
                  {group.label}
                </span>
                <svg
                  class="h-4 w-4 shrink-0 transition-transform duration-200 {openGroups[
                    group.id
                  ]
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

              {#if openGroups[group.id]}
                <ul transition:slide class="mt-0.5 flex flex-col gap-0.5 pl-8">
                  {#each group.children as child}
                    <li>
                      <a
                        href={child.href}
                        class="block rounded-lg px-3 py-2 text-sm font-medium duration-300
                          {isActive(child.href)
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
                      >
                        <span
                          class="sidebar-label whitespace-nowrap overflow-hidden transition-all duration-200
                          {sidebar.collapsed
                            ? 'max-w-0 opacity-0'
                            : 'max-w-40 opacity-100'}"
                        >
                          {child.label}
                        </span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </li>
        {/if}
      {/each}
    </ul>

    <!-- 세션 타이머 (nav 하단 고정) -->
    <div
      class="mt-auto flex items-center gap-3 rounded-lg p-2 text-xs font-medium
        {sidebar.collapsed ? 'justify-center' : ''}
        {sessionTimer.isWarning ? 'text-red-600' : 'text-gray-400'}"
    >
      {#if !sidebar.collapsed}
        <span class="flex h-5 w-5 shrink-0 items-center justify-center">
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
      {/if}
      <span class="whitespace-nowrap">
        {sessionTimer.display}
      </span>
    </div>
  </nav>

  <!-- Bottom: 로그아웃 -->
  <div class="border-t border-gray-100 px-3 py-3">
    <button
      onclick={handleLogout}
      disabled={loggingOut}
      class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors
        disabled:opacity-50 {sidebar.collapsed ? 'justify-center' : ''}"
    >
      <svg
        class="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      <span
        class="sidebar-label whitespace-nowrap overflow-hidden transition-all duration-200
          {sidebar.collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'}"
      >
        로그아웃
      </span>
    </button>
  </div>
</aside>

<!-- 접기 토글 (aside 바깥, overflow-hidden 영향 없음) -->
<button
  onclick={() => sidebar.toggle()}
  class="fixed top-1/2 z-40 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:text-gray-600"
  style="left: calc(var(--sidebar-width, 240px) - 12px)"
  title={sidebar.collapsed ? '메뉴 펼치기' : '메뉴 접기'}
>
  <svg
    class="h-4 w-4 transition-transform duration-200 {sidebar.collapsed
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
      d="M15 19l-7-7 7-7"
    />
  </svg>
</button>

<!-- collapsed flyout: fixed 위치, nav overflow 바깥에서 렌더 -->
{#if flyout && flyoutItem && sidebar.collapsed}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    transition:fade
    class="fixed z-50 ml-1 rounded-lg border border-gray-200 bg-white shadow-lg
      {flyout.type === 'single' ? 'px-3 py-2' : 'py-1.5 min-w-44'}"
    style="left: var(--sidebar-width, 240px); top: {flyout.top +
      flyout.height / 2}px; transform: translateY(-50%)"
    onmouseenter={onFlyoutEnter}
    onmouseleave={onFlyoutLeave}
  >
    {#if flyout.type === 'single' && flyoutItem.type === 'single'}
      <span class="whitespace-nowrap text-sm font-medium text-gray-700"
        >{flyoutItem.label}</span
      >
    {:else if flyout.type === 'group' && flyoutItem.type === 'group'}
      <div
        class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider"
      >
        {flyoutItem.label}
      </div>
      {#each flyoutItem.children as child}
        <a
          href={child.href}
          class="block px-3 py-2 text-sm font-medium whitespace-nowrap
            {isActive(child.href)
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}"
        >
          {child.label}
        </a>
      {/each}
    {/if}
  </div>
{/if}
