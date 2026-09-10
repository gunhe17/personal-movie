<script lang="ts">
  export let alert
</script>

<div class="px-5 py-4 flex gap-3">
  <!-- 상태 점 -->
  <div class="pt-1">
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    {#if alert.type === 'danger'}
      <span class="relative flex h-2 w-2">
        <span
          class="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"
        />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
    {:else}
      <span class="w-2 h-2 rounded-full bg-gray-300 mt-1 block" />
    {/if}
  </div>

  <!-- 내용 -->
  <div class="flex-1">
    <div class="font-medium text-sm text-gray-900">
      {alert.title}
    </div>
    {#if alert.description}
      <div class="text-xs text-gray-500 mt-0.5">
        {alert.description}
      </div>
    {/if}

    {#if alert.actions}
      <div class="flex gap-2 mt-2">
        {#each alert.actions as action}
          <button
            class="
              h-7 px-3 rounded-md text-xs font-semibold
              {action.variant === 'primary'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-200 text-gray-700'}
            "
          >
            {action.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- 시간 -->
  <div class="text-xs text-gray-400 whitespace-nowrap">
    {alert.time}
  </div>
</div>
