<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { beforeNavigate } from '$app/navigation'
  import { browser } from '$app/environment'
  import { modalStore } from '$lib/stores/modal'

  import { auth } from '$lib/stores/auth'
  import { centerStore } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { sidebarDrawer } from '$lib/stores/sidebar.svelte'
  import UnifiedSidebar from '@common/components/layout/UnifiedSidebar.svelte'
  import AppHeader from '$lib/components/layout/AppHeader.svelte'
  import PushToast from '$lib/features/notification/components/PushToast.svelte'

  import ModalContainer from '$lib/components/modal/ModalContainer.svelte'
  import Snackbar from '$lib/components/Snackbar.svelte'
  import AgentFloatingIcon from '$lib/components/agent/AgentFloatingIcon.svelte'
  import MockAgentController from '$lib/components/agent/MockAgentController.svelte'
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
  import SidePanelContainer from '../lib/components/sidepanel/SidePanelContainer.svelte'
  import type { LayoutData } from './$types'

  let { children, data }: { children: any; data: LayoutData } = $props()

  // ModalContainer가 라우트 밖(이 레이아웃)에 살아 라우트만 바뀌면 모달 오버레이·스크롤 잠금이
  // 그대로 남는다 — 화면이 안 변하니 "뒤로가기가 안 먹는" 것으로 보인다.
  // after가 아니라 before여야 한다: 도착 페이지가 마운트되며 여는 모달(agent prefill)보다
  // 반드시 먼저 실행돼 방금 연 모달을 되레 닫는 순서 경쟁이 생기지 않는다.
  beforeNavigate(() => modalStore.closeAll())

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: browser, // 서버 사이드에서 쿼리 실행 방지
        refetchOnWindowFocus: false, // 윈도우 포커스 시에 refetch옵션 비활성화
        retry: 0, // 요청 에러 시 재요청 횟수 설정(Back 단에서 데이터 없음 상태를 의도적으로 404로 설정하여 get요청시 불필요한 재시도를 0회로 설정)
        // retryDelay: attemptIndex => Math.min(3000 ** attemptIndex, 30000) // 재시도 간격 설정(매 시도마다 3초 간격)
        experimental_prefetchInRender: true // Svelte 5 호환성을 위한 플래그
      }
    }
  })

  // 헤더와 네비게이션을 숨겨야 하는 경로들
  const hideLayoutPaths = [
    '/login',
    '/signup',
    '/welcome',
    '/accept-invitation',
    '/assessment/login',
    '/assessment-flow/login',
    '/assessment-flow/centers',
    '/assessment-flow/receive',
    '/assessment-flow/rorschach',
    '/assessment/rorschach',
    '/assessment/receive/excel-preview',
    '/operation/operation',
    '/assessment-case/',
    '/package',
    '/admin',
    '/terms',
    '/privacy',
    '/verify-result',
    '/verify-link',
    '/forms/fill'
  ]

  // 풀스크린 편집기 경로 (대시보드 크롬 없이 자체 작업 화면을 갖는 페이지)
  // 예: /center/form-templates/{id}/edit — 목록·상세는 유지하고 편집기만 탈출
  const fullscreenEditorPatterns = [
    /^\/center\/form-templates\/[^/]+\/edit\/?$/
  ]

  // 현재 경로가 레이아웃을 숨겨야 하는지 확인
  const shouldHideLayout = $derived(
    hideLayoutPaths.some((path) => page.url.pathname.startsWith(path)) ||
      fullscreenEditorPatterns.some((re) => re.test(page.url.pathname))
  )

  // 접수 페이지: 레이아웃은 유지하되 여백을 별도 적용
  const receivePaths = [
    '/assessment/receive',
    '/counseling/receive',
    '/operation/receive',
    '/clients/register',
    '/agent/counseling/receive'
  ]
  const isReceivePage = $derived(
    receivePaths.some((path) => page.url.pathname.startsWith(path))
  )

  // 하단 패딩 없는 페이지
  const noPaddingBottomPaths = ['/myInfo']
  const isNoPaddingBottom = $derived(
    noPaddingBottomPaths.some(
      (path) =>
        page.url.pathname === path || page.url.pathname.startsWith(path + '/')
    )
  )

  // 오버레이 모드 (태블릿/모바일)
  const isOverlayMode = $derived(!responsive.isDesktop)

  // 센터명/로고 (헤더 바에서 사용)
  const currentCenterName = $derived.by(() => {
    const { currentCenterId, centers } = $centerStore
    if (!currentCenterId) return ''
    const center = centers.find((c: { id: string }) => c.id === currentCenterId)
    return center?.name ?? ''
  })
  const currentCenterLogo = $derived.by(() => {
    const { currentCenterId, centers } = $centerStore
    if (!currentCenterId) return ''
    const center = centers.find((c: { id: string }) => c.id === currentCenterId)
    return center?.logo_url ?? ''
  })

  onMount(async () => {
    // (protected) 외 경로(예: /assessment/receive) 새로고침 시에도 centerId를 복원
    centerStore.initialize()

    // 서버에서 전달받은 user 정보로 auth store 초기화
    if (data.user) {
      auth.login(data.user)
    } else {
      // HTTP-Only 쿠키 환경에서는 클라이언트에서 토큰을 읽을 수 없음
      // 개발용 mock 로그인의 경우에만 checkAuth 사용
      auth.checkAuth()
    }

    // Firebase Push 초기화 (로그인 상태 + Firebase 설정 존재)
    if (data.user && data.firebaseAvailable) {
      try {
        const { initializeFirebaseConfig } = await import(
          '$lib/services/firebase/config'
        )
        initializeFirebaseConfig(data.firebaseConfig)

        const { initializePush, setVapidKey } = await import(
          '$lib/services/firebase/messaging'
        )
        setVapidKey(data.firebaseVapidKey)
        await initializePush(queryClient)
      } catch (err) {
        // Firebase 미설정 시 무시 (graceful degradation)
        console.debug('[FCM] Push initialization skipped:', err)
      }
    }
  })
