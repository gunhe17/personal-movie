<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { auth } from '$lib/stores/auth'
  import { institutionStore, institutionId } from '$lib/stores/institution.store'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import Sidebar from '$lib/components/layout/Sidebar.svelte'
  import Header from '$lib/components/layout/Header.svelte'
  import Drawer from '$lib/components/layout/Drawer.svelte'
  import Snackbar from '$lib/components/feedback/Snackbar.svelte'
  import ModalContainer from '$lib/components/modal/ModalContainer.svelte'
  import SecretModeLockScreen from '$lib/components/SecretModeLockScreen.svelte'

  let { children } = $props()
  let sidebarOpen = $state(false)

  // 자체 전체화면 레이아웃을 갖는 페이지 (앱 sidebar/header 숨김)
  // - HTP 검사 페이지
  // - 로르샤하 영역 에디터 (어드민)
  // - ?embed=1: 종합보고서 모달 등에 iframe 임베드 (앱 셸 완전 제거)
  let isFullscreenPage = $derived(
    page.url.searchParams.get('embed') === '1' ||
      /\/examinations\/[^/]+\/htp/.test(page.url.pathname) ||
      /^\/admin\/rorschach-areas/.test(page.url.pathname)
  )

  /**
   * 기관 목록 채우기 — 헤더의 기관명이 이 목록에서 이름을 찾는다.
   *
   * 실패해도 삼킨다. 이름이 없으면 헤더가 그 부분만 비울 뿐이고,
   * 여기서 화면을 막을 이유는 없다.
   */
  async function loadInstitutions() {
    try {
      const { get } = await import('$lib/services/api/instances')
      const me = await get<{
        institutions: Array<{
          institution_id: string
          institution_name: string
          role: 'admin' | 'clinician' | 'researcher'
        }>
      }>('/auth/me')
      institutionStore.setInstitutions(
        (me.institutions ?? []).map((m) => ({
          id: m.institution_id,
          name: m.institution_name,
          role: m.role
        }))
      )
    } catch {
      // 이름 없이 진행 — 헤더가 알아서 비운다
    }
  }

  onMount(() => {
    // 이미 로그인 상태면 서버 체크 스킵 (로그인 직후 리다이렉트)
    let currentAuth: { isAuthenticated: boolean } = { isAuthenticated: false }
    const unsub = auth.subscribe(($a) => (currentAuth = $a))
    unsub()

    if (!currentAuth.isAuthenticated) {
      // 페이지 새로고침 시: 서버에서 httpOnly 쿠키 확인
      fetch('/api/auth/check')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          auth.initialize(data?.user ?? null)
          if (data?.currentInstitutionId) {
            institutionStore.hydrate({
              currentInstitutionId: data.currentInstitutionId,
              institutions: []
            })
            // 목록은 쿠키에 없다(/api/auth/check는 id만 준다). 비워 두면
            // 헤더가 id로 이름을 못 찾아 기관명·구분선이 통째로 사라진다
            // — 로그인 직후엔 보이다가 새로고침하면 없어지는 증상.
            loadInstitutions()
          }
        })
        .catch(() => auth.initialize(null))
    } else {
      auth.setLoading(false)
    }

    const unsubscribe = auth.subscribe(($auth) => {
      if (!$auth.isLoading && !$auth.isAuthenticated) {
        goto('/login')
      }
    })

    return unsubscribe
  })

  // 시크릿 모드 store 복구 — auth 와 institution 둘 다 들어오면 1회 초기화.
  let secretInitialized = $state(false)
  $effect(() => {
    const accountId = $auth.user?.id
    const instId = $institutionId
    if (secretInitialized || !accountId || !instId) return
    secretModeStore.initialize(accountId, instId)
    secretInitialized = true
  })
</script>

{#if isFullscreenPage}
  <!-- HTP 등 전체화면 레이아웃: 자체 sidebar/header 포함 -->
  {@render children()}
{:else}
  <!--
    골격 — 헤더가 전폭 최상단, 사이드바는 그 아래.
    (참조 프로젝트 src/routes/+layout.svelte와 같은 순서. 로고는 헤더가 갖는다.)
  -->
  <div class="flex h-screen flex-col overflow-hidden bg-gray-50">
    <Header onMenuToggle={() => (sidebarOpen = true)} />

    <div class="flex min-h-0 flex-1">
      <div class="hidden lg:contents">
        <Sidebar />
      </div>

      <Drawer
        open={sidebarOpen}
        onClose={() => (sidebarOpen = false)}
        side="left"
        hideAt="lg"
      >
        <Sidebar overlay onNavigate={() => (sidebarOpen = false)} />
      </Drawer>

      <main class="min-w-0 flex-1 overflow-y-auto bg-background">
        {@render children()}
      </main>
    </div>
  </div>
{/if}

{#if secretModeStore.mode === 'lockscreen'}
  <SecretModeLockScreen />
{/if}

<ModalContainer />
<Snackbar />
