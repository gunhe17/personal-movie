<script lang="ts">
  // 구성원 관리는 상담사에게 메뉴가 숨겨져 있어 라우트도 막는다. (청구·설정과 동일 정책)
  import MenuAccessGuard from '$lib/components/MenuAccessGuard.svelte'

  let { children } = $props()
</script>

<MenuAccessGuard menuId="members">
  {@render children?.()}
</MenuAccessGuard>
