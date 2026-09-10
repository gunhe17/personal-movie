<script lang="ts">
  import { t } from '$lib/ontology/terms'
  import { page } from '$app/state'
  import { goto, preloadData } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { centerStore, requireCenterId } from '$lib/stores/center.store'
  import { permissionStore } from '$lib/stores/permission.store'
  import { secretModeStore, isSecretMode } from '$lib/stores/secret-mode.store'
  import { modalStore } from '$lib/stores/modal'
  import {
    canShowSidebarMenu,
    type SidebarMenuId
  } from '$lib/config/sidebar-permissions'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getMe, type MeResponse } from '$lib/hooks/actions/auth.action'
  import { getScheduleChangeRequests } from '$lib/hooks/actions/schedule.action'
  import { centerId } from '$lib/stores/center.store'
  import { resolveAppEnv, showAiFeatures } from '$lib/config/environment'
  import { fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { browser } from '$app/environment'
  import type { Component } from 'svelte'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { sidebarDrawer } from '$lib/stores/sidebar.svelte'
  import DashboardOn20 from '$lib/assets/sidebar/DashboardOn20.svelte'
  import DashboardOff20 from '$lib/assets/sidebar/DashboardOff20.svelte'
  import CalendarOn20 from '$lib/assets/sidebar/CalendarOn20.svelte'
  import CalendarOff20 from '$lib/assets/sidebar/CalendarOff20.svelte'
  import ClientOn24 from '$lib/assets/sidebar/ClientOn24.svelte'
  import ClientOff24 from '$lib/assets/sidebar/ClientOff24.svelte'
  // 상담/검사 아이콘은 청구 화면(Counsel24Icon/AssessmentStack)과 동일한 형태이되,
  // 사이드바 파란 체계에 맞춰 파란 버전(on)/회색 버전(off)을 별도 사용.
  import CounselBlue24 from '$lib/assets/sidebar/CounselBlue24.svelte'
  import CounselGray24 from '$lib/assets/sidebar/CounselGray24.svelte'
  import AssessmentStack from '$lib/assets/AssessmentStack.svelte'
  import AssessmentGray24 from '$lib/assets/sidebar/AssessmentGray24.svelte'
  import CostOn24 from '$lib/assets/sidebar/CostOn24.svelte'
  import CostOff24 from '$lib/assets/sidebar/CostOff24.svelte'
  import VoucherOn24 from '$lib/assets/sidebar/VoucherOn24.svelte'
  import VoucherOff24 from '$lib/assets/sidebar/VoucherOff24.svelte'
  import MemberOn24 from '$lib/assets/sidebar/MemberOn24.svelte'
  import MemberOff24 from '$lib/assets/sidebar/MemberOff24.svelte'
  import SettingOn24 from '$lib/assets/sidebar/SettingOn24.svelte'
  import SettingOff24 from '$lib/assets/sidebar/SettingOff24.svelte'
  import MyinfoOn24 from '$lib/assets/sidebar/MyinfoOn24.svelte'
  import MyinfoOff24 from '$lib/assets/sidebar/MyinfoOff24.svelte'
  import AgentOn24 from '$lib/assets/sidebar/AgentOn24.svelte'
  import AgentOff24 from '$lib/assets/sidebar/AgentOff24.svelte'
  import Typography from '../Typography.svelte'
  import CustomService20 from '$root/src/lib/assets/CustomService20.svelte'
  import NoticeIcon20 from '$root/src/lib/assets/NoticeIcon20.svelte'
  import SecretOffIcon20 from '$root/src/lib/assets/SecretOffIcon20.svelte'
  import SecretOnIcon20 from '$root/src/lib/assets/SecretOnIcon20.svelte'
  import ArrowDownIcon20 from '$root/src/lib/assets/ArrowDownIcon20.svelte'

  const appVersion = __APP_VERSION__

  interface SubMenuItem {
    label: string
    path: string
    /** 지정하면 이 서브탭만 별도 권한으로 걸러진다 (부모 메뉴 권한과 별개) */
    menuId?: SidebarMenuId
  }

  interface MenuItem {
    id: string
    label: string
    path?: string
    icon: string
    children?: SubMenuItem[]
  }

  // 사이드바 축소 상태 (localStorage에서 복원 또는 화면 크기에 따라 기본값)
  const LAPTOP_BREAKPOINT = 1280 // xl breakpoint
  const STORAGE_KEY = 'sidebar-collapsed'

  // transition 활성화 (마운트 후 활성화)
  let transitionEnabled = $state(false)

  function getInitialCollapsed(): boolean {
    if (!browser) return false
    // app.html의 blocking script에서 설정한 값 사용
    const htmlCollapsed = document.documentElement.dataset.sidebarCollapsed
    if (htmlCollapsed !== undefined) {
      return htmlCollapsed === 'true'
    }
    // fallback: 작은 화면에서만 닫힌 상태, 큰 화면에서는 항상 펼침
    const isSmallScreen = window.innerWidth < LAPTOP_BREAKPOINT
    return isSmallScreen
  }

  let isLogoLoaded = $state<boolean>(false)
  let isCollapsed = $state(getInitialCollapsed())

  // 클라이언트 마운트 시 transition 활성화
  $effect(() => {
    if (browser) {
      // 상태는 이미 getInitialCollapsed()에서 올바르게 설정됨
      // 한 프레임 뒤에 transition 활성화
      requestAnimationFrame(() => {
        transitionEnabled = true
      })
    }
  })

  // 라우트 변경 등과 무관하게 전역 CSS 변수를 항상 실제 사이드바 상태와 동기화
  // (검사/구성원 등 다른 페이지에서 var(--sidebar-width) 사용 시 일치 보장)
  function syncSidebarCssVars() {
    if (!browser) return
    // 오버레이 모드에서는 사이드바가 고정이므로 콘텐츠 영역에 마진 불필요
    if (isOverlayMode) {
      document.documentElement.style.setProperty('--sidebar-width', '0px')
      document.documentElement.style.setProperty('--sidebar-px', '0.75rem')
      document.documentElement.style.setProperty(
        '--sidebar-toggle-rotate',
        '0deg'
      )
      document.documentElement.dataset.sidebarCollapsed = 'false'
      return
    }
    const w = isCollapsed ? '72px' : '280px'
    const px = isCollapsed ? '0.5rem' : '0.75rem'
    const rotate = isCollapsed ? '180deg' : '0deg'
    document.documentElement.style.setProperty('--sidebar-width', w)
    document.documentElement.style.setProperty('--sidebar-px', px)
    document.documentElement.style.setProperty(
      '--sidebar-toggle-rotate',
      rotate
    )
  }

  $effect(() => {
    if (browser) {
      syncSidebarCssVars()
    }
  })

  // 사이드바 토글 (localStorage에 저장)
  function toggleSidebar() {
    isCollapsed = !isCollapsed
    if (browser) {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed))
      document.documentElement.dataset.sidebarCollapsed = String(isCollapsed)
      syncSidebarCssVars()
    }
  }

  // 오버레이 모드: 데스크탑이 아닌 경우 (태블릿/모바일)
  const isOverlayMode = $derived(!responsive.isDesktop)

  // 오버레이 모드에서는 isCollapsed 무시 (항상 펼침)
  const effectiveCollapsed = $derived(isOverlayMode ? false : isCollapsed)

  // ── 메뉴 영역 스크롤 페이드 + 다음 항목 빼꼼 노출 ──
  // 스크롤이 가능할 때 (1) 잘리는 지점을 항목 중간에 스냅시켜 다음 항목 윗부분이
  // 살짝 보이게 하고 (2) 위/아래 가장자리에 페이드를 입혀 "더 있다"를 표시한다.
  // 스타일(마스크 + max-height)은 전부 imperative로 navEl.style에 직접 적용한다.
  // (Svelte의 style={} 바인딩은 setAttribute로 inline style 전체를 덮어써서
  //  imperative max-height를 지우므로 혼용하지 않는다.)
  let navEl = $state<HTMLElement | null>(null)
  let showTopFade = false
  let showBottomFade = false
  // PEEK가 FADE 안에 통째로 잠기면(옛 18/28) 걸친 항목이 거의 안 보여
  // "더 있다" 신호가 죽는다 — 걸침의 윗부분이 페이드 위로 또렷이 드러나도록
  // PEEK를 FADE의 3/4 지점까지 올린다(걸침 상단 불투명도 75%).
  const FADE_SIZE = 40 // 페이드 폭(px)
  const PEEK = 30 // 다음 항목이 보이는 높이(px)

  function applyMask() {
    if (!navEl) return
    const top = showTopFade ? `transparent 0, black ${FADE_SIZE}px` : 'black 0'
    const bottom = showBottomFade
      ? `black calc(100% - ${FADE_SIZE}px), transparent 100%`
      : 'black 100%'
    const grad = `linear-gradient(to bottom, ${top}, ${bottom})`
    navEl.style.maskImage = grad
    navEl.style.webkitMaskImage = grad
  }

  // 스크롤 시: 현재 가시 영역 기준으로 위/아래 페이드만 갱신
  function updateScrollFades() {
    if (!navEl) return
    const { scrollTop, scrollHeight, clientHeight } = navEl
    showTopFade = scrollTop > 4
    showBottomFade = scrollTop + clientHeight < scrollHeight - 4
    applyMask()
  }

  // maxHeight 스냅 변경을 즉시 점프 대신 짧게 글라이드시킨다 — 서브메뉴
  // 펼침/접힘으로 스냅 값이 바뀔 때 nav 하단 경계(빼꼼 노출 라인)가 한 프레임에
  // 수십 px 튀는 "드르륵"의 방지책 (바우처 트레이스 실측: 420→448 즉시 점프)
  let maxHeightAnimRaf = 0
  function glideNavMaxHeight(from: number, to: number, clearAfter = false) {
    if (!browser || !navEl) return
    cancelAnimationFrame(maxHeightAnimRaf)
    if (Math.abs(to - from) < 2) {
      navEl.style.maxHeight = clearAfter ? '' : `${to}px`
      return
    }
    const DUR = 180
    const start = performance.now()
    const step = (now: number) => {
      if (!navEl) return
      const t = Math.min(1, (now - start) / DUR)
      const eased = cubicOut(t)
      navEl.style.maxHeight = `${from + (to - from) * eased}px`
      if (t < 1) {
        maxHeightAnimRaf = requestAnimationFrame(step)
      } else if (clearAfter) {
        navEl.style.maxHeight = ''
      }
    }
    step(performance.now())
  }

  // 현재 레이아웃 기준으로 "빼꼼 노출" 스냅 높이를 측정만 한다(적용 없음).
  // maxHeight를 잠시 풀어 재므로 같은 태스크 안에서 원상복구 — 화면엔 안 보인다.
  function measureSnap(): {
    overflowing: boolean
    available: number
    snapped: number
  } | null {
    if (!browser || !navEl) return null
    const prevMax = navEl.style.maxHeight
    const prevScrollTop = navEl.scrollTop
    navEl.style.maxHeight = ''
    const available = navEl.clientHeight
    const overflowing = navEl.scrollHeight > available + 1
    let snapped = available
    if (overflowing) {
      // 마지막으로 '꽉 차게' 보일 항목 경계를 찾아, 그 아래로 PEEK 만큼만
      // 보이도록 높이를 스냅한다(잘리는 선이 항목 중간에 오도록).
      const navTop = navEl.getBoundingClientRect().top
      const scrollTop = navEl.scrollTop
      const rows = navEl.querySelectorAll('a, button')
      let bestBottom = 0
      for (const r of rows) {
        const bottom = r.getBoundingClientRect().bottom - navTop + scrollTop
        if (bottom <= available - PEEK && bottom > bestBottom)
          bestBottom = bottom
      }
      snapped = Math.min(
        bestBottom > 0 ? bestBottom + PEEK : available,
        available
      )
    }
    navEl.style.maxHeight = prevMax
    // maxHeight 해제 순간 clientHeight가 커지며 브라우저가 scrollTop을
    // 클램프한다 — 복원하지 않으면 화면이 점프한다(트레이스 실측 ±29px)
    navEl.scrollTop = prevScrollTop
    return { overflowing, available, snapped }
  }

  // 메뉴 영역 높이를 "항목 중간"에 스냅 → 다음 항목 윗부분이 빼꼼 보이게
  function recalcNav() {
    if (!browser || !navEl) return
    const prevScrollTop = navEl.scrollTop
    const hadMax = navEl.style.maxHeight !== ''
    const prevHeight = navEl.clientHeight // 현재 그려진 박스 높이
    cancelAnimationFrame(maxHeightAnimRaf)
    const m = measureSnap()
    if (!m) return

    if (!m.overflowing) {
      // 다 들어오면 제약·페이드 해제 (제약이 있었다면 부드럽게 풀기)
      if (hadMax) glideNavMaxHeight(prevHeight, m.available, true)
      else navEl.style.maxHeight = ''
      showTopFade = false
      showBottomFade = false
      applyMask()
      return
    }

    if (hadMax) {
      // 그려졌던 높이에서 새 스냅으로 글라이드 (즉시 점프 = 드르륵)
      navEl.style.maxHeight = `${prevHeight}px`
      glideNavMaxHeight(prevHeight, m.snapped)
    } else {
      navEl.style.maxHeight = `${m.snapped}px`
    }
    navEl.scrollTop = prevScrollTop

    showTopFade = prevScrollTop > 4
    showBottomFade = prevScrollTop + m.snapped < navEl.scrollHeight - 4
    applyMask()
  }

  /**
   * 서브메뉴 펼침 트랜지션 — svelte `slide`와 같은 형태(height+padding, overflow
   * hidden)를 `tick`(JS)으로 구현하고, 필요하면 **같은 tick 안에서** nav 스크롤을
   * 바닥에 고정한다.
   *
   * 왜 tick인가: `slide`는 `css(t)` 기반이라 브라우저 애니메이션 시계로 돌고,
   * 스크롤 follow를 rAF 루프로 따로 돌리면 height 갱신이 항상 rAF **뒤**에
   * 적용돼 follow가 한 프레임 뒤를 쫓는다 — "커짐(아래로 밀림)→스크롤(위로
   * 당김)"이 교대로 painting 되어 아래 메뉴들이 ±30px 널뛰는 드드득이 된다
   * (rAF 트레이스 실측). height와 scrollTop을 한 함수에서 쓰면 원자적 프레임.
   *
   * follow 판정(시작 시 1회): 펼침 완료 시점의 바닥으로 스크롤해도 메뉴 헤더가
   * 위로 밀려나지 않는 경우(= 아래쪽 메뉴)만 바닥을 따라간다 — 위쪽 메뉴는
   * 펼친 메뉴가 사라지는 게 더 혼란스럽다.
   */
  function submenuSlide(
    node: HTMLElement,
    { duration = 200, easing = cubicOut } = {},
    options?: { direction?: 'in' | 'out' | 'both' }
  ) {
    const dir = options?.direction === 'out' ? 'out' : 'in'
    const style = getComputedStyle(node)
    const height = parseFloat(style.height)
    const paddingBottom = parseFloat(style.paddingBottom)

    // 펼침 시 바닥 따라가기 여부 (접힘은 브라우저 스크롤 클램프가 자연히 따라감)
    let follow = false
    if (dir === 'in' && navEl) {
      const menuRow = node.closest('li')
      const navRect = navEl.getBoundingClientRect()
      const menuTop =
        (menuRow?.getBoundingClientRect().top ?? 0) -
        navRect.top +
        navEl.scrollTop
      // 아직 0 높이 — 성장분을 더해 '펼침 완료 시점'의 바닥을 예측한다
      const pendingGrowth = height - node.getBoundingClientRect().height
      const finalBottom =
        navEl.scrollHeight + pendingGrowth - navEl.clientHeight
      follow = finalBottom > 0 && finalBottom <= menuTop
    }

    // ── 최종 "빼꼼 노출" 스냅 높이를 미리 재서 슬라이드와 한 모션으로 움직인다 ──
    // (끝나고 재조정하면 '열림 → 재조정' 두 박자로 보인다 — 사용자 피드백)
    // 펼침: 요소가 자연 높이로 삽입된 직후·첫 tick 전이라 지금 레이아웃이 곧 최종.
    // 접힘: 잠깐 0으로 접어 최종 레이아웃을 재고 복원(같은 태스크 — 화면엔 안 보임).
    let maxFrom: number | null = null
    let maxTo: number | null = null
    let maxClearAfter = false
    if (navEl) {
      cancelAnimationFrame(maxHeightAnimRaf) // 진행 중 글라이드가 있으면 인수
      const boxH = navEl.clientHeight
      let m: ReturnType<typeof measureSnap> = null
      if (dir === 'out') {
        const saved = {
          h: node.style.height,
          pb: node.style.paddingBottom,
          ov: node.style.overflow
        }
        node.style.overflow = 'hidden'
        node.style.height = '0px'
        node.style.paddingBottom = '0px'
        m = measureSnap()
        node.style.height = saved.h
        node.style.paddingBottom = saved.pb
        node.style.overflow = saved.ov
      } else {
        m = measureSnap()
      }
      if (m) {
        const target = m.overflowing ? m.snapped : m.available
        if (Math.abs(target - boxH) >= 2) {
          maxFrom = boxH
          maxTo = target
          maxClearAfter = !m.overflowing
          navEl.style.maxHeight = `${boxH}px` // 시작점 고정
        }
      }
    }

    return {
      duration,
      easing,
      tick: (t: number) => {
        // intro는 t 0→1, outro는 1→0 — 진행률 p로 정규화
        const p = dir === 'out' ? 1 - t : t
        if (p === 1) {
          // 종료 — tick 방식은 인라인 스타일이 자동 정리되지 않는다
          node.style.overflow = ''
          node.style.height = ''
          node.style.paddingBottom = ''
          if (navEl && maxTo !== null) {
            navEl.style.maxHeight = maxClearAfter ? '' : `${maxTo}px`
          }
          updateScrollFades()
          return
        }
        node.style.overflow = 'hidden'
        node.style.height = `${t * height}px`
        node.style.paddingBottom = `${t * paddingBottom}px`
        if (navEl && maxFrom !== null && maxTo !== null) {
          navEl.style.maxHeight = `${maxFrom + (maxTo - maxFrom) * p}px`
        }
        if (follow && navEl) navEl.scrollTop = navEl.scrollHeight
      }
    }
  }

  // 콘텐츠/뷰포트 변화(서브메뉴 펼침·접힘, 창 크기) 시 재계산.
  // navEl 자체는 관찰하지 않는다(우리가 maxHeight를 바꾸므로 루프 방지).
  //
  // 서브메뉴 슬라이드(200ms) 동안 RO는 매 프레임 발화하는데, recalcNav는
  // maxHeight 해제→측정→전 행 rect 스캔으로 강제 리플로우가 커서 매 프레임
  // 돌리면 슬라이드가 뚝뚝 끊긴다. → 버스트 첫 발화만 즉시 1회, 이후엔
  // 발화가 잠잠해진 뒤(슬라이드 종료 후) 마무리 1회만 돌린다.
  const RECALC_QUIET_MS = 120
  $effect(() => {
    if (!browser || !navEl) return
    let raf = 0
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(recalcNav)
    }
    // trailing 전용 — 발화 즉시(leading) 재계산하면 슬라이드 첫 프레임의
    // 어중간한 중간 상태를 측정해 maxHeight에 굽는다(바우처 444.797px 실측).
    // 잠잠해진 뒤 1회만: 최종 상태만 스냅되고, 변경분은 glide가 부드럽게 편다.
    const schedule = () => {
      clearTimeout(settleTimer)
      settleTimer = setTimeout(run, RECALC_QUIET_MS)
    }
    run() // 마운트 직후 1회는 즉시
    const ro = new ResizeObserver(schedule)
    const inner = navEl.firstElementChild
    if (inner) ro.observe(inner)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(maxHeightAnimRaf)
      clearTimeout(settleTimer)
      ro.disconnect()
      window.removeEventListener('resize', schedule)
    }
  })

  // ── 접힘 상태 호버 플라이아웃 (서브메뉴 팝오버) ──
  // 사이드바가 overflow-hidden이라 fixed 위치로 띄워 잘림을 피한다.
  interface FlyoutState {
    id: string
    top: number
    height: number
  }
  let flyout = $state<FlyoutState | null>(null)
  let flyoutHideTimer: ReturnType<typeof setTimeout> | null = null
  // flyoutItem은 visibleMenuItems 정의 뒤에서 선언 (선언 순서 의존)

  function openFlyout(e: MouseEvent, id: string) {
    if (!effectiveCollapsed) return
    if (flyoutHideTimer) clearTimeout(flyoutHideTimer)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    flyout = { id, top: rect.top, height: rect.height }
  }

  function scheduleFlyoutClose() {
    if (flyoutHideTimer) clearTimeout(flyoutHideTimer)
    flyoutHideTimer = setTimeout(() => {
      flyout = null
    }, 150)
  }

  function cancelFlyoutClose() {
    if (flyoutHideTimer) clearTimeout(flyoutHideTimer)
  }

  // 라우트 변경 시 드로어 자동 닫기
  let prevPathname = $state(browser ? window.location.pathname : '')
  $effect(() => {
    const currentPath = page.url.pathname
    if (prevPathname && currentPath !== prevPathname && sidebarDrawer.isOpen) {
      sidebarDrawer.close()
    }
    prevPathname = currentPath
  })

  // ESC 키로 드로어 닫기
  $effect(() => {
    if (!browser || !isOverlayMode || !sidebarDrawer.isOpen) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sidebarDrawer.close()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  // 사이드바 아이콘 매핑 (On/Off 상태별 Svelte 컴포넌트)
  const iconMap: Record<string, { on: Component; off: Component }> = {
    dashboard: { on: DashboardOn20, off: DashboardOff20 },
    schedule: { on: CalendarOn20, off: CalendarOff20 },
    clients: { on: ClientOn24, off: ClientOff24 },
    counseling: { on: CounselBlue24, off: CounselGray24 },
    billing: { on: CostOn24, off: CostOff24 },
    voucher: { on: VoucherOn24, off: VoucherOff24 },
    assessment: { on: AssessmentStack, off: AssessmentGray24 },
    members: { on: MemberOn24, off: MemberOff24 },
    settings: { on: SettingOn24, off: SettingOff24 },
    myInfo: { on: MyinfoOn24, off: MyinfoOff24 },
    agent: { on: AgentOn24, off: AgentOff24 }
  }
  // On/Off가 없는 단일 아이콘 (고객센터, 공지사항 등)
  const singleIconMap: Record<string, Component> = {
    support: CustomService20,
    notice: NoticeIcon20
  }
  function getIconComponent(
    iconName: string,
    active: boolean
  ): Component | null {
    if (!iconName) return null
    const entry = iconMap[iconName]
    if (entry) return active ? entry.on : entry.off
    return singleIconMap[iconName] ?? null
  }

  // 메인 네비게이션 메뉴 구조 (이미지 기반 순서)
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: '대시보드',
      path: '/dashboard',
      icon: 'dashboard'
    },
    {
      id: 'schedule',
      label: '스케줄',
      path: '/schedule',
      icon: 'schedule',
      children: [
        { label: '일정', path: '/schedule' },
        { label: '변경 요청', path: '/schedule/reservations' }
        // { label: '필드노트', path: '/schedule/field-notes' }
      ]
    },
    {
      id: 'clients',
      label: t('subject'),
      path: '/clients',
      icon: 'clients'
    },
    {
      id: 'voucher',
      label: '바우처',
      path: '/vouchers',
      icon: 'voucher',
      children: [
        { label: '바우처 현황', path: '/vouchers' },
        {
          label: '바우처 관리',
          path: '/settings/vouchers',
          menuId: 'voucherManage'
        }
      ]
    },
    {
      id: 'counseling',
      label: '상담',
      path: '/counseling/status',
      icon: 'counseling',
      children: [
        { label: '상담 현황', path: '/counseling/status' },
        { label: '상담일지', path: '/counseling/notes' },
        {
          label: '프로그램 관리',
          path: '/center/program',
          menuId: 'programManage'
        }
      ]
    },
    {
      id: 'assessment',
      label: '검사',
      path: '/assessment/status',
      icon: 'assessment',
      children: [
        { label: '검사 현황', path: '/assessment/status' },
        {
          label: '검사 관리',
          path: '/center/manage',
          menuId: 'assessmentManage'
        }
      ]
    },
    {
      id: 'members',
      label: '구성원',
      path: '/member',
      icon: 'members',
      children: [
        { label: '구성원', path: '/member' },
        {
          label: '권한 설정',
          path: '/center/authorization',
          menuId: 'settingsAuthorization'
        }
      ]
    },
    {
      id: 'billing',
      label: '청구',
      path: '/billing',
      icon: 'billing',
      children: [{ label: '청구 내역', path: '/billing' }]
    },
    {
      id: 'settings',
      label: '설정',
      path: '/center/info',
      icon: 'settings',
      // 문서/문자 양식은 각각 독립 서브메뉴 (옛 '양식 관리' 탭 묶음 해체).
      // (검사 관리→검사 / 권한 설정→구성원 / 바우처 관리→바우처 / 프로그램 관리→상담 으로 각각 이관)
      children: [
        { label: '센터 정보', path: '/center/info' },
        // 공간 관리는 GNB에서 제외 — 센터 정보 좌측 패널의 진입점 하나만 남긴다
        // (같은 화면으로 가는 길이 둘이면 어디에 속한 화면인지가 흐려진다)
        // 문서 양식은 프로덕션에서 숨김 (HIDDEN_CHILD_PATHS)
        {
          label: '문서 양식',
          path: '/center/form-templates',
          menuId: 'formTemplates'
        },
        {
          label: '문자 양식',
          path: '/center/message-templates',
          menuId: 'messageTemplates'
        }
      ]
    },
    {
      id: 'myInfo',
      label: '내 정보',
      path: '/myInfo',
      icon: 'myInfo'
    }
    // {
    //   id: 'agent',
    //   label: '에이전트',
    //   path: '/agent',
    //   icon: 'agent'
    // }
  ]

  // 하단 메뉴 (공지사항, 고객센터 - 계정/내정보/로그아웃은 사용자 블록 드롭다운에서)
  const bottomMenuItems: MenuItem[] = [
    {
      id: 'notice',
      label: '공지사항',
      path: '/notice',
      icon: 'notice'
    },
    {
      id: 'support',
      label: '고객센터',
      path: '/support',
      icon: 'support'
    }
  ]

  // 현재 센터명 (centerStore에서 파생)
  const currentCenterName = $derived.by(() => {
    const { currentCenterId, centers } = $centerStore
    if (!currentCenterId) return ''
    const center = centers.find((c) => c.id === currentCenterId)
    return center?.name ?? ''
  })

  // 현재 센터로고 (centerStore에서 파생)
  const currentCenterLogo = $derived.by(() => {
    const { currentCenterId, centers } = $centerStore
    if (!currentCenterId) return ''
    const center = centers.find((c) => c.id === currentCenterId)
    return center?.logo_url ?? ''
  })

  // 권한 기반 메뉴 필터링 (서버 역할: ADMIN/MANAGER/STAFF/COUNSELOR에 맞춤)
  // 권한 확정 전에는 메뉴를 렌더하지 않아, 상담사 등에서 구성원/설정이 잠깐 보였다 사라지는 현상 방지
  const permissionContext = $derived($permissionStore.context)
  const permissionReady = $derived(
    permissionContext != null && !$permissionStore.isLoading
  )
  const permissions = $derived(permissionContext?.permissions ?? [])
  const userRole = $derived(permissionContext?.role ?? null)
  /** 변경 요청 대기 건수 폴링 주기 — 알림 벨과 같은 결 */
  const PENDING_POLL_INTERVAL = 60_000

  // 처리 대기 중인 일정 변경 요청 — 있으면 스케줄 메뉴에 건수를 띄운다
  const changeRequestsQuery = queryBuilder(
    getScheduleChangeRequests,
    () => ({ center_id: $centerId ?? '', status: 'pending' as const }),
    () => ({
      enabled: !!$centerId,
      refetchInterval: PENDING_POLL_INTERVAL,
      refetchOnWindowFocus: true
    })
  )
  const pendingChangeCount = $derived(
    ((changeRequestsQuery.data as unknown[]) ?? []).length
  )
  const MENU_BADGE_COUNT = $derived<Record<string, number>>({
    schedule: pendingChangeCount
  })
  const CHILD_BADGE_COUNT = $derived<Record<string, number>>({
    '/schedule/reservations': pendingChangeCount
  })

  // AI(에이전트·필드노트)는 리빙랩·개발 노출, 운영 미배포 (D1 확정 2026-07-20)
  const aiVisible = $derived(showAiFeatures(page.url.hostname))
  const isProduction = $derived(
    resolveAppEnv(page.url.hostname) === 'production'
  )
  const HIDDEN_MENU_IDS = $derived(aiVisible ? [] : ['agent'])
  const HIDDEN_CHILD_PATHS = $derived([
    ...(aiVisible ? [] : ['/schedule/field-notes']),
    // 문서 양식: 구현 완료 전까지 프로덕션에서만 숨김 (개발 환경에서는 노출)
    ...(isProduction ? ['/center/form-templates'] : [])
  ])
  const visibleMenuItems = $derived(
    !permissionReady
      ? []
      : menuItems
          .filter((item) =>
            canShowSidebarMenu(item.id as SidebarMenuId, permissions, userRole)
          )
          .filter((item) => !HIDDEN_MENU_IDS.includes(item.id))
          .map((item) => {
            if (!item.children) return item

            const filteredChildren = item.children.filter((child) => {
              // 프로덕션에서 개발중 서브메뉴 숨김
              if (HIDDEN_CHILD_PATHS.includes(child.path)) return false
              // Free 플랜도 AI 사용량 메뉴 노출 (페이지에서 업그레이드 유도)
              // 서브탭 자체 권한이 선언돼 있으면 그것으로 필터 (없으면 부모 권한만 적용)
              if (child.menuId)
                return canShowSidebarMenu(child.menuId, permissions, userRole)
              return true
            })
            // 서브탭이 하나뿐이면 확장/축소 없이 단일 링크로 렌더한다.
            // (예: 스케줄 — 현재 '일정'만 노출) 서브탭이 추가되면 자동으로 다시 확장형이 된다.
            if (filteredChildren.length <= 1) {
              const soleChild = filteredChildren[0]
              return {
                ...item,
                children: undefined,
                path: soleChild?.path ?? item.path
              }
            }
            return { ...item, children: filteredChildren }
          })
  )

  // 플라이아웃 대상 메뉴 (visibleMenuItems 정의 이후에 선언)
  const flyoutItem = $derived(
    flyout ? visibleMenuItems.find((i) => i.id === flyout!.id) : null
  )

  // 하단 메뉴도 권한에 따라 표시 (고객센터 등)
  const visibleBottomMenuItems = $derived(
    !permissionReady
      ? []
      : bottomMenuItems.filter((item) =>
          canShowSidebarMenu(item.id as SidebarMenuId, permissions, userRole)
        )
  )

  // 수동으로 확장된 메뉴 ID (토글용)
  let expandedMenuId: string | null = $state(null)

  // 현재 경로에 해당하는 메뉴 ID를 찾는 함수 (필터링된 메뉴 목록 기준)
  function getActiveMenuId(
    pathname: string,
    items: { id: string; path?: string; children?: SubMenuItem[] }[]
  ): string | null {
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        const isChildActive = item.children.some(
          (child) =>
            pathname === child.path || pathname.startsWith(child.path + '/')
        )
        const isParentActive =
          item.path &&
          (pathname === item.path || pathname.startsWith(item.path + '/'))

        if (isChildActive || isParentActive) {
          return item.id
        }
      }
    }
    return null
  }

  // 현재 URL에 해당하는 활성 메뉴 ID (표시 중인 메뉴 기준)
  const activeMenuId = $derived(
    getActiveMenuId(page.url.pathname, visibleMenuItems)
  )

  // URL 변경 시: 해당 메뉴가 서브메뉴 있으면 열기, 리프 메뉴로 이동 시 열린 서브메뉴 닫기
  $effect(() => {
    if (activeMenuId) {
      expandedMenuId = activeMenuId
    } else {
      expandedMenuId = null
    }
  })

  // 메뉴 토글 함수
  function toggleMenu(menuId: string) {
    if (expandedMenuId === menuId) {
      expandedMenuId = null
    } else {
      expandedMenuId = menuId
    }
  }

  // 현재 활성화된 메뉴 아이템 확인 (하위 경로 포함)
  // siblings: 형제 서브메뉴 path 목록. 현재 경로에 더 구체적으로 매칭되는
  // 형제가 있으면(예: '/billing/price-list'), 짧은 prefix path('/billing')는
  // 정확 일치(===)만 활성으로 인정한다. (형제 prefix 충돌 시 중복 하이라이트 방지)
  function isActive(path: string, siblings?: string[]): boolean {
    const pathname = page.url.pathname
    if (pathname === path) return true

    const hasMoreSpecificSibling =
      siblings?.some(
        (sib) =>
          sib !== path &&
          sib.startsWith(path + '/') &&
          (pathname === sib || pathname.startsWith(sib + '/'))
      ) ?? false
    if (hasMoreSpecificSibling) return false

    return pathname.startsWith(path + '/')
  }

  // 메뉴 아이템이 확장되어 있는지 확인
  function isExpanded(menuId: string): boolean {
    return expandedMenuId === menuId
  }

  // 메뉴 그룹이 활성화되어 있는지 확인 (부모 path 포함 시 활성, 또는 자식 중 하나 활성)
  // 예: /assessment/receive 에서도 검사 탭이 활성화되도록 부모 경로 매칭
  function isMenuGroupActive(item: MenuItem): boolean {
    const parentActive =
      item.path &&
      (page.url.pathname === item.path ||
        page.url.pathname.startsWith(item.path + '/'))
    if (item.children) {
      const siblingPaths = item.children.map((c) => c.path)
      return (
        !!parentActive ||
        item.children.some((child) => isActive(child.path, siblingPaths))
      )
    }
    return item.path ? isActive(item.path) : false
  }

  // getMe 쿼리 (시크릿 모드 등에서 사용)
  const meQuery = $derived(queryBuilder(getMe))
  const meData = $derived(meQuery.data as MeResponse | undefined)

  async function toggleSecretMode() {
    const accountId = meData?.account?.email || meData?.account?.id
    const centerId = requireCenterId()
    if (!accountId || !centerId) return

    if ($isSecretMode) {
      secretModeStore.disable(accountId, centerId)
    } else {
      const { default: SecretModeActivateModal } = await import(
        '$lib/components/modal/SecretModeActivateModal.svelte'
      )
      // 아이콘 중심 다이얼로그 = Web_Design.md §popup 폭 420 (md 640은 2단 카드가 늘어진다)
      const result = await modalStore.openWithPromise(
        SecretModeActivateModal,
        {},
        { customWidth: 420 }
      )
      if (result === 'masking' || result === 'lockscreen') {
        secretModeStore.enable(accountId, centerId, result)
      }
    }
  }
