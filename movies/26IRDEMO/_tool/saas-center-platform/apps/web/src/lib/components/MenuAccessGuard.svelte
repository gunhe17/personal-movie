<script lang="ts">
  // 사이드바에서 숨긴 메뉴(ROLE_EXCLUDED_MENUS)를 라우트 진입에서도 강제한다.
  // 메뉴만 숨기고 라우트는 열려 있으면 URL 직접 접근으로 관리자 화면이 뚫린다.
  import { goto } from '$app/navigation'
  import { permissionStore } from '$lib/stores/permission.store'
  import { userRole, permissions } from '$lib/stores/permission.view'
  import {
    canShowSidebarMenu,
    type SidebarMenuId
  } from '$lib/config/sidebar-permissions'
  import { snackbarStore } from '$lib/stores/snackbar'

  let { menuId, children }: { menuId: SidebarMenuId; children: any } = $props()

  // null = 권한 로드 전(판정 보류), true/false = 판정 완료
  let allowed = $state<boolean | null>(null)

  $effect(() => {
    const state = $permissionStore
    const ready = state.context != null && !state.isLoading
    if (!ready) return

    const ok = canShowSidebarMenu(menuId, $permissions, $userRole)
    allowed = ok
    if (!ok) {
      snackbarStore.error('접근 권한이 없어요')
      goto('/dashboard', { replaceState: true })
    }
  })
</script>

{#if allowed}
  {@render children?.()}
{/if}