</script>

<QueryClientProvider client={queryClient}>
  {#if shouldHideLayout}
    <!-- 레이아웃 없이 페이지만 표시 (검사 예약, 로르샤흐 등) -->
    {@render children?.()}
  {:else}
    <!-- 기본 레이아웃 (헤더 + 사이드바 + 메인) -->
    <div class="flex min-h-dvh xl:h-screen flex-col bg-gray-50">
      <!-- 상단 헤더 -->
      <AppHeader
        centerName={currentCenterName}
        centerLogo={currentCenterLogo}
        {isOverlayMode}
        onMenuOpen={() => sidebarDrawer.open()}
      />

      <!-- 사이드바 + 메인 -->
      <div class="flex flex-1 xl:min-h-0">
        <UnifiedSidebar />

        <main class="flex-1 flex flex-col bg-gray-50 xl:min-h-0 min-w-0">
          <div
            class="flex-1 min-w-0 overscroll-contain xl:overflow-y-auto {isReceivePage
              ? 'p-0'
              : isOverlayMode
                ? 'px-4 py-4'
                : isNoPaddingBottom
                  ? 'px-20 pt-5 pb-0'
                  : 'px-20 pt-5 pb-8'}"
          >
            <!--
              하단 여백 20 → 32. 늘어난 만큼은 콘텐츠 영역(h-full 페이지 높이)에서 가져간다 —
              셸을 넘치게 해 스크롤로 여백을 만들면 여유 있는 화면(권한 설정·관리류)까지
              20px짜리 군더더기 스크롤이 생긴다.
            -->
            {@render children?.()}
          </div>
        </main>
      </div>
    </div>
  {/if}

  <!-- 모달 컨테이너 -->
  <ModalContainer />

  <SidePanelContainer />

  <!-- 스낵바 -->
  <Snackbar />

  <!-- Push 알림 토스트 -->
  <PushToast />

  <!-- AI Agent 플로팅 아이콘 (테스트 단계 — 비활성) -->
  <!-- <AgentFloatingIcon /> -->

  <!-- 촬영용 목 에이전트 — 화면 요소 없음, 단축키로 턴 진행 (/lab/agent-mock에서 시작) -->
  <MockAgentController />
</QueryClientProvider>
