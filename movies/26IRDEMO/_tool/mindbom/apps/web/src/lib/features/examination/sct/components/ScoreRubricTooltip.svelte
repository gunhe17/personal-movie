<script lang="ts">
  import { SCORE_RUBRIC } from '../constants'

  let open = $state(false)
</script>

<div class="relative inline-block">
  <button
    type="button"
    onmouseenter={() => (open = true)}
    onmouseleave={() => (open = false)}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-500 hover:bg-gray-50"
    aria-label="점수 기준 보기"
  >
    ?
  </button>

  {#if open}
    <div
      class="absolute left-0 top-7 z-20 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
    >
      <div class="mb-2 text-xs font-semibold text-gray-700">SCT 채점 기준 (0-6점)</div>
      <ul class="space-y-1.5 text-xs">
        {#each SCORE_RUBRIC as r}
          <li class="flex gap-2">
            <span class="w-4 shrink-0 font-semibold text-gray-900">{r.score}</span>
            <span class="w-14 shrink-0 text-gray-700">{r.label}</span>
            <span class="text-gray-500">{r.description}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
