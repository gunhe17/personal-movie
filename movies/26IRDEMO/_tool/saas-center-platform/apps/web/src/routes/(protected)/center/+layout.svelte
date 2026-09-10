<script lang="ts">
  /**
   * 센터 설정 화면 공통 레이아웃
   *
   * 1) 화면 하나 = 사이드바 메뉴 하나. 옛 '양식 관리' 상단 탭(문서/문자)은 해체하고
   *    문서 양식·문자 양식을 각각 '설정' 서브메뉴로 세웠다(UnifiedSidebar).
   *    타이틀만 레이아웃이 얹고, 페이지의 메인 CTA는 pageAction 스토어로 올려받는다.
   * 2) /center/* 전체 라우트 가드 — COUNSELOR도 read:center를 갖고 있어(서버 기본 역할 권한)
   *    PermissionGuard(read:center)만으로는 안 막힌다. 사이드바에서 숨긴 것과 같은 기준을
   *    라우트에도 강제해야 URL 직접 입력으로 뚫리지 않는다.
   */
  import { page } from '$app/state'

  import MenuAccessGuard from '$lib/components/MenuAccessGuard.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { pageAction } from '$lib/stores/page-action'

  let { children } = $props()

  /**
   * 레이아웃이 타이틀을 소유하는 화면 — 사이드바 메뉴가 곧 진입점이라 타이틀만 얹는다.
   * (프로그램 관리는 '상담', 공간 관리·센터 정보는 '설정' 서브메뉴로 각각 이관)
   *
   * 타이틀 우측 액션 버튼(등록·추가)은 페이지가 `pageAction`으로 올려보낸다 —
   * 화면이 버튼을 쥐고 있어도 타이틀 행에 나란히 선다.
   * 예: /center/room(상담실 등록)·/center/program(프로그램 등록)은 아직 페이지에서
   * PageTitleSection을 직접 렌더하므로 여기 두지 않는다.
   */
  const TITLES: Record<string, string> = {
    '/center/info': '센터 정보',
    '/center/form-templates': '문서 양식',
    '/center/message-templates': '문자 양식'
  }

  // 하위 라우트(/center/form-templates/[id])에서도 부모 타이틀을 유지한다
  const title = $derived(
    Object.entries(TITLES).find(
      ([path]) =>
        page.url.pathname === path || page.url.pathname.startsWith(path + '/')
    )?.[1] ?? null
  )

  /** 프로그램 관리는 '상담' 서브메뉴로 이관됐지만 접근 조건은 그대로(settings 복제) */
  const guardMenuId = $derived(
    page.url.pathname.startsWith('/center/program')
      ? ('programManage' as const)
      : ('settings' as const)
  )
</script>

<MenuAccessGuard menuId={guardMenuId}>
  <!-- 타이틀은 있으면 얹고, 페이지가 소유한 화면이면 생략 —
       높이 체인(h-full → min-h-0 flex-1)은 두 경우 모두 동일해야 한다 -->
  <div class="flex h-full min-h-0 flex-col">
    {#if title}
      <PageTitleSection {title} className="mb-4 h-11 shrink-0">
        <span slot="extraBtn">
          {#if $pageAction}
            {@render $pageAction()}
          {/if}
        </span>
      </PageTitleSection>
    {/if}
    <div class="flex min-h-0 flex-1 flex-col">
      {@render children?.()}
    </div>
  </div>
</MenuAccessGuard>
