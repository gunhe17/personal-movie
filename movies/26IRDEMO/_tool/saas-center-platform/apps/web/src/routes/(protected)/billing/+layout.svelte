<script lang="ts">
  import MenuAccessGuard from '$lib/components/MenuAccessGuard.svelte'

  let { children } = $props()
</script>

<MenuAccessGuard menuId="billing">
  {@render children?.()}
</MenuAccessGuard>