</script>

{#if isOverlayMode && sidebarDrawer.isOpen}
  <!-- 오버레이 배경 (모바일/태블릿) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 bg-black/50"
    transition:fade={{ duration: 200 }}
    onclick={() => sidebarDrawer.close()}
    onkeydown={(e) => {
      if (e.key === 'Escape') sidebarDrawer.close()
    }}
  ></div>
{/if}

<aside
  style={isOverlayMode
    ? 'width: 240px; padding-left: 0.75rem; padding-right: 0.75rem;'
    : 'width: var(--sidebar-width, 280px); padding-left: var(--sidebar-px, 0.75rem); padding-right: var(--sidebar-px, 0.75rem);'}
  class="flex flex-col border-r border-gray-200 bg-white {isOverlayMode
    ? 'fixed inset-y-0 left-0 z-50 h-full' +
      (sidebarDrawer.isOpen ? ' translate-x-0' : ' -translate-x-full')
    : 'relative shrink-0 h-full'} {transitionEnabled
    ? 'transition-all duration-300'
    : ''}"
>
  {#if !isOverlayMode}
    <!-- 사이드바 가장자리 토글 버튼 (데스크탑에서만) -->
    <button
      onclick={toggleSidebar}
      class="absolute -right-3 top-1/2 z-50 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-md transition-all hover:bg-gray-50 hover:text-gray-600"
      title={isCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
    >
      <svg
        style="transform: rotate(var(--sidebar-toggle-rotate, 0deg));"
        class="h-3.5 w-3.5 {transitionEnabled
          ? 'transition-transform duration-300'
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
  {/if}

  <!-- 메인 메뉴 영역 (역할별 권한에 따라 표시) -->
  <nav
    bind:this={navEl}
    onscroll={updateScrollFades}
    class="scrollbar-none flex-1 overflow-y-auto overscroll-contain pt-4 [overflow-anchor:none]"
  >
    <ul class="flex flex-col gap-1.5">
      {#if !permissionReady}
        <li class="px-5 py-3">
          <span class="sidebar-label text-sm text-gray-500 whitespace-nowrap"
            >메뉴 불러오는 중...</span
          >
        </li>
      {:else}
        {#each visibleMenuItems as item (item.id)}
          {@const itemActive = isMenuGroupActive(item)}
          {@const IconC = getIconComponent(item.icon, itemActive)}
          <li>
            {#if item.children && item.children.length > 0}
              <!-- 확장된 메뉴 전체를 감싸는 컨테이너 -->
              <div
                role="presentation"
                onmouseenter={(e) => {
                  openFlyout(e, item.id)
                  // 클릭 시 goto가 서브메뉴 슬라이드와 동시에 달린다 — 라우트
                  // 모듈·데이터를 호버 시점에 미리 받아 애니메이션 중 메인스레드
                  // 작업을 줄인다(자식 링크의 preload-data="hover"와 동일 관례).
                  if (item.children?.length)
                    preloadData(item.children[0].path).catch(() => {})
                }}
                onmouseleave={scheduleFlyoutClose}
                class="group/menu relative overflow-hidden rounded-xl bg-transparent transition-[background-color] duration-300 ease-in-out {isMenuGroupActive(
                  item
                )
                  ? 'bg-gray-50!'
                  : ''}"
              >
                <!-- 하위 메뉴가 있는 경우 -->
                <button
                  onclick={() => {
                    if (effectiveCollapsed) {
                      // 축소 모드에서는 첫 번째 서브메뉴로 바로 이동
                      goto(item.children![0].path)
                    } else if (isMenuGroupActive(item)) {
                      toggleMenu(item.id)
                    } else {
                      // 서브메뉴를 여기서 즉시 펼치지 않는다 — goto와 동시에 펼치면
                      // 새 페이지 모듈 로드·마운트가 슬라이드 중간에 메인스레드를
                      // 점유해 애니메이션이 뚝뚝 끊긴다(rAF 측정: 슬라이드 중 266ms
                      // 프레임 정지). 네비게이션 완료 후 URL $effect가 펼치므로
                      // 슬라이드는 한가한 스레드에서 60fps로 돈다.
                      goto(item.children![0].path)
                    }
                  }}
                  class="group flex h-12.5 w-full cursor-pointer items-center px-4 {effectiveCollapsed
                    ? 'justify-center'
                    : 'justify-between'}"
                  title={effectiveCollapsed ? item.label : undefined}
                >
                  <div
                    class="flex items-center gap-3 {effectiveCollapsed
                      ? 'flex-none'
                      : 'flex-1'}"
                  >
                    {#if IconC}
                      <span class="shrink-0 h-5 w-5 flex-center">
                        <IconC />
                      </span>
                    {/if}
                    {#if !effectiveCollapsed}
                      <span
                        class="sidebar-label text-title-01-normal-semibold whitespace-nowrap {itemActive
                          ? 'text-gray-900'
                          : 'text-gray-600 group-hover:text-gray-900'}"
                      >
                        {item.label}
                      </span>
                    {/if}
                  </div>
                  {#if MENU_BADGE_COUNT[item.id]}
                    <span
                      class="mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white"
                      aria-label={`처리 대기 ${MENU_BADGE_COUNT[item.id]}건`}
                    >
                      {MENU_BADGE_COUNT[item.id]}
                    </span>
                  {/if}
                  {#if !effectiveCollapsed}
                    <span
                      class="sidebar-label flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-300 {isExpanded(
                        item.id
                      )
                        ? 'rotate-180'
                        : ''}"
                    >
                      <ArrowDownIcon20 />
                    </span>
                  {/if}
                </button>

                <!-- 서브메뉴 (축소 모드에서는 숨김) -->
                {#if !effectiveCollapsed && isExpanded(item.id)}
                  <!-- pb-1(4): 마지막 항목 h-10 의 아래 여백 12 + 4 = 상단(h-12.5 기준 16)과 동일하게 -->
                  <ul
                    data-submenu-id={item.id}
                    class="flex flex-col pb-1"
                    in:submenuSlide={{ duration: 300, easing: cubicOut }}
                    out:submenuSlide={{ duration: 300, easing: cubicOut }}
                  >
                    {#each item.children as child (child.path)}
                      <li>
                        <a
                          href={child.path}
                          data-sveltekit-preload-data="hover"
                          class="relative flex h-10 items-center pr-6 pl-14 text-[16px] leading-4 font-medium tracking-[-0.41px] {isActive(
                            child.path,
                            item.children?.map((c) => c.path)
                          )
                            ? 'text-gray-700'
                            : 'text-gray-500 hover:text-gray-900'}"
                        >
                          {child.label}
                          {#if CHILD_BADGE_COUNT[child.path]}
                            <span
                              class="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold text-white"
                            >
                              {CHILD_BADGE_COUNT[child.path]}
                            </span>
                          {/if}
                        </a>
                      </li>
                    {/each}
                  </ul>
                {/if}

                <!-- 축소 모드 호버 시: 서브메뉴 플라이아웃은 aside 바깥(fixed)에서 렌더 -->
              </div>
            {:else}
              <!-- 하위 메뉴가 없는 경우 -->
              <div
                class="group/menu relative overflow-hidden rounded-xl bg-transparent transition-[background-color] duration-300 ease-in-out {item.path &&
                isActive(item.path)
                  ? 'bg-gray-50!'
                  : ''}"
              >
                <a
                  href={item.path}
                  data-sveltekit-preload-data="hover"
                  class="group flex h-12.5 w-full items-center gap-3 px-4 {effectiveCollapsed
                    ? 'justify-center'
                    : ''}"
                  title={effectiveCollapsed ? item.label : undefined}
                >
                  {#if IconC}
                    <span class="shrink-0 h-5 w-5 flex-center">
                      <IconC />
                    </span>
                  {:else}
                    <span class="shrink-0 h-5 w-5" aria-hidden="true"></span>
                  {/if}
                  {#if !effectiveCollapsed}
                    <span
                      class="sidebar-label text-title-01-normal-semibold whitespace-nowrap {itemActive
                        ? 'text-gray-900'
                        : 'text-gray-600 group-hover:text-gray-900'}"
                    >
                      {item.label}
                    </span>
                  {/if}
                </a>
                <!-- 축소 모드: 호버 시 툴팁 -->
                {#if effectiveCollapsed}
                  <div
                    class="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover/menu:opacity-100"
                  >
                    <div
                      class="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white shadow-lg whitespace-nowrap"
                    >
                      {item.label}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </nav>

  <!-- 하단 메뉴 (계정 정보, 고객센터 - body-03-medium, 맨 아래 고정) -->
  {#if permissionReady}
    <div class="mt-auto pt-4 pb-4 {effectiveCollapsed ? '' : ''}">
      <ul class="flex flex-col gap-0.5">
        {#each visibleBottomMenuItems as item (item.id)}
          {@const isBottomActive = item.path ? isActive(item.path) : false}
          {@const BottomIconC = getIconComponent(item.icon, isBottomActive)}
          <li class="group/menu relative px-1">
            <a
              href={item.path}
              data-sveltekit-preload-data="hover"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {isBottomActive
                ? 'bg-gray-50'
                : 'hover:bg-gray-50'} {effectiveCollapsed
                ? 'justify-center'
                : 'justify-start'}"
              title={effectiveCollapsed ? item.label : undefined}
            >
              {#if BottomIconC}
                <span
                  class="shrink-0 h-4 w-4 {isBottomActive
                    ? 'text-primary-500'
                    : 'text-gray-400 group-hover/menu:text-primary-900'}"
                >
                  <BottomIconC />
                </span>
              {/if}
              {#if !effectiveCollapsed}
                <Typography
                  variant="body-02-normal-medium"
                  tag="span"
                  color={isBottomActive ? 'text-gray-900' : 'text-gray-500'}
                  className="sidebar-label whitespace-nowrap group-hover/menu:text-gray-900"
                >
                  {item.label}
                </Typography>
              {/if}
            </a>
            {#if effectiveCollapsed}
              <div
                class="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover/menu:opacity-100"
              >
                <div
                  class="rounded-lg bg-gray-800 px-3 py-2 shadow-lg whitespace-nowrap"
                >
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-white"
                  >
                    {item.label}
                  </Typography>
                </div>
              </div>
            {/if}
          </li>
        {/each}

        <!-- 구분선 -->
        <li class="my-2 mx-3 h-px bg-gray-100" aria-hidden="true"></li>

        <!-- 시크릿 모드 토글 -->
        <li class="group/secret relative px-1">
          <button
            type="button"
            onclick={toggleSecretMode}
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors
            {$isSecretMode ? 'bg-[#FFA1000F]' : 'hover:bg-gray-50'}
            {effectiveCollapsed ? 'justify-center' : ''}"
            title={effectiveCollapsed ? '시크릿 모드' : undefined}
            aria-label="시크릿 모드 전환"
          >
            <span class="shrink-0 flex items-center justify-center">
              {#if $isSecretMode}
                <SecretOnIcon20 />
              {:else}
                <SecretOffIcon20 />
              {/if}
            </span>
            {#if !effectiveCollapsed}
              <Typography
                variant="body-02-normal-medium"
                tag="span"
                color={$isSecretMode ? 'text-semantic-notice' : 'text-gray-500'}
                className="sidebar-label whitespace-nowrap"
              >
                시크릿 모드
              </Typography>
            {/if}
          </button>
          <!-- 축소 모드 툴팁 -->
          {#if effectiveCollapsed}
            <div
              class="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover/secret:opacity-100"
            >
              <div
                class="rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white shadow-lg whitespace-nowrap"
              >
                시크릿 모드 {$isSecretMode ? 'ON' : 'OFF'}
              </div>
            </div>
          {/if}
        </li>
      </ul>
    </div>
  {/if}
</aside>

<!-- 접힘 상태 서브메뉴 플라이아웃 (aside 바깥 fixed — overflow 영향 없음) -->
{#if flyout && flyoutItem?.children?.length && effectiveCollapsed}
  <div
    role="presentation"
    onmouseenter={cancelFlyoutClose}
    onmouseleave={scheduleFlyoutClose}
    class="fixed z-50 ml-2 min-w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
    style="left: var(--sidebar-width, 72px); top: {flyout.top +
      flyout.height / 2}px; transform: translateY(-50%)"
    transition:fade={{ duration: 120 }}
  >
    <div class="px-3 py-1.5 text-xs font-semibold tracking-wider text-gray-400">
      {flyoutItem.label}
    </div>
    {#each flyoutItem.children as child (child.path)}
      <a
        href={child.path}
        data-sveltekit-preload-data="hover"
        onclick={() => (flyout = null)}
        class="block px-3 py-2 text-sm font-medium whitespace-nowrap {isActive(
          child.path,
          flyoutItem.children?.map((c) => c.path)
        )
          ? 'bg-gray-50 text-gray-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}"
      >
        {child.label}
      </a>
    {/each}
  </div>
{/if}
