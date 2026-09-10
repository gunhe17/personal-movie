<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'

  const token = $derived(page.params.token ?? '')

  onMount(() => {
    if (token)
      goto('/accept-invitation?token=' + encodeURIComponent(token), {
        replaceState: true
      })
  })
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
  <p class="text-body-02-normal-regular text-gray-500">이동 중...</p>
</div>
