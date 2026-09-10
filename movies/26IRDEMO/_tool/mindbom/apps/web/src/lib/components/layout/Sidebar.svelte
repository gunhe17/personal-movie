<script lang="ts">
  /**
   * Sidebar — 참조 프로젝트(UnifiedSidebar)와 동일한 톤앤매너.
   *
   * 다크 네이비 크롬을 버리고 흰 면 + gray-200 보더로 간다. 활성 표시는
   * 왼쪽 파란 바가 아니라 `rounded-xl bg-gray-50` 블록이고, 텍스트는
   * gray-600 → 활성 gray-900. 아이콘만 활성 시 primary를 쓴다.
   *
   * 데스크탑에서 접기(72px)를 지원한다. 폭은 CSS 변수로 내보내 다른 화면이
   * var(--sidebar-width)로 참조할 수 있게 한다(참조 프로젝트와 같은 관례).
   */
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { auth } from '$lib/stores/auth'
  import Icon from '$components/ui/Icon.svelte'
  import { portal, Z_LAYER } from '$lib/utils/positionPortal'

  interface Props {
    /** 드로어(모바일)에서 항목 클릭 시 닫기 */
    onNavigate?: () => void
    /** 드로어 안에서는 접기 토글·보더를 숨기고 항상 펼침 */
    overlay?: boolean
  }

  let { onNavigate, overlay = false }: Props = $props()

  let user = $derived($auth.user)

  type NavItem = { label: string; href: string; icon: string }

  const STORAGE_KEY = 'sidebar-collapsed'

  let isCollapsed = $state(browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false)

  // 오버레이(드로어)에서는 접힘을 무시하고 항상 펼친다
  let collapsed = $derived(overlay ? false : isCollapsed)

  // 콘텐츠 영역이 참조할 수 있도록 실제 폭을 전역 변수로 동기화
  $effect(() => {
    if (!browser || overlay) return
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '72px' : '280px')
  })

  function toggleCollapse() {
    isCollapsed = !isCollapsed
    if (browser) localStorage.setItem(STORAGE_KEY, String(isCollapsed))
  }

  // 임상심리사는 내담자 관리 메뉴 비노출 (검사 흐름 안에서만 내담자 다룸)
  let mainItems = $derived.by<NavItem[]>(() => {
    const items: NavItem[] = [
      { label: '대시보드', href: '/dashboard', icon: 'home' },
      { label: '검사 현황', href: '/examinations', icon: 'assignment' }
    ]
    if (user?.role !== 'clinician') {
      items.push({ label: '내담자', href: '/clients', icon: 'people' })
    }
    return items
  })

  /**
   * role 기반 하단 메뉴: 직원 관리/감사 추적/기관 설정은 admin 전용.
   *
   * '내 설정'은 여기 두지 않는다 — 헤더의 사용자 드롭다운이 이미 갖고 있고,
   * 거기가 제자리다(내 계정 정보 옆). 양쪽에 두면 같은 화면으로 가는 길이
   * 둘이라 어느 쪽이 정본인지 흐려진다.
   * 반면 '기관 설정'은 개인이 아니라 조직 설정이라 사이드바가 맞다.
   */
  let bottomItems = $derived.by<NavItem[]>(() => {
    const isAdmin = user?.role === 'admin'
    const items: NavItem[] = []
    if (isAdmin) items.push({ label: '직원 관리', href: '/members', icon: 'manage_accounts' })
    if (isAdmin) items.push({ label: '감사 추적', href: '/audit-logs', icon: 'fact_check' })
    if (isAdmin) items.push({ label: '기관 설정', href: '/settings/institution', icon: 'apartment' })
    return items
  })

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/')
  }

  /**
   * 접힘 툴팁 — 호버 중인 항목 하나만 portal로 띄운다.
   *
   * CSS 호버(group-hover + opacity)로 두면 nav의 overflow-y-auto에 잘린다.
   * overflow-y만 줘도 브라우저는 overflow-x를 scroll로 승격시키므로 가로로도
   * 잘린다 — 안쪽 overflow-hidden만 걷어내선 해결되지 않는다.
   *
   * 항목마다 use:portal을 달면 접자마자 전 항목이 body에 붙으므로,
   * 호버 중인 href 하나만 상태로 들고 그 항목만 렌더한다.
   */
  let hoveredHref = $state<string | null>(null)
  let hoveredAnchor = $state<HTMLElement | null>(null)

  let hoveredLabel = $derived(
    hoveredHref
      ? ([...mainItems, ...bottomItems].find((i) => i.href === hoveredHref)?.label ?? '')
      : ''
  )

  function showTip(href: string, el: HTMLElement) {
    if (!collapsed) return
    hoveredHref = href
    hoveredAnchor = el
  }

  function hideTip(href: string) {
    if (hoveredHref === href) {
      hoveredHref = null
      hoveredAnchor = null
    }
  }

  // 펼치면 떠 있던 툴팁을 거둔다
  $effect(() => {
    if (!collapsed) {
      hoveredHref = null
      hoveredAnchor = null
    }
  })
