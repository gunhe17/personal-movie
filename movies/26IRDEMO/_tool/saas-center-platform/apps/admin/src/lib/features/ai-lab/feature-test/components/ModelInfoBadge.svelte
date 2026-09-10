<script lang="ts">
  let { model, label = '' }: { model: string | null; label?: string } = $props()
</script>

{#if model}
  <span class="inline-flex items-center gap-1 rounded bg-gray-200 px-1.5 py-0.5 text-label-01-normal-regular text-gray-600">
    {#if label}<span class="text-gray-400">{label}</span>{/if}
    {model}
  </span>
{/if}
