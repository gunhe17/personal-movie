<script lang="ts">
  export let title: string
  export let color: 'red' | 'yellow' | 'gray' = 'gray'
</script>

<div class="border-t border-gray-100">
  <div
    class="
      px-5 py-2 text-xs font-semibold flex items-center gap-2
      {color === 'red' && 'bg-status-danger-bg text-red-600'}
      {color === 'yellow' && 'bg-yellow-50 text-yellow-700'}
      {color === 'gray' && 'bg-gray-50 text-gray-600'}
    "
  >
    {title}
  </div>
  <div class="divide-y">
    <slot />
  </div>
</div>