</script>

{#snippet navRow(item: NavItem, active: boolean)}
  <li>
    <!--
      활성 표시는 rounded-xl 면(bg-gray-50)으로 준다. 참조 프로젝트와 동일하게
      호버는 텍스트 색만 올려 면이 두 번 겹치지 않게 한다.
    -->
    <div
      class="group/menu relative overflow-hidden rounded-xl transition-colors duration-200 {active
        ? 'bg-gray-50'
        : 'hover:bg-gray-50'}"
    >
      <a
        href={item.href}
        onclick={onNavigate}
        data-sveltekit-preload-data="hover"
        onmouseenter={(e) => showTip(item.href, e.currentTarget)}
        onmouseleave={() => hideTip(item.href)}
        onfocus={(e) => showTip(item.href, e.currentTarget)}
        onblur={() => hideTip(item.href)}
        class="group flex h-12.5 w-full items-center gap-3 px-4 {collapsed ? 'justify-center' : ''}"
        aria-label={collapsed ? item.label : undefined}
      >
        <Icon
          name={item.icon}
          size="md"
          class={active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'}
        />
        {#if !collapsed}
          <span
            class="whitespace-nowrap text-title-01-normal-semibold {active
              ? 'text-gray-900'
              : 'text-gray-600 group-hover:text-gray-900'}"
          >
            {item.label}
          </span>
        {/if}
      </a>

      <!--
        접힘 툴팁은 여기 두지 않는다 — nav의 스크롤 박스에 잘린다.
        aside 바깥(파일 하단)에서 portal로 띄운다.
      -->
    </div>
  </li>
{/snippet}

<aside
  style={overlay ? 'width: 280px;' : `width: ${collapsed ? '72px' : '280px'};`}
  class="relative flex h-full shrink-0 flex-col bg-white px-3 transition-[width] duration-300 {overlay
    ? ''
    : 'border-r border-gray-200'}"
>
  <!-- 로고는 헤더가 갖는다 — 헤더가 전폭 최상단이라 여기 두면 두 번 나온다. -->

  {#if !overlay}
    <!-- 가장자리 접기 토글 (참조 프로젝트와 동일한 위치·크기) -->
    <button
      type="button"
      onclick={toggleCollapse}
      class="absolute -right-3 top-1/2 z-50 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-600"
      title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
      aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
    >
      <svg
        class="h-3.5 w-3.5 transition-transform duration-300 {collapsed ? 'rotate-180' : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  {/if}

  <!-- 메인 메뉴 -->
  <nav class="scrollbar-none flex-1 overflow-y-auto pt-4">
    <ul class="flex flex-col gap-1.5">
      {#each mainItems as item (item.href)}
        {@render navRow(item, isActive(item.href))}
      {/each}
    </ul>
  </nav>

  <!--
    하단 메뉴 — 항목이 있을 때만 그린다.
    '내 설정'을 헤더 드롭다운으로 옮기면서 이 블록은 admin 전용 항목만
    남았다. 조건 없이 두면 clinician·researcher에게는 구분선만 뜬 빈
    영역이 보인다.
  -->
  {#if bottomItems.length > 0}
    <div class="mt-auto pb-4 pt-4">
      <div class="mx-3 mb-2 h-px bg-gray-100" aria-hidden="true"></div>
      <ul class="flex flex-col gap-0.5">
        {#each bottomItems as item (item.href)}
          {@render navRow(item, isActive(item.href))}
        {/each}
      </ul>
    </div>
  {/if}
</aside>

<!--
  접힘 툴팁 — portal로 body에 붙어 사이드바 스크롤 박스를 벗어난다.
  renderPosition='right'로 앵커 오른쪽에 놓고, 폭은 내용에 맞춘다.

  보조기술에는 노출하지 않는다(aria-hidden) — 접힘 상태에서 링크 이름은
  <a>의 aria-label이 이미 갖고 있어 그대로 두면 같은 말이 두 번 읽힌다.
  이 툴팁은 눈으로 보는 사람만을 위한 것이다.
-->
{#if collapsed && hoveredAnchor && hoveredLabel}
  <!--
    key — portal은 mount 시점의 anchor를 클로저에 잡는다. 항목 사이를 옮겨다닐 때
    같은 노드를 재사용하면 앵커가 갱신되지 않아 툴팁이 이전 항목 옆에 머문다.
  -->
  {#key hoveredHref}
  <div
    aria-hidden="true"
    use:portal={{
      anchor: hoveredAnchor,
      renderPosition: 'right',
      isFitWidth: false,
      offset: 8,
      zIndex: Z_LAYER.portalDropdown
    }}
    class="pointer-events-none whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-label-01-normal-medium text-white shadow-lg"
  >
    {hoveredLabel}
  </div>
  {/key}
{/if}
