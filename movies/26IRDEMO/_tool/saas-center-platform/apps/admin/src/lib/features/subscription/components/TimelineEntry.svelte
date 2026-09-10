<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    dotColor?: string
    isLast?: boolean
    children: Snippet
  }

  let { dotColor = 'bg-gray-400', isLast = false, children }: Props = $props()
</script>

<div class="relative pl-7 {isLast ? '' : 'pb-6'}">
  <!-- 세로 라인 -->
  {#if !isLast}
    <div class="absolute left-[5px] top-3 bottom-0 w-0.5 bg-gray-200"></div>
  {/if}

  <!-- 도트 -->
  <div class="absolute left-0 top-1.5 h-3 w-3 rounded-full {dotColor} ring-4 ring-white"></div>

  <!-- 컨텐츠 -->
  <div>
    {@render children()}
  </div>
</div>
