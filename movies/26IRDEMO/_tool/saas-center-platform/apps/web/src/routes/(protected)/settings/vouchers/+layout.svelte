<script lang="ts">
  // 바우처 종류 관리는 바우처 탭 하위 서브탭 — 옛 설정 메뉴와 같은 조건(상담사 제외)을
  // voucherManage로 옮겨 라우트에도 강제한다. 사이드바에서만 숨기면 URL 직접 접근으로 뚫린다.
  import MenuAccessGuard from '$lib/components/MenuAccessGuard.svelte'

  let { children } = $props()
</script>

<MenuAccessGuard menuId="voucherManage">
  {@render children?.()}
</MenuAccessGuard>
