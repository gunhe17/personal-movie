<script lang="ts">
  import { fly } from 'svelte/transition'
  import { snackbarStore } from '$lib/stores/snackbar'

  const typeStyles: Record<string, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-amber-600'
  }
</script>

<div class="fixed bottom-4 right-1/2 z-[10001] translate-x-1/2 flex flex-col gap-2">
  {#each $snackbarStore as item (item.id)}
    <div
      in:fly={{ y: 30, duration: 300 }}
      out:fly={{ y: 30, duration: 200 }}
      class="rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg {typeStyles[
        item.type
      ]}"
    >
      {item.message}
    </div>
  {/each}
</div>
